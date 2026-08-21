// ============================================================================
// Klaco — Webhook de pagamento (AppyPay / BAI)
// ----------------------------------------------------------------------------
// Edge Function do Supabase. Recebe a confirmação de pagamento do gateway e
// ativa o acesso do utilizador automaticamente.
//
// Criar:  supabase functions new appypay-webhook
//         (colar este ficheiro em supabase/functions/appypay-webhook/index.ts)
// Deploy: supabase functions deploy appypay-webhook --no-verify-jwt
//
// ⚠️ Só entra em produção depois de fechar com a AppyPay. Os pontos marcados
//    [AJUSTAR] dependem da documentação/credenciais deles. Enquanto não houver,
//    validarAssinatura() devolve false e nada é ativado (a via manual cobre).
// ============================================================================

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1) Corpo cru — necessário para validar a assinatura
  const raw = await req.text();

  // 2) [AJUSTAR] Validar a assinatura da AppyPay (nome do header + método).
  const assinatura = req.headers.get("x-appypay-signature") ?? ""; // [AJUSTAR]
  const segredo = Deno.env.get("APPYPAY_WEBHOOK_SECRET") ?? "";
  if (!validarAssinatura(raw, assinatura, segredo)) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  // 3) Interpretar o evento
  let evento: any;
  try {
    evento = JSON.parse(raw);
  } catch {
    return new Response("payload inválido", { status: 400 });
  }

  // [AJUSTAR] Mapear conforme o payload real da AppyPay:
  const estadoPago   = evento.status === "PAID" || evento.status === "SUCCESS"; // [AJUSTAR]
  const referenciaId = evento.merchant_reference;      // enviado por nós ao iniciar (= user_id ou ref)
  const plano        = evento.metadata?.plano;         // 'mensal' | 'anual'
  const valor        = evento.amount;                  // Kz
  const dentroTrial  = evento.metadata?.dentro_trial === true;

  if (!estadoPago) {
    return new Response("ignorado (não pago)", { status: 200 });
  }

  // 4) Ativar o acesso — reutiliza a função SQL ativar_pagamento
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service_role: só no servidor
  );

  const { error } = await supabase.rpc("ativar_pagamento", {
    p_user: referenciaId,          // [AJUSTAR] se a ref não for diretamente o user_id
    p_plano: plano,
    p_valor: valor,
    p_dentro_trial: dentroTrial,
    p_admin: "webhook:appypay",
  });

  if (error) {
    // 500 → a AppyPay volta a tentar (retry). Registar para auditoria.
    console.error("Falha ao ativar:", error);
    return new Response("erro ao ativar", { status: 500 });
  }

  // 5) 200 → recebido; a AppyPay pára de reenviar
  return new Response("ok", { status: 200 });
});

// ----------------------------------------------------------------------------
// [AJUSTAR] Implementar conforme a AppyPay. Exemplo típico: HMAC-SHA256 do corpo
// com o segredo partilhado, comparado (em tempo constante) com o header recebido.
// Enquanto não houver documentação/credenciais, devolve false (não ativa nada).
// ----------------------------------------------------------------------------
function validarAssinatura(_raw: string, _assinatura: string, _segredo: string): boolean {
  return false;
}
