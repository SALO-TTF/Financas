-- Admin: data do último pagamento APROVADO de um utilizador ("Pagamento confirmado em").
--
-- PARA REVISÃO E EXECUÇÃO MANUAL. Não foi executado em nenhuma base de dados real.
-- Mantém o nome e a assinatura public.admin_inicio_plano(uuid) → jsonb, por isso substitui uma
-- versão anterior (se tiver sido criada) com CREATE OR REPLACE.
--
-- Usa apenas public.pagamentos (user_id, status, confirmado_em, criado_em, id) e public.perfis
-- (id, is_admin). Só leitura: não altera pagamentos, planos, validade nem perfis.
--
-- Regras:
--   * só administradores (perfis.is_admin = true do auth.uid()); outros recebem 'sem_permissao';
--   * conta apenas status = 'aprovado' com confirmado_em preenchido. Os rejeitados também têm
--     confirmado_em e ficam de fora. CONFIRMAR que 'aprovado' é o valor gravado na aprovação;
--   * devolve a data de confirmado_em convertida para Africa/Luanda (AAAA-MM-DD) e o timestamp
--     original; não depende de acesso_ate nem do plano do perfil;
--   * sem pagamento aprovado → data = null (o painel mostra "Não disponível").
--
-- Segurança: SECURITY DEFINER com search_path vazio, nomes qualificados, sem SQL dinâmico;
-- EXECUTE só para authenticated (revogado de PUBLIC e anon).

begin;

create or replace function public.admin_inicio_plano(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_id uuid;
  v_confirmado timestamptz;
begin
  select p.is_admin into v_admin from public.perfis as p where p.id = auth.uid();
  if coalesce(v_admin, false) is not true then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  if p_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'utilizador_invalido');
  end if;

  select g.id, g.confirmado_em into v_id, v_confirmado
    from public.pagamentos as g
   where g.user_id = p_user_id
     and g.status = 'aprovado'
     and g.confirmado_em is not null
   order by g.confirmado_em desc, g.criado_em desc
   limit 1;

  if v_confirmado is null then
    return pg_catalog.jsonb_build_object('ok', true, 'data', null, 'codigo', 'sem_pagamento_aprovado');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'data', pg_catalog.to_char((v_confirmado at time zone 'Africa/Luanda')::date, 'YYYY-MM-DD'),
    'confirmado_em', v_confirmado,
    'pagamento_id', v_id
  );
end;
$$;

revoke all on function public.admin_inicio_plano(uuid) from PUBLIC, anon;
grant execute on function public.admin_inicio_plano(uuid) to authenticated;

commit;
