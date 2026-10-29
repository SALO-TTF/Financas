-- RPC public.guardar_origem_registo(p_origem text): preenche origem_registo do utilizador autenticado,
-- só quando estiver vazia e só com um valor válido. SEPARADA das métricas: não é necessária para elas.
--
-- DEPENDÊNCIA: 20261028090000_corrigir_permissoes_metricas.sql (o cliente não escreve a coluna).
-- Sem esta migração, o React continua a funcionar: a origem simplesmente não é gravada (o erro fica
-- só na consola) e as métricas de atividade não são afetadas.
--
-- A origem vem do cliente (?o= no URL), por isso NÃO é uma fonte de confiança e nunca deve ser usada
-- para autorização ou controlo de acesso. Serve apenas para análise de aquisição.

begin;

create or replace function public.guardar_origem_registo(p_origem text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_origem text;
  v_linhas integer;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;

  v_origem := pg_catalog.lower(pg_catalog.btrim(p_origem));
  if v_origem is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'origem_invalida');
  end if;
  -- Mesmo formato que o frontend aceita: letras minúsculas, números, "-" e "_" (1 a 40).
  if v_origem !~ '^[a-z0-9_-]{1,40}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'origem_invalida');
  end if;

  update public.perfis
     set origem_registo = v_origem
   where id = v_uid
     and origem_registo is null;
  get diagnostics v_linhas = row_count;

  if v_linhas > 0 then
    return pg_catalog.jsonb_build_object('ok', true, 'resultado', 'marcado');
  end if;

  perform 1 from public.perfis as p where p.id = v_uid;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'perfil_nao_encontrado');
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'resultado', 'ja_registado');
exception
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'erro_interno', 'sqlstate', sqlstate);
end;
$$;

comment on function public.guardar_origem_registo(text) is
  'Preenche origem_registo do utilizador autenticado só se estiver vazia e o valor for válido. Origem fornecida pelo cliente: não usar para autorização.';

revoke all on function public.guardar_origem_registo(text) from PUBLIC;
revoke all on function public.guardar_origem_registo(text) from anon;
grant execute on function public.guardar_origem_registo(text) to authenticated;

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.guardar_origem_registo(text)', 'EXECUTE') then
    raise exception 'anon ainda pode executar public.guardar_origem_registo(text). Migração revertida.';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.guardar_origem_registo(text)', 'EXECUTE') then
    raise exception 'authenticated não pode executar public.guardar_origem_registo(text). Migração revertida.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
