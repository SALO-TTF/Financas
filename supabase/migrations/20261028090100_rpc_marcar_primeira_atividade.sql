-- RPC public.marcar_primeira_atividade(p_tipo text): regista a 1.ª atividade financeira do utilizador
-- autenticado, com a hora do servidor, sem dar ao cliente escrita direta nas colunas de métricas.
--
-- DEPENDÊNCIA: 20261028090000_corrigir_permissoes_metricas.sql (o cliente não escreve as colunas).
-- Não altera dados, permissões de tabela, políticas RLS, subscrições nem outras colunas.
--
-- Segurança e limites:
--   * SECURITY DEFINER com search_path vazio; nomes totalmente qualificados; sem SQL dinâmico.
--   * Só opera sobre a linha de public.perfis do auth.uid(). Aceita apenas 'gasto' e 'rendimento'.
--   * O proprietário é quem aplica a migração; os privilégios do proprietário ficam limitados pelo
--     desenho da função (uma tabela, três UPDATE com WHERE id = auth.uid() e coluna IS NULL).
--   * `dados` é gravável pelo cliente, por isso a verificação de "array com pelo menos um registo"
--     não prova que a despesa é genuína. As métricas servem análise, nunca controlo de acesso.

begin;

create or replace function public.marcar_primeira_atividade(p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dados jsonb;
  v_array jsonb;
  v_tem_registo boolean := false;
  v_agora timestamptz := pg_catalog.now();
  v_linhas integer;
  v_marcou boolean := false;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;

  if p_tipo is null or p_tipo not in ('gasto', 'rendimento') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'tipo_invalido');
  end if;

  -- Bloqueia a linha do próprio utilizador: evita corridas entre chamadas simultâneas.
  select p.dados
    into v_dados
    from public.perfis as p
   where p.id = v_uid
     for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'perfil_nao_encontrado');
  end if;

  -- O registo tem de existir no JSONB já guardado na base de dados (e o campo tem de ser um array).
  if p_tipo = 'gasto' then
    v_array := v_dados -> 'despesas';
  else
    v_array := v_dados -> 'entradasExtra';
  end if;

  if v_array is not null then
    if pg_catalog.jsonb_typeof(v_array) = 'array' then
      v_tem_registo := pg_catalog.jsonb_array_length(v_array) > 0;
    end if;
  end if;

  if not v_tem_registo then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'sem_registo_financeiro');
  end if;

  -- Só preenche colunas vazias (idempotente); nunca sobrescreve.
  if p_tipo = 'gasto' then
    update public.perfis
       set primeiro_gasto_em = v_agora
     where id = v_uid
       and primeiro_gasto_em is null;
  else
    update public.perfis
       set primeiro_rendimento_em = v_agora
     where id = v_uid
       and primeiro_rendimento_em is null;
  end if;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    v_marcou := true;
  end if;

  update public.perfis
     set primeira_atividade_financeira_em = v_agora
   where id = v_uid
     and primeira_atividade_financeira_em is null;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    v_marcou := true;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'resultado', case when v_marcou then 'marcado' else 'ja_registado' end,
    'tipo', p_tipo
  );
exception
  when others then
    -- Erro controlado: não expõe detalhes internos; o cliente repete mais tarde.
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'erro_interno', 'sqlstate', sqlstate);
end;
$$;

comment on function public.marcar_primeira_atividade(text) is
  'Regista, com a hora do servidor, a primeira despesa ou o primeiro rendimento extra do utilizador autenticado. Só preenche colunas vazias.';

-- Execução só para authenticated (service_role mantém o acesso por defeito do Supabase).
revoke all on function public.marcar_primeira_atividade(text) from PUBLIC;
revoke all on function public.marcar_primeira_atividade(text) from anon;
grant execute on function public.marcar_primeira_atividade(text) to authenticated;

-- Verificação: anon não pode executar; authenticated pode.
do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.marcar_primeira_atividade(text)', 'EXECUTE') then
    raise exception 'anon ainda pode executar public.marcar_primeira_atividade(text). Migração revertida.';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.marcar_primeira_atividade(text)', 'EXECUTE') then
    raise exception 'authenticated não pode executar public.marcar_primeira_atividade(text). Migração revertida.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
