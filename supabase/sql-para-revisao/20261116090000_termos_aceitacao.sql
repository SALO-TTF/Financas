-- Aceitação dos Termos de Uso: hora do servidor, versão aceite e activação EXPLÍCITA da obrigatoriedade.
--
-- PARA REVISÃO E EXECUÇÃO MANUAL. Não foi executado em nenhuma base de dados real.
-- Pressupõe (como indicado pelo dev): public.perfis.termos_aceites_em TIMESTAMPTZ NULL e
-- public.perfis.termos_versao TEXT NULL já existem. Não altera nem apaga nenhuma linha existente.
--
-- INSTALAR ANTES DA PUBLICAÇÃO: este script NÃO activa a obrigatoriedade. A versão 1.0 fica
-- registada como INACTIVA. Com ela inactiva, ninguém é obrigado a aceitar (a aceitação, se for
-- feita, é guardada na mesma).
--
-- ACTIVAR (no Supabase, SQL Editor, depois de o novo frontend estar publicado):
--     select public.activar_obrigatoriedade_termos('1.0');
-- DESACTIVAR (reverter):
--     select public.desactivar_obrigatoriedade_termos('1.0');
-- Estas duas funções não podem ser chamadas pela app (anon/authenticated) nem pela service_role.
--
-- Quem fica obrigado (sem depender da data de criação da conta):
--   * no momento em que a linha de public.perfis da conta é criada (registo), um trigger vê, com
--     bloqueio, se há uma versão activa; se houver, regista essa conta em public.termos_exigencias.
--   * a activação e o registo de contas disputam o mesmo bloqueio (linhas de termos_versoes), por
--     isso cada conta fica de um lado ou do outro da activação, mesmo no mesmo segundo:
--       - registo concluído antes de a activação terminar → não obrigado;
--       - registo depois de a activação terminar → obrigado.
--   * contas existentes e contas criadas entre a instalação e a activação nunca são registadas,
--     por isso nunca são obrigadas.
--   * termos_estado() só diz "obrigatório" se a conta estiver em termos_exigencias E a versão
--     continuar activa. Depois de desactivar, ninguém é obrigado.
--
-- Protecção das colunas (mantida da versão anterior): só public.aceitar_termos grava
-- termos_aceites_em/termos_versao, com now() do servidor e uma versão registada, para a linha do
-- próprio utilizador. Nenhum papel as altera directamente.

begin;

-- 1) Versões dos Termos --------------------------------------------------------------------------
create table if not exists public.termos_versoes (
  versao         text primary key,
  activa         boolean not null default false,
  activada_em    timestamptz,
  desactivada_em timestamptz,
  criada_em      timestamptz not null default pg_catalog.now()
);
-- Compatibilidade, caso uma versão anterior deste script tenha sido instalada nalgum ambiente:
alter table public.termos_versoes add column if not exists activa boolean not null default false;
alter table public.termos_versoes add column if not exists activada_em timestamptz;
alter table public.termos_versoes add column if not exists desactivada_em timestamptz;
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'termos_versoes' and column_name = 'obrigatoria_desde') then
    alter table public.termos_versoes alter column obrigatoria_desde drop not null;
    alter table public.termos_versoes alter column obrigatoria_desde drop default;
  end if;
end
$$;

alter table public.termos_versoes enable row level security;  -- sem políticas: o cliente não lê nem escreve
revoke all on table public.termos_versoes from PUBLIC, anon, authenticated;

-- Registar a versão 1.0 INACTIVA. Voltar a executar o script não a activa nem a desactiva.
insert into public.termos_versoes (versao, activa) values ('1.0', false)
on conflict (versao) do nothing;

-- 2) Contas obrigadas a aceitar ------------------------------------------------------------------
create table if not exists public.termos_exigencias (
  user_id    uuid primary key,
  versao     text not null,
  marcada_em timestamptz not null default pg_catalog.now()
);
alter table public.termos_exigencias enable row level security;  -- sem políticas
revoke all on table public.termos_exigencias from PUBLIC, anon, authenticated;

