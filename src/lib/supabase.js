// src/lib/supabase.js
// Cliente Supabase da Klaco.
// Projecto Create React App (CRA) — usar EXCLUSIVAMENTE variáveis REACT_APP_*.
// As variáveis reais são configuradas na Vercel; nunca committar segredos.
// NUNCA usar a service_role no frontend — apenas a chave pública (anon).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Aviso em desenvolvimento; não expõe segredos.
  console.warn("Supabase: variáveis REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY em falta.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Normaliza telefone angolano para E.164 (+244XXXXXXXXX)
export function normalizarTelefone(valor) {
  const limpo = String(valor || "").replace(/[\s\-()]/g, "");
  const semPrefixo = limpo.replace(/^\+?244/, "");
  if (/^9\d{8}$/.test(semPrefixo)) return "+244" + semPrefixo;
  return limpo.startsWith("+") ? limpo : null;
}
