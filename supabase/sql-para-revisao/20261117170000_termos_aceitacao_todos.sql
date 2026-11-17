-- KLACO — Aceitação obrigatória da versão legal vigente por TODOS os utilizadores, com histórico.
--
-- SQL INCREMENTAL. Pressupõe os três scripts já executados em produção:
--   20261116090000_termos_aceitacao.sql, 20261116090100_lembrete_diario.sql,
--   20261116090200_admin_inicio_plano.sql (não são alterados; este ficheiro não os recria).
-- PARA REVISÃO E EXECUÇÃO MANUAL. Não foi executado na base de dados real.
--
-- O que muda:
--   1) public.termos_versoes ganha a coluna opcional "conteudo" (jsonb). Fica NULL para a 1.0
--      (o texto aprovado da 1.0 está no frontend, src/legal.js). Para uma versão futura, o texto
--      é gravado aqui e a app mostra-o sem novo deploy.
--   2) Nova tabela public.termos_aceitacoes (user_id, versao, aceite_em): histórico permanente,
--      uma linha por utilizador e por versão aceite. É preenchida com as aceitações já gravadas em
--      perfis (em produção: 1 aceitação da 1.0). Os perfis NÃO são alterados.
--      O cliente não lê nem escreve; ninguém altera linhas (UPDATE bloqueado para todos os papéis);
--      DELETE só pelo postgres (pedidos de eliminação de conta).
--   3) public.aceitar_termos(p_versao): mesma assinatura e mesmas validações. Passa a aceitar SÓ a
--      versão vigente (a activa mais recente; se não houver nenhuma activa, qualquer versão
--      registada, como antes) e grava também no histórico. Continua a gravar perfis.termos_versao/
--      termos_aceites_em (última aceitação) com a hora do servidor, pela mesma via protegida.
--   4) public.termos_estado(): mesmas propriedades (ok, versao_atual, obrigatorio, aceite,
--      versao_aceite). "obrigatorio" passa a ser verdadeiro para TODOS os utilizadores sempre que
--      houver uma versão activa (deixa de depender de termos_exigencias). "aceite" = este
--      utilizador aceitou a versão vigente.
--   5) Nova public.termos_conteudo(p_versao): devolve o texto gravado de uma versão (ou null).
--   6) Protecção de public.termos_versoes (trigger), para o texto mostrado ser sempre o aceite:
--      - o texto ("conteudo") de uma versão que já foi activada ou aceite não pode ser alterado
--        (para mudar o texto, cria-se uma versão nova);
--      - uma versão diferente da 1.0 não pode ficar activa sem texto (a 1.0 usa o texto aprovado
--        do frontend). Evita que uma activação sem texto impeça todos de entrar;
--      - o código da versão não pode ser alterado.
--
-- Mantido sem alterações: activar_obrigatoriedade_termos, desactivar_obrigatoriedade_termos,
-- proteger_colunas_termos (trigger em perfis), RLS e permissões existentes, lembretes e admin.
-- termos_exigencias e o trigger marcar_exigencia_termos ficam como estão (compatibilidade); já não
-- decidem quem é obrigado.
--
-- Pode ser executado mais do que uma vez sem duplicar dados.

begin;

-- 1) Texto opcional por versão -----------------------------------------------------------------
alter table public.termos_versoes add column if not exists conteudo jsonb;

-- 1b) Protecção das versões --------------------------------------------------------------------
create or replace function public.proteger_versoes_termos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.versao is distinct from old.versao then
      raise exception 'o código de uma versão legal não pode ser alterado' using errcode = '42501';
    end if;
    if new.conteudo is distinct from old.conteudo
       and (old.activa or old.activada_em is not null
            or exists (select 1 from public.termos_aceitacoes as a where a.versao = old.versao)) then
      raise exception 'o texto da versão % já foi publicado ou aceite e não pode ser alterado; criar uma versão nova', old.versao
        using errcode = '42501';
    end if;
  end if;
  if new.activa and new.conteudo is null and new.versao <> '1.0' then
    raise exception 'a versão % não pode ser activada sem texto (gravar primeiro a coluna conteudo)', new.versao
      using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 2) Histórico de aceitações -------------------------------------------------------------------
create table if not exists public.termos_aceitacoes (
  user_id   uuid        not null,
  versao    text        not null references public.termos_versoes (versao),
  aceite_em timestamptz not null default pg_catalog.now(),
  primary key (user_id, versao)
);
alter table public.termos_aceitacoes enable row level security;   -- sem políticas: o cliente não lê nem escreve
revoke all on table public.termos_aceitacoes from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on table public.termos_aceitacoes from service_role;

-- Preencher com as aceitações já gravadas nos perfis (só leitura dos perfis; não os altera).
drop trigger if exists bloquear_alteracao_aceitacoes on public.termos_aceitacoes;
insert into public.termos_aceitacoes (user_id, versao, aceite_em)
select p.id, p.termos_versao, p.termos_aceites_em
  from public.perfis as p
 where p.termos_versao is not null
   and p.termos_aceites_em is not null
   and exists (select 1 from public.termos_versoes as v where v.versao = p.termos_versao)
on conflict (user_id, versao) do nothing;

