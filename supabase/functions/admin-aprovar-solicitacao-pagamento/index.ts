// Edge Function: admin-aprovar-solicitacao-pagamento
// Aprova uma solicitação de pagamento pendente.
// Segurança: valida o Bearer token do utilizador, confirma perfis.is_admin = true,
// e SÓ ENTÃO usa a service_role (no servidor) para chamar aprovar_solicitacao_pagamento().
// A service_role NUNCA sai daqui — nunca vai para o frontend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── VALIDAÇÃO DE PLANO E MONTANTE (início) ────────────────────────────────────
// Preços oficiais em Kz. O servidor não confia no valor/plano enviados pelo cliente:
// só aprova se o montante do pedido corresponder a um preço oficial do plano.
const PRECO_MENSAL = 1000;
const PRECO_ANUAL_DESCONTO = 10000; // anual fora do teste (2 meses grátis)
const PRECO_ANUAL_NORMAL = 12000;   // preço de tabela do anual
const PRECO_ANUAL_TESTE = 6000;     // anual com 50% — só durante os 7 dias de teste (como mostrado na app)
const TRIAL_DAYS = 7;
const TOLERANCIA_DIAS = 1 / 24;     // 1 hora, para folgas de relógio

// Verifica no servidor se o pedido foi feito dentro do teste, usando perfis.trial_inicio
// (origem oficial, protegida) e a data de criação do pedido (não a data da aprovação).
// Devolve true/false, ou null se não houver dados para verificar.
function pedidoDentroDoTeste(criadoEm: unknown, trialInicio: unknown): boolean | null {
  if (!criadoEm || !trialInicio) return null;
  const pedido = new Date(criadoEm as string).getTime();
  const inicio = new Date(trialInicio as string).getTime();
  if (Number.isNaN(pedido) || Number.isNaN(inicio)) return null;
  const dias = (pedido - inicio) / 86400000;
  return dias < TRIAL_DAYS + TOLERANCIA_DIAS;
}

function validarMontante(
  plano: unknown,
  valorBruto: unknown,
  dentroDeclarado: boolean,
  dentroVerificado: boolean | null,
): { ok: boolean; motivo?: string } {
  const valor = Number(valorBruto);
  if (!Number.isInteger(valor)) return { ok: false, motivo: "Montante inválido." };
  if (plano === "mensal") {
    return valor === PRECO_MENSAL
      ? { ok: true }
      : { ok: false, motivo: `Montante ${valor} Kz incompatível com o plano mensal (${PRECO_MENSAL} Kz).` };
  }
  if (plano === "anual") {
    if (valor === PRECO_ANUAL_DESCONTO || valor === PRECO_ANUAL_NORMAL) return { ok: true };
    if (valor === PRECO_ANUAL_TESTE) {
      // Só vale se o pedido declarou teste E o servidor não contradiz (null = sem dados: mantém o comportamento atual).
      if (dentroDeclarado && dentroVerificado !== false) return { ok: true };
      return { ok: false, motivo: `O montante ${valor} Kz só é válido durante o período de teste de ${TRIAL_DAYS} dias.` };
    }
    return { ok: false, motivo: `Montante ${valor} Kz incompatível com o plano anual.` };
  }
  return { ok: false, motivo: "Plano inválido." };
}
// ── VALIDAÇÃO DE PLANO E MONTANTE (fim) ───────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Ler o token do utilizador
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Sem autorização." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2) Validar o utilizador com o token (cliente anon + token)
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3) Verificar is_admin no perfil (com service_role, leitura no servidor)
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: perfil, error: perfilErr } = await admin
      .from("perfis").select("is_admin, email").eq("id", user.id).single();
    if (perfilErr || !perfil?.is_admin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4) Ler o corpo
    const body = await req.json().catch(() => ({}));
    const pagamento_id = body?.pagamento_id;
    if (!pagamento_id) {
      return new Response(JSON.stringify({ error: "pagamento_id em falta." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4b) Validar o pedido ANTES de aprovar: tem de existir, estar pendente e ter plano/montante oficiais.
    const { data: pag, error: pagErr } = await admin
      .from("pagamentos").select("*").eq("id", pagamento_id).single();
    if (pagErr || !pag) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada." }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (pag.status !== "pendente") {
      return new Response(JSON.stringify({ error: "Solicitação já não está pendente." }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const dentroDeclarado = pag.dentro_do_trial === true;
    let dentroVerificado: boolean | null = null;
    if (pag.plano === "anual" && Number(pag.valor) === PRECO_ANUAL_TESTE) {
      const { data: perfilPag } = await admin
        .from("perfis").select("trial_inicio").eq("id", pag.user_id).single();
      dentroVerificado = pedidoDentroDoTeste(pag.criado_em ?? pag.created_at, perfilPag?.trial_inicio);
    }
    const validacao = validarMontante(pag.plano, pag.valor, dentroDeclarado, dentroVerificado);
    if (!validacao.ok) {
      return new Response(JSON.stringify({ error: `Pedido não aprovado: ${validacao.motivo}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 5) Chamar a RPC de aprovação (o email do admin vem da sessão validada, não do frontend)
    const { data, error } = await admin.rpc("aprovar_solicitacao_pagamento", {
      p_pagamento_id: pagamento_id,
      p_admin: perfil.email || user.email || "admin",
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
