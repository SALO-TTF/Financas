# Klaco — Backend Supabase (spec de implementação)

Objetivo: montar o backend da Klaco no Supabase e preparar o pagamento via gateway
(AppyPay / BAI), com ativação automática por webhook. Enquanto o gateway não está fechado,
existe uma via de **ativação manual** (Opção A) para não bloquear o arranque.

Prioridades:
1. Base (tabelas, Auth, RLS, persistência de estado).
2. Ativação manual (admin) — funciona sem o gateway.
3. Webhook do gateway (caixa de correio) — deixar pronto; ativa quando houver credenciais AppyPay.

Stack alvo: Supabase (Postgres + Auth + RLS + Edge Functions). App: React (App.jsx),
atualmente com estado em localStorage e marcadores `[DEV]` nos pontos de integração.

---

## 1. Setup do projeto

- Criar projeto Supabase (free serve para arranque: 50k MAU, 500 MB DB).
- Guardar: `SUPABASE_URL`, `anon key` (app cliente), `service_role key` (só admin/server).
- **Backups:** free tier não faz. Agendar `pg_dump` (ou PITR se subir de plano). Dados de
  `pagamentos` não podem ser perdidos.
- Free tier pausa projeto após ~7 dias sem tráfego.

---

## 2. Schema (SQL Editor → correr)

```sql
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  telefone text,
  email text,
  criado_em timestamptz default now(),
  estado text not null default 'trial',       -- 'trial' | 'ativo' | 'expirado'
  plano text,                                  -- 'mensal' | 'anual' | null
  trial_inicio date default current_date,
  acesso_ate date,                             -- null enquanto trial
  dados jsonb default '{}'::jsonb,             -- estado do App.jsx
  atualizado_em timestamptz default now()
);

create table if not exists pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plano text not null,
  valor integer not null,                      -- Kz
  dentro_do_trial boolean default false,
  referencia_externa text,        -- id/ref do gateway (quando automático)
  confirmado_por text,
  criado_em timestamptz default now()
);

create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  estrelas int not null check (estrelas between 1 and 5),
  texto text,
  criado_em timestamptz default now()
);

create table if not exists convites (
  id uuid primary key default gen_random_uuid(),
  convidador_id uuid references auth.users(id) on delete set null,
  convidado_id uuid references auth.users(id) on delete set null,
  convidado_pagou boolean default false,
  mes_creditado boolean default false,
  criado_em timestamptz default now()
);
```

---

## 3. RLS

```sql
alter table perfis enable row level security;
alter table pagamentos enable row level security;
alter table avaliacoes enable row level security;
alter table convites enable row level security;

create policy perfil_sel on perfis for select using (auth.uid() = id);
create policy perfil_upd on perfis for update using (auth.uid() = id);
create policy perfil_ins on perfis for insert with check (auth.uid() = id);

create policy aval_ins on avaliacoes for insert with check (auth.uid() = user_id);
create policy aval_sel on avaliacoes for select using (auth.uid() = user_id);

create policy pag_sel on pagamentos for select using (auth.uid() = user_id);
create policy conv_sel on convites for select
  using (auth.uid() = convidador_id or auth.uid() = convidado_id);
```

Escrita em `pagamentos`/`convites` só via `service_role` (admin). Cliente não se pode
auto-ativar. **Nunca** expor `service_role` no bundle do cliente.

---

## 4. RPC de ativação (chamada pelo admin com service_role)

```sql
create or replace function ativar_pagamento(
  p_user uuid, p_plano text, p_valor integer,
  p_dentro_trial boolean, p_admin text
) returns void language plpgsql security definer as $$
declare v_ate date;
begin
  v_ate := case when p_plano = 'anual'
                then current_date + interval '1 year'
                else current_date + interval '1 month' end;

  insert into pagamentos(user_id, plano, valor, dentro_do_trial, confirmado_por)
  values (p_user, p_plano, p_valor, p_dentro_trial, p_admin);

  update perfis set estado='ativo', plano=p_plano, acesso_ate=v_ate, atualizado_em=now()
   where id = p_user;

  update convites set convidado_pagou=true where convidado_id = p_user;
end; $$;
```

Regra de preço (validar `p_valor` no admin antes de chamar):
- dentro do trial: mensal 500 / anual 5000 (`p_dentro_trial=true`)
- fora do trial: mensal 1000 / anual 10000
- mensal com desconto aplica-se só ao 1º ciclo; renovação a 1000 (lógica de renovação
  fica para o gateway; nesta fase manual, registar `dentro_do_trial` para referência).

---

## 5. Admin (ativação manual)

Página separada do app cliente (ex.: subdomínio admin), autenticada, usa `service_role`.
Requisitos mínimos:
- Lista/busca de `perfis` por telefone/email, filtrável por `estado='trial'`.
- Ação "confirmar pagamento": seletor de plano → `rpc('ativar_pagamento', {...})`.
- Tabela de `pagamentos` recentes.

Alternativa imediata sem UI: dar acesso ao Table Editor + snippet SQL guardado que chama
`ativar_pagamento(...)`. Funciona desde o dia 1; substituir por UI quando houver tempo.

---

## 6. Integração no App.jsx

Pontos marcados com `[DEV]` no código. Resumo:

1. Init `createClient(SUPABASE_URL, anonKey)`.
2. **Auth** (`AuthScreen`): email → `signUp`/`signInWithPassword`/`resetPasswordForEmail`;
   telefone → `signInWithOtp({phone})` + `verifyOtp` (SMS tem custo). No signup, upsert em
   `perfis` (nome, telefone/email, trial_inicio).
3. **Estado**: carregar `perfis.dados` no login; persistir on-change (debounce). Pode
   coexistir com localStorage como cache offline.