-- Corre quando a linha do perfil é criada (registo da conta). SECURITY DEFINER porque o cliente
-- não escreve em termos_exigencias. Bloqueia TODAS as linhas de termos_versoes (FOR SHARE) para
-- esperar por uma activação/desactivação em curso e ler o estado já confirmado.
create or replace function public.marcar_exigencia_termos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_versao text;
  v_quando timestamptz;
begin
  for v in select t.versao, t.activa, t.activada_em from public.termos_versoes as t for share loop
    if v.activa and (v_quando is null or v.activada_em > v_quando) then
      v_versao := v.versao;
      v_quando := v.activada_em;
    end if;
  end loop;

  if v_versao is not null then
    insert into public.termos_exigencias (user_id, versao) values (new.id, v_versao)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists marcar_exigencia_termos on public.perfis;
create trigger marcar_exigencia_termos
  after insert on public.perfis
  for each row execute function public.marcar_exigencia_termos();

-- 3) Activar / desactivar (só pelo SQL Editor; a app não consegue chamar) -------------------------
create or replace function public.activar_obrigatoriedade_termos(p_versao text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_activa boolean;
begin
  select t.activa into v_activa from public.termos_versoes as t where t.versao = p_versao for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_inexistente');
  end if;
  if v_activa then
    return pg_catalog.jsonb_build_object('ok', true, 'codigo', 'ja_activa');
  end if;
  update public.termos_versoes
     set activa = true, activada_em = pg_catalog.now(), desactivada_em = null
   where versao = p_versao;
  return pg_catalog.jsonb_build_object('ok', true, 'codigo', 'activada', 'versao', p_versao, 'activada_em', pg_catalog.now());
end;
$$;

create or replace function public.desactivar_obrigatoriedade_termos(p_versao text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_activa boolean;
begin
  select t.activa into v_activa from public.termos_versoes as t where t.versao = p_versao for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_inexistente');
  end if;
  if not v_activa then
    return pg_catalog.jsonb_build_object('ok', true, 'codigo', 'ja_inactiva');
  end if;
  update public.termos_versoes
     set activa = false, desactivada_em = pg_catalog.now()
   where versao = p_versao;
  return pg_catalog.jsonb_build_object('ok', true, 'codigo', 'desactivada', 'versao', p_versao);
end;
$$;

-- 4) Protecção das colunas de aceitação -----------------------------------------------------------
revoke insert (termos_aceites_em, termos_versao) on table public.perfis from PUBLIC, anon, authenticated;
revoke update (termos_aceites_em, termos_versao) on table public.perfis from PUBLIC, anon, authenticated;

-- INSERT normal com ambos os campos NULL e UPDATE que não altera esses campos são permitidos.
-- Para gravar uma aceitação exige-se simultaneamente: papel efectivo do proprietário
-- da RPC SECURITY DEFINER, utilizador autenticado dono do perfil, marcador da
-- transacção e data/versão válidas. O marcador NÃO é uma credencial de segurança.
-- IMPORTANTE: manter a RPC sob proprietário privilegiado (postgres) e não conceder
-- privilégios de UPDATE nas colunas de aceitação aos papéis anon/authenticated.
create or replace function public.proteger_colunas_termos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_aut text := pg_catalog.current_setting('klaco.termos_autorizacao', true);
begin
  if tg_op = 'INSERT' then
    if new.termos_aceites_em is null and new.termos_versao is null then
      return new;
    end if;
  elsif new.termos_aceites_em is not distinct from old.termos_aceites_em
    and new.termos_versao is not distinct from old.termos_versao then
    return new;
  end if;

  -- A variável de sessão pode ser falsificada. Só é aceite em conjunto com
  -- o papel efectivo privilegiado da RPC e o UID do dono do perfil.
  -- Isto pressupõe que a RPC é instalada pelo postgres no SQL Editor.
  if current_user <> 'postgres'
     or current_user <> (
       select pg_catalog.pg_get_userbyid(p.proowner)
       from pg_catalog.pg_proc as p
       where p.oid = 'public.aceitar_termos(text)'::pg_catalog.regprocedure
     )
     or auth.uid() is distinct from new.id
     or v_aut is null
     or v_aut <> (pg_catalog.pg_current_xact_id()::text || ':' || new.id::text) then
    raise exception 'termos_aceites_em/termos_versao só podem ser gravados por public.aceitar_termos'
      using errcode = '42501';
  end if;

  if new.termos_aceites_em is distinct from pg_catalog.now()
     or new.termos_versao is null
     or not exists (select 1 from public.termos_versoes as v where v.versao = new.termos_versao) then
    raise exception 'aceitação dos termos inválida (data ou versão)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_colunas_termos on public.perfis;
create trigger proteger_colunas_termos
  before insert or update on public.perfis
  for each row execute function public.proteger_colunas_termos();

-- 5) Aceitar (sem alterações) --------------------------------------------------------------------
-- Aceita qualquer versão registada, activa ou não: quem marca o visto antes da activação fica com
-- a aceitação guardada na mesma.
create or replace function public.aceitar_termos(p_versao text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_atual text;
  v_quando timestamptz;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;
  if p_versao is null or not exists (select 1 from public.termos_versoes v where v.versao = p_versao) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'versao_invalida');
  end if;

  select p.termos_versao, p.termos_aceites_em into v_atual, v_quando
    from public.perfis as p where p.id = v_uid for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'perfil_nao_encontrado');
  end if;

  if v_atual = p_versao and v_quando is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'ja_aceite', true, 'versao', v_atual, 'aceite_em', v_quando);
  end if;

  perform pg_catalog.set_config('klaco.termos_autorizacao',
    pg_catalog.pg_current_xact_id()::text || ':' || v_uid::text, true);

  update public.perfis
     set termos_aceites_em = pg_catalog.now(), termos_versao = p_versao
   where id = v_uid
  returning termos_aceites_em into v_quando;

  perform pg_catalog.set_config('klaco.termos_autorizacao', '', true);

  return pg_catalog.jsonb_build_object('ok', true, 'ja_aceite', false, 'versao', p_versao, 'aceite_em', v_quando);