-- Histórico permanente: ninguém altera linhas; só o postgres apaga (eliminação de conta a pedido).
create or replace function public.bloquear_alteracao_aceitacoes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'o histórico de aceitações não pode ser alterado' using errcode = '42501';
  end if;
  if current_user <> 'postgres' then
    raise exception 'o histórico de aceitações só pode ser apagado pelo administrador da base de dados'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger bloquear_alteracao_aceitacoes
  before update or delete on public.termos_aceitacoes
  for each row execute function public.bloquear_alteracao_aceitacoes();

drop trigger if exists proteger_versoes_termos on public.termos_versoes;
create trigger proteger_versoes_termos
  before insert or update on public.termos_versoes
  for each row execute function public.proteger_versoes_termos();

-- 3) Aceitar: só a versão vigente; grava perfil (última) + histórico ----------------------------
-- A gravação no perfil continua a passar pelo trigger proteger_colunas_termos, que exige o papel
-- do proprietário desta função (postgres), o auth.uid() dono do perfil e o marcador da transacção.
create or replace function public.aceitar_termos(p_versao text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vigente text;
  v_atual text;
  v_quando timestamptz;
  v_hist timestamptz;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;
  if p_versao is null or not exists (select 1 from public.termos_versoes v where v.versao = p_versao) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_invalida');
  end if;

  -- Só se aceita a versão vigente (a que a app mostrou depois de perguntar a termos_estado).
  select t.versao into v_vigente from public.termos_versoes as t
   where t.activa order by t.activada_em desc, t.versao desc limit 1;
  if v_vigente is not null and p_versao <> v_vigente then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_nao_vigente', 'versao_vigente', v_vigente);
  end if;

  select p.termos_versao, p.termos_aceites_em into v_atual, v_quando
    from public.perfis as p where p.id = v_uid for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'perfil_nao_encontrado');
  end if;

  -- Já aceite antes (histórico).
  select a.aceite_em into v_hist from public.termos_aceitacoes as a
   where a.user_id = v_uid and a.versao = p_versao;
  if v_hist is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'ja_aceite', true, 'versao', p_versao, 'aceite_em', v_hist);
  end if;

  -- Já aceite antes do histórico existir: regista no histórico com a data original.
  if v_atual = p_versao and v_quando is not null then
    insert into public.termos_aceitacoes (user_id, versao, aceite_em) values (v_uid, p_versao, v_quando)
    on conflict (user_id, versao) do nothing;
    return pg_catalog.jsonb_build_object('ok', true, 'ja_aceite', true, 'versao', p_versao, 'aceite_em', v_quando);
  end if;

  perform pg_catalog.set_config('klaco.termos_autorizacao',
    pg_catalog.pg_current_xact_id()::text || ':' || v_uid::text, true);

  update public.perfis
     set termos_aceites_em = pg_catalog.now(), termos_versao = p_versao
   where id = v_uid
  returning termos_aceites_em into v_quando;

  perform pg_catalog.set_config('klaco.termos_autorizacao', '', true);

  insert into public.termos_aceitacoes (user_id, versao, aceite_em) values (v_uid, p_versao, v_quando)
  on conflict (user_id, versao) do nothing;

  return pg_catalog.jsonb_build_object('ok', true, 'ja_aceite', false, 'versao', p_versao, 'aceite_em', v_quando);
end;
$$;

-- 4) Estado: obrigatório para todos quando há versão activa ------------------------------------
create or replace function public.termos_estado()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_versao_atual text;
  v_aceite_versao text;
  v_aceite_em timestamptz;
  v_aceite boolean := false;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;

  select t.versao into v_versao_atual from public.termos_versoes as t
   where t.activa order by t.activada_em desc, t.versao desc limit 1;
  select p.termos_versao, p.termos_aceites_em into v_aceite_versao, v_aceite_em
    from public.perfis as p where p.id = v_uid;

  if v_versao_atual is not null then
    v_aceite := exists (select 1 from public.termos_aceitacoes as a
                         where a.user_id = v_uid and a.versao = v_versao_atual)
             or (v_aceite_em is not null and v_aceite_versao = v_versao_atual);
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'versao_atual', v_versao_atual,
    'obrigatorio', (v_versao_atual is not null),
    'aceite', v_aceite,
    'versao_aceite', v_aceite_versao
  );
end;
$$;

-- 5) Texto de uma versão (para versões futuras gravadas na base de dados) -----------------------
create or replace function public.termos_conteudo(p_versao text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conteudo jsonb;
begin
  if auth.uid() is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;
  select t.conteudo into v_conteudo from public.termos_versoes as t where t.versao = p_versao;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_invalida');
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'versao', p_versao, 'conteudo', v_conteudo);
end;
$$;

-- 6) Permissões --------------------------------------------------------------------------------
revoke all on function public.aceitar_termos(text) from PUBLIC, anon;
revoke all on function public.termos_estado() from PUBLIC, anon;
revoke all on function public.termos_conteudo(text) from PUBLIC, anon;
grant execute on function public.aceitar_termos(text) to authenticated;
grant execute on function public.termos_estado() to authenticated;
grant execute on function public.termos_conteudo(text) to authenticated;
revoke all on function public.bloquear_alteracao_aceitacoes() from PUBLIC, anon, authenticated;
revoke all on function public.proteger_versoes_termos() from PUBLIC, anon, authenticated;

commit;