4. **Gate de acesso**: derivar trial/pago de `perfis.estado` + `perfis.acesso_ate`
   (`ativo` && `acesso_ate >= hoje` → acesso; senão lógica de trial atual). Não confiar só
   na contagem local.
5. **Avaliações**: `handleEnviarAvaliacao` → `insert` em `avaliacoes`
   (`{user_id, estrelas, texto}`).
6. **Convites**: signup com `?ref=CODIGO` → `insert` em `convites` (convidador+convidado).
   Crédito do mês grátis ao `convidado_pagou=true` (aplicar na renovação — fase gateway).
7. **Notificações push**: enviar só a quem tem `notifLembrete`/`notifNovidades` no estado.

---

## 7. Ordem de execução

1. Projeto + SQL (secs 2–4).
2. Auth + upsert `perfis`.
3. Persistência de estado em `perfis.dados`.
4. Admin de ativação (sec 5).
5. Avaliações + convites.
6. (Fase seguinte) Gateway AppyPay + webhook → substitui ativação manual.

---

## 8. Webhook de pagamento (esqueleto — Edge Function)

Endpoint que a AppyPay/BAI chama quando um pagamento é confirmado. Ativa o acesso
automaticamente. **Só entra em produção depois de fechar com a AppyPay** (credenciais +
formato do payload + validação de assinatura são definidos por eles). O esqueleto abaixo
deixa a "caixa de correio" pronta; ajustar os pontos marcados `AJUSTAR` conforme a doc da
AppyPay.

Criar como Edge Function: `supabase functions new appypay-webhook`
Deploy: `supabase functions deploy appypay-webhook --no-verify-jwt`
(o `--no-verify-jwt` porque quem chama é a AppyPay, não um utilizador autenticado; a
segurança faz-se pela validação da assinatura do fornecedor — ver abaixo.)

```ts
// supabase/functions/appypay-webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // 1) Ler o corpo cru (necessário para validar assinatura)
  const raw = await req.text();

  // 2) [AJUSTAR] Validar a assinatura da AppyPay.
  //    A AppyPay envia um header de assinatura/token — confirmar o nome e o método na
  //    doc deles. Rejeitar se não bater (impede pedidos falsos).
  const assinatura = req.headers.get("x-appypay-signature") ?? ""; // AJUSTAR nome do header
  const segredo = Deno.env.get("APPYPAY_WEBHOOK_SECRET") ?? "";      // guardado nos secrets
  const assinaturaOk = validarAssinatura(raw, assinatura, segredo); // AJUSTAR implementação
  if (!assinaturaOk) return new Response("Assinatura inválida", { status: 401 });

  // 3) Interpretar o payload
  const evento = JSON.parse(raw);

  // [AJUSTAR] Mapear os campos conforme o payload real da AppyPay:
  const estadoPago   = evento.status === "PAID" || evento.status === "SUCCESS"; // AJUSTAR
  const referenciaId = evento.merchant_reference; // o ID que ENVIÁMOS ao iniciar (= user_id ou ref própria)
  const plano        = evento.metadata?.plano;    // 'mensal' | 'anual' — enviado por nós na criação
  const valor        = evento.amount;             // Kz
  const dentroTrial  = evento.metadata?.dentro_trial === true;

  if (!estadoPago) return new Response("ignorado (não pago)", { status: 200 });

  // 4) Ativar o acesso — reutiliza a função ativar_pagamento (sec 4)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service_role: só no servidor, nunca no cliente
  );

  const { error } = await supabase.rpc("ativar_pagamento", {
    p_user: referenciaId,          // AJUSTAR se a ref não for diretamente o user_id
    p_plano: plano,
    p_valor: valor,
    p_dentro_trial: dentroTrial,
    p_admin: "webhook:appypay",
  });

  if (error) {
    // Devolver 500 faz a AppyPay tentar de novo (retry). Registar para auditoria.
    console.error("Falha ao ativar:", error);
    return new Response("erro ao ativar", { status: 500 });
  }

  // 5) 200 = recebido com sucesso (a AppyPay pára de reenviar)
  return new Response("ok", { status: 200 });
});

function validarAssinatura(_raw: string, _assinatura: string, _segredo: string): boolean {
  // [AJUSTAR] Implementar conforme a AppyPay (ex.: HMAC-SHA256 do corpo com o segredo,
  // comparado com o header). Enquanto não houver doc, devolver false em produção.
  return false;
}
```

Secrets a configurar (Supabase → Edge Functions → Secrets), **só depois da AppyPay**:
- `APPYPAY_WEBHOOK_SECRET` — segredo/chave de validação fornecido pela AppyPay.
- `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` — do próprio projeto.

Do lado da app (App.jsx), ao **iniciar** o pagamento, enviar à AppyPay:
- `merchant_reference` = `user_id` (ou uma ref própria mapeável ao utilizador);
- `metadata` = `{ plano, dentro_trial }`.
Assim o webhook sabe quem ativar e com que plano. **É o que liga o pagamento à conta.**

URL do webhook a registar no painel AppyPay (após deploy):
`https://<projeto>.functions.supabase.co/appypay-webhook`

> Enquanto a AppyPay não estiver fechada: a caixa fica pronta mas `validarAssinatura`
> devolve `false` (não ativa nada). A ativação real corre pela via **manual** (sec 5).

---

## Notas

- Normalizar telefone para E.164 (+244…) antes de Auth/`signInWithOtp`.
- Índices úteis: `perfis(estado)`, `perfis(telefone)`, `perfis(email)`, `pagamentos(user_id)`.
- Empresa (faturação/beneficiário): JEZ CONSULTORIA SU LDA — IBAN AO06 0040 0000 42990859101 33.