end;
$$;

-- 6) Estado para a app (mesma resposta de antes: ok, versao_atual, obrigatorio, aceite, versao_aceite)
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
  v_exigida boolean;
  v_aceite_versao text;
  v_aceite_em timestamptz;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'nao_autenticado');
  end if;

  select t.versao into v_versao_atual from public.termos_versoes as t
   where t.activa order by t.activada_em desc, t.versao desc limit 1;
  select exists (select 1 from public.termos_exigencias as e where e.user_id = v_uid) into v_exigida;
  select p.termos_versao, p.termos_aceites_em into v_aceite_versao, v_aceite_em
    from public.perfis as p where p.id = v_uid;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'versao_atual', v_versao_atual,
    'obrigatorio', (v_versao_atual is not null and v_exigida),
    'aceite', (v_aceite_em is not null and v_versao_atual is not null and v_aceite_versao = v_versao_atual),
    'versao_aceite', v_aceite_versao
  );
end;
$$;

-- 7) Permissões ----------------------------------------------------------------------------------
-- Apenas authenticated pode executar as RPCs de consulta/aceitação.
-- As funções administrativas permanecem inacessíveis à API pública.
-- Nota: confirmar que o proprietário das RPCs criadas é postgres antes do deploy.
revoke all on function public.aceitar_termos(text) from PUBLIC, anon;
revoke all on function public.termos_estado() from PUBLIC, anon;
grant execute on function public.aceitar_termos(text) to authenticated;
grant execute on function public.termos_estado() to authenticated;
revoke all on function public.proteger_colunas_termos() from PUBLIC, anon, authenticated;
revoke all on function public.marcar_exigencia_termos() from PUBLIC, anon, authenticated;
revoke all on function public.activar_obrigatoriedade_termos(text) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.desactivar_obrigatoriedade_termos(text) from PUBLIC, anon, authenticated, service_role;

commit;
