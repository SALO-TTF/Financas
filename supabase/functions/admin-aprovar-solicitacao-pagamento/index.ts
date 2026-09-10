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
