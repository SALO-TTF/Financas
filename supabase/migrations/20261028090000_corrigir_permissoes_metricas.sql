-- Corretiva de permissões em public.perfis: métricas e origem passam a ser escritas só por RPC.
--
-- DEPENDÊNCIA: 20261027120000_proteger_perfis.sql concedia INSERT/UPDATE por coluna a authenticated
-- em origem_registo, primeira_atividade_financeira_em, primeiro_gasto_em e primeiro_rendimento_em.
-- Esse desenho foi substituído pelas RPC das migrações 20261028090100 e 20261028090200.
--
-- Esta migração NÃO assume que a anterior foi (ou não) aplicada, e é idempotente:
--   * se a anterior foi aplicada, revoga as concessões indevidas;
--   * se não foi, não faz nada de mal (REVOKE de um privilégio inexistente é um no-op);
--   * se as colunas ainda forem escritáveis no fim (por exemplo por um privilégio ao nível da
--     TABELA, que um REVOKE por coluna não remove), o bloco de verificação aborta e reverte tudo.
-- Não altera dados, políticas RLS, is_admin nem permissões de service_role.
-- Não é necessário executá-la para o React funcionar com as RPC; é necessária para que o cliente
-- NÃO consiga escrever estas colunas diretamente.

begin;

-- 1) Métricas e origem: nenhum papel de cliente escreve diretamente.
revoke insert (origem_registo, primeira_atividade_financeira_em, primeiro_gasto_em, primeiro_rendimento_em)
  on table public.perfis from PUBLIC, anon, authenticated;
revoke update (origem_registo, primeira_atividade_financeira_em, primeiro_gasto_em, primeiro_rendimento_em)
  on table public.perfis from PUBLIC, anon, authenticated;

-- 2) Colunas privilegiadas: o cliente nunca as escreve (reforço; não concede nada).
revoke insert (is_admin, estado, plano, trial_inicio, acesso_ate)
  on table public.perfis from PUBLIC, anon, authenticated;
revoke update (is_admin, estado, plano, trial_inicio, acesso_ate)
  on table public.perfis from PUBLIC, anon, authenticated;

-- 3) anon nunca escreve em perfis (nenhum fluxo da app o exige).
revoke insert, update, delete on table public.perfis from anon;

-- 4) Verificação: se algum destes privilégios ainda existir (coluna OU tabela), reverte a migração.
--    has_column_privilege considera também privilégios herdados da tabela e de PUBLIC.
do $$
declare
  v_papel text;
  v_coluna text;
  v_priv text;
begin
  foreach v_papel in array array['anon', 'authenticated'] loop
    foreach v_coluna in array array[
      'is_admin', 'estado', 'plano', 'trial_inicio', 'acesso_ate',
      'origem_registo', 'primeira_atividade_financeira_em', 'primeiro_gasto_em', 'primeiro_rendimento_em'
    ] loop
      foreach v_priv in array array['INSERT', 'UPDATE'] loop
        if pg_catalog.has_column_privilege(v_papel, 'public.perfis', v_coluna, v_priv) then
          raise exception 'Privilégio % indevido de % em public.perfis.% (provavelmente ao nível da tabela). Migração revertida: confirmar as permissões atuais antes de repetir.',
            v_priv, v_papel, v_coluna;
        end if;
      end loop;
    end loop;
  end loop;
end
$$;

commit;
