-- Lembrete diário INTERNO (fica na lista de notificações da app). Não é notificação push.
--
-- PARA REVISÃO E EXECUÇÃO MANUAL. Não foi executado em nenhuma base de dados real.
-- Usa as colunas indicadas pelo dev em public.notificacoes:
--   id, user_id, titulo, mensagem, tipo, criada_em, lida, lida_em, chave_evento
-- Pressupõe que id tem valor por omissão (como já acontece com as notificações geradas hoje).
-- Não altera a estrutura de nenhuma tabela.
--
-- public.registar_lembrete_diario(p_valor numeric):
--   * só para o utilizador autenticado (auth.uid());
--   * só se o consentimento estiver ligado no estado guardado: perfis.dados->'notifLembrete' = true;
--   * um por dia, com a data de Africa/Luanda: chave_evento = 'lembrete_diario:AAAA-MM-DD';
--     a linha do perfil é bloqueada (FOR UPDATE) para duas chamadas simultâneas não duplicarem;
--   * p_valor é o "Podes gastar hoje" calculado na app (o cálculo vive no frontend e os dados em
--     perfis.dados, que o próprio utilizador escreve). Só se aceita um número entre 0 e 1e12.
--   * Reconhece também os lembretes financeiros já observados na produção, criados com
--     tipo='sistema' e chave_evento='lembrete_financeiro:AAAA-MM-DD'.
--     Se já existir um lembrete desse dia para o utilizador, não cria outro.
--     NOTA: esta verificação evita duplicados sequenciais, mas não garante exclusão
--     mútua com a Edge Function gerar-lembretes em execuções simultâneas; essa função
--     terá de adoptar a mesma regra de deduplicação para garantia completa.

begin;

create or replace function public.registar_lembrete_diario(p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dados jsonb;
  v_dia date := (pg_catalog.now() at time zone 'Africa/Luanda')::date;
  v_inicio_dia timestamptz;
  v_chave text;
  v_valor numeric;
  v_texto text;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;
  if p_valor is null or p_valor < 0 or p_valor > 1000000000000 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'valor_invalido');
  end if;

  select p.dados into v_dados from public.perfis as p where p.id = v_uid for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'perfil_nao_encontrado');
  end if;
  if coalesce(v_dados -> 'notifLembrete', 'false'::jsonb) <> 'true'::jsonb then
    return pg_catalog.jsonb_build_object('ok', true, 'criada', false, 'codigo', 'sem_consentimento');
  end if;

  v_chave := 'lembrete_diario:' || pg_catalog.to_char(v_dia, 'YYYY-MM-DD');
  if exists (select 1 from public.notificacoes as n where n.user_id = v_uid and n.chave_evento = v_chave) then
    return pg_catalog.jsonb_build_object('ok', true, 'criada', false, 'codigo', 'ja_existe');
  end if;

  -- Já há um lembrete de hoje (Luanda) criado por outra via, por exemplo gerar-lembretes.
  v_inicio_dia := v_dia::timestamp at time zone 'Africa/Luanda';
  if exists (
    select 1 from public.notificacoes as n
     where n.user_id = v_uid
       and n.criada_em >= v_inicio_dia
       and n.criada_em <  v_inicio_dia + interval '1 day'
       and (
         pg_catalog.lower(coalesce(n.tipo, '')) like '%lembrete%'
         or n.chave_evento = v_chave
         or n.chave_evento = 'lembrete_financeiro:' || pg_catalog.to_char(v_dia, 'YYYY-MM-DD')
       )
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'criada', false, 'codigo', 'ja_existe_lembrete_hoje');
  end if;

  v_valor := pg_catalog.floor(p_valor);
  if v_valor > 0 then
    v_texto := 'Hoje podes gastar '
      || pg_catalog.replace(pg_catalog.to_char(v_valor, 'FM999,999,999,999,990'), ',', '.')
      || ' Kz. Regista os teus gastos e entradas para o número ficar certo.';
  else
    v_texto := 'Hoje não tens margem para gastar. Abre a Klaco para veres o teu plano.';
  end if;

  insert into public.notificacoes (user_id, titulo, mensagem, tipo, criada_em, lida, chave_evento)
  values (v_uid, 'Lembrete diário', v_texto, 'lembrete', pg_catalog.now(), false, v_chave);

  return pg_catalog.jsonb_build_object('ok', true, 'criada', true, 'chave_evento', v_chave);
end;
$$;

revoke all on function public.registar_lembrete_diario(numeric) from PUBLIC, anon;
grant execute on function public.registar_lembrete_diario(numeric) to authenticated;

commit;

-- OPCIONAL (recomendado, só depois de confirmar que não há duplicados já gravados):
-- create unique index if not exists notificacoes_user_chave_evento_unq
--   on public.notificacoes (user_id, chave_evento) where chave_evento is not null;
