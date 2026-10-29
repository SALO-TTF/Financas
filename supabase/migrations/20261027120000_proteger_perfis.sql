-- Proteger public.perfis contra escrita de colunas privilegiadas pelo cliente.
--
-- O cliente autenticado continua limitado à própria linha (RLS existente, não alterada) e passa a
-- poder escrever SÓ as colunas que o frontend já usa. As colunas server-authoritative
-- (is_admin, estado, plano, acesso_ate, trial_inicio, criado_em) ficam sem privilégio de escrita
-- para anon/authenticated, tanto em UPDATE como em INSERT/UPSERT.
--
-- Não apaga nem recria a tabela, não altera dados, não altera valores de is_admin e não toca em
-- service_role, nas políticas RLS, nos triggers nem nas funções SECURITY DEFINER.
-- Idempotente: pode ser aplicada mais do que uma vez.

begin;

-- RLS mantém-se ativa (as políticas existentes limitam cada utilizador à própria linha).
alter table public.perfis enable row level security;

-- 1) Retirar a escrita a nível de tabela. O REVOKE de tabela remove também quaisquer grants por coluna.
--    DELETE: o frontend nunca apaga perfis; sem DELETE o utilizador não consegue apagar a própria
--    linha e voltar a inseri-la para reiniciar o trial. Se preferires não incluir, remove a linha DELETE.
revoke insert, update, delete on table public.perfis from authenticated;
revoke insert, update, delete on table public.perfis from anon;

-- 2) Leitura mantém-se (a RLS limita à própria linha). O frontend lê is_admin, estado, plano, etc.
grant select on table public.perfis to authenticated;

-- 3) Escrita só nas colunas que o frontend já utiliza.
--    "id" está incluída porque o upsert (.upsert(payload, { onConflict: "id" })) gera
--    INSERT ... ON CONFLICT (id) DO UPDATE SET ..., que precisa de privilégio sobre as colunas
--    enviadas; a RLS continua a impedir que o utilizador escreva noutra linha.
grant insert (
  id, email, nome, telefone, dados, atualizado_em,
  origem_registo, primeira_atividade_financeira_em, primeiro_gasto_em, primeiro_rendimento_em
) on table public.perfis to authenticated;

grant update (
  id, email, nome, telefone, dados, atualizado_em,
  origem_registo, primeira_atividade_financeira_em, primeiro_gasto_em, primeiro_rendimento_em
) on table public.perfis to authenticated;

-- 4) service_role mantém acesso total (Edge Functions e RPCs administrativas).
grant all on table public.perfis to service_role;

commit;

-- Reversão, se for necessária (repõe os privilégios amplos anteriores):
--   grant insert, update, delete on table public.perfis to authenticated;
