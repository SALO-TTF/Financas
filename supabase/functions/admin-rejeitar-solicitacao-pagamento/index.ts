// Edge Function: admin-rejeitar-solicitacao-pagamento
// Rejeita uma solicitação de pagamento pendente.
// Segurança: valida o Bearer token do utilizador, confirma perfis.is_admin = true,
// e só então usa a service_role (no servidor) para marcar a solicitação como 'rejeitado'.
// NÃO ativa o utilizador, NÃO altera acesso_ate nem plano. A service_role nunca sai daqui.

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

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Sem autorização." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Validar utilizador
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Verificar is_admin
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: perfil, error: perfilErr } = await admin
      .from("perfis").select("is_admin, email").eq("id", user.id).single();
    if (perfilErr || !perfil?.is_admin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const pagamento_id = body?.pagamento_id;
    if (!pagamento_id) {
      return new Response(JSON.stringify({ error: "pagamento_id em falta." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Rejeitar SOMENTE se ainda estiver 'pendente'. Não toca no perfil/acesso/plano.
    const { data, error } = await admin
      .from("pagamentos")
      .update({ status: "rejeitado", confirmado_por: perfil.email || user.email || "admin", confirmado_em: new Date().toISOString() })
      .eq("id", pagamento_id)
      .eq("status", "pendente")
      .select();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Solicitação já não está pendente." }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
