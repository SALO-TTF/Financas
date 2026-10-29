import { useState, useRef, useEffect } from "react";
import { supabase, normalizarTelefone } from "./lib/supabase";

// ── Origem do registo (canal de aquisição) ─────────────────────────────────────
// URL → localStorage: guarda ?o=valor (ex.: ?o=fb, ?o=ig, ?o=inf-nome) só na 1.ª visita com origem.
// Nunca sobrescreve uma origem já guardada e não cria nenhuma se o URL não tiver ?o=.
const CHAVE_ORIGEM = "klaco_origem";
function guardarOrigemDoUrl() {
  try {
    if (window.localStorage.getItem(CHAVE_ORIGEM)) return; // já existe: mantém
    const bruto = new URLSearchParams(window.location.search).get("o");
    const valor = (bruto || "").trim().toLowerCase();
    // Só letras, números, "-" e "_" (máx. 40): valor seguro, sem tocar no resto do URL.
    if (/^[a-z0-9_-]{1,40}$/.test(valor)) window.localStorage.setItem(CHAVE_ORIGEM, valor);
  } catch (e) {}
}
function lerOrigem() {
  try { return window.localStorage.getItem(CHAVE_ORIGEM) || null; } catch (e) { return null; }
}
guardarOrigemDoUrl();

// ── Contactos da Klaco (fonte única; evita endereços duplicados pela app) ──────
const CONTACTOS = {
  invoice: "invoice@klaco.app",     // pagamentos, comprovativos e faturas
  comercial: "comercial@klaco.app", // sugestões, elogios, informação e assuntos comerciais
  suporte: "suporte@klaco.app",     // problemas técnicos, bugs e dificuldades de utilização
  whatsapp: "244952272299",         // internacional, para wa.me
  whatsappTexto: "952 272 299",
};

// ── Ícones próprios (SVG de dois tons: contorno + preenchimento suave) ──────────
// Substituem os emojis da interface: iguais em qualquer telemóvel e na cor da marca.
const IC_F = 'fill="currentColor" fill-opacity=".2"';
const ICONES = {
  home: `<path d="M4 11l8-7 8 7v8.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z" ${IC_F}/><path d="M9.5 20v-5.5h5V20"/>`,
  target: `<circle cx="12" cy="12" r="8.5" ${IC_F}/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>`,
  chart: `<rect x="4" y="12" width="4" height="8" rx="1.2" ${IC_F}/><rect x="10" y="7" width="4" height="13" rx="1.2" ${IC_F}/><rect x="16" y="4" width="4" height="16" rx="1.2" ${IC_F}/>`,
  sliders: `<path d="M4 7h8M17 7h3M4 12h3M12 12h8M4 17h10M19 17h1"/><circle cx="14.5" cy="7" r="2.2" ${IC_F}/><circle cx="9.5" cy="12" r="2.2" ${IC_F}/><circle cx="16.5" cy="17" r="2.2" ${IC_F}/>`,
  sparkle: `<path d="M12 3.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" ${IC_F}/>`,
  trend: `<path d="M3.5 17l6-6 4 4 7-7"/><path d="M15.5 8h5v5"/>`,
  trendDown: `<path d="M3.5 7l6 6 4-4 7 7"/><path d="M15.5 16h5v-5"/>`,
  user: `<circle cx="12" cy="8" r="4" ${IC_F}/><path d="M4.5 20c.6-3.6 3.7-5.5 7.5-5.5s6.9 1.9 7.5 5.5"/>`,
  users: `<circle cx="9" cy="8.5" r="3.5" ${IC_F}/><path d="M2.8 19.5c.5-3.2 3.1-4.8 6.2-4.8s5.7 1.6 6.2 4.8"/><path d="M15.5 5.3a3.4 3.4 0 0 1 0 6.4M17.5 14.8c2 .5 3.3 2 3.7 4.7"/>`,
  card: `<rect x="3" y="5.5" width="18" height="13" rx="2.5" ${IC_F}/><path d="M3 10h18"/>`,
  list: `<rect x="5" y="3.5" width="14" height="17" rx="2.5" ${IC_F}/><path d="M9 9h6M9 13h6M9 17h3.5"/>`,
  arrowin: `<circle cx="12" cy="12" r="8.5" ${IC_F}/><path d="M12 8v7.5M8.8 12.8L12 16l3.2-3.2"/>`,
  tag: `<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7l8.3 8.3a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0z" ${IC_F}/><circle cx="8" cy="8" r="1.2" fill="currentColor"/>`,
  star: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" ${IC_F}/>`,
  starFull: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" fill="currentColor"/>`,
  chat: `<path d="M4.5 5.5h15A1.5 1.5 0 0 1 21 7v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5z" ${IC_F}/>`,
  bell: `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" ${IC_F}/><path d="M10 20.5a2 2 0 0 0 4 0"/>`,
  megaphone: `<path d="M4 10v4h3l7 4V6L7 10z" ${IC_F}/><path d="M17.5 9a4 4 0 0 1 0 6"/>`,
  chev: `<path d="M9.5 6l6 6-6 6"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18"/>`,
  pencil: `<path d="M14.5 5.5l4 4"/><path d="M4.5 19.5l1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5z" ${IC_F}/>`,
  logout: `<path d="M9.5 4.5h-4A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5h4"/><path d="M15 8l4 4-4 4M19 12H9.5"/>`,
  alert: `<path d="M12 4l9 16H3z" ${IC_F}/><path d="M12 10v4.5M12 17.2v.1"/>`,
  alertCircle: `<circle cx="12" cy="12" r="8.5" ${IC_F}/><path d="M12 8v5M12 16v.1"/>`,
  checkCircle: `<circle cx="12" cy="12" r="8.5" ${IC_F}/><path d="M8.2 12.4l2.6 2.6 5-5.4"/>`,
  xCircle: `<circle cx="12" cy="12" r="8.5" ${IC_F}/><path d="M9 9l6 6M15 9l-6 6"/>`,
  hourglass: `<path d="M7 4h10M7 20h10M8 4v3.5a4 4 0 0 0 1.8 3.3L12 12l2.2-1.2A4 4 0 0 0 16 7.5V4M8 20v-3.5a4 4 0 0 1 1.8-3.3L12 12l2.2 1.2a4 4 0 0 1 1.8 3.3V20"/>`,
  gem: `<path d="M6.5 4h11l3.5 5-9 11L3 9z" ${IC_F}/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5"/>`,
  sprout: `<path d="M12 20v-7"/><path d="M12 13c0-3.500-2.500-5.500-6.500-5.500C5.500 11 8 13 12 13z" ${IC_F}/><path d="M12 13c0-3 2-5 6-5 0 3.500-2.200 5-6 5z" ${IC_F}/>`,
  bulb: `<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.200 10c.5.4.7.9.7 1.500v.5h5V15c0-.6.2-1.100.7-1.500A5.500 5.500 0 0 0 12 3.500z" ${IC_F}/>`,
  flame: `<path d="M12 3.5s5.500 4 5.500 9.500a5.500 5.500 0 0 1-11 0c0-2.200 1-3.700 2.200-5 .3 1.400 1.200 2.200 2 2.200C10.800 8 12 6 12 3.500z" ${IC_F}/>`,
  flag: `<path d="M5.5 21V4.5"/><path d="M5.5 5h11l-2 4 2 4h-11z" ${IC_F}/>`,
  gift: `<rect x="4" y="9" width="16" height="11" rx="2" ${IC_F}/><path d="M3 9h18V6H3zM12 6v14"/><path d="M12 6c-1-2.500-4.500-2.500-4 0M12 6c1-2.500 4.500-2.500 4 0"/>`,
  award: `<circle cx="12" cy="9" r="5.500" ${IC_F}/><path d="M8.500 13.500L7 21l5-2.500 5 2.500-1.500-7.500"/>`,
  medal: `<circle cx="12" cy="14.500" r="5.500" ${IC_F}/><path d="M8 3.500l4 6.500 4-6.500"/>`,
  sun: `<circle cx="12" cy="12" r="4" ${IC_F}/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>`,
  tree: `<path d="M12 3.500l5 7h-3l4 5.500H6l4-5.500H7z" ${IC_F}/><path d="M12 16v4.500"/>`,
  briefcase: `<rect x="3.500" y="7.500" width="17" height="12" rx="2.200" ${IC_F}/><path d="M9 7.500V6a1.500 1.500 0 0 1 1.500-1.500h3A1.500 1.500 0 0 1 15 6v1.500M3.500 13h17"/>`,
  cart: `<path d="M3.500 4.500H6l2 10h9.500l2-7H7.200"/><circle cx="9.500" cy="19" r="1.400" fill="currentColor"/><circle cx="17" cy="19" r="1.400" fill="currentColor"/>`,
  drop: `<path d="M12 3.500s6 6.200 6 10.500a6 6 0 0 1-12 0c0-4.300 6-10.500 6-10.500z" ${IC_F}/>`,
  fuel: `<rect x="5" y="4" width="9" height="16" rx="1.600" ${IC_F}/><path d="M5 10h9M14 8h2.500A1.500 1.500 0 0 1 18 9.500V16a1.500 1.500 0 0 0 3 0v-6l-2.500-2.500"/>`,
  car: `<path d="M4 15l1.800-5.200A2 2 0 0 1 7.700 8.500h8.600a2 2 0 0 1 1.900 1.300L20 15v3.500h-3V17H7v1.500H4z" ${IC_F}/><circle cx="7.800" cy="14.200" r=".9" fill="currentColor"/><circle cx="16.200" cy="14.200" r=".9" fill="currentColor"/>`,
  wifi: `<path d="M3.500 9.500a12 12 0 0 1 17 0M6.500 12.700a8 8 0 0 1 11 0M9.500 15.800a4 4 0 0 1 5 0"/><circle cx="12" cy="19" r="1.100" fill="currentColor"/>`,
  phone: `<rect x="7" y="3" width="10" height="18" rx="2.400" ${IC_F}/><path d="M10.500 18h3"/>`,
  pill: `<g transform="rotate(-40 12 12)"><rect x="3.500" y="8.500" width="17" height="7" rx="3.500" ${IC_F}/><path d="M12 8.500v7"/></g>`,
  book: `<path d="M5 4.500h6.500A1.500 1.500 0 0 1 13 6v14a2 2 0 0 0-2-2H5z" ${IC_F}/><path d="M19 4.500h-5A1.500 1.500 0 0 0 12.500 6v14a2 2 0 0 1 2-2H19z" ${IC_F}/>`,
  building: `<rect x="5" y="3.500" width="14" height="17" rx="1.600" ${IC_F}/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.500 20.500V17h3v3.500"/>`,
  shirt: `<path d="M8.500 4l-5 3 2 3.500 2-1V20h9V9.500l2 1 2-3.500-5-3a3.500 3.500 0 0 1-7 0z" ${IC_F}/>`,
  dumbbell: `<path d="M6.500 8v8M17.500 8v8M3.500 10v4M20.500 10v4M6.500 12h11"/>`,
  ticket: `<path d="M3.500 8.500a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v1.500a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4z" ${IC_F}/>`,
  film: `<rect x="3.500" y="5" width="17" height="14" rx="2" ${IC_F}/><path d="M8 5v14M16 5v14M3.500 9H8M16 9h4.500M3.500 15H8M16 15h4.500"/>`,
  scissors: `<circle cx="7" cy="7" r="2.500"/><circle cx="7" cy="17" r="2.500"/><path d="M9 8.600L20 19M9 15.400L20 5"/>`,
  cross: `<rect x="3.500" y="3.500" width="17" height="17" rx="3" ${IC_F}/><path d="M12 8v8M8 12h8"/>`,
  heart: `<path d="M12 20s-7.500-4.500-7.500-10A4.300 4.300 0 0 1 12 7.300 4.300 4.300 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z" ${IC_F}/>`,
  plane: `<path d="M21 4.500L3 11l6 2.500 2.500 6z" ${IC_F}/><path d="M9 13.500l5-5"/>`,
  bank: `<path d="M3.500 9L12 4l8.500 5z" ${IC_F}/><path d="M5.500 9v8M9.500 9v8M14.500 9v8M18.500 9v8M3.500 20h17"/>`,
  globe: `<circle cx="12" cy="12" r="8.500" ${IC_F}/><path d="M3.500 12h17M12 3.500c3 2.500 3 14.500 0 17M12 3.500c-3 2.500-3 14.500 0 17"/>`,
  shield: `<path d="M12 3.500l7 2.500v5.500c0 4.200-3 7.400-7 9-4-1.600-7-4.800-7-9V6z" ${IC_F}/>`,
  cap: `<path d="M2.500 9.500L12 5l9.500 4.500L12 14z" ${IC_F}/><path d="M6.500 11.800V16c1.500 1.500 3.400 2.200 5.500 2.200s4-.7 5.500-2.200v-4.200M21.500 9.500v5"/>`,
  utensils: `<path d="M7 3.500v7a2 2 0 0 0 2 2v8M5 3.500v5M9 3.500v5M17 20.500V3.500c-2.500 1.500-3.500 4-3.500 7H17"/>`,
  cup: `<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" ${IC_F}/><path d="M16 9.500h1.500a2.500 2.500 0 0 1 0 5H16M8 3.500v2M11 3.500v2"/>`,
  calendar: `<rect x="3.500" y="5" width="17" height="15" rx="2.400" ${IC_F}/><path d="M3.500 10h17M8 3.500v3M16 3.500v3"/>`,
  refresh: `<path d="M19.500 12a7.500 7.500 0 0 1-13 5.100M4.500 12a7.500 7.500 0 0 1 13-5.100"/><path d="M17.500 3.500v3.700h-3.700M6.500 20.500v-3.700h3.700"/>`,
  fingerprint: `<path d="M12 4a7 7 0 0 0-7 7v1.500M12 4a7 7 0 0 1 7 7v2.500c0 2.500-.5 4.500-1.500 6.500M8 11a4 4 0 0 1 8 0v2.500c0 2-.4 3.900-1.200 5.500M12 11v3.500c0 1.700-.3 3.200-.9 4.500M8 13.500c0 1.800-.3 3.600-1 5"/>`,
  camera: `<path d="M4 8h3l1.500-2h7L17 8h3v11H4z" ${IC_F}/><circle cx="12" cy="13" r="3.400"/>`,
  share: `<path d="M12 15V4M8 7.500L12 4l4 3.500"/><path d="M6 11H5a1.500 1.500 0 0 0-1.500 1.500v6A1.500 1.500 0 0 0 5 20h14a1.500 1.500 0 0 0 1.500-1.500v-6A1.500 1.500 0 0 0 19 11h-1"/>`,
  wrench: `<path d="M14.500 6.500a4 4 0 0 0 4.800 5l-8.300 8.300a2.200 2.200 0 0 1-3-3l8.300-8.300a4 4 0 0 0-1.800-2z" ${IC_F}/>`,
  unlock: `<rect x="5" y="11" width="14" height="9.500" rx="2.200" ${IC_F}/><path d="M8 11V8a4 4 0 0 1 7.700-1.500"/>`,
};
function Icone({ nome, size = 22, color = "currentColor", sw = 1.8, style }) {
  const miolo = ICONES[nome];
  if (!miolo) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ color, flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
      dangerouslySetInnerHTML={{ __html: miolo }} />
  );
}
// Marca da Klaco: o sol (desenhado, não emoji).
function Sol({ size = 28, cor = "#F59E0B" }) {
  const raios = [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="12" y1="2.6" x2="12" y2="5.4" transform="rotate(${a} 12 12)"/>`).join("");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.9" strokeLinecap="round"
      aria-hidden="true" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      dangerouslySetInnerHTML={{ __html: `<circle cx="12" cy="12" r="4.1" fill="${cor}"/>${raios}` }} />
  );
}
// Os dados dos utilizadores guardam o emoji como texto (formato JSONB que não se altera):
// este mapa mostra o ícone correspondente. Emojis desconhecidos não aparecem (ou usam `fallback`).
const EMOJI_ICONE = {
  "🏠": "home", "✨": "sparkle", "💎": "gem", "🌱": "sprout", "💡": "bulb", "🔥": "flame", "🦅": "flag",
  "🎁": "gift", "💰": "award", "🏖": "sun", "🎄": "tree", "💼": "briefcase", "🛒": "cart", "💧": "drop",
  "⛽": "fuel", "🚕": "car", "🚗": "car", "📶": "wifi", "📱": "phone", "💊": "pill", "📚": "book", "📖": "book",
  "🏢": "building", "🏗": "building", "🧹": "sparkle", "🌳": "tree", "🛡": "shield", "🍽": "utensils", "☕": "cup",
  "👗": "shirt", "💪": "dumbbell", "🎭": "ticket", "🎬": "film", "✂": "scissors", "🏥": "cross", "🧘": "heart",
  "✈": "plane", "🏦": "bank", "📈": "trend", "💵": "globe", "🎓": "cap", "🥇": "medal", "💍": "gem", "🎯": "target",
  "🏷": "tag", "📝": "pencil", "📅": "calendar", "📊": "chart", "📉": "trendDown", "🔴": "alertCircle", "⚠": "alert",
  "🔔": "bell", "✅": "checkCircle", "❌": "xCircle", "⏳": "hourglass", "🧾": "list", "🛠": "wrench", "💬": "chat",
  "⭐": "star", "👤": "user", "🤝": "users", "🚪": "logout", "📣": "megaphone", "⚙": "sliders", "🌅": "sun",
  "🔓": "unlock", "🎉": "award", "🤖": "phone", "📲": "phone", "📸": "camera", "👆": "fingerprint", "🔄": "refresh",
};
function Emo({ e, size = 22, color = "currentColor", fallback = null, style }) {
  const chave = EMOJI_ICONE[String(e || "").replace(/\uFE0F/g, "")] || fallback;
  return chave ? <Icone nome={chave} size={size} color={color} style={style} /> : null;
}

// ── Datas em Africa/Luanda (evita diferenças entre UTC, navegador e servidor) ───
const FUSO_ANGOLA = "Africa/Luanda";
// Devolve o dia (AAAA-MM-DD) em Luanda. Aceita data simples ou timestamp.
function dataLuanda(valor) {
  if (!valor) return null;
  const txt = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  const d = new Date(txt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_ANGOLA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const hojeLuanda = () => dataLuanda(new Date().toISOString());
// Dias de calendário de a até b (ambos AAAA-MM-DD).
function diasEntreDatas(a, b) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}
const diasDesdeLuanda = (valor) => { const ini = dataLuanda(valor); return ini ? Math.max(0, diasEntreDatas(ini, hojeLuanda())) : 0; };
// Subscrição paga válida: estado "ativo" E validade (acesso_ate, inclusiva) não anterior a hoje em Luanda.
const acessoPagoValido = (estado, acessoAte) => { const ate = dataLuanda(acessoAte); return estado === "ativo" && !!ate && ate >= hojeLuanda(); };
const acessoExpirado = (acessoAte) => { const ate = dataLuanda(acessoAte); return !!ate && ate < hojeLuanda(); };

// ── Notificações (tabela public.notificacoes; só leitura do utilizador + marcar como lida) ──
const dataNotif = (n) => new Date(n.criada_em || n.criado_em || n.created_at || 0).getTime() || 0;

// Devolve a lista (mais recentes primeiro) ou null se falhar (para não apagar a lista já mostrada).
async function carregarNotificacoes(userId) {
  try {
    const { data, error } = await supabase.from("notificacoes").select("*").limit(100);
    if (error) { console.error("carregarNotificacoes:", error.message); return null; }
    // A RLS já limita às do utilizador; por precaução, se a linha trouxer user_id tem de ser o dele.
    return (data || []).filter(n => !n.user_id || n.user_id === userId).sort((a, b) => dataNotif(b) - dataNotif(a));
  } catch (e) { console.error("carregarNotificacoes:", e); return null; }
}

// Atualiza APENAS lida e lida_em, e só nas que ainda não estão lidas (não repõe lida_em já existente).
async function marcarNotificacoesLidas(ids) {
  if (!ids || ids.length === 0) return true;
  try {
    const { error } = await supabase.from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .in("id", ids)
      .or("lida.is.null,lida.eq.false");
    if (error) { console.error("marcarNotificacoesLidas:", error.message); return false; }
    return true;
  } catch (e) { console.error("marcarNotificacoesLidas:", e); return false; }
}

// Gera os lembretes do utilizador autenticado (Edge Function gerar-lembretes). O servidor identifica
// o utilizador pelo token; aqui envia-se explicitamente dry_run:false. Erros nunca bloqueiam a app.
async function executarGerarLembretes() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;
    const { error } = await supabase.functions.invoke("gerar-lembretes", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { dry_run: false },
    });
    if (error) { console.error("gerar-lembretes:", error.message || error); return false; }
    return true;
  } catch (e) { console.error("gerar-lembretes:", e); return false; }
}

// ── Admin: listar utilizadores e ativar pagamento via Edge Function ────────────
// A segurança está na Edge Function (verifica is_admin). Aqui só usamos a sessão
// autenticada — NUNCA service_role. Não chamamos a RPC ativar_pagamento diretamente.
async function listarPerfis() {
  // Listagem administrativa via Edge Function segura (verifica is_admin no backend).
  // NÃO lê a tabela perfis diretamente — isso violaria o RLS (cada user só vê o seu).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) { console.error("listarPerfis: sem sessão"); return []; }
  // Enviar o JWT da sessão explicitamente no header Authorization (a função exige verify_jwt).
  const { data, error } = await supabase.functions.invoke("admin-listar-utilizadores", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) { console.error("admin-listar-utilizadores:", error.message || error); return []; }
  // A Edge Function devolve a lista; aceitar tanto array direto como { data: [...] }
  const lista = Array.isArray(data) ? data : (data?.data || data?.utilizadores || []);
  return lista;
}

// [NÃO USADA pelo painel atual] Ativação manual antiga. Mantida intacta a pedido do dev
// (o fluxo atual usa solicitações pendentes: aprovarSolicitacao/rejeitarSolicitacao).
async function adminAtivarPagamento({ user_id, plano, valor, dentro_do_trial }) {
  // Confirma sessão válida
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, erro: "Sessão expirada. Entra de novo." };
  }
  // Invoca a Edge Function (ela verifica is_admin e chama a RPC no servidor)
  const { data, error } = await supabase.functions.invoke("admin-ativar-pagamento", {
    body: { user_id, plano, valor, dentro_do_trial },
  });
  if (error) {
    console.error("admin-ativar-pagamento:", error.message || error);
    return { ok: false, erro: error.message || "Falha ao ativar o pagamento." };
  }
  return { ok: true, data };
}

// ── Fluxo de pagamentos PENDENTES (solicitação → aprovação/rejeição) ───────────
// Cliente cria uma solicitação (não ativa nada). Admin aprova/rejeita via Edge Function.

// Cliente: criar solicitação de pagamento (chama a RPC criar_solicitacao_pagamento).
// NÃO ativa a conta — só regista um pedido com status 'pendente'.
async function criarSolicitacaoPagamento({ plano, valor, dentroTrial }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, erro: "Sessão expirada. Entra de novo." };
  const { data, error } = await supabase.rpc("criar_solicitacao_pagamento", {
    p_plano: plano,
    p_valor: valor,
    p_dentro_trial: !!dentroTrial,
  });
  if (error) {
    console.error("criar_solicitacao_pagamento:", error.message || error);
    return { ok: false, erro: error.message || "Não foi possível enviar a solicitação." };
  }
  return { ok: true, data };
}

// Admin: listar pagamentos pendentes (Edge Function segura, verifica is_admin).
async function listarPagamentosPendentes() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) { console.error("listarPagamentosPendentes: sem sessão"); return []; }
  const { data, error } = await supabase.functions.invoke("admin-listar-pagamentos-pendentes", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {},
  });
  if (error) { console.error("admin-listar-pagamentos-pendentes:", error.message || error); return []; }
  return data?.pagamentos || (Array.isArray(data) ? data : []);
}

// Admin: aprovar uma solicitação (Edge Function → aprovar_solicitacao_pagamento no servidor).
async function aprovarSolicitacao(pagamento_id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, erro: "Sessão expirada. Entra de novo." };
  const { data, error } = await supabase.functions.invoke("admin-aprovar-solicitacao-pagamento", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { pagamento_id },
  });
  if (error) {
    console.error("admin-aprovar-solicitacao-pagamento:", error.message || error);
    // Mostra o motivo enviado pelo servidor (ex.: montante inválido), quando existir.
    let msg = error.message || "Falha ao aprovar.";
    try { const corpo = await error.context?.json?.(); if (corpo?.error) msg = corpo.error; } catch (e) {}
    return { ok: false, erro: msg };
  }
  return { ok: true, data };
}

// Admin: rejeitar uma solicitação (Edge Function segura).
async function rejeitarSolicitacao(pagamento_id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, erro: "Sessão expirada. Entra de novo." };
  const { data, error } = await supabase.functions.invoke("admin-rejeitar-solicitacao-pagamento", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { pagamento_id },
  });
  if (error) { console.error("admin-rejeitar-solicitacao-pagamento:", error.message || error); return { ok: false, erro: error.message || "Falha ao rejeitar." }; }
  return { ok: true, data };
}


// Camada fina sobre o Supabase. A lógica da app não muda; estas funções só ligam
// o estado existente à base de dados. RLS garante que cada utilizador só toca no
// que é seu. NUNCA usar service_role aqui (só a chave anon, via cliente importado).

// Cria/atualiza o perfil após signup (id = auth.users.id). Não apaga dados existentes.
async function upsertPerfil(user, extra = {}) {
  if (!user?.id) return;
  const payload = {
    id: user.id,
    email: user.email || extra.email || null,
    telefone: extra.telefone || user.phone || null,
    ...(extra.nome ? { nome: extra.nome } : {}),
  };
  // onConflict id: se já existe, atualiza só o que passamos (não sobrescreve o resto)
  const { error } = await supabase.from("perfis").upsert(payload, { onConflict: "id" });
  if (error) console.error("upsertPerfil:", error.message);
}

// Persiste o NOME em perfis.nome no Supabase (fonte oficial do nome).
// Usado no fim do setup e ao editar dados. O estado local é atualizado só depois.
async function guardarNome(userId, nome) {
  if (!userId || !nome) return { ok: false };
  const { error } = await supabase
    .from("perfis")
    .update({ nome, atualizado_em: new Date().toISOString() })
    .eq("id", userId);
  if (error) { console.error("guardarNome:", error.message); return { ok: false, erro: error.message }; }
  return { ok: true };
}

// Carrega o perfil do utilizador autenticado
async function carregarPerfil(userId) {
  const { data, error } = await supabase.from("perfis").select("*").eq("id", userId).single();
  if (error) { console.error("carregarPerfil:", error.message); return null; }
  return data;
}

// Persiste o estado da app em perfis.dados (chamado com debounce)
async function guardarDados(userId, dados) {
  const { error } = await supabase
    .from("perfis")
    .update({ dados, atualizado_em: new Date().toISOString() })
    .eq("id", userId);
  if (error) { console.error("guardarDados:", error.message); return false; }
  return true; // o servidor não devolveu erro: a gravação foi aceite
}

// ── Métricas: origem do registo e primeira atividade financeira ────────────────
// Todos os UPDATE abaixo são condicionais (WHERE coluna IS NULL): nunca substituem um valor
// já preenchido, mesmo com operações simultâneas, vários separadores ou estado desatualizado.
const ORIGEM_VALIDA = /^[a-z0-9_-]{1,40}$/;

// Origem do registo: usa a origem gravada nos metadados do Auth no momento em que a conta foi
// criada (signInWithOtp options.data). Contas antigas não têm origem e ficam como estão.
async function guardarOrigemRegisto(user) {
  try {
    const origem = user?.user_metadata?.origem;
    if (!user?.id || typeof origem !== "string" || !ORIGEM_VALIDA.test(origem)) return;
    // A coluna só se escreve pela RPC (valida o valor e só preenche se estiver vazia).
    const { data, error } = await supabase.rpc("guardar_origem_registo", { p_origem: origem });
    if (error) { console.error("guardarOrigemRegisto:", error.message); return; }
    if (data?.ok !== true) console.error("guardarOrigemRegisto:", data?.codigo);
  } catch (e) { console.error("guardarOrigemRegisto:", e); }
}

// Marca a 1.ª atividade ("gasto" | "rendimento") através da RPC marcar_primeira_atividade.
// Devolve true só se o servidor confirmou; qualquer erro devolve false (a pendência mantém-se).
async function marcarPrimeiraAtividade(userId, tipo) {
  try {
    // RPC: o servidor trata da data e só preenche colunas vazias. Sucesso = "marcado" ou "ja_registado".
    const { data, error } = await supabase.rpc("marcar_primeira_atividade", { p_tipo: tipo });
    if (error) { console.error("marcarPrimeiraAtividade:", error.message); return false; }
    if (data?.ok === true && (data.resultado === "marcado" || data.resultado === "ja_registado")) return true;
    console.error("marcarPrimeiraAtividade:", data?.codigo || data);
    return false;
  } catch (e) { console.error("marcarPrimeiraAtividade:", e); return false; }
}

// Chamada só depois de guardarDados ter sido aceite. Só marca se a operação foi a 1.ª da conta
// (pendente) E o snapshot realmente gravado já a contém (evita gravações antigas ainda em curso).
// Repetição segura: depois de uma falha só volta a tentar passados COOLDOWN_METRICAS_MS (não há limite de
// tentativas, por isso nunca desiste) e nunca há duas chamadas em simultâneo. Não bloqueia gravações.
const COOLDOWN_METRICAS_MS = 30000;
let metricasEmCurso = false;
async function confirmarMetricas(pendentes, userId, snapshot) {
  if (!pendentes || pendentes.uid !== userId) return;
  const querGasto = pendentes.gasto && (snapshot?.despesas || []).length > 0;
  const querRendimento = pendentes.rendimento && (snapshot?.entradasExtra || []).length > 0;
  if (!querGasto && !querRendimento) return;
  if (metricasEmCurso) return;
  if (pendentes.aguardaAte && Date.now() < pendentes.aguardaAte) return;
  metricasEmCurso = true;
  try {
    let falhou = false;
    if (querGasto) { if (await marcarPrimeiraAtividade(userId, "gasto")) pendentes.gasto = false; else falhou = true; }
    if (querRendimento) { if (await marcarPrimeiraAtividade(userId, "rendimento")) pendentes.rendimento = false; else falhou = true; }
    pendentes.aguardaAte = falhou ? Date.now() + COOLDOWN_METRICAS_MS : 0;
  } finally { metricasEmCurso = false; }
}

// Regista uma avaliação
async function enviarAvaliacaoSupabase(userId, estrelas, texto) {
  const { error } = await supabase.from("avaliacoes").insert({ user_id: userId, estrelas, texto: texto || null });
  if (error) console.error("avaliacao:", error.message);
}

// Convites: a tabela "convites" NÃO tem policy de INSERT para o utilizador comum
// (só SELECT). Fazer insert direto pelo frontend seria bloqueado pelo RLS.
// Por isso NÃO inserimos aqui. Guardamos o código de convite no perfil do convidado
// (perfis.dados.refConvite), de forma segura, e deixamos o relacionamento em convites
// para ser criado por uma Edge Function / RPC segura numa fase posterior.
// [PENDENTE-BACKEND] Criar Edge Function (ou RPC SECURITY DEFINER) que:
//   - recebe { convidadoId, codigoRef }
//   - resolve o convidador pelo inviteCode
//   - faz o insert em convites com service_role (no servidor, nunca no frontend)
// convidado_pagou NUNCA é tocado pelo frontend.
async function guardarRefConvite(userId, codigoRef) {
  if (!userId || !codigoRef) return;
  // Lê os dados atuais e adiciona o refConvite sem apagar o resto
  const { data } = await supabase.from("perfis").select("dados").eq("id", userId).single();
  const dados = { ...(data?.dados || {}), refConvite: codigoRef };
  const { error } = await supabase.from("perfis").update({ dados }).eq("id", userId);
  if (error) console.error("guardarRefConvite:", error.message);
}


// Format: 20.000,00 Kz (Angolan standard — dots for thousands, comma for decimals)
const fmtKz = (n) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100);
  const intPart = Math.floor(cents / 100);
  const decPart = String(cents % 100).padStart(2, "0");
  // Add dots every 3 digits from right
  const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + intStr + "," + decPart + " Kz";
};

// ── Entrada de dinheiro com decimais (padrão angolano: . milhares, , decimais) ──
// Aceita o que a pessoa escreve (dígitos e uma vírgula), devolve:
//  - valor: número real (ex: 250567.22) para os cálculos
//  - display: texto formatado (ex: "250.567,22") para mostrar no input
const parseValorInput = (raw) => {
  // manter só dígitos e vírgulas; a primeira vírgula é o separador decimal
  let s = String(raw).replace(/[^\d,]/g, "");
  const partes = s.split(",");
  const inteira = partes[0] || "";
  const decimal = partes.length > 1 ? partes.slice(1).join("").slice(0, 2) : null; // máx 2 casas
  // valor numérico
  const numStr = decimal !== null ? `${inteira || "0"}.${decimal}` : (inteira || "");
  const valor = numStr === "" ? 0 : parseFloat(numStr);
  // display formatado
  let display = "";
  if (inteira !== "") {
    const intFmt = String(parseInt(inteira, 10)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    display = decimal !== null ? `${intFmt},${decimal}` : intFmt;
  } else if (decimal !== null) {
    display = `0,${decimal}`;
  }
  return { valor, display };
};

const todayStr = () => new Date().toISOString().split("T")[0];
const addMonths = (dateStr, n) => {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
};
// Days from today TO a future date (next payment)
const daysUntil = (dateStr) => {
  if (!dateStr) return 0;
  const target = new Date(dateStr); 
  if (isNaN(target.getTime())) return 0;
  target.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.max(0, Math.round((target - now) / 86400000));
};
// Days elapsed FROM a past date (for trial tracking)
const daysSince = (dateStr) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const start = new Date(dateStr); start.setHours(0,0,0,0);
  return Math.max(0, Math.round((now - start) / 86400000));
};

const CATS = [
  { id: "necessidades", label: "Necessidades",       emoji: "🏠", color: "#22C55E", desc: "Renda, água, luz, alimentação, transporte" },
  { id: "qualidade",    label: "Qualidade de Vida",  emoji: "✨", color: "#3B82F6", desc: "Lazer, saúde, roupas, restaurantes" },
  { id: "investimento", label: "Investimento",        emoji: "💎", color: "#F59E0B", desc: "Poupança, negócio, fundo de emergência" },
];

// ── COMUNIDADE & CONQUISTAS ───────────────────────────────────────────────────
// Gera código de convite único por sessão (em produção seria por utilizador autenticado)
const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

// Níveis de conquista — celebram GASTAR com intenção, não restringir
const NIVEIS = [
  { id: "iniciado",     label: "Iniciado",     emoji: "🌱", desc: "Primeiro dia a gastar com intenção",        dias: 1  },
  { id: "consciente",  label: "Consciente",   emoji: "💡", desc: "7 dias a saber o que podes gastar",          dias: 7  },
  { id: "consistente", label: "Consistente",  emoji: "🔥", desc: "14 dias sem surpresas no fim do mês",        dias: 14 },
  { id: "livre",       label: "Livre",        emoji: "🦅", desc: "30 dias a gastar no que queres, sem culpa",  dias: 30 },
  { id: "mestre",      label: "Mestre",       emoji: "💎", desc: "60 dias. O dinheiro trabalha para ti.",      dias: 60 },
];

const getNivel = (diasAtivos) => {
  let nivel = NIVEIS[0];
  for (const n of NIVEIS) { if (diasAtivos >= n.dias) nivel = n; }
  return nivel;
};

const DEFAULT_PCT = { necessidades: 60, qualidade: 30, investimento: 10 };

// Pre-defined expense suggestions per category
const SUGESTOES_ENTRADA = [
  { nome: "13º mês", emoji: "🎁" },
  { nome: "Bónus", emoji: "💰" },
  { nome: "Subsídio de férias", emoji: "🏖️" },
  { nome: "Subsídio de Natal", emoji: "🎄" },
  { nome: "Trabalho extra", emoji: "💼" },
];

const SUGESTOES = {
  necessidades: [
    { nome: "Renda / Casa",         emoji: "🏠" },
    { nome: "Mercado / Alimentação",emoji: "🛒" },
    { nome: "Água",                 emoji: "💧" },
    { nome: "Electricidade",        emoji: "💡" },
    { nome: "Combustível",          emoji: "⛽" },
    { nome: "Transporte / Táxi",    emoji: "🚕" },
    { nome: "Internet",             emoji: "📶" },
    { nome: "Telemóvel",            emoji: "📱" },
    { nome: "Medicamentos",         emoji: "💊" },
    { nome: "Escola / Propinas",    emoji: "📚" },
    { nome: "Condomínio",           emoji: "🏢" },
    { nome: "Gás",                  emoji: "🔥" },
    { nome: "Empregada doméstica",  emoji: "🧹" },
    { nome: "Motorista",            emoji: "🚗" },
    { nome: "Jardineiro",           emoji: "🌳" },
    { nome: "Segurança / Guarda",   emoji: "🛡️" },
    { nome: "Explicador / Professor", emoji: "📖" },
  ],
  qualidade: [
    { nome: "Restaurante",          emoji: "🍽️" },
    { nome: "Café",                 emoji: "☕" },
    { nome: "Roupas",               emoji: "👗" },
    { nome: "Ginásio",              emoji: "💪" },
    { nome: "Lazer / Saídas",       emoji: "🎭" },
    { nome: "Netflix / Streaming",  emoji: "🎬" },
    { nome: "Cabeleireiro / Barbearia", emoji: "✂️" },
    { nome: "Farmácia / Saúde",     emoji: "🏥" },
    { nome: "Spa / Bem-estar",      emoji: "🧘" },
    { nome: "Viagem",               emoji: "✈️" },
    { nome: "Presentes",            emoji: "🎁" },
    { nome: "Livros / Formação",    emoji: "📖" },
  ],
  investimento: [
    { nome: "Poupança bancária",    emoji: "🏦" },
    { nome: "Negócio próprio",      emoji: "💼" },
    { nome: "BODIVA / Acções",      emoji: "📈" },
    { nome: "Imobiliário",          emoji: "🏗️" },
    { nome: "Dólares / Divisas",    emoji: "💵" },
    { nome: "Fundo de emergência",  emoji: "🛡️" },
    { nome: "Formação / Cursos",    emoji: "🎓" },
    { nome: "Ouro / Metais",        emoji: "🥇" },
  ],
};

// ── SETUP (multi-step, with free back navigation + editable %) ────────────────
// ── AUTENTICAÇÃO (entrar / criar conta / recuperar) ──────────────────────────
// ── ECRÃ DE PIN ───────────────────────────────────────────────────────────────
// Serve para DEFINIR (modo "definir") e para ENTRAR (modo "entrar").
// Protege o acesso neste aparelho — como os apps de finanças (código, não password).
function PinScreen({ modo, pinCorreto, biometriaAtiva, onDefinir, onEntrar, onEsqueci, onBiometria }) {
  const [entrada, setEntrada] = useState("");        // o que está a ser digitado agora
  const [primeiroPin, setPrimeiroPin] = useState(""); // 1º PIN guardado (modo definir)
  const [fase, setFase] = useState("primeiro");       // primeiro | confirmar (só definir)
  const [erro, setErro] = useState("");
  // Refs espelham o estado atual — evitam closure desatualizado no setTimeout
  const faseRef = useRef(fase);
  const primeiroPinRef = useRef(primeiroPin);
  useEffect(() => { faseRef.current = fase; }, [fase]);
  useEffect(() => { primeiroPinRef.current = primeiroPin; }, [primeiroPin]);

  const premir = (d) => {
    if (entrada.length >= 4) return;
    setErro("");
    const novo = entrada + d;
    setEntrada(novo);
    if (novo.length === 4) {
      // pequeno atraso só para o utilizador ver o 4º ponto preencher
      setTimeout(() => processar(novo), 120);
    }
  };
  const apagar = () => { setErro(""); setEntrada(e => e.slice(0, -1)); };

  const processar = (valor) => {
    if (modo === "definir") {
      if (faseRef.current === "primeiro") {
        // guarda o 1º PIN e passa à confirmação
        setPrimeiroPin(valor);
        setFase("confirmar");
        setEntrada("");
      } else {
        // fase confirmar: comparar com o 1º
        if (valor === primeiroPinRef.current) {
          onDefinir(valor);
        } else {
          setErro("Os códigos não coincidem. Recomeça.");
          setPrimeiroPin("");
          setFase("primeiro");
          setEntrada("");
        }
      }
    } else {
      // modo entrar
      if (valor === pinCorreto) {
        onEntrar();
      } else {
        setErro("Código errado. Tenta de novo.");
        setEntrada("");
      }
    }
  };

  const preenchidos = entrada.length;

  const titulo = modo === "definir"
    ? (fase === "primeiro" ? "Cria o teu código" : "Confirma o código")
    : "Introduz o teu código";
  const sub = modo === "definir"
    ? "4 dígitos para proteger o teu acesso. Vais usá-lo para entrar."
    : "Bem-vindo de volta";

  return (
    <div style={S.setup}>
      <div style={{ ...S.setupCard, textAlign: "center" }}>
        <div style={{ marginBottom: 8 }}><Sol size={44} /></div>
        <div style={{ ...S.logo, fontSize: "1.1em", marginBottom: 6 }}>{titulo}</div>
        <p style={{ color: "#A09880", fontSize: "0.86em", marginBottom: 24 }}>{sub}</p>

        {/* Pontos do PIN */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: preenchidos > i ? "#F59E0B" : "transparent", border: `2px solid ${preenchidos > i ? "#F59E0B" : "#333"}`, transition: "all 0.15s" }} />
          ))}
        </div>

        {erro && <div style={{ color: "#EF4444", fontSize: "0.82em", marginBottom: 16 }}>{erro}</div>}

        {/* Teclado numérico */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 260, margin: "0 auto" }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => premir(String(n))}
              style={{ aspectRatio: "1", background: "#0D0D0D", border: "1px solid #1E1E1E", borderRadius: "50%", color: "#E8E0D0", fontSize: "1.4em", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {n}
            </button>
          ))}
          {/* Biometria (só no modo entrar e se ativa) */}
          {modo === "entrar" && biometriaAtiva ? (
            <button onClick={onBiometria}
              style={{ aspectRatio: "1", background: "transparent", border: "none", cursor: "pointer", fontSize: "1.6em" }}><Icone nome="fingerprint" size={30} color="#F59E0B" /></button>
          ) : <div />}
          <button onClick={() => premir("0")}
            style={{ aspectRatio: "1", background: "#0D0D0D", border: "1px solid #1E1E1E", borderRadius: "50%", color: "#E8E0D0", fontSize: "1.4em", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            0
          </button>
          <button onClick={apagar}
            style={{ aspectRatio: "1", background: "transparent", border: "none", color: "#8A8070", fontSize: "1.2em", cursor: "pointer", fontFamily: "inherit" }}>
            ⌫
          </button>
        </div>

        {modo === "entrar" && (
          <button onClick={onEsqueci}
            style={{ marginTop: 24, background: "transparent", border: "none", color: "#8A8070", fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit" }}>
            Esqueci o meu código
          </button>
        )}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [modo, setModo] = useState("inicio"); // inicio | criar | entrar
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [aLigar, setALigar] = useState(false);

  // Identificador: aceita EMAIL ou TELEFONE (em Angola muitos não têm email).
  const val = email.trim();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const telLimpo = val.replace(/[\s\-()]/g, "").replace(/^\+?244/, "");
  const telValido = /^9\d{8}$/.test(telLimpo);
  const idValido = emailValido || telValido;

  const traduzErro = (m) => {
    if (!m) return "Algo correu mal. Tenta de novo.";
    if (/already registered|already exists/i.test(m)) return "Já existe uma conta com estes dados. Tenta entrar.";
    return "Não foi possível concluir. Verifica os dados e tenta de novo.";
  };

  // ── Criar conta / Entrar — SEM PASSWORD ──
  // A conta identifica-se pelo telefone/email; a proteção do acesso é o PIN (ecrã seguinte).
  // [DEV] Ligação ao Supabase Auth sem password:
  //   - TELEFONE: usar signInWithOtp para criar/associar a conta. No cadastro normal,
  //     seguimos direto para o PIN (o código só é pedido em recuperação/novo aparelho).
  //   - EMAIL: idem (magic link / OTP por email). A password foi removida.
  //   Nota: pode exigir ajuste nas definições do Supabase (permitir signup sem password).
  // Fluxo OTP real do Supabase. O código (OTP) é enviado UMA vez, para criar a
  // sessão real — é isso que gera o auth.uid() e faz o trigger criar o perfil.
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [otpCodigo, setOtpCodigo] = useState("");
  const [identGuardado, setIdentGuardado] = useState("");
  const [ehEmail, setEhEmail] = useState(false);

  const submeter = async (novaConta) => {
    setErro("");
    if (!idValido) { setErro("Escreve um email ou número de telefone válido."); return; }
    setALigar(true);
    const origem = lerOrigem(); // canal guardado (ou null: então não se envia nada)
    try {
      if (emailValido) {
        // Email: OTP por email (código). O Supabase cria/associa o utilizador.
        const { error } = await supabase.auth.signInWithOtp({
          email: val,
          options: { shouldCreateUser: true, ...(origem ? { data: { origem } } : {}) },
        });
        if (error) { setErro(traduzErro(error.message)); return; }
        setIdentGuardado(val); setEhEmail(true); setOtpEnviado(true);
      } else {
        // Telefone: OTP por SMS/WhatsApp (conforme configurado no Supabase).
        const phone = normalizarTelefone(val);
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: { shouldCreateUser: true, ...(origem ? { data: { origem } } : {}) },
        });
        if (error) { setErro(traduzErro(error.message)); return; }
        setIdentGuardado(phone); setEhEmail(false); setOtpEnviado(true);
      }
    } catch (e) {
      setErro(traduzErro(e?.message));
    } finally { setALigar(false); }
  };

  // Verificar o código OTP → cria a sessão real → user.id real → trigger cria o perfil
  const verificarOtp = async () => {
    setErro("");
    if (otpCodigo.length < 4) { setErro("Escreve o código que recebeste."); return; }
    setALigar(true);
    try {
      const params = ehEmail
        ? { email: identGuardado, token: otpCodigo, type: "email" }
        : { phone: identGuardado, token: otpCodigo, type: "sms" };
      const { data, error } = await supabase.auth.verifyOtp(params);
      if (error) { setErro(traduzErro(error.message)); return; }
      if (data?.user) {
        // Garantir o perfil (o trigger já o cria; isto reforça nome/dados quando houver)
        await upsertPerfil(data.user, ehEmail ? { email: identGuardado } : { telefone: identGuardado });
        await guardarOrigemRegisto(data.user);
        onAuth(data.user.email || data.user.phone || identGuardado, data.user);
      } else {
        setErro("Não foi possível confirmar. Tenta de novo.");
      }
    } catch (e) {
      setErro(traduzErro(e?.message));
    } finally { setALigar(false); }
  };

  const campoEmail = (
    <div style={S.field}>
      <label style={S.label}>EMAIL OU TELEFONE</label>
      <input type="text" inputMode="text" autoCapitalize="none" value={email}
        onChange={e => setEmail(e.target.value)} placeholder="" style={S.input} />
      <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 6 }}>
        Podes usar o teu email ou o teu número de telefone.
      </div>
    </div>
  );
  const msgErro = erro && (
    <div style={{ fontSize: "0.82em", color: "#EF4444", marginBottom: 12 }}>{erro}</div>
  );

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={{ ...S.logo, display: "flex", alignItems: "center", gap: 8 }}><Sol size={24} /> Klaco</div>

        {modo === "inicio" && !otpEnviado && (
          <>
            <h2 style={S.setupTitle}>Agora sabes o que fazer com o teu dinheiro</h2>
            <p style={{ ...S.setupSub, marginBottom: 28 }}>Cria a tua conta e descobre, todos os dias, quanto podes gastar.</p>
            <button onClick={() => { setModo("criar"); setErro(""); }} style={{ ...S.btn, marginBottom: 12 }}>Criar conta</button>
            <button onClick={() => { setModo("entrar"); setErro(""); }}
              style={{ width: "100%", background: "transparent", border: "1px solid #2A2A2A", borderRadius: 14, padding: "15px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit" }}>
              Já tenho conta
            </button>
          </>
        )}

        {otpEnviado && (
          <>
            <h2 style={S.setupTitle}>Confirma o código</h2>
            <p style={{ ...S.setupSub, marginBottom: 20 }}>
              Enviámos um código para {identGuardado}. Escreve-o aqui para confirmares a tua conta.
            </p>
            <div style={S.field}>
              <label style={S.label}>CÓDIGO</label>
              <input type="text" inputMode="numeric" value={otpCodigo}
                onChange={e => setOtpCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" style={S.input} maxLength={8} autoFocus />
            </div>
            {msgErro}
            <button onClick={verificarOtp} disabled={aLigar}
              style={{ ...S.btn, opacity: (otpCodigo.length >= 4 && !aLigar) ? 1 : 0.5, marginBottom: 12 }}>
              {aLigar ? "A confirmar…" : "Confirmar"}
            </button>
            <button onClick={() => { setOtpEnviado(false); setOtpCodigo(""); setErro(""); }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
              ← Voltar
            </button>
          </>
        )}

        {modo === "criar" && !otpEnviado && (
          <>
            <h2 style={S.setupTitle}>Cria a tua conta</h2>
            <p style={{ ...S.setupSub, marginBottom: 20 }}>É rápido. Só precisas do teu email ou telefone — a seguir crias um código de 4 dígitos.</p>
            {campoEmail}
            {msgErro}
            <button onClick={() => submeter(true)} disabled={aLigar}
              style={{ ...S.btn, opacity: (idValido && !aLigar) ? 1 : 0.5, marginBottom: 12 }}>
              {aLigar ? "Um momento…" : "Continuar"}
            </button>
            <p style={{ fontSize: "0.76em", color: "#8A8070", lineHeight: 1.5, textAlign: "center", marginBottom: 14 }}>
              Ao criar conta confirmas que tens 18 anos ou mais e aceitas a{" "}
              <span style={{ color: "#F59E0B" }}>Política de Privacidade</span> e os{" "}
              <span style={{ color: "#F59E0B" }}>Termos de Uso</span>.
            </p>
            <button onClick={() => { setModo("inicio"); setErro(""); }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
              ← Voltar
            </button>
          </>
        )}

        {modo === "entrar" && !otpEnviado && (
          <>
            <h2 style={S.setupTitle}>Bem-vindo de volta</h2>
            <p style={{ ...S.setupSub, marginBottom: 20 }}>Escreve o email ou telefone da tua conta.</p>
            {campoEmail}
            {msgErro}
            <button onClick={() => submeter(false)} disabled={aLigar}
              style={{ ...S.btn, opacity: (idValido && !aLigar) ? 1 : 0.5, marginBottom: 10 }}>
              {aLigar ? "Um momento…" : "Continuar"}
            </button>
            <button onClick={() => { setModo("inicio"); setErro(""); }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
              ← Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SetupScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [salario, setSalario] = useState("");
  const [salarioDisplay, setSalarioDisplay] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(todayStr());
  const [proximoPagamento, setProximoPagamento] = useState("");
  const [semEntradaInicial, setSemEntradaInicial] = useState(false); // começou agora
  const [rendimentoVariavel, setRendimentoVariavel] = useState(false); // salário muda de mês para mês

  const handleSalarioChange = (raw) => {
    const { valor, display } = parseValorInput(raw);
    setSalario(valor ? String(valor) : "");
    setSalarioDisplay(display);
  };

  const sal = parseFloat(salario) || 0;
  const datasValidas = semEntradaInicial
    ? (!!proximoPagamento && proximoPagamento > todayStr())
    : (!!dataRecebimento && !!proximoPagamento && proximoPagamento > todayStr());
  const primeiroNome = nome.trim().split(" ")[0];

  const steps = [
    // Passo 0 — nome
    {
      title: "Como preferes que te chame?",
      subtitle: "Para tornar esta experiência tua",
      valid: nome.trim().length >= 2,
      body: (
        <div>
          <input
            autoFocus
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="O teu nome"
            style={{ ...S.dateInput, fontSize: "1.3em", fontWeight: 700, padding: "16px 20px", letterSpacing: "-0.01em" }}
          />
          {nome.trim().length >= 2 && (
            <div style={{ marginTop: 16, fontSize: "0.92em", color: "#8A8070", textAlign: "center" }}>
              Olá, <span style={{ color: "#F59E0B", fontWeight: 700 }}>{primeiroNome}</span>
            </div>
          )}
        </div>
      ),
    },
    // Passo 1 — rendimento
    {
      title: "Quanto recebes por mês?",
      subtitle: "Inclui tudo que entra — salário, negócio, rendas",
      hint: sal > 0 ? null : "Escreve o valor e avança",
      valid: sal > 0,
      body: (
        <div>
          <div style={S.inputGroup}>
            <span style={S.currency}>Kz</span>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={salarioDisplay}
              onChange={e => handleSalarioChange(e.target.value)}
              placeholder="0"
              style={S.bigInput}
            />
          </div>
          {sal > 0 ? (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: "0.82em", color: "#8A8070", marginBottom: 4 }}>
                O app vai dividir automaticamente:
              </div>
              {CATS.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0D0D0D", border: "1px solid #161616", borderRadius: 12, padding: "12px 16px" }}>
                  <span style={{ color: "#A09880", fontSize: "0.92em", display: "inline-flex", alignItems: "center", gap: 6 }}><Emo e={c.emoji} size={16} color={c.color} /> {c.label}</span>
                  <span style={{ color: c.color, fontWeight: 700, fontSize: "0.95em" }}>
                    {fmtKz(sal * DEFAULT_PCT[c.id] / 100)}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: "0.78em", color: "#9F9582", textAlign: "center", marginTop: 4 }}>
                Podes ajustar estas percentagens nas Definições
              </div>

              {/* Rendimento fixo ou variável */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: "0.82em", color: "#8A8070", marginBottom: 8 }}>O teu rendimento é sempre igual?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setRendimentoVariavel(false)}
                    style={{ flex: 1, background: !rendimentoVariavel ? "#F59E0B15" : "#0A0A0A", border: `1px solid ${!rendimentoVariavel ? "#F59E0B" : "#222"}`, borderRadius: 12, padding: "12px", cursor: "pointer", fontFamily: "inherit", color: !rendimentoVariavel ? "#F59E0B" : "#8A8070", fontSize: "0.85em", fontWeight: 700 }}>
                    Fixo, é sempre igual
                  </button>
                  <button onClick={() => setRendimentoVariavel(true)}
                    style={{ flex: 1, background: rendimentoVariavel ? "#F59E0B15" : "#0A0A0A", border: `1px solid ${rendimentoVariavel ? "#F59E0B" : "#222"}`, borderRadius: 12, padding: "12px", cursor: "pointer", fontFamily: "inherit", color: rendimentoVariavel ? "#F59E0B" : "#8A8070", fontSize: "0.85em", fontWeight: 700 }}>
                    Varia todos os meses
                  </button>
                </div>
                {rendimentoVariavel && (
                  <div style={{ fontSize: "0.75em", color: "#8A8070", marginTop: 8, lineHeight: 1.5 }}>
                    Sempre que receberes, vamos perguntar-te quanto recebeste desta vez, para o teu número ficar certo.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 24, fontSize: "0.88em", color: "#9F9582", textAlign: "center", lineHeight: 1.6 }}>
              A partir deste valor calculamos quanto podes gastar cada dia sem surpresas no fim do mês
            </div>
          )}
        </div>
      ),
    },
    // Passo 2 — datas
    {
      title: "Quando recebes o teu dinheiro?",
      subtitle: "Para calcularmos o teu dia a dia com exactidão",
      valid: datasValidas,
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Toggle: começou agora? */}
          <button
            onClick={() => setSemEntradaInicial(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 10, background: "#0A0A0A",
              border: `1px solid ${semEntradaInicial ? "#F59E0B" : "#222"}`, borderRadius: 12,
              padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${semEntradaInicial ? "#F59E0B" : "#444"}`, background: semEntradaInicial ? "#F59E0B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {semEntradaInicial && <Icone nome="check" size={14} color="#000" sw={3} />}
            </div>
            <span style={{ fontSize: "0.85em", color: "#E8E0D0" }}>Comecei agora — ainda não recebi nenhum pagamento</span>
          </button>

          {!semEntradaInicial && (
            <div>
              <label style={S.label}>ÚLTIMO PAGAMENTO</label>
              <input type="date" value={dataRecebimento}
                onChange={e => setDataRecebimento(e.target.value)} style={S.dateInput} />
            </div>
          )}
          <div>
            <label style={S.label}>{semEntradaInicial ? "QUANDO RECEBES O PRIMEIRO PAGAMENTO" : "PRÓXIMO PAGAMENTO"}</label>
            <input type="date" value={proximoPagamento}
              onChange={e => setProximoPagamento(e.target.value)} style={S.dateInput} />
            {proximoPagamento && proximoPagamento <= todayStr() && (
              <div style={{ fontSize: "0.82em", color: "#EF4444", marginTop: 8 }}>
                <Icone nome="alert" size={15} style={{ marginRight: 6 }} />A data tem de ser no futuro
              </div>
            )}
            {datasValidas && (
              <div style={{ fontSize: "0.82em", color: "#22C55E", marginTop: 8 }}>
                <Icone nome="check" size={15} style={{ marginRight: 6 }} />{daysUntil(proximoPagamento)} dias até ao pagamento
              </div>
            )}
          </div>

          {semEntradaInicial && (
            <div style={{ background: "#141000", border: "1px solid #2A2010", borderRadius: 12, padding: "12px 14px", fontSize: "0.82em", color: "#C8C0B0", lineHeight: 1.55 }}>
              Como ainda não recebeste, vamos calcular o teu dia a dia a partir do teu primeiro pagamento. Até lá, o teu número será associado a essa data.
            </div>
          )}
        </div>
      ),
    },
  ];

  const cur = steps[step];

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={{ ...S.logo, display: "flex", alignItems: "center", gap: 8 }}><Sol size={24} /> Klaco</div>

        {/* Dots de progresso — visíveis */}
        <div style={S.stepDots}>
          {steps.map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: i === step ? 28 : 8, height: 8, borderRadius: 4,
                background: i < step ? "#F59E0B" : i === step ? "#F59E0B" : "#333",
                transition: "all 0.3s",
              }} />
            </div>
          ))}
          <div style={{ fontSize: "0.78em", color: "#9F9582", marginLeft: 6 }}>
            {step + 1} de {steps.length}
          </div>
        </div>

        <h2 style={S.setupTitle}>{cur.title}</h2>
        <p style={S.setupSub}>{cur.subtitle}</p>

        <div style={{ margin: "24px 0" }}>{cur.body}</div>

        {/* Botão inactivo explica o que falta */}
        {!cur.valid && step === 0 && nome.trim().length < 2 && (
          <div style={{ fontSize: "0.82em", color: "#9F9582", textAlign: "center", marginBottom: 10 }}>
            Escreve o teu nome para continuar
          </div>
        )}
        {!cur.valid && step === 1 && sal === 0 && (
          <div style={{ fontSize: "0.82em", color: "#9F9582", textAlign: "center", marginBottom: 10 }}>
            Escreve o teu rendimento para continuar
          </div>
        )}
        {!cur.valid && step === 2 && !datasValidas && (
          <div style={{ fontSize: "0.82em", color: "#9F9582", textAlign: "center", marginBottom: 10 }}>
            {!proximoPagamento ? "Indica a data do próximo pagamento" : "A data tem de ser no futuro"}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={S.backBtnSetup}>← Voltar</button>
          )}
          <button
            disabled={!cur.valid}
            onClick={() => {
              if (step < steps.length - 1) setStep(step + 1);
              else {
                onComplete({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct: { ...DEFAULT_PCT }, semEntradaInicial, rendimentoVariavel, periodoSalarioConfirmado: dataRecebimento, despesas: [] });
              }
            }}
            style={{ ...S.btn, opacity: cur.valid ? 1 : 0.35, flex: 1 }}
          >
            {step < steps.length - 1 ? "Continuar →" : "Ver quanto posso gastar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
// Valor do dia em destaque: inteiros grandes, decimais mais pequenos e "Kz" na cor da marca.
function ValorHero({ texto, corUnidade }) {
  const m = String(texto).match(/^(.*?)(,\d{2})\s*Kz$/);
  if (!m) return <span>{texto}</span>;
  return (
    <span>
      {m[1]}<span style={{ fontSize: "0.58em", opacity: 0.7 }}>{m[2]}</span>{" "}
      <span style={{ fontSize: "0.5em", color: corUnidade, fontWeight: 800 }}>Kz</span>
    </span>
  );
}

// Cartão "Pagar já": sempre visível no topo do Início durante o teste. Começa discreto e ganha
// urgência perto do fim (2 dias: mais forte; último dia: vermelho). Só apresentação.
function BannerPagarJa({ dias, onPagar }) {
  const ultimo = dias <= 1, perto = dias === 2;
  const rgb = ultimo ? "239,68,68" : "245,158,11";
  const cor = ultimo ? "#EF4444" : "#F59E0B";
  const titulo = ultimo ? "Hoje é o último dia" : perto ? "Teste termina em 2 dias" : "Paga já e poupa 50%";
  const sub = ultimo ? "Paga hoje e poupa 50%" : perto ? "Paga já e poupa 50%" : "Só até ao fim do teste";
  const r = 18, circ = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, dias / TRIAL_DAYS));
  return (
    <div style={{ margin: "6px 16px 0", minHeight: 68, borderRadius: 18, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      background: `linear-gradient(120deg,rgba(${rgb},${perto || ultimo ? 0.28 : 0.20}),rgba(${rgb},0.07))`, border: `1px solid rgba(${rgb},${perto || ultimo ? 0.6 : 0.42})` }}>
      <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
          <circle cx="23" cy="23" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
          <div style={{ fontSize: "1em", fontWeight: 800, color: "#F2EBDD" }}>{dias}</div>
          <div style={{ fontSize: "0.5em", fontWeight: 700, color: "#BDB3A0", marginTop: 1, letterSpacing: "0.04em" }}>{dias === 1 ? "DIA" : "DIAS"}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.92em", fontWeight: 800, color: "#F2EBDD" }}>{titulo}</div>
        <div style={{ fontSize: "0.76em", color: "#CFC6B4", marginTop: 2 }}>{sub}</div>
      </div>
      <button onClick={onPagar}
        style={{ height: 38, padding: "0 16px", borderRadius: 19, background: cor, color: ultimo ? "#fff" : "#1A1203", border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        Pagar já
      </button>
    </div>
  );
}

function DashboardScreen({ state, onAddExpense, onAddEntrada, onOpenCharts, onOpenGoals, onOpenConvite, notifNaoLidas = 0, onAbrirNotificacoes, bannerPagar }) {
  const { salario, dataRecebimento, proximoPagamento, despesas, pct, objectivos = [], entradasExtra = [], semEntradaInicial = false } = state;
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showComoCalcula, setShowComoCalcula] = useState(false);

  // Entradas extra (13º, bónus, subsídios) deste período somam ao rendimento
  const totalExtra = entradasExtra.reduce((s, e) => s + (e.valor || 0), 0);
  const rendimentoPeriodo = salario + totalExtra;

  // Period: dataRecebimento → proximoPagamento
  // Caso "comecei agora": antes do 1º pagamento, conta a partir de hoje (diasPassados=0).
  // Quando o 1º pagamento chega, passa a contar um período normal a partir dessa data.
  const primeiroPagamentoChegou = semEntradaInicial && daysUntil(proximoPagamento) <= 0;
  const inicioPeriodo = (semEntradaInicial && primeiroPagamentoChegou) ? proximoPagamento : dataRecebimento;
  const fimPeriodo = (semEntradaInicial && primeiroPagamentoChegou) ? addMonths(proximoPagamento, 1) : proximoPagamento;
  const diasRestantes = Math.max(0, daysUntil(fimPeriodo));
  const diasPassados = (semEntradaInicial && !primeiroPagamentoChegou) ? 0 : daysSince(inicioPeriodo);
  const diasPeriodo = diasRestantes + diasPassados;

  // Despesas por categoria
  const gastosPorCat = {};
  CATS.forEach(c => {
    gastosPorCat[c.id] = despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0);
  });
  const totalGasto = Object.values(gastosPorCat).reduce((a, b) => a + b, 0);

  // Objectivos: poupança mensal reservada por categoria
  const reservadoPorCat = {};
  CATS.forEach(c => {
    reservadoPorCat[c.id] = objectivos
      .filter(o => o.categoria === c.id)
      .reduce((s, o) => s + (o.poupancaMensal || 0), 0);
  });
  const totalReservado = Object.values(reservadoPorCat).reduce((a, b) => a + b, 0);

  // Daily rate based on FULL period
  const taxaDiaria = diasPeriodo > 0 ? rendimentoPeriodo / diasPeriodo : rendimentoPeriodo;
  const orcamentoRestante = taxaDiaria * diasRestantes;

  // Saldo real = salary - expenses - goals reserved
  const totalComprometido = totalGasto + totalReservado;
  const saldoAjustado = orcamentoRestante - totalComprometido;
  const gastoDiario = diasRestantes > 0 ? saldoAjustado / diasRestantes : saldoAjustado;
  const saldo = rendimentoPeriodo - totalComprometido;

  // Context: are we on track?
  const gastoEsperadoAteHoje = taxaDiaria * diasPassados;
  const acimaDoEsperado = totalComprometido > gastoEsperadoAteHoje;
  const diferencaVsEsperado = Math.abs(totalComprometido - gastoEsperadoAteHoje);

  // Hero tone — vermelho SÓ quando o número é negativo (limite excedido).
  // Reservar poupança para objectivos reduz o número, mas não deve pintá-lo de vermelho.
  const heroPositive = gastoDiario >= 0;

  // Estado de espera: marcou "comecei agora" e o primeiro pagamento ainda não chegou.
  // O salário inserido é a EXPECTATIVA, não algo já recebido — por isso não depende de ser zero.
  const aguardaPrimeiroPagamento = semEntradaInicial && !primeiroPagamentoChegou;
  const dataPrimeiroFmt = (() => {
    try {
      const d = new Date(proximoPagamento + "T00:00:00");
      return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
    } catch { return proximoPagamento; }
  })();

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={{ ...S.header, paddingBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sol size={28} />
          <div style={{ fontSize: "1.3em", fontWeight: 800, color: "#F59E0B", letterSpacing: "-0.01em" }}>Klaco</div>
        </div>
        {onAbrirNotificacoes && (
          <button onClick={onAbrirNotificacoes} aria-label="Notificações"
            style={{ position: "relative", background: "#101010", border: "1px solid #1E1E1E", borderRadius: "50%", width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <Icone nome="bell" size={21} color="#E8E0D0" />
            {notifNaoLidas > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: "#EF4444", color: "#fff", fontSize: "0.62em", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {notifNaoLidas > 9 ? "9+" : notifNaoLidas}
              </span>
            )}
          </button>
        )}
      </div>

      {bannerPagar}

      {/* Hero */}
      <div style={{
        ...S.heroCard,
        background: heroPositive
          ? "linear-gradient(160deg,rgba(245,158,11,0.16),rgba(245,158,11,0.03) 60%)"
          : "linear-gradient(160deg,rgba(239,68,68,0.16),rgba(239,68,68,0.03) 60%)",
        borderColor: heroPositive ? "rgba(245,158,11,0.30)" : "rgba(239,68,68,0.35)",
      }}>
        {aguardaPrimeiroPagamento ? (
          <>
            <div style={{ ...S.heroLabel, color: "#F5C46B" }}>O TEU PRIMEIRO PAGAMENTO ESTÁ A CHEGAR</div>
            <div style={{ ...S.heroAmount, color: "#F2EBDD", fontSize: "2.2em" }}>Em breve</div>
            <div style={{ ...S.heroSub, color: "#BDB3A0", lineHeight: 1.5 }}>
              A partir de {dataPrimeiroFmt}, vais saber exactamente quanto podes gastar todos os dias.
            </div>
            <div style={S.heroDivider} />
            <div style={{ fontSize: "0.85em", color: "#BDB3A0", lineHeight: 1.5 }}>
              Faltam {diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}. Até lá, podes ir conhecendo a Klaco.
            </div>
          </>
        ) : (
          <>
            <div style={{ ...S.heroLabel, color: heroPositive ? "#F5C46B" : "#F87171" }}>
              {gastoDiario >= 0 ? "PODES GASTAR HOJE" : "LIMITE DIÁRIO EXCEDIDO"}
            </div>
            <button onClick={() => setShowComoCalcula(true)} aria-label="Como calculamos o teu número"
              style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "block", width: "100%", textAlign: "left" }}>
              <div style={{ ...S.heroAmount, color: heroPositive ? "#F2EBDD" : "#F87171", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0 12px" }}>
                <ValorHero texto={gastoDiario >= 0 ? fmtKz(gastoDiario) : `−${fmtKz(Math.abs(gastoDiario))}`} corUnidade={heroPositive ? "#F59E0B" : "#F87171"} />
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", border: "1.8px solid #F5C46B", color: "#F5C46B", font: "italic 700 15px Georgia, serif", flexShrink: 0 }}>i</span>
              </div>
            </button>
            <div style={{ ...S.heroSub, color: heroPositive ? "#BDB3A0" : "#F0A090" }}>
              {gastoDiario >= 0
                ? `${diasRestantes} dias até ao próximo pagamento`
                : `Precisas de compensar nos próximos ${diasRestantes} dias`}
            </div>
            <div style={S.heroDivider} />
            <div style={S.heroRow}>
              <div>
                <div style={S.heroSmallLabel}>Sobra este mês</div>
                <div style={{ ...S.heroSmall, color: saldo >= 0 ? "#F2EBDD" : "#EF4444" }}>{fmtKz(saldo)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={S.heroSmallLabel}>Já gastaste</div>
                <div style={{ ...S.heroSmall, color: "#F2EBDD" }}>{fmtKz(totalGasto)}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Categories */}
      <div style={{ ...S.sectionLabel, display: "flex", justifyContent: "space-between" }}><span>DISTRIBUIÇÃO</span><span>{CATS.map(c => pct[c.id]).join(" · ")}</span></div>
      <div style={S.categoryList}>
        {CATS.map(c => {
          const gasto = gastosPorCat[c.id];
          const reservado = reservadoPorCat[c.id] || 0;
          const orc = salario * pct[c.id] / 100;
          const totalUsado = gasto + reservado;
          const pctUsed = orc > 0 ? Math.min(100, (totalUsado / orc) * 100) : 0;
          const over = totalUsado > orc;
          const restante = orc - totalUsado;
          // Taxa diária desta categoria: igual lógica do número principal — orçamento do
          // PERÍODO INTEIRO dividido pelos dias do período inteiro (não pelos dias restantes
          // do que sobra), para bater sempre com o "PODES GASTAR HOJE".
          const taxaDiariaCat = diasPeriodo > 0 ? orc / diasPeriodo : orc;
          const restanteAjustadoCat = (taxaDiariaCat * diasRestantes) - totalUsado;
          const hojeCat = diasRestantes > 0 ? restanteAjustadoCat / diasRestantes : restanteAjustadoCat;
          return (
            <div key={c.id} style={S.categoryCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${c.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Emo e={c.emoji} size={22} color={c.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.catName}>{c.label}</div>
                  {aguardaPrimeiroPagamento
                    ? <div style={{ fontSize: "0.8em", color: "#9F9582", fontWeight: 600, marginTop: 2 }}>Em breve saberás</div>
                    : over
                    ? <div style={{ ...S.overAlert, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}><Icone nome="alert" size={14} />Excedeste em {fmtKz(totalUsado - orc)}</div>
                    : <div style={{ fontSize: "0.8em", color: "#22C55E", fontWeight: 600, marginTop: 2 }}>{fmtKz(restante)} disponível</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  {aguardaPrimeiroPagamento ? (
                    <div style={{ color: "#9F9582", fontWeight: 700, fontSize: "0.85em" }}>em breve</div>
                  ) : (diasRestantes > 0 && hojeCat > 0) ? (
                    <>
                      <div style={{ fontSize: "0.66em", color: "#9F9582", fontWeight: 700, letterSpacing: "0.06em" }}>HOJE</div>
                      <div style={{ fontSize: "0.95em", fontWeight: 800, color: "#F2EBDD" }}>{fmtKz(hojeCat)}</div>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ ...S.barBg, marginTop: 12 }}>
                <div style={{ ...S.barFill, width: `${aguardaPrimeiroPagamento ? 0 : pctUsed}%`, background: over ? "#EF4444" : c.color }} />
              </div>
              {!aguardaPrimeiroPagamento && (
                <div style={{ fontSize: "0.75em", color: "#9F9582", marginTop: 8 }}>
                  {fmtKz(gasto)}{reservado > 0 ? ` + ${fmtKz(reservado)} obj.` : ""} de {fmtKz(orc)} ({pct[c.id]}%)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão fixo "Adicionar": abre a escolha entre gasto e entrada (como antes) */}
      {!showAddMenu && (
        <button onClick={() => setShowAddMenu(true)} aria-label="Adicionar"
          style={{ position: "fixed", right: "max(18px, calc(50% - 222px))", bottom: "calc(100px + env(safe-area-inset-bottom, 0px))", zIndex: 90, height: 54, padding: "0 22px 0 16px", borderRadius: 27, background: "#F59E0B", border: "none", color: "#1A1203", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(245,158,11,0.35)" }}>
          <Icone nome="plus" size={22} color="#1A1203" sw={2.4} /> Adicionar
        </button>
      )}
      {showAddMenu && (
        <div onClick={() => setShowAddMenu(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 150, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "slideUp 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1C1C1C", borderRadius: "24px 24px 0 0", padding: "20px 16px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
            {[
              { ic: "cart", txt: "Novo registo (gasto ou investimento)", fn: onAddExpense },
              { ic: "arrowin", txt: "Adicionar uma entrada (salário extra, 13º, bónus)", fn: onAddEntrada },
            ].map(op => (
              <button key={op.ic} onClick={() => { setShowAddMenu(false); op.fn(); }}
                style={{ width: "100%", background: "#101010", border: "1px solid #1C1C1C", borderRadius: 14, padding: "14px 16px", marginBottom: 10, color: "#F2EBDD", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icone nome={op.ic} size={20} color="#F59E0B" />
                </span>
                {op.txt}
              </button>
            ))}
            <button onClick={() => setShowAddMenu(false)}
              style={{ width: "100%", background: "transparent", border: "none", padding: "12px", color: "#BDB3A0", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: como é calculado o número */}
      {showComoCalcula && (
        <div onClick={() => setShowComoCalcula(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, animation: "slideUp 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 20, padding: "26px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Sol size={28} />
              <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#F2EBDD", lineHeight: 1.25 }}>Como calculamos o teu número</div>
            </div>
            <p style={{ fontSize: "0.92em", color: "#C8C0B0", lineHeight: 1.65, marginBottom: 18 }}>
              Pegamos no que tens para este período, tiramos o que já gastaste, e dividimos pelos dias que faltam até ao próximo pagamento.
            </p>
            <p style={{ fontSize: "0.92em", color: "#F59E0B", fontWeight: 700, lineHeight: 1.55, marginBottom: 22 }}>
              Regista sempre gastos e entradas.<br />O número fica mais certo.
            </p>
            <button onClick={() => setShowComoCalcula(false)} style={S.btn}>Percebi</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS (edit salário, datas, percentagens) ──────────────────────────────
function EtiquetasScreen({ etiquetasCustom = {}, onDelete, onBack }) {
  const temAlguma = Object.values(etiquetasCustom).some(arr => (arr || []).length > 0);
  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>As minhas etiquetas</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <p style={{ fontSize: "0.85em", color: "#8A8070", lineHeight: 1.6, marginBottom: 20 }}>
          Estas são as descrições que guardaste. Aparecem como sugestão quando lanças uma despesa, para não teres de escrever sempre o mesmo.
        </p>
        {!temAlguma && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9F9582" }}>
            <div style={{ marginBottom: 12 }}><Icone nome="tag" size={44} color="#9F9582" /></div>
            <div style={{ fontSize: "0.9em", lineHeight: 1.6 }}>
              Ainda não guardaste nenhuma etiqueta.<br />
              Quando lançares uma despesa com um nome novo, podes guardá-lo aqui.
            </div>
          </div>
        )}
        {CATS.map(cat => {
          const lista = etiquetasCustom[cat.id] || [];
          if (lista.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Emo e={cat.emoji} size={20} color={cat.color || "#F59E0B"} />
                <span style={{ fontSize: "0.8em", fontWeight: 700, color: cat.color, letterSpacing: "0.04em" }}>{cat.label.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {lista.map((nome, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 20, padding: "8px 12px 8px 14px" }}>
                    <span style={{ fontSize: "0.85em", color: "#DDD" }}>{nome}</span>
                    <button onClick={() => onDelete(cat.id, nome)}
                      style={{ background: "transparent", border: "none", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontSize: "1em", padding: 0, lineHeight: 1 }}><Icone nome="x" size={20} /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Linha de contacto reutilizada na secção «Suporte e dúvidas».
function LinhaContacto({ icone, titulo, endereco, href, externo }) {
  return (
    <a href={href} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={{ display: "flex", alignItems: "center", gap: 14, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px 16px", marginBottom: 10, textDecoration: "none" }}>
      <Icone nome={icone} size={24} color="#F59E0B" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82em", color: "#A09880", lineHeight: 1.4 }}>{titulo}</div>
        <div style={{ fontSize: "0.92em", color: "#F59E0B", fontWeight: 700, marginTop: 3, wordBreak: "break-all" }}>{endereco}</div>
      </div>
    </a>
  );
}

function SuporteModal({ onFechar }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 20px 36px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 6 }}>Suporte e dúvidas</div>
        <p style={{ color: "#8A8070", fontSize: "0.85em", lineHeight: 1.5, marginBottom: 18 }}>Escolhe o contacto certo para o que precisas.</p>
        <LinhaContacto icone="list" titulo="Pagamentos e comprovativos" endereco={CONTACTOS.invoice} href={`mailto:${CONTACTOS.invoice}`} />
        <LinhaContacto icone="bulb" titulo="Sugestões, elogios, pedidos de informação e assuntos comerciais" endereco={CONTACTOS.comercial} href={`mailto:${CONTACTOS.comercial}`} />
        <LinhaContacto icone="wrench" titulo="Problemas técnicos, bugs e dificuldades de utilização" endereco={CONTACTOS.suporte} href={`mailto:${CONTACTOS.suporte}`} />
        <LinhaContacto icone="chat" titulo="WhatsApp" endereco={CONTACTOS.whatsappTexto} href={`https://wa.me/${CONTACTOS.whatsapp}`} externo />
        <button onClick={onFechar}
          style={{ width: "100%", background: "transparent", border: "1px solid #2A2A2A", borderRadius: 14, padding: "14px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// Ícone e rótulo por tipo de notificação. Só rotula o que é inequívoco (aprovado, rejeitado, lembrete);
// os restantes tipos aparecem tal como vêm do servidor, sem adivinhar distinções.
function infoTipoNotif(tipo) {
  const t = String(tipo || "").toLowerCase();
  const legivel = t ? t.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()) : "Notificação";
  if (t.includes("aprov")) return { icone: "checkCircle", cor: "#22C55E", rotulo: "Pagamento aprovado" };
  if (t.includes("rejeit")) return { icone: "xCircle", cor: "#EF4444", rotulo: "Pagamento rejeitado" };
  if (t.includes("lembrete")) return { icone: "bell", cor: "#F59E0B", rotulo: "Lembrete diário" };
  if (t.includes("trial") || t.includes("teste") || t.includes("subscri") || t.includes("expir")) return { icone: "hourglass", cor: "#F59E0B", rotulo: legivel };
  return { icone: "bell", cor: "#F59E0B", rotulo: legivel };
}

function NotificacoesModal({ itens, onFechar, onMarcarLidas }) {
  const naoLidas = itens.filter(n => n.lida !== true);
  const fmt = (n) => {
    const ms = dataNotif(n);
    if (!ms) return "";
    return new Intl.DateTimeFormat("pt-PT", { timeZone: FUSO_ANGOLA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "24px 20px 32px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0" }}>Notificações</div>
          <button onClick={onFechar} aria-label="Fechar"
            style={{ background: "transparent", border: "none", color: "#8A8070", fontSize: "1.3em", cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}><Icone nome="x" size={20} /></button>
        </div>
        {naoLidas.length > 0 && (
          <button onClick={() => onMarcarLidas(naoLidas.map(n => n.id))}
            style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "#F59E0B", fontSize: "0.82em", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, padding: 0 }}>
            Marcar todas como lidas
          </button>
        )}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {itens.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9F9582", fontSize: "0.9em", padding: "36px 0" }}>Ainda não tens notificações.</div>
          ) : itens.map(n => {
            const { icone, cor, rotulo } = infoTipoNotif(n.tipo);
            const lida = n.lida === true;
            return (
              <button key={n.id} onClick={() => { if (!lida) onMarcarLidas([n.id]); }}
                style={{ width: "100%", textAlign: "left", display: "flex", gap: 12, background: lida ? "transparent" : "#141000", border: `1px solid ${lida ? "#161616" : "#2A2000"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: lida ? "default" : "pointer", fontFamily: "inherit" }}>
                <Icone nome={icone} size={24} color={cor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#E8E0D0", fontWeight: lida ? 600 : 800, fontSize: "0.9em" }}>{n.titulo || n.title || rotulo}</span>
                    {!lida && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />}
                  </div>
                  {(n.mensagem || n.message) && <div style={{ color: "#A09880", fontSize: "0.82em", lineHeight: 1.5, marginTop: 3 }}>{n.mensagem || n.message}</div>}
                  <div style={{ color: "#9F9582", fontSize: "0.72em", marginTop: 6 }}>{rotulo}{fmt(n) ? ` · ${fmt(n)}` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Linha das Definições: ícone, título, subtítulo e seta (ou interruptor).
function LinhaConfig({ icone, titulo, sub, onClick, tipo = "seta", ativo, onToggle, ultimo }) {
  const perigo = tipo === "perigo";
  const miolo = (
    <>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: perigo ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone nome={icone} size={20} color={perigo ? "#EF4444" : "#F59E0B"} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: "0.95em", fontWeight: 700, color: perigo ? "#EF4444" : "#F2EBDD" }}>{titulo}</div>
        {sub && <div style={{ fontSize: "0.78em", color: "#BDB3A0", marginTop: 2, lineHeight: 1.35 }}>{sub}</div>}
      </div>
    </>
  );
  const base = { display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", borderBottom: ultimo ? "none" : "1px solid #1A1A1A" };
  if (tipo === "toggle") {
    return (
      <div style={base}>
        {miolo}
        <button onClick={onToggle} aria-pressed={!!ativo} aria-label={titulo}
          style={{ width: 46, height: 28, borderRadius: 14, background: ativo ? "#F59E0B" : "#2A2A2A", position: "relative", cursor: "pointer", flexShrink: 0, border: "none", transition: "background 0.2s", padding: 0 }}>
          <div style={{ position: "absolute", top: 3, left: ativo ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: ativo ? "#1A1203" : "#8A8070", transition: "left 0.2s" }} />
        </button>
      </div>
    );
  }
  return (
    <button onClick={onClick} style={{ ...base, width: "100%", background: "transparent", border: "none", borderBottom: base.borderBottom, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
      {miolo}
      {!perigo && <Icone nome="chev" size={18} color="#8A8070" sw={2} />}
    </button>
  );
}
function GrupoConfig({ titulo, children }) {
  return (
    <>
      {titulo && <div style={{ fontSize: "0.72em", fontWeight: 700, letterSpacing: "0.09em", color: "#9F9582", margin: "20px 4px 8px" }}>{titulo}</div>}
      <div style={{ background: "#101010", border: "1px solid #1C1C1C", borderRadius: 18, overflow: "hidden", marginTop: titulo ? 0 : 20 }}>{children}</div>
    </>
  );
}

function SettingsScreen({ state, onToggleNotif, onBack, onEditarDados, onVerDespesas, onVerEntradas, onOpenConvite, onVerEtiquetas, onOpenPlano, planoSub, onOpenAvaliacao, isAdmin, onOpenAdmin, onLogout, diasTeste }) {
  const [mostrarSuporte, setMostrarSuporte] = useState(false);
  const [confirmarLogout, setConfirmarLogout] = useState(false);

  const paga = acessoPagoValido(state.estadoConta, state.acessoAte);
  const nomePlano = state.planoAtivo === "anual" ? "Anual" : state.planoAtivo === "mensal" ? "Mensal" : "";
  const fmtD = (iso) => { try { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; } catch (e) { return iso; } };

  return (
    <div style={S.screen}>
      <div style={{ padding: "8px 20px 0" }}>
        <div style={{ fontSize: "1.8em", fontWeight: 800, letterSpacing: "-0.02em", color: "#F2EBDD" }}>Definições</div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {/* Cartão de conta — nome + estado (ADMIN, conta ativa ou teste) */}
        <div style={{ marginTop: 16, background: "#101010", border: `1px solid ${isAdmin ? "#F59E0B" : paga ? "#22C55E" : "rgba(245,158,11,0.28)"}`, borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#F59E0B", color: "#1A1203", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35em", fontWeight: 800, flexShrink: 0 }}>
            {(state.nome || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "1.05em", fontWeight: 800, color: "#F2EBDD" }}>{state.nome || "A minha conta"}</div>
            {isAdmin ? (
              <div style={{ display: "inline-block", marginTop: 4, padding: "2px 10px", borderRadius: 20, background: "#F59E0B", color: "#080808", fontSize: "0.72em", fontWeight: 800, letterSpacing: "0.08em" }}>ADMIN</div>
            ) : paga ? (
              <div style={{ fontSize: "0.8em", color: "#22C55E", fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <Icone nome="check" size={14} sw={2.4} />Conta ativa{nomePlano ? ` · ${nomePlano}` : ""}{state.acessoAte ? ` · até ${fmtD(state.acessoAte)}` : ""}
              </div>
            ) : (
              <div style={{ fontSize: "0.82em", color: "#BDB3A0", marginTop: 3 }}>
                {typeof diasTeste === "number" ? `Teste grátis · ${diasTeste} ${diasTeste === 1 ? "dia" : "dias"}` : "Conta gratuita · período de teste"}
              </div>
            )}
          </div>
          {!isAdmin && !paga && (
            <button onClick={onOpenPlano}
              style={{ padding: "9px 14px", borderRadius: 20, background: "#F59E0B", color: "#1A1203", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              Pagar já
            </button>
          )}
        </div>

        {isAdmin && (
          <GrupoConfig titulo="ADMINISTRAÇÃO">
            <LinhaConfig icone="wrench" titulo="Painel de administração" sub="Gerir utilizadores e confirmar pagamentos" onClick={onOpenAdmin} ultimo />
          </GrupoConfig>
        )}

        <GrupoConfig titulo="CONTA">
          {!isAdmin && <LinhaConfig icone="card" titulo="Meu plano" sub={planoSub} onClick={onOpenPlano} />}
          <LinhaConfig icone="user" titulo="Editar os meus dados" sub="Nome, rendimento, datas e percentagens" onClick={onEditarDados} />
          {/* [DEV] Cada interruptor reflecte o consentimento. O backend só envia cada tipo a quem tem o respectivo consentimento ligado. */}
          <LinhaConfig icone="bell" tipo="toggle" titulo="Lembrete diário" sub="Saber quanto podes gastar hoje" ativo={state.notifLembrete} onToggle={() => onToggleNotif("notifLembrete")} />
          <LinhaConfig icone="megaphone" tipo="toggle" titulo="Novidades e promoções" sub="Ofertas e atualizações da Klaco" ativo={state.notifNovidades} onToggle={() => onToggleNotif("notifNovidades")} ultimo />
        </GrupoConfig>

        <GrupoConfig titulo="O TEU DINHEIRO">
          <LinhaConfig icone="list" titulo="Todas as despesas" sub="Ver, editar ou apagar" onClick={onVerDespesas} />
          <LinhaConfig icone="arrowin" titulo="Todas as entradas" sub="13º, bónus, subsídios e mais" onClick={onVerEntradas} />
          <LinhaConfig icone="tag" titulo="As minhas etiquetas" sub="Descrições guardadas para lançar mais rápido" onClick={onVerEtiquetas} ultimo />
        </GrupoConfig>

        <GrupoConfig titulo="COMUNIDADE E AJUDA">
          <LinhaConfig icone="users" titulo="Convidar amigos" sub="Convida amigos para a Klaco" onClick={onOpenConvite} />
          <LinhaConfig icone="star" titulo="Deixar a tua opinião" sub="Avalia a Klaco e diz-nos o que achas" onClick={onOpenAvaliacao} />
          <LinhaConfig icone="chat" titulo="Suporte e dúvidas" sub="Pagamentos, sugestões e problemas técnicos" onClick={() => setMostrarSuporte(true)} ultimo />
        </GrupoConfig>

        {/* SAIR DA CONTA — visível, com confirmação antes de terminar a sessão */}
        <GrupoConfig>
          <LinhaConfig icone="logout" tipo="perigo" titulo="Sair da conta" sub="Terminar sessão neste aparelho" onClick={() => setConfirmarLogout(true)} ultimo />
        </GrupoConfig>
      </div>

      {mostrarSuporte && <SuporteModal onFechar={() => setMostrarSuporte(false)} />}

      {confirmarLogout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px" }}>
            <div style={{ fontSize: "1.05em", fontWeight: 800, color: "#E8E0D0", marginBottom: 10 }}>Sair da conta?</div>
            <p style={{ color: "#A09880", fontSize: "0.9em", lineHeight: 1.6, marginBottom: 22 }}>
              Terás de confirmar novamente o teu email ou telefone para entrar.
            </p>
            <button onClick={onLogout}
              style={{ width: "100%", background: "#EF4444", border: "none", borderRadius: 14, padding: "15px", color: "#fff", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
              Sair
            </button>
            <button onClick={() => setConfirmarLogout(false)}
              style={{ width: "100%", background: "transparent", border: "1px solid #2A2A2A", borderRadius: 14, padding: "15px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EDITAR OS MEUS DADOS ──────────────────────────────────────────────────────
function EditarDadosScreen({ state, onSave, onBack }) {
  const [nome, setNome] = useState(state.nome || "");
  const [salario, setSalario] = useState(String(state.salario));
  const [salarioDisplay, setSalarioDisplay] = useState(
    state.salario ? String(state.salario).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
  );
  const [dataRecebimento, setDataRecebimento] = useState(state.dataRecebimento);
  const [proximoPagamento, setProximoPagamento] = useState(state.proximoPagamento);
  const [pct, setPct] = useState({ ...state.pct });
  const [guardado, setGuardado] = useState(false);

  const handleSalario = (raw) => {
    const { valor, display } = parseValorInput(raw);
    setSalario(valor ? String(valor) : "");
    setSalarioDisplay(display);
  };

  const handlePct = (id, raw) => {
    if (raw === "" || raw === "-") { setPct(prev => ({ ...prev, [id]: "" })); return; }
    const val = Math.min(100, Math.max(0, parseInt(raw) || 0));
    setPct(prev => ({ ...prev, [id]: val }));
  };

  const totalPct = Object.values(pct).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const sal = parseFloat(salario) || 0;
  const valid = sal > 0 && totalPct === 100 && dataRecebimento && proximoPagamento;

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Os meus dados</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={S.field}>
          <label style={S.label}>O TEU NOME</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="O teu nome" style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>RENDIMENTO MENSAL (Kz)</label>
          <div style={{ ...S.inputGroup, marginTop: 0 }}>
            <span style={S.currency}>Kz</span>
            <input type="text" inputMode="numeric" value={salarioDisplay} onChange={e => handleSalario(e.target.value)}
              placeholder="0" style={S.bigInput} />
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>DATA DO ÚLTIMO PAGAMENTO</label>
          <input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} style={S.dateInput} />
        </div>
        <div style={S.field}>
          <label style={S.label}>DATA DO PRÓXIMO PAGAMENTO</label>
          <input type="date" value={proximoPagamento} onChange={e => setProximoPagamento(e.target.value)} style={S.dateInput} />
        </div>

        <label style={{ ...S.label, marginBottom: 12, display: "block" }}>PERCENTAGENS</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {CATS.map(c => (
            <div key={c.id} style={{ background: "#0A0A0A", border: `1px solid ${c.color}30`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9em", color: "#DDD", display: "inline-flex", alignItems: "center", gap: 6 }}><Emo e={c.emoji} size={16} color={c.color} /> {c.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="0" max="100" value={pct[c.id]} onChange={e => handlePct(c.id, e.target.value)}
                    style={{ width: 52, background: "#111", border: `1px solid ${c.color}60`, borderRadius: 8, padding: "5px 8px", color: c.color, fontWeight: 800, fontFamily: "inherit", outline: "none", textAlign: "center", fontSize: "0.95em" }} />
                  <span style={{ color: "#8A8070" }}>%</span>
                </div>
              </div>
              <div style={{ height: 4, background: "#1A1A1A", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct[c.id]}%`, height: "100%", background: c.color, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: "0.75em", color: c.color, marginTop: 5 }}>{fmtKz(sal * pct[c.id] / 100)}</div>
            </div>
          ))}
          <div style={{ textAlign: "center", fontSize: "0.82em", fontWeight: 700, color: totalPct === 100 ? "#22C55E" : "#EF4444", padding: "6px", borderRadius: 8, background: totalPct === 100 ? "#22C55E10" : "#EF444410" }}>
            {totalPct === 100 ? <><Icone nome="check" size={15} sw={2.4} /> 100% — perfeito!</> : `Total: ${totalPct}%`}
          </div>
        </div>

        <button disabled={!valid} onClick={() => { onSave({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct }); setGuardado(true); setTimeout(() => setGuardado(false), 2600); }}
          style={{ ...S.btn, opacity: valid ? 1 : 0.4, marginBottom: 12 }}>
          Guardar alterações
        </button>
        {guardado && (
          <div style={{ background: "#0A1A0A", border: "1px solid #22C55E40", borderRadius: 12, padding: "12px 16px", marginBottom: 20, animation: "slideUp 0.2s ease", display: "flex", alignItems: "center", gap: 8 }}>
            <Icone nome="check" size={16} sw={2.6} />
            <span style={{ fontSize: "0.86em", color: "#22C55E", fontWeight: 600 }}>Guardado. O teu número já reflete as alterações.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADD EXPENSE (with smart suggestions + custom library) ─────────────────────
function AddExpenseScreen({ onSave, onBack, despesasAnteriores, saldoRestante, etiquetasCustom = {} }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [categoria, setCategoria] = useState("necessidades");
  const [data, setData] = useState(todayStr());
  const [showSugg, setShowSugg] = useState(true);
  const [guardarEtiqueta, setGuardarEtiqueta] = useState(false);

  // Build suggestion list: pre-defined + custom saved labels + user's own past descriptions
  const pastNames = [...new Set(despesasAnteriores.map(d => d.descricao))];
  const catSugg = SUGESTOES[categoria] || [];
  const predefinedNames = catSugg.map(s => s.nome);
  // Etiquetas guardadas pelo utilizador nesta categoria (nas configurações ou ao gravar)
  const savedLabels = (etiquetasCustom[categoria] || [])
    .filter(n => !predefinedNames.includes(n))
    .map(n => ({ nome: n, emoji: "🏷️" }));
  const savedNames = savedLabels.map(s => s.nome);
  // User's past expenses in this category not already in predefined or saved
  const userCustom = pastNames
    .filter(n => despesasAnteriores.some(d => d.categoria === categoria && d.descricao === n))
    .filter(n => !predefinedNames.includes(n) && !savedNames.includes(n))
    .map(n => ({ nome: n, emoji: "📝" }));
  const allSugg = [...catSugg, ...savedLabels, ...userCustom];
  const filtered = descricao.trim()
    ? allSugg.filter(s => s.nome.toLowerCase().includes(descricao.toLowerCase()))
    : allSugg;

  // A descrição atual é nova (não está em sugestões nem guardada)?
  const descricaoNova = descricao.trim() &&
    !predefinedNames.some(n => n.toLowerCase() === descricao.trim().toLowerCase()) &&
    !savedNames.some(n => n.toLowerCase() === descricao.trim().toLowerCase());

  const cat = CATS.find(c => c.id === categoria);
  const v = parseFloat(valor) || 0;
  const sobraAposEsta = saldoRestante - v;

  const pickSugg = (s) => {
    setDescricao(s.nome);
    setShowSugg(false);
  };

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Novo registo</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>

        {/* Category selector FIRST — so suggestions are contextual */}
        <div style={S.field}>
          <label style={S.label}>CATEGORIA</label>
          <div style={{ display: "flex", gap: 8 }}>
            {CATS.map(c => (
              <button key={c.id} onClick={() => { setCategoria(c.id); setShowSugg(true); }}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  background: categoria === c.id ? `${c.color}18` : "#0F0F0F",
                  border: `1px solid ${categoria === c.id ? c.color : "#1E1E1E"}`,
                  borderRadius: 12, padding: "10px 6px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                <Emo e={c.emoji} size={24} color={c.color} />
                <span style={{ fontSize: "0.68em", fontWeight: 700, color: categoria === c.id ? c.color : "#8A8070", textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description with suggestions */}
        <div style={S.field}>
          <label style={S.label}>O QUE FOI?</label>
          <input value={descricao}
            onChange={e => { setDescricao(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            placeholder="Escreve ou escolhe abaixo..."
            style={S.input} />

          {/* Suggestions grid */}
          {showSugg && filtered.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "0.68em", color: "#9F9582", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
                {descricao ? "SUGESTÕES" : `COMUNS EM ${cat?.label?.toUpperCase()}`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {filtered.map((s, i) => (
                  <button key={i} onClick={() => pickSugg(s)}
                    style={{ display: "flex", alignItems: "center", gap: 5,
                      background: descricao === s.nome ? `${cat?.color}20` : "#111",
                      border: `1px solid ${descricao === s.nome ? cat?.color : "#222"}`,
                      borderRadius: 20, padding: "6px 12px", cursor: "pointer",
                      fontFamily: "inherit", fontSize: "0.8em",
                      color: descricao === s.nome ? cat?.color : "#A09880",
                      transition: "all 0.15s" }}>
                    <Emo e={s.emoji} size={15} color="currentColor" />
                    <span>{s.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Value */}
        <div style={S.field}>
          <label style={S.label}>VALOR (Kz)</label>
          <div style={{ position: "relative" }}>
            <span style={S.inputPrefix}>Kz</span>
            <input
              type="text"
              inputMode="decimal"
              value={valorDisplay}
              onChange={e => {
                const { valor: nv, display } = parseValorInput(e.target.value);
                setValor(nv ? String(nv) : "");
                setValorDisplay(display);
              }}
              placeholder="0"
              style={{ ...S.input, paddingLeft: 44 }}
            />
          </div>
          {v > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78em", marginBottom: 4 }}>
                <span style={{ color: "#8A8070" }}>Estás a gastar:</span>
                <span style={{ fontWeight: 700, color: "#F59E0B" }}>{fmtKz(v)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78em" }}>
                <span style={{ color: "#8A8070" }}>Saldo após esta despesa:</span>
                <span style={{ fontWeight: 700, color: sobraAposEsta >= 0 ? "#22C55E" : "#EF4444" }}>
                  {fmtKz(sobraAposEsta)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div style={S.field}>
          <label style={S.label}>DATA</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={S.dateInput} />
        </div>

        {/* Guardar como etiqueta — só se a descrição for nova */}
        {descricaoNova && (
          <button onClick={() => setGuardarEtiqueta(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: guardarEtiqueta ? "#F59E0B15" : "#0A0A0A", border: `1px solid ${guardarEtiqueta ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", marginBottom: 16, textAlign: "left" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${guardarEtiqueta ? "#F59E0B" : "#444"}`, background: guardarEtiqueta ? "#F59E0B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {guardarEtiqueta && <Icone nome="check" size={12} color="#000" sw={3.2} />}
            </div>
            <span style={{ fontSize: "0.85em", color: "#C8C0B0", display: "inline-flex", alignItems: "center", gap: 6 }}><Icone nome="tag" size={15} /> Guardar "{descricao.trim()}" para a próxima vez</span>
          </button>
        )}

        <button
          disabled={!descricao || !valor || v <= 0}
          onClick={() => onSave({ id: Date.now(), descricao: descricao.trim(), valor: v, categoria, data }, guardarEtiqueta && descricaoNova)}
          style={{ ...S.btn, opacity: descricao && v > 0 ? 1 : 0.4 }}>
          Guardar registo
        </button>
      </div>
    </div>
  );
}

// ── GOALS SCREEN ─────────────────────────────────────────────────────────────
function GoalsScreen({ state, onBack, onSaveGoal, onDeleteGoal, onAddToGoal, onUpdateGoal }) {
  const { salario, objectivos = [], despesas, pct } = state;
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [nomeDisplay, setNomeDisplay] = useState("");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorAlvoDisplay, setValorAlvoDisplay] = useState("");
  const [poupancaMensal, setPoupancaMensal] = useState("");
  const [poupancaMensalDisplay, setPoupancaMensalDisplay] = useState("");
  const [categoria, setCategoria] = useState("investimento");
  const [emoji, setEmoji] = useState("🎯");
  const [addandoId, setAddandoId] = useState(null);      // objetivo a receber poupança
  const [valorAdd, setValorAdd] = useState("");
  const [valorAddDisplay, setValorAddDisplay] = useState("");
  const [editandoId, setEditandoId] = useState(null);    // objetivo em edição (null = criar novo)
  const [acumulacaoAuto, setAcumulacaoAuto] = useState(false); // acumula a poupança mensal sozinho
  const [acumuladoEdit, setAcumuladoEdit] = useState("");
  const [acumuladoEditDisplay, setAcumuladoEditDisplay] = useState("");

  const abrirEdicao = (obj) => {
    setEditandoId(obj.id);
    setNome(obj.nome);
    setEmoji(obj.emoji);
    setValorAlvo(String(obj.valorAlvo));
    setValorAlvoDisplay(String(obj.valorAlvo).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setPoupancaMensal(String(obj.poupancaMensal));
    setPoupancaMensalDisplay(String(obj.poupancaMensal).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setCategoria(obj.categoria);
    setAcumulacaoAuto(!!obj.acumulacaoAuto);
    setAcumuladoEdit(String(obj.acumulado || 0));
    setAcumuladoEditDisplay(String(obj.acumulado || 0).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setShowForm(true);
  };

  const limparForm = () => {
    setShowForm(false); setEditandoId(null);
    setNome(""); setValorAlvo(""); setValorAlvoDisplay("");
    setPoupancaMensal(""); setPoupancaMensalDisplay(""); setEmoji("🎯");
    setAcumulacaoAuto(false);
    setAcumuladoEdit(""); setAcumuladoEditDisplay("");
  };

  const EMOJIS = ["🎯","🚗","🏠","✈️","📱","💍","🎓","💼","🏖️","🛒","💊","🎁"];
  const SUGESTOES_OBJ_FIXAS = [
    { nome: "Fundo de emergência", emoji: "🏥" },
    { nome: "Viagem", emoji: "✈️" },
    { nome: "Comprar carro", emoji: "🚗" },
    { nome: "Casa", emoji: "🏠" },
    { nome: "Estudos", emoji: "🎓" },
    { nome: "Casamento", emoji: "💍" },
    { nome: "Telemóvel", emoji: "📱" },
  ];
  // Junta as sugestões fixas com as que o utilizador já criou (ex: "Aniversário"),
  // sem repetir. Assim as sugestões próprias ficam guardadas e reaparecem.
  const nomesGuardados = state.sugestoesObjGuardadas || [];
  const SUGESTOES_OBJ = [
    ...nomesGuardados.filter(g => !SUGESTOES_OBJ_FIXAS.some(f => f.nome.toLowerCase() === g.nome.toLowerCase())),
    ...SUGESTOES_OBJ_FIXAS,
  ];

  const handleNumInput = (raw, setSt, setDisp) => {
    const { valor, display } = parseValorInput(raw);
    setSt(valor ? String(valor) : "");
    setDisp(display);
  };

  const totalGasto = despesas.reduce((s,d) => s + d.valor, 0);
  const saldo = salario - totalGasto;

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Os meus objectivos</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Existing goals */}
        {objectivos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {objectivos.map(obj => {
              const cat = CATS.find(c => c.id === obj.categoria);
              const orcCat = salario * pct[obj.categoria] / 100;
              const gastoCat = despesas.filter(d => d.categoria === obj.categoria).reduce((s,d) => s+d.valor, 0);
              const dispCat = orcCat - gastoCat - obj.poupancaMensal;
              const pctConcluido = Math.min(100, (obj.acumulado / obj.valorAlvo) * 100);
              const mesesRestantes = obj.poupancaMensal > 0
                ? Math.ceil((obj.valorAlvo - obj.acumulado) / obj.poupancaMensal)
                : null;

              return (
                <div key={obj.id} style={{ background: "#0F0F0F", border: `1px solid ${cat?.color}30`, borderRadius: 16, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Emo e={obj.emoji} size={30} color="#F59E0B" fallback="target" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95em", color: "#DDD" }}>{obj.nome}</div>
                        <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 2 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Emo e={cat?.emoji} size={14} color={cat?.color} /> {cat?.label}</span>
                          {obj.acumulacaoAuto && <span style={{ color: "#22C55E", marginLeft: 6 }}>· <Icone nome="refresh" size={13} style={{ marginRight: 4 }} />Automático</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => abrirEdicao(obj)}
                        style={{ background: "transparent", border: "none", color: "#8A8070", cursor: "pointer", fontSize: "0.95em", padding: "4px 6px" }}><Icone nome="pencil" size={16} /></button>
                      <button onClick={() => onDeleteGoal(obj.id)}
                        style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "1em", padding: "4px 6px" }}><Icone nome="x" size={20} /></button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72em", color: "#8A8070", marginBottom: 6 }}>
                      <span>Acumulado: <strong style={{ color: cat?.color }}>{fmtKz(obj.acumulado)}</strong></span>
                      <span>Alvo: <strong style={{ color: "#DDD" }}>{fmtKz(obj.valorAlvo)}</strong></span>
                    </div>
                    {/* Circle progress */}
                    <div style={{ position: "relative", height: 8, background: "#1A1A1A", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pctConcluido}%`, background: cat?.color, borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7em", marginTop: 4 }}>
                      <span style={{ color: cat?.color, fontWeight: 700 }}>{pctConcluido.toFixed(0)}% concluído</span>
                      {mesesRestantes && <span style={{ color: "#8A8070" }}>~{mesesRestantes} meses para atingir</span>}
                    </div>
                  </div>

                  {/* Monthly impact */}
                  <div style={{ background: "#0A0A0A", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em" }}>
                      <span style={{ color: "#8A8070" }}>Poupança mensal para objectivo</span>
                      <span style={{ color: "#F59E0B", fontWeight: 700 }}>-{fmtKz(obj.poupancaMensal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em", marginTop: 6 }}>
                      <span style={{ color: "#8A8070" }}>Disponível restante em {cat?.label}</span>
                      <span style={{ fontWeight: 700, color: dispCat >= 0 ? "#22C55E" : "#EF4444" }}>{fmtKz(Math.max(0, dispCat))}</span>
                    </div>
                  </div>

                  {/* Registar poupança neste objectivo */}
                  {pctConcluido < 100 && (
                    addandoId === obj.id ? (
                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <input
                          autoFocus
                          inputMode="numeric"
                          value={valorAddDisplay}
                          onChange={(e) => handleNumInput(e.target.value, setValorAdd, setValorAddDisplay)}
                          placeholder="Quanto puseste de parte?"
                          style={{ flex: 1, background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 10, padding: "10px 12px", color: "#DDD", fontSize: "0.85em", fontFamily: "inherit" }}
                        />
                        <button
                          disabled={!valorAdd}
                          onClick={() => {
                            onAddToGoal(obj.id, parseInt(valorAdd));
                            setAddandoId(null); setValorAdd(""); setValorAddDisplay("");
                          }}
                          style={{ background: cat?.color, border: "none", borderRadius: 10, padding: "10px 14px", color: "#000", fontWeight: 700, fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit", opacity: valorAdd ? 1 : 0.4 }}>
                          Guardar
                        </button>
                        <button
                          onClick={() => { setAddandoId(null); setValorAdd(""); setValorAddDisplay(""); }}
                          style={{ background: "transparent", border: "1px solid #222", borderRadius: 10, padding: "10px 12px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82em" }}><Icone nome="x" size={20} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddandoId(obj.id)}
                        style={{ width: "100%", marginTop: 10, background: `${cat?.color}18`, border: `1px solid ${cat?.color}55`, borderRadius: 10, padding: "10px", color: cat?.color, fontWeight: 700, fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit" }}>
                        + Registar poupança
                      </button>
                    )
                  )}
                  {pctConcluido >= 100 && (
                    <div style={{ marginTop: 10, textAlign: "center", fontSize: "0.82em", color: "#22C55E", fontWeight: 700 }}>
                      <Icone nome="award" size={16} style={{ marginRight: 6 }} />Objectivo atingido!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add goal form */}
        {!showForm ? (
          <button onClick={() => { limparForm(); setShowForm(true); }}
            style={{ width: "100%", background: "#0F0F0F", border: "1px dashed #2A2A2A", borderRadius: 14, padding: "16px", color: "#F59E0B", fontWeight: 700, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit" }}>
            + Adicionar objectivo
          </button>
        ) : (
          <div style={{ background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 16, padding: "18px" }}>
            <div style={{ fontWeight: 700, color: "#DDD", marginBottom: 16, fontSize: "0.95em" }}>{editandoId ? "Editar objectivo" : "Novo objectivo"}</div>

            <div style={S.field}>
              <label style={S.label}>SUGESTÕES</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGESTOES_OBJ.map(s => (
                  <button key={s.nome} onClick={() => { setNome(s.nome); setEmoji(s.emoji); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: nome === s.nome ? "#F59E0B20" : "#111", border: `1px solid ${nome === s.nome ? "#F59E0B" : "#222"}`, borderRadius: 20, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                    <Emo e={s.emoji} size={16} color="#F59E0B" fallback="target" />
                    <span style={{ fontSize: "0.78em", color: nome === s.nome ? "#F59E0B" : "#C8C0B0", fontWeight: 600 }}>{s.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>NOME DO OBJECTIVO</label>
              <input value={nome} onChange={e => setNome(e.target.value)}
                placeholder="ex: Comprar carro, Viagem, Fundo de emergência"
                style={S.input} />
            </div>

            <div style={S.field}>
              <label style={S.label}>VALOR ALVO (Kz)</label>
              <div style={{ position: "relative" }}>
                <span style={S.inputPrefix}>Kz</span>
                <input type="text" inputMode="numeric" value={valorAlvoDisplay}
                  onChange={e => handleNumInput(e.target.value, setValorAlvo, setValorAlvoDisplay)}
                  placeholder="0" style={{ ...S.input, paddingLeft: 44 }} />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>QUANTO GUARDAR POR MÊS (Kz)</label>
              <div style={{ position: "relative" }}>
                <span style={S.inputPrefix}>Kz</span>
                <input type="text" inputMode="numeric" value={poupancaMensalDisplay}
                  onChange={e => handleNumInput(e.target.value, setPoupancaMensal, setPoupancaMensalDisplay)}
                  placeholder="0" style={{ ...S.input, paddingLeft: 44 }} />
              </div>
              {poupancaMensal && valorAlvo && (
                <div style={{ fontSize: "0.75em", color: "#F59E0B", marginTop: 6 }}>
                  ≈ {Math.ceil(parseInt(valorAlvo) / parseInt(poupancaMensal))} meses para atingir o objectivo
                </div>
              )}
            </div>

            <div style={S.field}>
              <label style={S.label}>CATEGORIA DE ONDE SAI</label>
              <div style={{ display: "flex", gap: 8 }}>
                {CATS.map(c => (
                  <button key={c.id} onClick={() => setCategoria(c.id)}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: categoria === c.id ? `${c.color}18` : "#0A0A0A", border: `1px solid ${categoria === c.id ? c.color : "#1E1E1E"}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit" }}>
                    <Emo e={c.emoji} size={22} color={c.color} />
                    <span style={{ fontSize: "0.62em", fontWeight: 700, color: categoria === c.id ? c.color : "#8A8070", textAlign: "center" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Já acumulado — só na edição, para corrigir enganos */}
            {editandoId && (
              <div style={S.field}>
                <label style={S.label}>JÁ ACUMULADO (Kz)</label>
                <div style={{ position: "relative" }}>
                  <span style={S.inputPrefix}>Kz</span>
                  <input type="text" inputMode="numeric" value={acumuladoEditDisplay}
                    onChange={e => handleNumInput(e.target.value, setAcumuladoEdit, setAcumuladoEditDisplay)}
                    placeholder="0" style={{ ...S.input, paddingLeft: 44 }} />
                </div>
                <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 6 }}>
                  Corrige aqui se te enganaste no valor guardado.
                </div>
              </div>
            )}

            {/* Acumulação automática */}
            <button onClick={() => setAcumulacaoAuto(v => !v)}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", background: acumulacaoAuto ? "#22C55E15" : "#0A0A0A", border: `1px solid ${acumulacaoAuto ? "#22C55E" : "#1E1E1E"}`, borderRadius: 12, padding: "13px 14px", cursor: "pointer", fontFamily: "inherit", marginBottom: 16, textAlign: "left" }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${acumulacaoAuto ? "#22C55E" : "#444"}`, background: acumulacaoAuto ? "#22C55E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {acumulacaoAuto && <Icone nome="check" size={12} color="#000" sw={3.2} />}
              </div>
              <div>
                <div style={{ fontSize: "0.85em", fontWeight: 700, color: "#DDD" }}>Acumular automaticamente</div>
                <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 2, lineHeight: 1.4 }}>A cada novo salário, somamos sozinhos a poupança mensal a este objectivo. Podes sempre ajustar à mão.</div>
              </div>
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={limparForm}
                style={{ flex: 1, background: "transparent", border: "1px solid #222", borderRadius: 12, padding: "13px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button
                disabled={!nome || !valorAlvo || !poupancaMensal}
                onClick={() => {
                  const dados = { nome, emoji, valorAlvo: parseInt(valorAlvo), poupancaMensal: parseInt(poupancaMensal), categoria, acumulacaoAuto };
                  if (editandoId) {
                    onUpdateGoal(editandoId, { ...dados, acumulado: parseInt(acumuladoEdit) || 0 });
                  } else {
                    onSaveGoal({ id: Date.now(), ...dados, acumulado: 0 });
                  }
                  limparForm();
                }}
                style={{ flex: 2, background: "#F59E0B", border: "none", borderRadius: 12, padding: "13px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: nome && valorAlvo && poupancaMensal ? 1 : 0.4 }}>
                {editandoId ? "Guardar alterações" : "Guardar objectivo"}
              </button>
            </div>
          </div>
        )}

        {objectivos.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#333" }}>
            <div style={{ marginBottom: 10 }}><Icone nome="target" size={44} color="#F59E0B" /></div>
            <div style={{ fontSize: "0.85em", color: "#8A8070" }}>Define um objectivo e vê quanto tempo demoras a atingi-lo.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CHARTS SCREEN ────────────────────────────────────────────────────────────
function ChartsScreen({ state, onBack }) {
  const { salario, despesas, pct, historicoPeriodos = [], objectivos = [] } = state;
  const totalGasto = despesas.reduce((s, d) => s + d.valor, 0);
  // Dinheiro separado para objetivos (conta como parte do Investimento)
  const totalObjetivos = objectivos.reduce((s, o) => s + (o.acumulado || 0), 0);
  const saldo = salario - totalGasto - totalObjetivos;

  // Per category totals — cada objetivo soma à SUA categoria (não sempre ao investimento)
  const catTotals = CATS.map(c => ({
    ...c,
    gasto: despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0)
           + objectivos.filter(o => (o.categoria || "investimento") === c.id).reduce((s, o) => s + (o.acumulado || 0), 0),
    orcamento: salario * pct[c.id] / 100,
  }));

  // ── PADRÕES DE COMPORTAMENTO (cálculo simples sobre os dados existentes) ──
  const insights = [];
  if (despesas.length > 0) {
    // 1. Categoria onde gastas mais
    const catMais = [...catTotals].filter(c => c.gasto > 0).sort((a, b) => b.gasto - a.gasto)[0];
    if (catMais) {
      insights.push({
        emoji: catMais.emoji,
        texto: `Gastas mais em ${catMais.label}`,
        detalhe: `${fmtKz(catMais.gasto)} — ${totalGasto > 0 ? ((catMais.gasto / totalGasto) * 100).toFixed(0) : 0}% de tudo o que gastaste`,
        cor: catMais.color,
      });
    }

    // 2. Dia da semana em que gastas mais
    const diasNomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const porDia = {};
    despesas.forEach(d => {
      if (d.data) {
        const dia = new Date(d.data).getDay();
        porDia[dia] = (porDia[dia] || 0) + d.valor;
      }
    });
    const diaTop = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];
    if (diaTop) {
      insights.push({
        emoji: "📅",
        texto: `${diasNomes[diaTop[0]]} é o teu dia de maior gasto`,
        detalhe: `Em média sai mais dinheiro neste dia da semana`,
        cor: "#F59E0B",
      });
    }

    // 3. Média de gasto por dia
    const diasComGasto = new Set(despesas.filter(d => d.data).map(d => new Date(d.data).toDateString())).size || 1;
    const mediaDia = totalGasto / diasComGasto;
    insights.push({
      emoji: "📊",
      texto: `Gastas em média ${fmtKz(mediaDia)} por dia`,
      detalhe: `Com base nos dias em que registaste gastos`,
      cor: "#22C55E",
    });

    // 4. Comparação com o período anterior
    if (historicoPeriodos.length > 0) {
      const anterior = historicoPeriodos[historicoPeriodos.length - 1];
      if (anterior && typeof anterior.totalGasto === "number") {
        const dif = totalGasto - anterior.totalGasto;
        const pctDif = anterior.totalGasto > 0 ? Math.abs((dif / anterior.totalGasto) * 100).toFixed(0) : 0;
        insights.push({
          emoji: dif <= 0 ? "📉" : "📈",
          texto: dif <= 0 ? `Gastaste menos que no período anterior` : `Gastaste mais que no período anterior`,
          detalhe: `${dif <= 0 ? "-" : "+"}${pctDif}% face ao período passado (${fmtKz(Math.abs(dif))})`,
          cor: dif <= 0 ? "#22C55E" : "#EF4444",
        });
      }
    }

    // 5. Alerta de orçamento por categoria (a que está mais perto de estourar)
    const perto = [...catTotals].filter(c => c.orcamento > 0).map(c => ({ ...c, uso: (c.gasto / c.orcamento) * 100 })).sort((a, b) => b.uso - a.uso)[0];
    if (perto && perto.uso >= 70) {
      insights.push({
        emoji: perto.uso >= 100 ? "🔴" : "⚠️",
        texto: perto.uso >= 100 ? `Já passaste o orçamento de ${perto.label}` : `Estás perto do limite em ${perto.label}`,
        detalhe: `Já usaste ${perto.uso.toFixed(0)}% do que reservaste para ${perto.label}`,
        cor: perto.uso >= 100 ? "#EF4444" : "#F59E0B",
      });
    }
  }

  // Per description breakdown (top 6)
  const byDesc = {};
  despesas.forEach(d => { byDesc[d.descricao] = (byDesc[d.descricao] || 0) + d.valor; });
  const topDesc = Object.entries(byDesc).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Donut chart: SVG
  const radius = 54, cx = 70, cy = 70, circ = 2 * Math.PI * radius;
  let offset = 0;
  const slices = totalGasto > 0
    ? catTotals.filter(c => c.gasto > 0).map(c => {
        const pctSlice = c.gasto / totalGasto;
        const dash = pctSlice * circ;
        const slice = { id: c.id, color: c.color, dash, offset, label: c.label, pct: (pctSlice * 100).toFixed(0) };
        offset += dash;
        return slice;
      })
    : [];

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Análise de gastos</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Summary row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total gasto", value: totalGasto, color: "#EF4444" },
            { label: "Saldo restante", value: saldo, color: saldo >= 0 ? "#22C55E" : "#EF4444" },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px" }}>
              <div style={{ fontSize: "0.68em", color: "#8A8070", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>{item.label.toUpperCase()}</div>
              <div style={{ fontSize: "1.1em", fontWeight: 800, color: item.color }}>{fmtKz(item.value)}</div>
            </div>
          ))}
        </div>

        {/* Padrões de comportamento */}
        {insights.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, padding: 0, marginBottom: 12 }}>O QUE OS TEUS GASTOS DIZEM</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#0F0F0F", border: `1px solid ${ins.cor}30`, borderRadius: 12, padding: "12px 14px" }}>
                  <Emo e={ins.emoji} size={24} color="#F59E0B" fallback="sparkle" />
                  <div>
                    <div style={{ fontSize: "0.85em", fontWeight: 700, color: "#DDD", lineHeight: 1.3 }}>{ins.texto}</div>
                    <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 3, lineHeight: 1.4 }}>{ins.detalhe}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Donut chart */}
        {despesas.length > 0 ? (
          <>
            <div style={{ ...S.sectionTitle, padding: 0, marginBottom: 14 }}>DISTRIBUIÇÃO POR CATEGORIA</div>
            <div style={{ background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {/* SVG Donut */}
                <svg width="140" height="140" style={{ flexShrink: 0 }}>
                  <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1A1A1A" strokeWidth="18" />
                  {slices.map(s => (
                    <circle key={s.id} cx={cx} cy={cy} r={radius} fill="none"
                      stroke={s.color} strokeWidth="18"
                      strokeDasharray={`${s.dash} ${circ - s.dash}`}
                      strokeDashoffset={-(s.offset - circ / 4)}
                      style={{ transition: "stroke-dasharray 0.5s ease" }}
                    />
                  ))}
                  <text x={cx} y={cy - 6} textAnchor="middle" fill="#DDD" fontSize="11" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">GASTO</text>
                  <text x={cx} y={cy + 10} textAnchor="middle" fill="#F59E0B" fontSize="11" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{totalGasto > 0 ? ((totalGasto/salario)*100).toFixed(0) : 0}%</text>
                </svg>
                {/* Legend */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {catTotals.map(c => (
                    <div key={c.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: "0.8em", color: "#CCC", display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Emo e={c.emoji} size={16} color={c.color} /> {c.label}</span>
                        </span>
                        <span style={{ fontSize: "0.78em", fontWeight: 700, color: c.gasto > c.orcamento ? "#EF4444" : c.color }}>
                          {c.orcamento > 0 ? ((c.gasto / c.orcamento) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: "#1A1A1A", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, c.orcamento > 0 ? (c.gasto / c.orcamento) * 100 : 0)}%`, height: "100%", background: c.gasto > c.orcamento ? "#EF4444" : c.color, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ fontSize: "0.7em", color: "#8A8070", marginTop: 2 }}>
                        {fmtKz(c.gasto)} / {fmtKz(c.orcamento)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top spending items */}
            {topDesc.length > 0 && (
              <>
                <div style={{ ...S.sectionTitle, padding: 0, marginBottom: 12 }}>ONDE GASTAS MAIS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topDesc.map(([nome, total], i) => {
                    const exp = despesas.find(d => d.descricao === nome);
                    const cat = CATS.find(c => c.id === exp?.categoria);
                    const pctBar = totalGasto > 0 ? (total / totalGasto) * 100 : 0;
                    return (
                      <div key={nome} style={{ background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "0.7em", fontWeight: 800, color: "#9F9582", minWidth: 16 }}>#{i + 1}</span>
                            <span style={{ fontSize: "0.9em", fontWeight: 600, color: "#DDD" }}>{nome}</span>
                            {cat && <span style={{ fontSize: "0.65em", background: `${cat.color}20`, color: cat.color, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{cat.label}</span>}
                          </div>
                          <span style={{ fontWeight: 700, color: "#EF4444", fontSize: "0.88em" }}>{fmtKz(total)}</span>
                        </div>
                        <div style={{ height: 3, background: "#1A1A1A", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${pctBar}%`, height: "100%", background: cat?.color || "#F59E0B", borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: "0.68em", color: "#9F9582", marginTop: 3 }}>{pctBar.toFixed(1)}% do total gasto</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9F9582" }}>
            <div style={{ marginBottom: 12 }}><Icone nome="chart" size={52} color="#F59E0B" /></div>
            <div style={{ fontWeight: 700, color: "#8A8070", marginBottom: 8 }}>Ainda sem dados</div>
            <div style={{ fontSize: "0.85em" }}>Regista as tuas primeiras despesas para ver os gráficos.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PRÉ-RESERVA BANNER (shown after saving expense from day 4 onwards) ─────────
// ── TRIAL EXPIRED SCREEN — Pagamento ─────────────────────────────────────────
function AnelContagem({ diasRestantes, total = TRIAL_DAYS }) {
  const frac = Math.max(0, Math.min(1, diasRestantes / total));
  const r = 34, circ = 2 * Math.PI * r;
  const preenchido = circ * frac;
  // Cor aquece nos últimos 3 dias (âmbar → vermelho)
  const critico = diasRestantes <= 3;
  const cor = critico ? "#EF4444" : "#F59E0B";
  return (
    <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
      <svg width="84" height="84" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="#1E1E1E" strokeWidth="6" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={cor} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${circ}`}
          style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "1.7em", fontWeight: 800, color: cor, lineHeight: 1 }}>{diasRestantes}</div>
        <div style={{ fontSize: "0.55em", color: "#8A8070", fontWeight: 700, letterSpacing: "0.05em", marginTop: 1 }}>
          {diasRestantes === 1 ? "DIA" : "DIAS"}
        </div>
      </div>
    </div>
  );
}

function TrialExpiredScreen({ comprovativoEnviado, planoInicial, onComprovativo, dentroDoTeste = false, diasRestantes = 0, onFechar, subscricaoExpirada = false, onTrocarConta }) {
  // ── PAGAMENTO VIA GATEWAY (AppyPay / BAI) ──
  // [DEV] Ao tocar num método, iniciar o pagamento no gateway enviando:
  //         merchant_reference = user_id  (liga o pagamento à conta)
  //         metadata = { plano, dentro_trial }
  //       A confirmação chega pelo webhook (ver doc do backend) e ativa o acesso.
  // [DEV] REGRA DE PREÇO (aplicada na cobrança/renovação pelo backend):
  //   - DENTRO do período de teste: 1º pagamento com 50% (mensal 500 / anual 5.000); renova a cheio.
  //   - DEPOIS do período de teste: preço cheio (mensal 1.000 / anual 10.000).
  const [etapa, setEtapa] = useState("escolha"); // escolha | metodo
  const [plano, setPlano] = useState(planoInicial || "anual");
  const [aEnviar, setAEnviar] = useState(false);
  const [msgSolicitacao, setMsgSolicitacao] = useState(null); // {tipo, texto}
  const [aTrocarConta, setATrocarConta] = useState(false);

  // Preços: com desconto (dentro do teste) vs cheio (depois)
  const PRECO = {
    anual:  { cheio: "12.000 Kz", normal: "10.000 Kz", desconto: "6.000 Kz", periodo: "por ano", nome: "Anual" },
    mensal: { cheio: "1.000 Kz",  normal: "1.000 Kz",  desconto: "1.000 Kz", periodo: "por mês", nome: "Mensal" },
  };
  const p = PRECO[plano];
  const valorAtual = dentroDoTeste ? p.desconto : p.normal;
  const dados = { valor: valorAtual, cheio: p.cheio, periodo: p.periodo, nome: p.nome };

  // ── ECRÃ DEMO — após escolher um método (representa o hand-off ao gateway) ──
  if (comprovativoEnviado) {
    return (
      <div style={S.setup}>
        <div style={S.setupCard}>
          <div style={{ marginBottom: 16, textAlign: "center" }}><Sol size={56} /></div>
          <div style={{ ...S.logo, marginBottom: 12, textAlign: "center" }}>A processar o pagamento</div>
          <p style={{ color: "#C8C0B0", fontSize: "0.95em", lineHeight: 1.7, textAlign: "center", marginBottom: 20 }}>
            Estás a ser encaminhado para pagamento seguro. Assim que o pagamento for confirmado, o teu acesso é ativado automaticamente.
          </p>
          <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px 16px", fontSize: "0.8em", color: "#8A8070", lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
            Integração de pagamento (Multicaixa Express · Referência · Débito direto) — via gateway AppyPay / BAI.
          </div>
          <button onClick={() => { onComprovativo(null); setEtapa("escolha"); }}
            style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── PÁGINA 1 — ESCOLHA DO PLANO ──
  if (etapa === "escolha") {
    return (
      <div style={S.setup}>
        <div style={S.setupCard}>
          {onFechar && (
            <button onClick={onFechar} aria-label="Fechar"
              style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 14px)", right: 16, zIndex: 50, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "#141414", border: "1px solid #2A2A2A", borderRadius: "50%", color: "#E8E0D0", fontSize: "1.1em", cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}><Icone nome="x" size={20} /></button>
          )}

          {dentroDoTeste ? (
            // Dentro do período de teste — oferta de desconto com anel de urgência
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <AnelContagem diasRestantes={diasRestantes} />
                <div>
                  <div style={{ fontSize: "1.15em", fontWeight: 800, color: "#F59E0B", lineHeight: 1.2 }}>Paga agora e poupa 50%</div>
                  <div style={{ fontSize: "0.82em", color: "#A09880", marginTop: 4, lineHeight: 1.4 }}>
                    Só enquanto durar o teu período gratuito.
                  </div>
                </div>
              </div>
            </>
          ) : subscricaoExpirada ? (
            <>
              <div style={{ marginBottom: 12 }}><Icone nome="hourglass" size={44} color="#F59E0B" /></div>
              <div style={{ ...S.logo, marginBottom: 8 }}>A tua subscrição expirou</div>
              <p style={{ color: "#A09880", fontSize: "0.92em", lineHeight: 1.6, marginBottom: 22 }}>
                Os teus dados estão guardados. Renova para continuares a saber, todos os dias, quanto podes gastar.
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}><Icone nome="unlock" size={44} color="#F59E0B" /></div>
              <div style={{ ...S.logo, marginBottom: 8 }}>Os teus 7 dias gratuitos acabaram</div>
              <p style={{ color: "#A09880", fontSize: "0.92em", lineHeight: 1.6, marginBottom: 22 }}>
                Já sabes o que é abrir o telemóvel e saber exactamente quanto podes gastar hoje. Continua a gastar sem culpa.
              </p>
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <button onClick={() => setPlano("anual")}
              style={{ position: "relative", textAlign: "left", background: plano === "anual" ? "#F59E0B12" : "#0A0A0A", border: `2px solid ${plano === "anual" ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ position: "absolute", top: -10, right: 16, background: dentroDoTeste ? "#22C55E" : "#F59E0B", color: "#000", fontSize: "0.68em", fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{dentroDoTeste ? "POUPA 50%" : "MAIS ESCOLHIDO"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${plano === "anual" ? "#F59E0B" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {plano === "anual" && <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.95em", fontWeight: 800, color: "#E8E0D0" }}>Anual</div>
                  <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>
                    {dentroDoTeste
                      ? <><span style={{ textDecoration: "line-through" }}>12.000 Kz</span> &nbsp;<span style={{ color: "#22C55E", fontWeight: 700 }}>6.000 Kz</span> por ano</>
                      : <><span style={{ textDecoration: "line-through" }}>12.000 Kz</span> &nbsp;<span style={{ color: "#22C55E", fontWeight: 700 }}>10.000 Kz</span> por ano</>}
                  </div>
                </div>
              </div>
            </button>

            <button onClick={() => setPlano("mensal")}
              style={{ textAlign: "left", background: plano === "mensal" ? "#F59E0B12" : "#0A0A0A", border: `2px solid ${plano === "mensal" ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${plano === "mensal" ? "#F59E0B" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {plano === "mensal" && <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.95em", fontWeight: 800, color: "#E8E0D0" }}>Mensal</div>
                  <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>
                    1.000 Kz por mês
                  </div>
                </div>
              </div>
            </button>
          </div>

          <button onClick={() => setEtapa("metodo")} style={S.btn}>
            Continuar
          </button>

          <p style={{ fontSize: "0.8em", color: "#8A8070", textAlign: "center", lineHeight: 1.6, marginTop: 18 }}>
            Precisas de ajuda? Fala com o suporte da Klaco:{" "}
            <a href={`mailto:${CONTACTOS.suporte}`} style={{ color: "#F59E0B", textDecoration: "none", fontWeight: 600 }}>{CONTACTOS.suporte}</a>
          </p>

          {onTrocarConta && (
            <button
              disabled={aTrocarConta}
              onClick={async () => { setATrocarConta(true); try { await onTrocarConta(); } finally { setATrocarConta(false); } }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", marginTop: 8, padding: "8px" }}>
              {aTrocarConta ? "A terminar sessão…" : "Iniciar sessão com outra conta"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── PÁGINA 2 — PAGAMENTO MANUAL (transferência + comprovativo por WhatsApp) ──
  // Cliente transfere, envia o comprovativo por WhatsApp e clica "Já enviei o comprovativo",
  // o que cria uma SOLICITAÇÃO pendente (não ativa a conta). O admin aprova depois.
  const WHATSAPP = CONTACTOS.whatsapp;
  const msgWhats = encodeURIComponent(
    `Olá! Fiz o pagamento da Klaco (plano ${dados.nome} — ${dados.valor}). Segue o comprovativo.`
  );
  const linkWhats = `https://wa.me/${WHATSAPP}?text=${msgWhats}`;

  const jaEnviei = async () => {
    setAEnviar(true); setMsgSolicitacao(null);
    const r = await onComprovativo(plano);
    setAEnviar(false);
    if (r && r.ok) {
      setMsgSolicitacao({ tipo: "ok", texto: "Solicitação enviada. O teu pagamento será analisado e o acesso ativado após confirmação." });
    } else if (r && /pendente|já existe/i.test(r.erro || "")) {
      setMsgSolicitacao({ tipo: "ok", texto: "Já tens uma solicitação pendente. Vamos analisá-la em breve." });
    } else {
      setMsgSolicitacao({ tipo: "erro", texto: (r && r.erro) || "Não foi possível enviar. Tenta de novo." });
    }
  };

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <button onClick={() => setEtapa("escolha")}
          style={{ background: "transparent", border: "none", color: "#8A8070", fontSize: "0.88em", cursor: "pointer", fontFamily: "inherit", marginBottom: 16, padding: 0 }}>
          ‹ Mudar de plano
        </button>

        <div style={{ ...S.logo, marginBottom: 4, fontSize: "1.1em" }}>Plano {dados.nome}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #1A1A1A" }}>
          <span style={{ color: "#A09880", fontSize: "0.88em" }}>Valor a pagar</span>
          <span style={{ color: "#F59E0B", fontSize: "1.2em", fontWeight: 800 }}>
            {dados.cheio && dados.cheio !== dados.valor && (
              <span style={{ textDecoration: "line-through", color: "#9F9582", fontSize: "0.75em", marginRight: 6 }}>{dados.cheio}</span>
            )}
            {dados.valor} <span style={{ fontSize: "0.6em", color: "#8A8070", fontWeight: 600 }}>{dados.periodo}</span>
          </span>
        </div>

        <div style={{ fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 12 }}>
          1. TRANSFERE PARA ESTE IBAN
        </div>
        <div style={{ background: "#0D0D0D", border: "1px solid #1E1E1E", borderRadius: 14, padding: "16px", marginBottom: 18 }}>
          <div style={{ fontSize: "0.72em", color: "#8A8070", marginBottom: 3 }}>Empresa</div>
          <div style={{ fontSize: "0.92em", color: "#E8E0D0", fontWeight: 600, marginBottom: 14 }}>JEZ CONSULTORIA SU LDA</div>
          <div style={{ fontSize: "0.72em", color: "#8A8070", marginBottom: 3 }}>IBAN</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: "0.92em", color: "#E8E0D0", fontWeight: 600, wordBreak: "break-all" }}>AO06 0040 0000 4299 0859 1013 3</span>
            <button onClick={() => { try { navigator.clipboard.writeText("004000004299085910133"); } catch (e) {} }}
              style={{ flexShrink: 0, background: "transparent", border: "1px solid #2A2A2A", borderRadius: 8, padding: "4px 10px", color: "#F59E0B", fontSize: "0.72em", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              Copiar
            </button>
          </div>
        </div>

        <div style={{ fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 12 }}>
          2. ENVIA O COMPROVATIVO
        </div>
        <a href={linkWhats} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#22C55E", borderRadius: 14, padding: "16px", textDecoration: "none", marginBottom: 16 }}>
          <Icone nome="chat" size={22} color="#052E16" />
          <span style={{ color: "#052E16", fontWeight: 800, fontSize: "0.98em" }}>Enviar comprovativo por WhatsApp</span>
        </a>
        <p style={{ fontSize: "0.78em", color: "#8A8070", textAlign: "center", lineHeight: 1.6, margin: "-4px 0 16px" }}>
          Ou envia o comprovativo por e-mail:{" "}
          <a href={`mailto:${CONTACTOS.invoice}`} style={{ color: "#F59E0B", textDecoration: "none", fontWeight: 600 }}>{CONTACTOS.invoice}</a>
        </p>

        <div style={{ fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 12 }}>
          3. CONFIRMA
        </div>
        {msgSolicitacao && (
          <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 12, fontSize: "0.84em", lineHeight: 1.5,
            background: msgSolicitacao.tipo === "ok" ? "#22C55E22" : "#EF444422", color: msgSolicitacao.tipo === "ok" ? "#22C55E" : "#EF4444" }}>
            {msgSolicitacao.texto}
          </div>
        )}
        {!(msgSolicitacao && msgSolicitacao.tipo === "ok") && (
          <button onClick={jaEnviei} disabled={aEnviar}
            style={{ ...S.btn, opacity: aEnviar ? 0.6 : 1 }}>
            {aEnviar ? "A enviar…" : "Já enviei o comprovativo"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({ active, onHome, onGoals, onCharts, onSettings }) {
  const tabs = [
    { id: "dashboard", label: "Início",     icone: "home",    action: onHome },
    { id: "goals",     label: "Objectivos", icone: "target",  action: onGoals },
    { id: "charts",    label: "Gráficos",   icone: "chart",   action: onCharts },
    { id: "settings",  label: "Definições", icone: "sliders", action: onSettings },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480,
      background: "#0B0B0B", borderTop: "1px solid #1E1E1E",
      display: "flex", zIndex: 100,
      padding: "8px 6px 0", paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={t.action} aria-current={on ? "page" : undefined}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 4px 4px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: 58, height: 30, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "rgba(245,158,11,0.16)" : "transparent", color: on ? "#F59E0B" : "#A39A88", transition: "background 0.15s" }}>
              <Icone nome={t.icone} size={23} sw={1.9} />
            </span>
            <span style={{ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? "#F59E0B" : "#BDB3A0" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── SISTEMA DE CONVITES ───────────────────────────────────────────────────────
function ConviteScreen({ inviteCode, inviteCount, diasAtivos, onBack }) {
  const [copied, setCopied] = useState(false);
  const nivel = getNivel(diasAtivos);
  const nextNivel = NIVEIS[NIVEIS.indexOf(nivel) + 1];
  // [DEV] Substituir pelo domínio real da Klaco. O ?ref= identifica quem convidou,
  //       para creditar automaticamente 1 mês grátis quando o convidado subscrever.
  const link = `https://klaco.app/?ref=${inviteCode}`;
  const msgPartilha = `Descobri a Klaco — diz-me todos os dias quanto posso gastar, sem culpa. Entra pelo meu convite: ${link}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(msgPartilha).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(msgPartilha);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Convida e ganha</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Nível actual */}
        <div style={{
          background: "linear-gradient(135deg,#1C1400,#0F0C00)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 20, padding: "22px 20px", marginBottom: 20, textAlign: "center",
        }}>
          <div style={{ marginBottom: 8 }}><Emo e={nivel.emoji} size={52} color="#F59E0B" /></div>
          <div style={{ fontSize: "0.65em", fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B80", marginBottom: 4 }}>
            O TEU NÍVEL
          </div>
          <div style={{ fontSize: "1.4em", fontWeight: 800, color: "#F59E0B" }}>{nivel.label}</div>
          <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 6, lineHeight: 1.5 }}>{nivel.desc}</div>
          {nextNivel && (
            <div style={{ marginTop: 14, fontSize: "0.72em", color: "#9F9582" }}>
              Próximo nível: <span style={{ color: "#F59E0B80", display: "inline-flex", alignItems: "center", gap: 4 }}><Emo e={nextNivel.emoji} size={14} color="#F59E0B80" /> {nextNivel.label}</span> em {nextNivel.dias - diasAtivos} dias
            </div>
          )}
        </div>

        {/* Convites feitos */}
        {inviteCount > 0 && (
          <div style={{
            background: "#0A1A0A", border: "1px solid #22C55E30",
            borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Icone nome="users" size={32} color="#F59E0B" />
            <div>
              <div style={{ fontWeight: 700, color: "#22C55E", fontSize: "0.9em" }}>
                {inviteCount} amigo{inviteCount !== 1 ? "s" : ""} já entraram pelo teu convite
              </div>
              <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 3 }}>
                Obrigado por cresceres esta comunidade
              </div>
            </div>
          </div>
        )}

        {/* Recompensa — 1 mês grátis quando o amigo subscrever */}
        <div style={{
          background: "linear-gradient(135deg,#0A1A0A,#081208)",
          border: "1px solid #22C55E40",
          borderRadius: 16, padding: "18px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Icone nome="gift" size={28} color="#F59E0B" />
            <div style={{ fontSize: "1em", fontWeight: 800, color: "#22C55E" }}>Convida 1 amigo, ganha 1 mês grátis</div>
          </div>
          <div style={{ fontSize: "0.83em", color: "#A09880", lineHeight: 1.6 }}>
            Quando um amigo entra pelo teu convite e <strong style={{ color: "#C8C0B0" }}>paga a subscrição</strong>, ganhas <strong style={{ color: "#22C55E" }}>1 mês grátis</strong>. Aplicamos na tua próxima renovação.
          </div>
        </div>

        {/* O que partilhas */}
        <div style={{ fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#9F9582", marginBottom: 10 }}>
          A MENSAGEM QUE PARTILHAS
        </div>
        <div style={{
          background: "#0F0F0F", border: "1px solid #1E1E1E",
          borderRadius: 14, padding: "16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: "0.88em", color: "#A09880", lineHeight: 1.6 }}>
            "Descobri a Klaco — diz-me todos os dias quanto posso gastar, sem culpa. Entra pelo meu convite:"
          </div>
          <div style={{ marginTop: 10, fontSize: "0.75em", color: "#9F9582", fontFamily: "monospace", wordBreak: "break-all" }}>
            {link}
          </div>
        </div>

        {/* Botões de partilha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handleWhatsApp} style={{
            background: "#25D366", border: "none", borderRadius: 14,
            padding: "15px", color: "#000", fontWeight: 800, fontSize: "0.95em",
            cursor: "pointer", fontFamily: "inherit", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Icone nome="share" size={20} /> Partilhar no WhatsApp
          </button>
          <button onClick={handleCopy} style={{
            background: copied ? "#22C55E15" : "#0F0F0F",
            border: `1px solid ${copied ? "#22C55E40" : "#2A2A2A"}`,
            borderRadius: 14, padding: "15px",
            color: copied ? "#22C55E" : "#A09880", fontWeight: 700, fontSize: "0.9em",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {copied ? "Copiado!" : "Copiar mensagem"}
          </button>
        </div>

        {/* Todos os níveis */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#9F9582", marginBottom: 12 }}>
            OS NÍVEIS DA COMUNIDADE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {NIVEIS.map(n => {
              const atingido = diasAtivos >= n.dias;
              return (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: atingido ? "#0F0F0F" : "transparent",
                  border: `1px solid ${atingido ? "#2A2A2A" : "#111"}`,
                  borderRadius: 12, padding: "12px 14px",
                  opacity: atingido ? 1 : 0.4,
                }}>
                  <Emo e={n.emoji} size={26} color={atingido ? "#F59E0B" : "#8A8070"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88em", color: atingido ? "#DDD" : "#8A8070" }}>{n.label}</div>
                    <div style={{ fontSize: "0.7em", color: "#9F9582", marginTop: 2 }}>{n.desc}</div>
                  </div>
                  <div style={{ fontSize: "0.7em", color: atingido ? "#22C55E" : "#333", fontWeight: 700 }}>
                    {atingido ? <Icone nome="check" size={14} sw={3} /> : `${n.dias}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL DE CONQUISTA ────────────────────────────────────────────────────────
function ConquistaModal({ nivel, diasAtivos, inviteCode, onPartilhar, onFechar }) {
  // [DEV] Substituir pelo domínio real da Klaco. O ?ref= identifica quem partilhou,
  //       para creditar automaticamente quando a pessoa convidada subscrever.
  const link = `https://klaco.app/?ref=${inviteCode}`;
  const handleWhatsApp = () => {
    const msgs = [
      `Dia ${diasAtivos} a gastar com intenção. Sem surpresas no fim do mês. 💪 Experimenta também: ${link}`,
      `${diasAtivos} dias e o dinheiro ainda está no lugar certo. 🔥 Quer saber como? ${link}`,
      `Nível ${nivel.label} desbloqueado. ${diasAtivos} dias a saber exactamente o que posso gastar. ${nivel.emoji} Experimenta: ${link}`,
    ];
    const msg = encodeURIComponent(msgs[Math.floor(Math.random() * msgs.length)]);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
    onFechar();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 200, animation: "slideUp 0.3s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "linear-gradient(160deg,#0F0C00,#080808)",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: "24px 24px 0 0",
        padding: "32px 24px 40px",
        textAlign: "center",
      }}>
        <div style={{ marginBottom: 12, animation: "pulse 1.5s infinite" }}><Emo e={nivel.emoji} size={64} color="#F59E0B" /></div>
        <div style={{ fontSize: "0.65em", fontWeight: 700, letterSpacing: "0.14em", color: "#F59E0B80", marginBottom: 6 }}>
          NÍVEL DESBLOQUEADO
        </div>
        <div style={{ fontSize: "1.8em", fontWeight: 800, color: "#F59E0B", marginBottom: 8 }}>{nivel.label}</div>
        <div style={{ fontSize: "0.88em", color: "#A09880", lineHeight: 1.6, marginBottom: 24 }}>{nivel.desc}</div>

        <div style={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.78em", color: "#8A8070", marginBottom: 4 }}>A TUA CONQUISTA</div>
          <div style={{ fontSize: "0.95em", color: "#E8E0D0", fontWeight: 600 }}>
            {diasAtivos} dia{diasAtivos !== 1 ? "s" : ""} a gastar com intenção
          </div>
          <div style={{ fontSize: "0.82em", color: "#8A8070", marginTop: 4 }}>sem revelar valores · sem culpa · sem surpresas</div>
        </div>

        <div style={{ fontSize: "0.88em", color: "#8A8070", marginBottom: 16, textAlign: "center" }}>
          Partilha a conquista — sem expor o teu dinheiro.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handleWhatsApp} style={{
            background: "#25D366", border: "none", borderRadius: 14, padding: "17px",
            color: "#000", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit",
          }}>
            Partilhar no WhatsApp
          </button>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: "#9F9582",
            fontSize: "0.88em", cursor: "pointer", fontFamily: "inherit", padding: "10px",
          }}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL CONVITE PÓS-PRIMEIRA-DESPESA ───────────────────────────────────────
function ConviteMomentoModal({ inviteCode, onFechar }) {
  // [DEV] Substituir pelo domínio real da Klaco.
  const link = `https://klaco.app/?ref=${inviteCode}`;

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Descobri a Klaco — diz-me todos os dias quanto posso gastar, sem culpa. Entra pelo meu convite: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
    onFechar();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 200, animation: "slideUp 0.3s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "#0D0D0D",
        border: "1px solid #1A1A1A",
        borderRadius: "24px 24px 0 0",
        padding: "32px 24px 44px",
      }}>
        {/* Pergunta simples, sem pressão */}
        <div style={{ marginBottom: 16, textAlign: "center" }}><Icone nome="users" size={36} color="#F59E0B" /></div>
        <div style={{ fontSize: "1.2em", fontWeight: 800, color: "#E8E0D0", marginBottom: 10, lineHeight: 1.3 }}>
          Conheces alguém que precisava de saber isto?
        </div>
        <div style={{ fontSize: "0.92em", color: "#8A8070", lineHeight: 1.6, marginBottom: 16 }}>
          A maioria das pessoas não sabe quanto pode gastar hoje. Tu já sabes. Partilha com alguém que importa.
        </div>
        <div style={{ background: "#0A1A0A", border: "1px solid #22C55E30", borderRadius: 12, padding: "12px 14px", marginBottom: 24, fontSize: "0.82em", color: "#A09880", lineHeight: 1.5 }}>
          E quando essa pessoa subscrever, ganhas <strong style={{ color: "#22C55E" }}>1 mês grátis</strong>.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handleWhatsApp} style={{
            background: "#25D366", border: "none", borderRadius: 14,
            padding: "17px", color: "#000", fontWeight: 800,
            fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit",
          }}>
            Partilhar no WhatsApp
          </button>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none",
            color: "#9F9582", fontSize: "0.88em",
            cursor: "pointer", fontFamily: "inherit", padding: "10px",
          }}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADICIONAR ENTRADA (salário extra, 13º, bónus, subsídio) ──────────────────
function AddEntradaScreen({ onSave, onBack }) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [data, setData] = useState(todayStr());

  const handleValor = (raw) => {
    const { valor: nv, display } = parseValorInput(raw);
    setValor(nv ? String(nv) : "");
    setValorDisplay(display);
  };

  const atalhos = ["13º mês", "Bónus", "Subsídio de férias", "Subsídio de Natal", "Trabalho extra"];
  const v = parseFloat(valor) || 0;
  const valido = nome.trim().length > 0 && v > 0;

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Nova entrada</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: "0.86em", color: "#8A8070", marginBottom: 20, lineHeight: 1.5 }}>
          Recebeste algo além do salário? Adiciona aqui — entra no que podes gastar este período.
        </div>

        <div style={S.field}>
          <label style={S.label}>O QUE RECEBESTE?</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: 13º mês" style={S.input} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {atalhos.map(a => (
              <button key={a} onClick={() => setNome(a)}
                style={{ background: nome === a ? "#F59E0B20" : "#0F0F0F", border: `1px solid ${nome === a ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 20, padding: "7px 13px", color: nome === a ? "#F59E0B" : "#8A8070", fontSize: "0.8em", cursor: "pointer", fontFamily: "inherit" }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>VALOR (Kz)</label>
          <div style={{ ...S.inputGroup, marginTop: 0 }}>
            <span style={S.currency}>Kz</span>
            <input type="text" inputMode="numeric" value={valorDisplay} onChange={e => handleValor(e.target.value)}
              placeholder="0" style={S.bigInput} />
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>DATA</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={S.dateInput} />
        </div>

        <button disabled={!valido}
          onClick={() => onSave({ id: Date.now(), nome: nome.trim(), valor: v, data })}
          style={{ ...S.btn, opacity: valido ? 1 : 0.4 }}>
          Adicionar entrada
        </button>
      </div>
    </div>
  );
}

// ── EDITAR UM MOVIMENTO (despesa ou entrada) ─────────────────────────────────
function EditMovimentoModal({ tipo, item, onSave, onDelete, onClose }) {
  const isDespesa = tipo === "despesa";
  const [nome, setNome] = useState(isDespesa ? item.descricao : item.nome);
  const [valor, setValor] = useState(String(item.valor));
  const [categoria, setCategoria] = useState(item.categoria || "necessidades");
  const [valorDisplay, setValorDisplay] = useState(
    item.valor ? String(item.valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
  );
  const [data, setData] = useState(item.data || todayStr());
  const handleValor = (raw) => {
    const { valor: nv, display } = parseValorInput(raw);
    setValor(nv ? String(nv) : "");
    setValorDisplay(display);
  };
  const v = parseFloat(String(valor)) || 0;
  const valido = nome.trim().length > 0 && v > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 20 }}>
          Editar {isDespesa ? "registo" : "entrada"}
        </div>
        <div style={S.field}>
          <label style={S.label}>{isDespesa ? "DESCRIÇÃO" : "NOME"}</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} style={S.input} />
          {/* Sugestões clicáveis — mesmas do ecrã de adicionar, conforme a categoria */}
          {(() => {
            const sugg = isDespesa ? (SUGESTOES[categoria] || []) : (SUGESTOES_ENTRADA || []);
            if (!sugg.length) return null;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {sugg.slice(0, 8).map(s => (
                  <button key={s.nome} onClick={() => setNome(s.nome)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: nome === s.nome ? "#1A1400" : "#0D0D0D", border: `1px solid ${nome === s.nome ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8em", color: nome === s.nome ? "#F59E0B" : "#A09880" }}>
                    <Emo e={s.emoji} size={15} color="currentColor" /> {s.nome}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        <div style={S.field}>
          <label style={S.label}>VALOR (Kz)</label>
          <div style={{ ...S.inputGroup, marginTop: 0 }}>
            <span style={S.currency}>Kz</span>
            <input type="text" inputMode="numeric" value={valorDisplay} onChange={e => handleValor(e.target.value)}
              placeholder="0" style={S.bigInput} />
          </div>
        </div>
        {isDespesa && (
          <div style={S.field}>
            <label style={S.label}>CATEGORIA</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CATS.map(c => (
                <button key={c.id} onClick={() => setCategoria(c.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: categoria === c.id ? "#141414" : "transparent", border: `1px solid ${categoria === c.id ? c.color : "#1E1E1E"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <Emo e={c.emoji} size={22} color={c.color} />
                  <span style={{ flex: 1, color: categoria === c.id ? "#E8E0D0" : "#8A8070", fontWeight: categoria === c.id ? 700 : 500, fontSize: "0.92em" }}>{c.label}</span>
                  {categoria === c.id && <Icone nome="check" size={16} color={c.color} sw={3} />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={S.field}>
          <label style={S.label}>DATA</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={S.dateInput} />
        </div>
        <button disabled={!valido}
          onClick={() => { onSave(isDespesa ? { descricao: nome.trim(), valor: v, data, categoria } : { nome: nome.trim(), valor: v, data }); onClose(); }}
          style={{ ...S.btn, opacity: valido ? 1 : 0.4, marginBottom: 10 }}>
          Guardar
        </button>
        <button onClick={() => { onDelete(); onClose(); }}
          style={{ width: "100%", background: "transparent", border: "1px solid #EF444440", borderRadius: 14, padding: "14px", color: "#EF4444", fontWeight: 700, fontSize: "0.9em", cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
          Apagar
        </button>
        <button onClick={onClose}
          style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit", padding: "6px" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── TODAS AS DESPESAS ────────────────────────────────────────────────────────
function AllDespesasScreen({ despesas, onEdit, onDelete, onBack }) {
  const [editing, setEditing] = useState(null);
  const total = despesas.reduce((s, d) => s + d.valor, 0);
  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Todas as despesas</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px", marginBottom: 18, textAlign: "center" }}>
          <div style={{ fontSize: "0.75em", color: "#8A8070", marginBottom: 4 }}>TOTAL GASTO</div>
          <div style={{ fontSize: "1.6em", fontWeight: 800, color: "#EF4444" }}>{fmtKz(total)}</div>
          <div style={{ fontSize: "0.78em", color: "#9F9582", marginTop: 2 }}>{despesas.length} despesa{despesas.length !== 1 ? "s" : ""}</div>
        </div>
        {despesas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9F9582", fontSize: "0.9em", padding: "40px 0" }}>Ainda não registaste despesas.</div>
        ) : (
          (() => {
            // Agrupar por data (mais recente primeiro)
            const grupos = {};
            [...despesas].forEach(d => { (grupos[d.data] = grupos[d.data] || []).push(d); });
            const datas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
            const fmtData = (iso) => {
              try {
                const hoje = todayStr();
                const ontem = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return x.toISOString().split("T")[0]; })();
                if (iso === hoje) return "Hoje";
                if (iso === ontem) return "Ontem";
                const [a, m, dia] = iso.split("-");
                const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
                return `${parseInt(dia,10)} ${meses[parseInt(m,10)-1]} ${a}`;
              } catch (e) { return iso; }
            };
            return datas.map(dataIso => {
              const itens = grupos[dataIso];
              const totalDia = itens.reduce((s, d) => s + d.valor, 0);
              return (
                <div key={dataIso} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #1A1A1A" }}>
                    <span style={{ fontSize: "0.8em", fontWeight: 700, color: "#C8C0B0", textTransform: "capitalize" }}>{fmtData(dataIso)}</span>
                    <span style={{ fontSize: "0.78em", color: "#8A8070" }}>{fmtKz(totalDia)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {itens.map(d => {
                      const cat = CATS.find(c => c.id === d.categoria);
                      return (
                        <button key={d.id} onClick={() => setEditing(d)}
                          style={{ ...S.expenseRow, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}>
                          <span style={S.expEmoji}><Emo e={cat?.emoji} size={20} color={cat?.color} /></span>
                          <div style={{ flex: 1 }}>
                            <div style={S.expDesc}>{d.descricao}</div>
                            <div style={S.expDate}>{cat?.label}</div>
                          </div>
                          <div style={{ color: "#EF4444", fontWeight: 600 }}>-{fmtKz(d.valor)}</div>
                          <Icone nome="pencil" size={14} color="#9F9582" style={{ marginLeft: 8 }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
      {editing && (
        <EditMovimentoModal tipo="despesa" item={editing}
          onSave={(dados) => onEdit(editing.id, dados)}
          onDelete={() => onDelete(editing.id)}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// ── TODAS AS ENTRADAS ────────────────────────────────────────────────────────
function AllEntradasScreen({ entradas, onEdit, onDelete, onBack, onAdd }) {
  const [editing, setEditing] = useState(null);
  const total = entradas.reduce((s, e) => s + e.valor, 0);
  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Todas as entradas</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px", marginBottom: 18, textAlign: "center" }}>
          <div style={{ fontSize: "0.75em", color: "#8A8070", marginBottom: 4 }}>TOTAL DE ENTRADAS EXTRA</div>
          <div style={{ fontSize: "1.6em", fontWeight: 800, color: "#22C55E" }}>{fmtKz(total)}</div>
          <div style={{ fontSize: "0.78em", color: "#9F9582", marginTop: 2 }}>{entradas.length} entrada{entradas.length !== 1 ? "s" : ""}</div>
        </div>
        {entradas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9F9582", fontSize: "0.9em", padding: "40px 0" }}>Ainda não tens entradas extra.</div>
        ) : (
          (() => {
            const grupos = {};
            [...entradas].forEach(e => { const k = e.data || "—"; (grupos[k] = grupos[k] || []).push(e); });
            const datas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
            const fmtData = (iso) => {
              try {
                const hoje = todayStr();
                const ontem = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return x.toISOString().split("T")[0]; })();
                if (iso === hoje) return "Hoje";
                if (iso === ontem) return "Ontem";
                const [a, m, dia] = iso.split("-");
                const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
                return `${parseInt(dia,10)} ${meses[parseInt(m,10)-1]} ${a}`;
              } catch (e) { return iso; }
            };
            return (
              <div style={{ marginBottom: 16 }}>
                {datas.map(dataIso => (
                  <div key={dataIso} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: "0.8em", fontWeight: 700, color: "#C8C0B0", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #1A1A1A", textTransform: "capitalize" }}>{fmtData(dataIso)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {grupos[dataIso].map(e => (
                        <button key={e.id || e.nome} onClick={() => setEditing(e)}
                          style={{ ...S.expenseRow, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}>
                          <span style={S.expEmoji}><Icone nome="arrowin" size={20} color="#22C55E" /></span>
                          <div style={{ flex: 1 }}>
                            <div style={S.expDesc}>{e.nome}</div>
                          </div>
                          <div style={{ color: "#22C55E", fontWeight: 600 }}>+{fmtKz(e.valor)}</div>
                          <Icone nome="pencil" size={14} color="#9F9582" style={{ marginLeft: 8 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
        <button onClick={onAdd} style={{ ...S.btn }}>+ Adicionar entrada</button>
      </div>
      {editing && (
        <EditMovimentoModal tipo="entrada" item={editing}
          onSave={(dados) => onEdit(editing.id, dados)}
          onDelete={() => onDelete(editing.id)}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// Extrai os campos da assinatura do perfil (Supabase) para o estado local.
// Usado no login E no carregamento inicial, para dar o mesmo resultado nos dois.
function infoAssinatura(perfil) {
  return {
    estadoConta: perfil?.estado || "trial",
    acessoAte: perfil?.acesso_ate || null,
    planoAtivo: perfil?.plano || null,
    trialInicio: perfil?.trial_inicio || null, // fonte OFICIAL do início do trial (servidor)
  };
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const TRIAL_DAYS = 7;

// Modal "Parabéns, tens acesso" — aparece quando o pagamento é confirmado
function ParabensPagamentoModal({ plano, acessoAte, onFechar }) {
  const nomePlano = plano === "anual" ? "1 ano inteiro" : plano === "mensal" ? "1 mês" : "o teu plano";
  const fmtD = (iso) => { try { const [a,m,d]=iso.split("-"); return `${d}/${m}/${a}`; } catch(e){ return iso; } };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0D0D0D", border: "1px solid #22C55E", borderRadius: 24, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ marginBottom: 12 }}><Icone nome="award" size={52} color="#F59E0B" /></div>
        <div style={{ fontSize: "1.3em", fontWeight: 800, color: "#E8E0D0", marginBottom: 10 }}>Parabéns!</div>
        <p style={{ color: "#A09880", fontSize: "0.95em", lineHeight: 1.6, marginBottom: 8 }}>
          O teu pagamento foi confirmado. Agora tens acesso à Klaco por <b style={{ color: "#22C55E" }}>{nomePlano}</b>.
        </p>
        {acessoAte && (
          <p style={{ color: "#8A8070", fontSize: "0.82em", marginBottom: 24 }}>Válido até {fmtD(acessoAte)}</p>
        )}
        <button onClick={onFechar} style={S.btn}>Continuar</button>
      </div>
    </div>
  );
}


// ── CONSENTIMENTO DE NOTIFICAÇÕES (aparece uma vez, após o 1º número) ─────────
function ConfirmarSalarioModal({ salarioAnterior, onConfirmar }) {
  const [valor, setValor] = useState(String(salarioAnterior || ""));
  const [display, setDisplay] = useState(salarioAnterior ? String(salarioAnterior).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");
  const handleInput = (raw) => {
    const { valor: nv, display: disp } = parseValorInput(raw);
    setValor(nv ? String(nv) : "");
    setDisplay(disp);
  };
  return (
    <div style={S.modalOverlay}>
      <div style={S.modalCard}>
        <div style={{ textAlign: "center", marginBottom: 12 }}><Sol size={44} /></div>
        <div style={{ ...S.logo, fontSize: "1.15em", textAlign: "center", marginBottom: 8 }}>Novo pagamento chegou</div>
        <p style={{ fontSize: "0.9em", color: "#A09880", lineHeight: 1.6, textAlign: "center", marginBottom: 20 }}>
          Quanto recebeste desta vez? Confirma ou ajusta, para o teu número do dia ficar certo.
        </p>
        <div style={S.inputGroup}>
          <span style={S.currency}>Kz</span>
          <input autoFocus type="text" inputMode="numeric" value={display}
            onChange={e => handleInput(e.target.value)} placeholder="0" style={S.bigInput} />
        </div>
        <button
          disabled={!valor || parseInt(valor) <= 0}
          onClick={() => onConfirmar(parseInt(valor))}
          style={{ ...S.btn, marginTop: 20, opacity: valor && parseInt(valor) > 0 ? 1 : 0.4 }}>
          Confirmar rendimento
        </button>
        <button onClick={() => onConfirmar(salarioAnterior)}
          style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.83em", cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
          Recebi o mesmo de sempre
        </button>
      </div>
    </div>
  );
}

function InstalarAppModal({ deferredPrompt, onInstalado, onFechar }) {
  const [vista, setVista] = useState("escolha"); // escolha | iphone

  const instalarAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const res = await deferredPrompt.userChoice;
        if (res && res.outcome === "accepted") { onInstalado(); return; }
      } catch (e) {}
      onFechar();
    } else {
      // Sem evento de instalação disponível (ex.: já instalada, ou navegador sem suporte)
      onFechar();
    }
  };

  // ── Ecrã da instrução do iPhone ──
  if (vista === "iphone") {
    return (
      <div style={S.modalOverlay}>
        <div style={S.modalCard}>
          <button onClick={() => setVista("escolha")}
            style={{ background: "transparent", border: "none", color: "#8A8070", fontSize: "0.88em", cursor: "pointer", fontFamily: "inherit", marginBottom: 14, padding: 0 }}>
            ‹ Voltar
          </button>
          <div style={{ ...S.logo, fontSize: "1.15em", textAlign: "center", marginBottom: 16 }}>Instalar no iPhone</div>
          <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
            <div style={{ fontSize: "0.84em", color: "#C8C0B0", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>1. Toca em <strong style={{ color: "#F59E0B" }}>Partilhar</strong> (o quadrado com a seta <Icone nome="share" size={15} style={{ margin: "0 2px" }} />, na barra de baixo do Safari).</div>
              <div>2. Desce e escolhe <strong style={{ color: "#F59E0B" }}>“Adicionar ao ecrã principal”</strong>.</div>
              <div>3. Toca em <strong style={{ color: "#F59E0B" }}>Adicionar</strong>. Pronto!</div>
            </div>
          </div>
          <button onClick={onFechar}
            style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
            Já percebi
          </button>
        </div>
      </div>
    );
  }

  // ── Ecrã de escolha (dois botões) ──
  return (
    <div style={S.modalOverlay}>
      <div style={S.modalCard}>
        <div style={{ textAlign: "center", marginBottom: 12 }}><Icone nome="phone" size={44} color="#F59E0B" /></div>
        <div style={{ ...S.logo, fontSize: "1.15em", textAlign: "center", marginBottom: 10 }}>
          Leva a Klaco contigo
        </div>
        <p style={{ fontSize: "0.9em", color: "#A09880", lineHeight: 1.6, textAlign: "center", marginBottom: 22 }}>
          Instala a Klaco no teu telemóvel e abre-a com um toque, como qualquer app — sem ir ao navegador. Escolhe o teu telemóvel:
        </p>

        <button onClick={instalarAndroid}
          style={{ width: "100%", background: "#F59E0B", border: "none", borderRadius: 14, padding: "15px", color: "#000", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Instalar no Android
        </button>
        <button onClick={() => setVista("iphone")}
          style={{ width: "100%", background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 14, padding: "15px", color: "#E8E0D0", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
           Instalar no iPhone
        </button>

        <button onClick={onFechar}
          style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          Agora não
        </button>
      </div>
    </div>
  );
}

// ── CONVITE A PARTILHAR NO INSTAGRAM — aparece só para quem dá 4 ou 5 estrelas ──
function PartilharInstagramModal({ onFechar }) {
  const [copiado, setCopiado] = useState(false);
  const INSTAGRAM_KLACO = "https://www.instagram.com/klacoapp?stkn=MThjbHhxZmh6emQ1Zg%3D%3D&utm_source=qr";
  const legendaSugerida = "A Klaco está a ajudar-me a saber todos os dias quanto posso gastar sem culpa. 🌅 @klacoapp";

  const handleCopiar = () => {
    try { navigator.clipboard.writeText(legendaSugerida); } catch (e) {}
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };
  const handleAbrirInstagram = () => {
    window.open(INSTAGRAM_KLACO, "_blank");
    onFechar();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px" }}>
        <div style={{ marginBottom: 10 }}><Icone nome="camera" size={40} color="#F59E0B" /></div>
        <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 8 }}>Que bom que estás a gostar!</div>
        <p style={{ color: "#A09880", fontSize: "0.9em", lineHeight: 1.6, marginBottom: 20 }}>
          Partilha a tua experiência e marca-nos: <span style={{ color: "#F59E0B", fontWeight: 700 }}>@klacoapp</span>
        </p>

        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 14, padding: "14px 16px", marginBottom: 18, fontSize: "0.85em", color: "#C8C0B0", lineHeight: 1.6 }}>
          "{legendaSugerida}"
        </div>

        <button onClick={handleCopiar}
          style={{ width: "100%", background: "transparent", border: "1px solid #2A2A2A", borderRadius: 14, padding: "14px", color: copiado ? "#22C55E" : "#E8E0D0", fontWeight: 700, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
          {copiado ? "Legenda copiada" : "Copiar legenda"}
        </button>

        <button onClick={handleAbrirInstagram} style={{ ...S.btn, marginBottom: 10 }}>
          Abrir Instagram da Klaco
        </button>

        <button onClick={onFechar}
          style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
          Agora não
        </button>
      </div>
    </div>
  );
}

function AvaliacaoModal({ onEnviar, onFechar, avaliacaoAnterior }) {
  const [estrelas, setEstrelas] = useState(avaliacaoAnterior?.estrelas || 0);
  const [hover, setHover] = useState(0);
  const [texto, setTexto] = useState(avaliacaoAnterior?.texto || "");

  return (
    <div style={S.modalOverlay}>
      <div style={S.modalCard}>
        {onFechar && (
          <button onClick={onFechar}
            style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "#8A8070", fontSize: "1.3em", cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}><Icone nome="x" size={20} /></button>
        )}
        <div style={{ textAlign: "center", marginBottom: 10 }}><Sol size={40} /></div>
        <div style={{ ...S.logo, fontSize: "1.1em", textAlign: "center", marginBottom: 8 }}>
          Estás a gostar da Klaco?
        </div>
        <p style={{ fontSize: "0.86em", color: "#A09880", lineHeight: 1.5, textAlign: "center", marginBottom: 20 }}>
          A tua opinião ajuda-nos a melhorar. Leva só um segundo.
        </p>

        {/* Estrelas */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {[1,2,3,4,5].map(n => (
            <button key={n}
              onClick={() => setEstrelas(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "2.1em", lineHeight: 1, padding: 2, fontFamily: "inherit", transition: "transform 0.1s", transform: (hover || estrelas) >= n ? "scale(1.1)" : "scale(1)" }}>
              <Icone nome={(hover || estrelas) >= n ? "starFull" : "star"} size={34} color={(hover || estrelas) >= n ? "#F59E0B" : "#4A4438"} />
            </button>
          ))}
        </div>

        {/* Texto opcional */}
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Queres dizer mais alguma coisa? (opcional)"
          rows={3}
          style={{ width: "100%", background: "#0A0A0A", border: "1px solid #1E1E1E", borderRadius: 12, padding: "12px 14px", color: "#DDD", fontSize: "0.88em", fontFamily: "inherit", resize: "none", marginBottom: 18, lineHeight: 1.5 }}
        />

        <button
          disabled={estrelas === 0}
          onClick={() => onEnviar({ estrelas, texto: texto.trim(), data: todayStr() })}
          style={{ ...S.btn, opacity: estrelas > 0 ? 1 : 0.4 }}>
          Enviar avaliação
        </button>
        {onFechar && (
          <button onClick={onFechar}
            style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.83em", cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
            Agora não
          </button>
        )}
      </div>
    </div>
  );
}

function NotifConsentModal({ onGuardar }) {
  const [lembrete, setLembrete] = useState(false);
  const [novidades, setNovidades] = useState(false);

  const Check = ({ ativo }) => (
    <div style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${ativo ? "#F59E0B" : "#3A3A3A"}`, background: ativo ? "#F59E0B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
      {ativo && <Icone nome="check" size={12} color="#000" sw={3.2} />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 250, animation: "slideUp 0.3s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 36px" }}>
        <div style={{ marginBottom: 8 }}><Sol size={30} /></div>
        <div style={{ fontSize: "1.2em", fontWeight: 800, color: "#E8E0D0", marginBottom: 6 }}>Como queres que a Klaco fale contigo?</div>
        <p style={{ fontSize: "0.86em", color: "#8A8070", marginBottom: 22, lineHeight: 1.5 }}>
          Escolhe o que preferes receber. Podes mudar isto quando quiseres nas Definições.
        </p>

        <button onClick={() => setLembrete(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: lembrete ? "#F59E0B10" : "#0A0A0A", border: `1px solid ${lembrete ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 14, padding: "16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 12 }}>
          <Check ativo={lembrete} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" }}>Lembrete diário</div>
            <div style={{ fontSize: "0.8em", color: "#8A8070", marginTop: 2 }}>Saber quanto podes gastar hoje</div>
          </div>
        </button>

        <button onClick={() => setNovidades(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: novidades ? "#F59E0B10" : "#0A0A0A", border: `1px solid ${novidades ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 14, padding: "16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 22 }}>
          <Check ativo={novidades} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" }}>Novidades e promoções</div>
            <div style={{ fontSize: "0.8em", color: "#8A8070", marginTop: 2 }}>Ofertas e atualizações da Klaco</div>
          </div>
        </button>

        <button onClick={() => onGuardar({ lembrete, novidades })} style={S.btn}>Guardar</button>
        <p style={{ fontSize: "0.74em", color: "#9F9582", textAlign: "center", marginTop: 12, lineHeight: 1.4 }}>
          Se não escolheres nada, não recebes notificações. Sem problema.
        </p>
      </div>
    </div>
  );
}

const INIT = {
  conta: false,        // true depois de criar conta / entrar
  email: "",
  setup: false,
  salario: 0,
  dataRecebimento: todayStr(),
  proximoPagamento: addMonths(todayStr(), 1),
  pct: { ...DEFAULT_PCT },
  despesas: [],
  objectivos: [],
  setupDate: null,
  nome: "",
  entradasExtra: [], // 13º, bónus, subsídios: [{ nome, valor, data }]
  semEntradaInicial: false, // true = começou agora, só tem pagamento futuro
  inviteCode: generateInviteCode(),
  inviteCount: 0,
  conquistaMostrada: false,
  conviteDiasMostrados: [],
  notifLembrete: false,      // consentimento: lembrete diário
  notifNovidades: false,     // consentimento: novidades e promoções
  notifPerguntado: false,    // já mostrámos o cartão de consentimento?
  dicaRegistoMostrada: false, // já mostrámos a dica "regista para o número ficar certo"?
  avaliacaoTrialFeita: false, // já pedimos avaliação uma vez durante o trial?
  ultimaAvaliacao: null,      // { estrelas, texto, data } da última avaliação enviada
  convitePartilhaInstagramVisto: false, // já viu o convite p/ partilhar no Instagram (4-5 estrelas)?
  ultimoPedidoAvaliacao: null, // data do último pedido (para espaçar depois do trial)
  comprovativoEnviado: false, // pagamento: já abriu o WhatsApp para enviar o comprovativo?
  etiquetasCustom: {}, // descrições personalizadas por categoria: { necessidades: ["..."], ... }
  planoEscolhido: "anual",    // plano que escolheu no ecrã de pagamento
  rendimentoVariavel: false,  // true se o salário muda de mês para mês
  periodoSalarioConfirmado: null, // qual dataRecebimento já teve o salário confirmado
  appInstalada: false,        // a pessoa já instalou a app (PWA)?
  pin: null,                  // PIN de 4 dígitos (proteção local do acesso)
  biometriaAtiva: false,      // a pessoa ativou entrar por biometria?
  estadoConta: "trial",       // estado no servidor: trial | ativo | expirado
  trialInicio: null,          // início do trial vindo do servidor (perfis.trial_inicio) — fonte oficial
  acessoAte: null,            // data até quando o acesso pago é válido
  planoAtivo: null,           // mensal | anual (quando pago)
  parabensPagamentoVisto: false, // já mostrou o "Parabéns, tens acesso"?
  instalarPedidos: 0,         // quantas vezes já mostrámos o convite para instalar
  aberturas: 0,               // número de vezes que abriu a app (para o timing do lembrete)
};

// ── PAINEL DE ADMINISTRAÇÃO ────────────────────────────────────────────────────
function AdminScreen({ onBack }) {
  const [perfis, setPerfis] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [pesquisa, setPesquisa] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | trial | ativo | expirado
  const [selecionado, setSelecionado] = useState(null);
  const [msg, setMsg] = useState(null); // {tipo:'ok'|'erro', texto}
  const [pendentes, setPendentes] = useState([]);
  const [aProcessarPag, setAProcessarPag] = useState(null); // id em processamento

  const carregar = async () => {
    setACarregar(true);
    try {
      const [lista, pend] = await Promise.all([listarPerfis(), listarPagamentosPendentes()]);
      setPerfis(lista);
      setPendentes(pend);
    } catch (e) {
      console.error("admin carregar:", e);
      setMsg({ tipo: "erro", texto: "Não foi possível carregar os dados. Tenta novamente." });
    } finally {
      setACarregar(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const aprovar = async (pag) => {
    if (aProcessarPag) return; // impede cliques duplicados
    setAProcessarPag(pag.id); setMsg(null);
    try {
      const r = await aprovarSolicitacao(pag.id);
      if (r && r.ok) {
        setMsg({ tipo: "ok", texto: "Pagamento aprovado e acesso ativado." });
        setPendentes(prev => prev.filter(p => p.id !== pag.id));
        carregar();
      } else {
        setMsg({ tipo: "erro", texto: (r && r.erro) || "Não foi possível concluir a operação. Tenta novamente." });
      }
    } catch (e) {
      console.error("aprovar:", e);
      setMsg({ tipo: "erro", texto: "Não foi possível concluir a operação. Tenta novamente." });
    } finally {
      setAProcessarPag(null);
    }
  };
  const rejeitar = async (pag) => {
    if (aProcessarPag) return;
    if (!window.confirm("Tem certeza que deseja rejeitar esta solicitação?")) return;
    setAProcessarPag(pag.id); setMsg(null);
    try {
      const r = await rejeitarSolicitacao(pag.id);
      if (r && r.ok) {
        setMsg({ tipo: "ok", texto: "Solicitação rejeitada." });
        setPendentes(prev => prev.filter(p => p.id !== pag.id));
      } else {
        setMsg({ tipo: "erro", texto: (r && r.erro) || "Não foi possível concluir a operação. Tenta novamente." });
      }
    } catch (e) {
      console.error("rejeitar:", e);
      setMsg({ tipo: "erro", texto: "Não foi possível concluir a operação. Tenta novamente." });
    } finally {
      setAProcessarPag(null);
    }
  };

  // Classificação (datas em Africa/Luanda; acesso_ate é inclusiva):
  //  - admin: perfis.is_admin === true (única fonte) — sem estado/validade;
  //  - ativo: subscrição paga com validade não anterior a hoje;
  //  - expirado: subscrição paga já vencida (ou sem validade válida) OU teste de 7 dias já terminado;
  //  - trial: teste ainda em curso. Não altera nada na base de dados.
  const ehAdminPerfil = (p) => p.is_admin === true;
  const estadoReal = (p) => {
    if (ehAdminPerfil(p)) return "admin";
    if (p.estado === "ativo") return acessoPagoValido("ativo", p.acesso_ate) ? "ativo" : "expirado";
    if (p.estado === "expirado") return "expirado";
    // Validade já passada = expirada, tal como o bloqueio de acesso da app (acessoExpirado), mesmo que
    // o estado guardado ainda seja "trial".
    if (acessoExpirado(p.acesso_ate)) return "expirado";
    const inicio = dataLuanda(p.trial_inicio);
    if (inicio && diasEntreDatas(inicio, hojeLuanda()) >= TRIAL_DAYS) return "expirado";
    return p.estado || "trial";
  };

  const filtrados = perfis.filter(p => {
    const txt = pesquisa.trim().toLowerCase();
    const bate = !txt ||
      (p.nome || "").toLowerCase().includes(txt) ||
      (p.email || "").toLowerCase().includes(txt) ||
      (p.telefone || "").toLowerCase().includes(txt);
    const est = estadoReal(p);
    const passaFiltro = filtro === "todos" || est === filtro;
    return bate && passaFiltro;
  });

  const corEstado = (e) => e === "ativo" ? "#22C55E" : e === "expirado" ? "#EF4444" : "#F59E0B";
  // Teste terminado distingue-se de subscrição paga expirada; administradores mostram ADMIN.
  const rotuloEstado = (p, e) => e === "admin" ? "ADMIN" : (e === "expirado" && !p.acesso_ate && p.estado !== "ativo" && p.estado !== "expirado") ? "teste terminado" : e;
  const estiloChip = (e, tam) => e === "admin"
    ? { padding: "3px 10px", borderRadius: 20, background: "#F59E0B", color: "#080808", fontSize: tam, fontWeight: 800, letterSpacing: "0.08em" }
    : { padding: "3px 10px", borderRadius: 20, background: corEstado(e) + "22", color: corEstado(e), fontSize: tam, fontWeight: 700 };

  // ── Detalhe de um utilizador ──
  if (selecionado) {
    const est = estadoReal(selecionado);
    return (
      <div style={S.screen}>
        <div style={S.topBar}>
          <button onClick={() => { setSelecionado(null); setMsg(null); }} style={S.backBtn}>← Voltar</button>
          <div style={{ fontWeight: 800, color: "#E8E0D0" }}>Utilizador</div>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ padding: "0 16px 40px" }}>
          <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 4 }}>{selecionado.nome || "(sem nome)"}</div>
            <div style={{ fontSize: "0.85em", color: "#8A8070" }}>{selecionado.email || selecionado.telefone || "—"}</div>
            <div style={{ display: "inline-block", marginTop: 10, ...estiloChip(est, "0.78em") }}>{rotuloEstado(selecionado, est)}</div>
            <div style={{ marginTop: 14, fontSize: "0.82em", color: "#A09880", lineHeight: 1.8 }}>
              {est !== "admin" && (
                <>
                  <div>Plano: {selecionado.plano || "—"}</div>
                  <div>Início do trial: {selecionado.trial_inicio || "—"}</div>
                  <div>Acesso até: {selecionado.acesso_ate || "—"}</div>
                </>
              )}
              <div style={{ fontSize: "0.9em", color: "#9F9582", marginTop: 4, wordBreak: "break-all" }}>ID: {selecionado.id}</div>
            </div>
          </div>

          <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 12, padding: "14px 16px", fontSize: "0.82em", color: "#8A8070", lineHeight: 1.6 }}>
            As ativações de pagamento são feitas na secção <b style={{ color: "#A09880" }}>Pagamentos pendentes</b>, quando o utilizador envia uma solicitação. Aqui vês apenas os dados da conta.
          </div>
        </div>
      </div>
    );
  }

  // ── Lista de utilizadores ──
  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={{ fontWeight: 800, color: "#E8E0D0" }}>Administração</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px 40px" }}>
        {msg && (
          <div style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: "0.84em",
            background: msg.tipo === "ok" ? "#22C55E22" : "#EF444422", color: msg.tipo === "ok" ? "#22C55E" : "#EF4444" }}>
            {msg.texto}
          </div>
        )}

        {/* PAGAMENTOS PENDENTES */}
        {pendentes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: "0.78em", fontWeight: 800, letterSpacing: "0.08em", color: "#F59E0B", marginBottom: 10 }}>
              PAGAMENTOS PENDENTES ({pendentes.length})
            </div>
            {pendentes.map(pag => {
              const fmtD = (iso) => { try { const d = new Date(iso); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; } catch(e){ return iso || "—"; } };
              // Identificar o utilizador: usar o que a Edge Function trouxer; se faltar,
              // cruzar com a lista de perfis já carregada (pagamentos.user_id → perfis.id).
              const perfilDoPag = perfis.find(p => p.id === (pag.user_id || pag.perfil_id)) || {};
              const nome = pag.nome || pag.perfil_nome || perfilDoPag.nome || "(sem nome)";
              const email = pag.email || perfilDoPag.email || null;
              const telefone = pag.telefone || perfilDoPag.telefone || null;
              return (
                <div key={pag.id} style={{ background: "#0D0D0D", border: "1px solid #F59E0B44", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                  <div style={{ fontSize: "0.95em", color: "#E8E0D0", fontWeight: 800 }}>{nome}</div>
                  <div style={{ fontSize: "0.82em", color: "#A09880", marginTop: 8, lineHeight: 1.8 }}>
                    {email && <>Email: <b style={{ color: "#E8E0D0" }}>{email}</b><br/></>}
                    {telefone && <>Telefone: <b style={{ color: "#E8E0D0" }}>{telefone}</b><br/></>}
                    Plano: <b style={{ color: "#E8E0D0", textTransform: "capitalize" }}>{pag.plano}</b><br/>
                    Valor: <b style={{ color: "#E8E0D0" }}>{Number(pag.valor).toLocaleString("pt")} Kz</b><br/>
                    Solicitado em: <b style={{ color: "#E8E0D0" }}>{fmtD(pag.criado_em)}</b><br/>
                    Status: <b style={{ color: "#F59E0B", textTransform: "capitalize" }}>{pag.status || "pendente"}</b>
                  </div>
                  <div style={{ fontSize: "0.68em", color: "#5A5245", marginTop: 8, wordBreak: "break-all" }}>Ref.: {pag.id}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => aprovar(pag)} disabled={aProcessarPag === pag.id}
                      style={{ flex: 1, background: "#22C55E", border: "none", borderRadius: 10, padding: "11px", color: "#052E16", fontWeight: 800, fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit", opacity: aProcessarPag === pag.id ? 0.6 : 1 }}>
                      {aProcessarPag === pag.id ? "…" : "Aprovar"}
                    </button>
                    <button onClick={() => rejeitar(pag)} disabled={aProcessarPag === pag.id}
                      style={{ flex: 1, background: "transparent", border: "1px solid #EF444466", borderRadius: 10, padding: "11px", color: "#EF4444", fontWeight: 700, fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <input type="text" value={pesquisa} onChange={e => setPesquisa(e.target.value)}
          placeholder="Pesquisar por nome, email ou telefone" style={{ ...S.input, marginBottom: 12 }} />

        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {["todos", "trial", "ativo", "expirado"].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: "7px 14px", borderRadius: 20, background: filtro === f ? "#F59E0B" : "transparent", border: `1px solid ${filtro === f ? "#F59E0B" : "#2A2A2A"}`, color: filtro === f ? "#080808" : "#A09880", fontSize: "0.82em", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
              {f}
            </button>
          ))}
        </div>

        {aCarregar ? (
          <div style={{ textAlign: "center", color: "#8A8070", padding: 40 }}>A carregar utilizadores…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8A8070", padding: 40 }}>Nenhum utilizador encontrado.</div>
        ) : (
          filtrados.map(p => {
            const est = estadoReal(p);
            return (
              <button key={p.id} onClick={() => { setSelecionado(p); setMsg(null); }}
                style={{ width: "100%", textAlign: "left", background: "#0D0D0D", border: "1px solid #161616", borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#E8E0D0", fontWeight: 700, fontSize: "0.92em" }}>{p.nome || "(sem nome)"}</div>
                  <div style={{ color: "#8A8070", fontSize: "0.78em", marginTop: 2 }}>{p.email || p.telefone || "—"}</div>
                </div>
                <div style={estiloChip(est, "0.74em")}>{rotuloEstado(p, est)}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Lê o estado guardado no aparelho (memória entre sessões no mesmo dispositivo).
  // localStorage serve de CACHE offline; a fonte de verdade é o Supabase (perfis.dados).
  const carregarEstado = () => {
    try {
      const guardado = window.localStorage.getItem("klaco_state");
      if (guardado) return { ...INIT, ...JSON.parse(guardado) };
    } catch (e) {}
    return INIT;
  };

  const [state, setState] = useState(carregarEstado);
  const [screen, setScreen] = useState("auth");
  const [userId, setUserId] = useState(null);       // id do utilizador autenticado (Supabase)
  const [aCarregar, setACarregar] = useState(true); // a verificar sessão ao arrancar
  const [authReady, setAuthReady] = useState(false); // decisão de navegação inicial concluída
  const [bloqueado, setBloqueado] = useState(false); // ecrã de PIN a bloquear o acesso
  const [definirPin, setDefinirPin] = useState(false); // mostrar ecrã de criar PIN
  const [isAdmin, setIsAdmin] = useState(false); // perfil.is_admin — mostra painel de admin
  const [notificacoes, setNotificacoes] = useState([]);           // lista vinda de public.notificacoes
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const lembretesExecutadosPara = useRef(null); // userId para o qual gerar-lembretes já correu nesta sessão
  const saveTimer = useRef(null);
  // SÓ permitir gravar em perfis.dados DEPOIS de o perfil ter sido carregado do Supabase.
  // Isto impede que o estado inicial vazio sobrescreva (apague) os dados já guardados.
  const podeGravar = useRef(false);
  // 1.ª despesa / 1.º rendimento adicional desta sessão, à espera de a gravação ser confirmada.
  const metricasPendentes = useRef({ uid: null, gasto: false, rendimento: false });

  // Cache local imediato (offline) sempre que o estado muda.
  useEffect(() => {
    try { window.localStorage.setItem("klaco_state", JSON.stringify(state)); } catch (e) {}
  }, [state]);

  // Ao arrancar: verificar se há sessão ativa e carregar o perfil do Supabase.
  useEffect(() => {
    let vivo = true;
    // Ecrãs internos seguros de restaurar após refresh (não decidem segurança sozinhos)
    const ecrasRestauraveis = ["dashboard", "goals", "charts", "settings", "convite", "editarDados", "todasDespesas", "todasEntradas", "etiquetas"];
    let ecraGuardado = null;
    try { ecraGuardado = window.sessionStorage.getItem("klaco_screen"); } catch (e) {}
    // Lê o "setup" diretamente do cache local (não do state do closure, que fica congelado
    // na primeira renderização). Assim as decisões de navegação usam o valor atual do cache.
    let setupEmCache = false;
    try {
      const guardado = window.localStorage.getItem("klaco_state");
      if (guardado) setupEmCache = !!JSON.parse(guardado)?.setup;
    } catch (e) {}

    // Decide o ecrã final quando o utilizador tem setup completo:
    // restaura o ecrã onde estava (se for seguro), senão vai ao dashboard.
    const decidirEcraComSetup = (ehAdmin) => {
      if (ecraGuardado && ecrasRestauraveis.includes(ecraGuardado)) return ecraGuardado;
      if (ecraGuardado === "admin" && ehAdmin) return "admin"; // admin só se confirmado is_admin
      return "dashboard";
    };

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && vivo) {
          setUserId(session.user.id);
          const perfil = await carregarPerfil(session.user.id);
          if (perfil && vivo) {
            const ehAdmin = perfil.is_admin === true;
            setIsAdmin(ehAdmin);
            const contaInfo = infoAssinatura(perfil);
            const dados = perfil.dados && Object.keys(perfil.dados).length ? perfil.dados : null;
            if (dados) {
              // perfil.nome (coluna oficial) tem prioridade sobre o nome em dados/cache.
              setState(prev => ({ ...INIT, ...prev, ...dados, ...contaInfo, ...(perfil.nome ? { nome: perfil.nome } : {}), email: perfil.email || prev.email }));
              if (dados.setup) {
                // Tem setup: restaura o ecrã onde estava (validado), com PIN se aplicável
                if (dados.pin) { setBloqueado(true); setScreen(decidirEcraComSetup(ehAdmin)); }
                else setScreen(decidirEcraComSetup(ehAdmin));
              } else {
                setScreen("setup");
              }
            } else {
              setState(prev => ({ ...prev, ...contaInfo }));
              // Sem dados no servidor: só vai a setup se realmente não houver setup em cache.
              // Lê o setup do cache local diretamente (não do state do closure, que pode estar stale).
              setScreen(setupEmCache ? decidirEcraComSetup(ehAdmin) : "setup");
            }
          } else if (vivo) {
            // Perfil não veio (pode ser erro temporário): não forçar setup se há cache com setup
            setScreen(setupEmCache ? "dashboard" : "setup");
          }
          if (vivo) podeGravar.current = true;
        }
        // Sem sessão: fica em "auth" (o valor inicial). Não força nada.
      } catch (e) {
        console.error("sessão:", e);
        // Erro a carregar: não navegar arbitrariamente. Se há cache com setup, mantém dashboard.
        if (vivo && setupEmCache) setScreen("dashboard");
      }
      finally { if (vivo) { setACarregar(false); setAuthReady(true); } }
    })();

    // Reagir a login/logout noutros separadores/sessões
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      // Se a sessão desaparece (logout/expirou), volta a auth
      if (!uid) { setScreen("auth"); setIsAdmin(false); }
    });
    return () => { vivo = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // Guardar o ecrã atual (para restaurar após refresh) — só telas internas seguras.
  useEffect(() => {
    if (!authReady) return;
    try {
      if (["auth", "setup"].includes(screen)) window.sessionStorage.removeItem("klaco_screen");
      else window.sessionStorage.setItem("klaco_screen", screen);
    } catch (e) {}
  }, [screen, authReady]);

  // Deteta a aprovação do pagamento sem exigir logout/login.
  // Enquanto o utilizador está logado e a conta NÃO está paga, recarrega o perfil
  // periodicamente (intervalo moderado). Assim que o servidor refletir estado='ativo'
  // e acesso_ate no futuro, o estado local atualiza e a app sai do ecrã de bloqueio.
  useEffect(() => {
    if (!userId) return;
    // Só faz sentido enquanto a conta ainda não está paga/válida.
    const jaPaga = acessoPagoValido(state.estadoConta, state.acessoAte);
    if (jaPaga) return;
    let vivo = true;
    const intervalo = setInterval(async () => {
      try {
        const perfil = await carregarPerfil(userId);
        if (!perfil || !vivo) return;
        const info = infoAssinatura(perfil);
        // Atualiza só se algo mudou (evita re-render desnecessário)
        setState(prev => {
          if (prev.estadoConta === info.estadoConta && prev.acessoAte === info.acessoAte && prev.planoAtivo === info.planoAtivo) {
            return prev;
          }
          return { ...prev, ...info };
        });
      } catch (e) { /* silencioso — tenta de novo no próximo ciclo */ }
    }, 30000); // 30s: moderado, sem sobrecarregar
    return () => { vivo = false; clearInterval(intervalo); };
  }, [userId, state.estadoConta, state.acessoAte]);

  // Guardar o estado no Supabase, com debounce (evita gravar a cada tecla).
  // Só grava depois de o perfil ter sido carregado (podeGravar), para nunca
  // sobrescrever perfis.dados com um estado inicial vazio.
  useEffect(() => {
    if (!userId || !podeGravar.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const guardou = await guardarDados(userId, state);
      if (guardou) confirmarMetricas(metricasPendentes.current, userId, state);
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, userId]);

  // Acumulação automática dos objectivos: uma vez por período, soma a poupança mensal.
  // O identificador do período é a data de recebimento em vigor. Cada objectivo guarda
  // o último período em que já acumulou, para nunca somar duas vezes no mesmo período.
  // [DEV] Com o Supabase, este controlo deve viver no servidor para ser à prova de tudo.
  useEffect(() => {
    if (!state.setup) return;
    const periodoAtual = state.dataRecebimento || "";
    if (!periodoAtual) return;
    const objs = state.objectivos || [];
    const precisaAcumular = objs.some(g =>
      g.acumulacaoAuto && g.ultimoPeriodoAuto !== periodoAtual && (g.acumulado || 0) < g.valorAlvo
    );
    if (!precisaAcumular) return;
    setState(prev => ({
      ...prev,
      objectivos: (prev.objectivos || []).map(g => {
        if (g.acumulacaoAuto && g.ultimoPeriodoAuto !== periodoAtual && (g.acumulado || 0) < g.valorAlvo) {
          const novoAcumulado = Math.min(g.valorAlvo, (g.acumulado || 0) + (g.poupancaMensal || 0));
          return { ...g, acumulado: novoAcumulado, ultimoPeriodoAuto: periodoAtual };
        }
        return g;
      }),
    }));
  }, [state.setup, state.dataRecebimento, state.objectivos]);

  // Cálculo do trial — FONTE OFICIAL: perfis.trial_inicio (servidor, protegido).
  // O trial_inicio vem do Supabase e não pode ser manipulado no navegador.
  // state.setupDate fica apenas como fallback para contas antigas sem trial_inicio.
  const inicioTrial = state.trialInicio || state.setupDate || null;
  const trialDaysUsed = inicioTrial ? diasDesdeLuanda(inicioTrial) : 0; // dias de calendário em Africa/Luanda
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  // Estado REAL da subscrição (calculado da data, não só de estadoConta):
  // - contaPaga: estado 'ativo' no servidor E acesso ainda válido (data no futuro)
  // - subscricaoExpirada: já teve um plano pago (tem acessoAte) mas a data já passou
  const contaPaga = acessoPagoValido(state.estadoConta, state.acessoAte);
  const subscricaoExpirada = acessoExpirado(state.acessoAte);
  // Bloqueio: trial gratuito esgotado OU subscrição paga expirada (ambos exigem pagar).
  // Isto é apresentação (UI), não autorização: a autoridade é a base de dados
  // (is_admin, estado, plano, acesso_ate, trial_inicio), que o cliente não consegue alterar.
  const trialExpired = state.setup && !isAdmin && !contaPaga &&
    (subscricaoExpirada || trialDaysUsed >= TRIAL_DAYS);

  const handleDispensarDica = () => {
    setState(prev => ({ ...prev, dicaRegistoMostrada: true }));
  };

  const handleComprovativoEnviado = async (plano) => {
    // plano === null significa "mudar de plano" — volta ao ecrã de pagamento
    if (plano === null) {
      setState(prev => ({ ...prev, comprovativoEnviado: false }));
      return { ok: true };
    }
    const dentroTrial = trialDaysUsed < TRIAL_DAYS;
    // Anual: 12.000 Kz de tabela — 6.000 Kz no trial (50%), 10.000 Kz fora do trial (2 meses grátis).
    const valorNum = plano === "anual" ? (dentroTrial ? 6000 : 10000) : 1000;
    // Criar a solicitação de pagamento (status 'pendente' no servidor). NÃO ativa a conta.
    const r = await criarSolicitacaoPagamento({ plano, valor: valorNum, dentroTrial });
    if (r.ok) {
      setState(prev => ({ ...prev, comprovativoEnviado: true, planoEscolhido: plano }));
    }
    return r;
  };

  const handleToggleNotif = (chave) => {
    setState(prev => ({ ...prev, [chave]: !prev[chave] }));
  };

  const handleNotifConsent = ({ lembrete, novidades }) => {
    setState(prev => ({ ...prev, notifLembrete: lembrete, notifNovidades: novidades, notifPerguntado: true }));
  };

  const handleAuth = async (email, user) => {
    if (user?.id) {
      setUserId(user.id);
      // Se veio por convite (?ref=CODIGO no link), guardar o código no perfil de forma
      // segura (sem violar o RLS de convites). O relacionamento em "convites" será criado
      // por uma Edge Function/RPC segura no backend (ver [PENDENTE-BACKEND]).
      try {
        const ref = new URLSearchParams(window.location.search).get("ref");
        if (ref) await guardarRefConvite(user.id, ref);
      } catch (e) {}
      // Carregar perfil (caso já exista de um login anterior)
      const perfil = await carregarPerfil(user.id);
      if (perfil) setIsAdmin(perfil.is_admin === true);
      // Campos da assinatura (estado/acesso_ate/plano) vindos diretamente da tabela perfis
      const contaInfo = infoAssinatura(perfil);
      const dados = perfil?.dados && Object.keys(perfil.dados).length ? perfil.dados : null;
      if (dados) {
        setState(prev => ({ ...INIT, ...prev, ...dados, ...contaInfo, ...(perfil.nome ? { nome: perfil.nome } : {}), conta: true, email }));
        setScreen(dados.setup ? "dashboard" : "setup");
        podeGravar.current = true; // perfil lido → seguro gravar
        return;
      }
      // Sem dados financeiros ainda, mas preserva o estado da assinatura do servidor
      setState(prev => ({ ...prev, ...contaInfo, conta: true, email }));
      podeGravar.current = true; // conta nova, sem dados a apagar → seguro gravar
      setScreen("setup");
      return;
    }
    setState(prev => ({ ...prev, conta: true, email }));
    setScreen("setup");
  };

  // Limpeza local ao terminar a sessão (não chama o Supabase): estado, cache e ecrã de login.
  const limparSessaoLocal = () => {
    podeGravar.current = false;
    metricasPendentes.current = { uid: null, gasto: false, rendimento: false };
    setNotificacoes([]); setMostrarNotificacoes(false);
    setUserId(null);
    try { window.localStorage.removeItem("klaco_state"); } catch (e) {}
    setState(INIT);
    setScreen("auth");
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    limparSessaoLocal();
  };

  // Trocar de conta a partir do ecrã de bloqueio (teste/subscrição expirados).
  // Chama o signOut UMA só vez e verifica o resultado ANTES de limpar: se falhar (ex.: sem rede),
  // o Supabase mantém a sessão guardada e ela seria restaurada ao recarregar. Só se confirmar,
  // faz a limpeza local (estado, cache, userId) e volta ao ecrã de autenticação.
  const handleTrocarConta = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao terminar sessão:", e);
      alert("Não foi possível terminar a sessão. Verifica a ligação e tenta de novo.");
      return;
    }
    limparSessaoLocal();
  };

  const handleSetupDone = async (data) => {
    // Persistir o nome em perfis.nome ANTES de concluir o setup (Supabase = fonte oficial).
    // ID: obter diretamente da sessão autenticada (fonte principal); userId (estado) só como fallback,
    // para não depender de um valor de estado que possa estar desatualizado.
    if (data?.nome) {
      let idParaGravar = userId; // fallback
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) idParaGravar = user.id;
      } catch (e) {
        console.error("Erro ao obter utilizador autenticado:", e);
      }
      if (idParaGravar) {
        const resultadoNome = await guardarNome(idParaGravar, data.nome);
        if (!resultadoNome.ok) {
          console.error("Erro ao guardar nome:", resultadoNome.erro);
          alert("Não foi possível guardar o teu nome. Verifica a ligação e tenta de novo.");
          return; // mantém no setup; não considera o cadastro concluído
        }
      }
    }
    setState(prev => ({ ...prev, ...data, setup: true, setupDate: todayStr() }));
    setScreen("dashboard");
    // Se ainda não definiu PIN, pedir para criar um agora
    if (!state.pin) setDefinirPin(true);
  };

  const handleDefinirPin = (pin) => {
    setState(prev => ({ ...prev, pin }));
    setDefinirPin(false);
  };

  const handleEntrarPin = () => setBloqueado(false);

  const handleEsqueciPin = async () => {
    // [DEV] Recuperação do PIN: enviar código pelo canal da conta.
    //   - Conta por EMAIL  → resetPasswordForEmail / link (requer SMTP configurado).
    //   - Conta por TELEFONE → novo OTP por WhatsApp/SMS (requer canal configurado).
    // Enquanto os canais não estão prontos, faz logout para reentrar pela conta.
    await handleLogout();
    setBloqueado(false);
  };

  const handleBiometria = () => {
    // Biometria (impressão digital / rosto) via WebAuthn — trata os dois tipos.
    // [DEV] Integrar WebAuthn (navigator.credentials) para desbloqueio biométrico real.
    //   Aqui, se ativa, desbloqueia. A verificação real é feita pelo dispositivo.
    setBloqueado(false);
  };

  const handleSettingsSave = async (data) => {
    // O nome é persistido no Supabase ANTES de atualizar o ecrã (Supabase = fonte oficial).
    // Só atualiza o estado visual depois de o banco confirmar o UPDATE.
    if (data?.nome && userId) {
      const r = await guardarNome(userId, data.nome);
      if (!r.ok) {
        // Falhou a gravação no banco: não atualiza o visual com um valor que não persistiu.
        alert("Não foi possível guardar o nome. Verifica a ligação e tenta de novo.");
        return;
      }
    }
    setState(prev => ({ ...prev, ...data }));
    setScreen("dashboard");
  };

  const handleAddExpense = (expense, guardarEtiqueta) => {
    const isPrimeiraDespesa = state.despesas.length === 0;
    if (isPrimeiraDespesa && userId) metricasPendentes.current = { ...metricasPendentes.current, uid: userId, gasto: true };
    const jaViuHoje = state.conviteDiasMostrados?.includes(trialDaysUsed);
    // Dias em que o convite proactivo aparece: dia 0 (1ª despesa), dia 3
    // Dia 7 é coberto pelo ConquistaModal (nível Consciente)
    const diaDeConvite = (isPrimeiraDespesa && trialDaysUsed === 0) ||
                         (trialDaysUsed === 3 && !jaViuHoje);

    setState(prev => {
      // Guardar etiqueta personalizada, se pedido e ainda não existir
      let etiquetas = prev.etiquetasCustom || {};
      if (guardarEtiqueta) {
        const cat = expense.categoria;
        const atuais = etiquetas[cat] || [];
        if (!atuais.some(n => n.toLowerCase() === expense.descricao.toLowerCase())) {
          etiquetas = { ...etiquetas, [cat]: [...atuais, expense.descricao] };
        }
      }
      return {
        ...prev,
        despesas: [...prev.despesas, expense],
        etiquetasCustom: etiquetas,
        conviteDiasMostrados: diaDeConvite
          ? [...(prev.conviteDiasMostrados || []), trialDaysUsed]
          : prev.conviteDiasMostrados || [],
      };
    });

    setScreen("dashboard");

    if (diaDeConvite) {
      setTimeout(() => setConviteMomento(true), 700);
    }
  };

  const handleEditExpense = (id, dados) => {
    setState(prev => ({ ...prev, despesas: prev.despesas.map(d => d.id === id ? { ...d, ...dados } : d) }));
  };
  const handleDeleteExpense = (id) => {
    setState(prev => ({ ...prev, despesas: prev.despesas.filter(d => d.id !== id) }));
  };
  const handleAddEntrada = (entrada) => {
    if ((state.entradasExtra || []).length === 0 && userId) metricasPendentes.current = { ...metricasPendentes.current, uid: userId, rendimento: true };
    setState(prev => ({ ...prev, entradasExtra: [...(prev.entradasExtra || []), entrada] }));
    setScreen("dashboard");
  };
  const handleEditEntrada = (id, dados) => {
    setState(prev => ({ ...prev, entradasExtra: (prev.entradasExtra || []).map(e => e.id === id ? { ...e, ...dados } : e) }));
  };
  const handleDeleteEntrada = (id) => {
    setState(prev => ({ ...prev, entradasExtra: (prev.entradasExtra || []).filter(e => e.id !== id) }));
  };

  const handleSaveGoal = (goal) => {
    setState(prev => {
      // Guardar o nome como sugestão futura (se for novo), com o seu emoji
      const guardadas = prev.sugestoesObjGuardadas || [];
      const jaExiste = guardadas.some(g => g.nome.toLowerCase() === (goal.nome || "").toLowerCase());
      const novasGuardadas = (goal.nome && !jaExiste)
        ? [{ nome: goal.nome, emoji: goal.emoji || "🎯" }, ...guardadas].slice(0, 12)
        : guardadas;
      return {
        ...prev,
        objectivos: [...(prev.objectivos || []), goal],
        sugestoesObjGuardadas: novasGuardadas,
      };
    });
  };

  const handleDeleteGoal = (id) => {
    setState(prev => ({ ...prev, objectivos: (prev.objectivos || []).filter(g => g.id !== id) }));
  };

  const handleAddToGoal = (id, valor) => {
    setState(prev => ({
      ...prev,
      objectivos: (prev.objectivos || []).map(g =>
        g.id === id ? { ...g, acumulado: (g.acumulado || 0) + valor } : g
      ),
    }));
  };

  const handleDeleteEtiqueta = (catId, nome) => {
    setState(prev => ({
      ...prev,
      etiquetasCustom: {
        ...(prev.etiquetasCustom || {}),
        [catId]: (prev.etiquetasCustom?.[catId] || []).filter(n => n !== nome),
      },
    }));
  };

  const handleUpdateGoal = (id, dados) => {
    setState(prev => ({
      ...prev,
      objectivos: (prev.objectivos || []).map(g =>
        g.id === id ? { ...g, ...dados } : g
      ),
    }));
  };

  const handleConfirmarSalario = (novoValor) => {
    setState(prev => ({
      ...prev,
      salario: novoValor,
      periodoSalarioConfirmado: prev.dataRecebimento,
    }));
  };

  // Conquista: mostra modal quando utilizador atinge novo nível
  const diasAtivos = state.setupDate ? daysSince(state.setupDate) : 0;
  const nivelAtual = getNivel(diasAtivos);
  const [conquistaVista, setConquistaVista] = useState(false);
  const [conquistaModal, setConquistaModal] = useState(false);
  const [conviteMomento, setConviteMomento] = useState(false); // modal após 1ª despesa
  const [deferredPrompt, setDeferredPrompt] = useState(null);   // evento de instalar (Android)
  const [mostrarInstalar, setMostrarInstalar] = useState(false); // modal de instalar visível agora
  const [mostrarPagarJa, setMostrarPagarJa] = useState(false);   // ecrã de pagamento antecipado (durante teste)
  const [mostrarParabens, setMostrarParabens] = useState(false); // "Parabéns, tens acesso" após ativação

  // Deteta quando a conta passou a ativa (pagamento confirmado) e ainda não celebrou
  useEffect(() => {
    const paga = acessoPagoValido(state.estadoConta, state.acessoAte);
    if (paga && !state.parabensPagamentoVisto && state.setup) {
      setMostrarParabens(true);
    }
  }, [state.estadoConta, state.acessoAte, state.parabensPagamentoVisto, state.setup]);

  // Notificações: uma vez por sessão (por utilizador), depois de a sessão e o perfil estarem prontos,
  // gera os lembretes no servidor (dry_run:false) e carrega a lista. Erros não bloqueiam nada.
  useEffect(() => {
    if (!userId) { lembretesExecutadosPara.current = null; return; }
    if (aCarregar || !authReady || !state.setup) return;
    if (lembretesExecutadosPara.current === userId) return;
    lembretesExecutadosPara.current = userId;
    let vivo = true;
    (async () => {
      await executarGerarLembretes();
      const lista = await carregarNotificacoes(userId);
      if (vivo && lista) setNotificacoes(lista);
    })();
    return () => { vivo = false; };
  }, [userId, aCarregar, authReady, state.setup]);

  // Ao voltar à app, atualiza a lista (ex.: pagamento aprovado entretanto).
  useEffect(() => {
    if (!userId) return;
    const aoVoltar = async () => {
      if (document.visibilityState !== "visible") return;
      const lista = await carregarNotificacoes(userId);
      if (lista) setNotificacoes(lista);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [userId]);

  const abrirNotificacoes = async () => {
    setMostrarNotificacoes(true);
    if (!userId) return;
    const lista = await carregarNotificacoes(userId);
    if (lista) setNotificacoes(lista);
  };
  // O contador só muda depois de o servidor confirmar a atualização de lida/lida_em.
  const marcarLidas = async (ids) => {
    const ok = await marcarNotificacoesLidas(ids);
    if (ok) setNotificacoes(prev => prev.map(n => ids.includes(n.id) ? { ...n, lida: true } : n));
  };
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false); // modal de avaliação (estrelas)
  const [mostrarPartilhaInstagram, setMostrarPartilhaInstagram] = useState(false); // convite Instagram (4-5 estrelas)
  const [avaliacaoManual, setAvaliacaoManual] = useState(false);   // aberta pelas Definições (pode fechar sempre)

  const handleEnviarAvaliacao = (avaliacao) => {
    // Envia a avaliação para o Supabase (tabela "avaliacoes"): estrelas + texto.
    if (userId) enviarAvaliacaoSupabase(userId, avaliacao.estrelas, avaliacao.texto);
    // 4 ou 5 estrelas, só uma vez: convida a partilhar a experiência no Instagram.
    const mostrarConviteInstagram = avaliacao.estrelas >= 4 && !state.convitePartilhaInstagramVisto;
    setState(prev => ({
      ...prev,
      ultimaAvaliacao: avaliacao,
      avaliacaoTrialFeita: true,
      ultimoPedidoAvaliacao: todayStr(),
      ...(mostrarConviteInstagram ? { convitePartilhaInstagramVisto: true } : {}),
    }));
    setMostrarAvaliacao(false);
    setAvaliacaoManual(false);
    if (mostrarConviteInstagram) setMostrarPartilhaInstagram(true);
  };

  const handleFecharAvaliacao = () => {
    // Fechar sem avaliar: no trial conta como "já perguntámos" (só uma vez);
    // se foi aberta manualmente, apenas fecha.
    if (!avaliacaoManual) {
      setState(prev => ({ ...prev, avaliacaoTrialFeita: true, ultimoPedidoAvaliacao: todayStr() }));
    }
    setMostrarAvaliacao(false);
    setAvaliacaoManual(false);
  };

  // Captura o evento de instalação (Android/Chrome) e deteta se já está instalada
  useEffect(() => {
    const onBIP = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", onBIP);
    // Se já corre como app instalada (standalone), marcar e nunca mais pedir
    const jaInstalada = window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator.standalone === true;
    if (jaInstalada && !state.appInstalada) {
      setState(prev => ({ ...prev, appInstalada: true }));
    }
    // Detetar instalação concluída
    const onInstalled = () => setState(prev => ({ ...prev, appInstalada: true }));
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Conta uma abertura por sessão (para o timing do lembrete de instalar)
  useEffect(() => {
    if (state.setup) {
      setState(prev => ({ ...prev, aberturas: (prev.aberturas || 0) + 1 }));
    }
  }, [state.setup]);

  const handleInstalado = () => {
    setState(prev => ({ ...prev, appInstalada: true }));
    setMostrarInstalar(false);
  };
  const handleFecharInstalar = () => {
    setState(prev => ({ ...prev, instalarPedidos: (prev.instalarPedidos || 0) + 1 }));
    setMostrarInstalar(false);
  };

  useEffect(() => {
    if (!state.setup) return;
    const marcos = NIVEIS.map(n => n.dias);
    if (marcos.includes(diasAtivos) && !conquistaVista) {
      setConquistaModal(true);
      setConquistaVista(true);
    }
  }, [diasAtivos, state.setup]);

  // Decide quando mostrar o convite para instalar — UM aviso por sessão, com prioridade.
  // Prioridade: confirmar salário > convite pós-despesa > notificações > INSTALAR.
  // 1º pedido: logo após o setup. Reforços: na 3ª e 6ª abertura online, depois pára.
  useEffect(() => {
    if (!state.setup || state.appInstalada) return;
    // Não empilhar com outros modais que tenham prioridade real neste momento.
    // (As notificações NÃO bloqueiam — o instalar aparece primeiro, e as notificações vêm depois.)
    const outroAvisoAtivo =
      (state.rendimentoVariavel && state.periodoSalarioConfirmado !== state.dataRecebimento) ||
      conviteMomento || conquistaModal;
    if (outroAvisoAtivo) return;

    const ab = state.aberturas || 0;
    const pedidos = state.instalarPedidos || 0;
    // 1º pedido após setup (1ª abertura); reforço na 3ª e 6ª; máximo 3 vezes.
    const deveMostrar =
      (pedidos === 0) ||
      (pedidos === 1 && ab >= 3) ||
      (pedidos === 2 && ab >= 6);
    if (deveMostrar) setMostrarInstalar(true);
  }, [state.setup, state.appInstalada, state.aberturas, state.instalarPedidos,
      conviteMomento, conquistaModal,
      state.rendimentoVariavel, state.periodoSalarioConfirmado, state.dataRecebimento]);

  // Pedido de avaliação — PRIORIDADE MAIS BAIXA de todas.
  // No trial: uma única vez, ao 7º dia. Depois do trial: espaçado (~30 dias).
  // Só aparece se NENHUM outro aviso/ecrã estiver ativo nesta sessão.
  useEffect(() => {
    if (!state.setup) return;
    // Não empilhar: cede a vez a todos os outros avisos e ecrãs.
    const algoAtivo =
      mostrarInstalar || mostrarPagarJa || conviteMomento || conquistaModal ||
      !state.notifPerguntado ||
      (state.rendimentoVariavel && state.periodoSalarioConfirmado !== state.dataRecebimento) ||
      (!state.appInstalada && (state.instalarPedidos || 0) === 0);
    if (algoAtivo) return;

    if (!trialExpired) {
      // Durante o trial: uma vez, ao 7º dia
      if (!state.avaliacaoTrialFeita && trialDaysUsed >= 7) {
        setAvaliacaoManual(false);
        setMostrarAvaliacao(true);
      }
    } else {
      // Depois do trial: espaçado ~30 dias desde o último pedido
      const ultimo = state.ultimoPedidoAvaliacao;
      const diasDesde = ultimo ? daysSince(ultimo) : 999;
      if (diasDesde >= 30) {
        setAvaliacaoManual(false);
        setMostrarAvaliacao(true);
      }
    }
  }, [state.setup, trialDaysUsed, trialExpired, state.avaliacaoTrialFeita,
      state.notifPerguntado, state.appInstalada, state.instalarPedidos,
      mostrarInstalar, mostrarPagarJa, conviteMomento, conquistaModal,
      state.rendimentoVariavel, state.periodoSalarioConfirmado, state.dataRecebimento, state.ultimoPedidoAvaliacao]);

  // Ecrã de carregamento enquanto verifica a sessão no Supabase
  if (aCarregar) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 12 }}><Sol size={44} /></div>
          <div style={{ color: "#8A8070", fontSize: "0.9em" }}>A carregar…</div>
        </div>
      </div>
    );
  }

  // Ecrã de PIN — definir (após setup, se ainda não tem PIN) ou entrar (ao reabrir)
  // Verificação centralizada e robusta: se fez setup mas não tem PIN, define agora.
  if ((definirPin || (state.setup && !state.pin)) && !bloqueado) {
    return (
      <div style={S.app}>
        <PinScreen modo="definir" onDefinir={handleDefinirPin} />
      </div>
    );
  }
  if (bloqueado) {
    return (
      <div style={S.app}>
        <PinScreen modo="entrar" pinCorreto={state.pin} biometriaAtiva={state.biometriaAtiva}
          onEntrar={handleEntrarPin} onEsqueci={handleEsqueciPin} onBiometria={handleBiometria} />
      </div>
    );
  }

  // If trial expired, show expired screen
  // Pagamento antecipado — durante o teste, com desconto de 50%
  if (mostrarPagarJa && !trialExpired) {
    return (
      <div style={S.app}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input { -webkit-appearance: none; }
          @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <TrialExpiredScreen
          comprovativoEnviado={state.comprovativoEnviado}
          planoInicial={state.planoEscolhido}
          onComprovativo={handleComprovativoEnviado}
          dentroDoTeste={true}
          diasRestantes={trialDaysLeft}
          onFechar={() => setMostrarPagarJa(false)}
        />
      </div>
    );
  }

  if (trialExpired && screen !== "setup") {
    return (
      <div style={S.app}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input { -webkit-appearance: none; }
          @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <TrialExpiredScreen
          comprovativoEnviado={state.comprovativoEnviado}
          planoInicial={state.planoEscolhido}
          onComprovativo={handleComprovativoEnviado}
          subscricaoExpirada={subscricaoExpirada}
          onTrocarConta={handleTrocarConta}
        />
      </div>
    );
  }

  // Which tabs show the bottom nav
  const showNav = ["dashboard","goals","settings","charts","convite","editarDados","todasDespesas","todasEntradas","addEntrada","etiquetas"].includes(screen);
  const navActive = screen === "charts" ? "charts"
    : screen === "goals" ? "goals"
    : ["settings","editarDados","todasDespesas","todasEntradas","etiquetas","convite"].includes(screen) ? "settings"
    : "dashboard";

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input { -webkit-appearance: none; }
        button:active { opacity: 0.8; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #2A2A2A; }
      `}</style>

      {screen === "auth"       && <AuthScreen onAuth={handleAuth} />}
      {screen === "setup"      && <SetupScreen onComplete={handleSetupDone} />}
      {screen === "dashboard"  && (
        <>
          <DashboardScreen
            state={state}
            onAddExpense={() => setScreen("add")}
            onAddEntrada={() => setScreen("addEntrada")}
            onOpenCharts={() => setScreen("charts")}
            onOpenGoals={() => setScreen("goals")}
            onSettings={() => setScreen("settings")}
            onOpenConvite={() => setScreen("convite")}
            notifNaoLidas={notificacoes.filter(n => n.lida !== true).length}
            onAbrirNotificacoes={abrirNotificacoes}
            bannerPagar={state.setup && !isAdmin && !trialExpired && !contaPaga
              ? <BannerPagarJa dias={trialDaysLeft} onPagar={() => setMostrarPagarJa(true)} />
              : null}
          />
          {/* Confirmação de rendimento — só para quem tem rendimento variável, quando muda o período */}
          {state.setup && state.rendimentoVariavel && state.periodoSalarioConfirmado !== state.dataRecebimento && (
            <ConfirmarSalarioModal salarioAnterior={state.salario} onConfirmar={handleConfirmarSalario} />
          )}
          {/* Cartão de consentimento de notificações — só DEPOIS de tratar o convite de instalar */}
          {state.setup && !state.notifPerguntado && !mostrarInstalar &&
           (state.appInstalada || (state.instalarPedidos || 0) >= 1) && (
            <NotifConsentModal onGuardar={handleNotifConsent} />
          )}
          {/* Dica de registo — aparece no 2º/3º dia de uso, uma vez */}
          {state.setup && !state.dicaRegistoMostrada && trialDaysUsed >= 1 && trialDaysUsed <= 3 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ background: "#141000", border: "1px solid #2A2010", borderRadius: 14, padding: "16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Sol size={26} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.9em", fontWeight: 700, color: "#E8E0D0", marginBottom: 3 }}>Faz o teu número ficar mais certo</div>
                  <div style={{ fontSize: "0.82em", color: "#A09880", lineHeight: 1.5 }}>Sempre que gastas, regista. Quanto mais registas, mais real fica o que podes gastar.</div>
                </div>
                <button onClick={handleDispensarDica}
                  style={{ background: "transparent", border: "none", color: "#BDB3A0", cursor: "pointer", flexShrink: 0, fontFamily: "inherit", padding: 4 }}><Icone nome="x" size={18} /></button>
              </div>
            </div>
          )}
          {/* Espaço para a barra de navegação fixa não tapar o conteúdo do fim */}
          <div style={{ height: "calc(90px + env(safe-area-inset-bottom, 0px))" }} />
        </>
      )}
      {screen === "admin"      && <AdminScreen onBack={() => setScreen("settings")} />}
      {screen === "settings"   && <SettingsScreen state={state} onToggleNotif={handleToggleNotif} onBack={() => setScreen("dashboard")} onEditarDados={() => setScreen("editarDados")} onVerDespesas={() => setScreen("todasDespesas")} onVerEntradas={() => setScreen("todasEntradas")} onOpenConvite={() => setScreen("convite")} onVerEtiquetas={() => setScreen("etiquetas")} onOpenPlano={() => setMostrarPagarJa(true)} planoSub={contaPaga ? `Conta ativa${state.planoAtivo ? " · " + (state.planoAtivo === "anual" ? "Anual" : "Mensal") : ""}` : (trialExpired ? "O teu período gratuito terminou — subscreve" : `Período gratuito — ${trialDaysLeft} dias restantes`)} onOpenAvaliacao={() => { setAvaliacaoManual(true); setMostrarAvaliacao(true); }} isAdmin={isAdmin} onOpenAdmin={() => setScreen("admin")} onLogout={handleLogout} diasTeste={trialDaysLeft} />}
      {screen === "etiquetas"  && <EtiquetasScreen etiquetasCustom={state.etiquetasCustom || {}} onDelete={handleDeleteEtiqueta} onBack={() => setScreen("settings")} />}
      {screen === "editarDados" && <EditarDadosScreen state={state} onSave={handleSettingsSave} onBack={() => setScreen("settings")} />}
      {screen === "convite"     && <ConviteScreen inviteCode={state.inviteCode} inviteCount={state.inviteCount} diasAtivos={diasAtivos} onBack={() => setScreen("dashboard")} />}
      {screen === "add"        && <AddExpenseScreen onSave={handleAddExpense} onBack={() => setScreen("dashboard")}
                                    despesasAnteriores={state.despesas}
                                    etiquetasCustom={state.etiquetasCustom || {}}
                                    saldoRestante={state.salario - state.despesas.reduce((s,d) => s+d.valor, 0)} />}
      {screen === "addEntrada" && <AddEntradaScreen onSave={handleAddEntrada} onBack={() => setScreen("dashboard")} />}
      {screen === "todasDespesas" && <AllDespesasScreen despesas={state.despesas} onEdit={handleEditExpense} onDelete={handleDeleteExpense} onBack={() => setScreen("settings")} />}
      {screen === "todasEntradas" && <AllEntradasScreen entradas={state.entradasExtra || []} onEdit={handleEditEntrada} onDelete={handleDeleteEntrada} onBack={() => setScreen("settings")} onAdd={() => setScreen("addEntrada")} />}
      {screen === "goals"      && <GoalsScreen state={state} onBack={() => setScreen("dashboard")} onSaveGoal={handleSaveGoal} onDeleteGoal={handleDeleteGoal} onAddToGoal={handleAddToGoal} onUpdateGoal={handleUpdateGoal} />}
      {screen === "charts"     && <ChartsScreen state={state} onBack={() => setScreen("dashboard")} />}

      {/* Modal de conquista — dias 1, 7, 14, 30, 60 */}
      {conquistaModal && !conviteMomento && (
        <ConquistaModal
          nivel={nivelAtual}
          diasAtivos={diasAtivos}
          inviteCode={state.inviteCode}
          onPartilhar={() => setConquistaModal(false)}
          onFechar={() => setConquistaModal(false)}
        />
      )}

      {/* Momento de convite — após primeira despesa */}
      {conviteMomento && (
        <ConviteMomentoModal
          inviteCode={state.inviteCode}
          onFechar={() => setConviteMomento(false)}
        />
      )}

      {/* Convite para instalar a app (PWA) — só um aviso por sessão, nunca empilhado */}
      {mostrarInstalar && !conviteMomento && !conquistaModal && (
        <InstalarAppModal
          deferredPrompt={deferredPrompt}
          onInstalado={handleInstalado}
          onFechar={handleFecharInstalar}
        />
      )}

      {/* Avaliação por estrelas — prioridade mais baixa; sempre dispensável */}
      {mostrarAvaliacao && (
        <AvaliacaoModal
          onEnviar={handleEnviarAvaliacao}
          onFechar={handleFecharAvaliacao}
          avaliacaoAnterior={state.ultimaAvaliacao}
        />
      )}

      {/* Parabéns — pagamento confirmado */}
      {mostrarParabens && (
        <ParabensPagamentoModal
          plano={state.planoAtivo}
          acessoAte={state.acessoAte}
          onFechar={() => { setMostrarParabens(false); setState(prev => ({ ...prev, parabensPagamentoVisto: true })); }}
        />
      )}

      {/* Notificações */}
      {mostrarNotificacoes && (
        <NotificacoesModal itens={notificacoes} onFechar={() => setMostrarNotificacoes(false)} onMarcarLidas={marcarLidas} />
      )}

      {/* Convite a partilhar no Instagram — só para 4-5 estrelas, uma vez */}
      {mostrarPartilhaInstagram && (
        <PartilharInstagramModal onFechar={() => setMostrarPartilhaInstagram(false)} />
      )}

      {/* Bottom Navigation */}
      {showNav && (
        <BottomNav
          active={navActive}
          onHome={() => setScreen("dashboard")}
          onGoals={() => setScreen("goals")}
          onCharts={() => setScreen("charts")}
          onSettings={() => setScreen("settings")}
        />
      )}
    </div>
  );
}

// ── PALETA ────────────────────────────────────────────────────────────────────
// Âmbar #F59E0B · Preto #080808 · Verde #22C55E · Areia #E8E0D0 · Vermelho #EF4444
// Regra: 80% preto, 15% âmbar, 5% verde/areia

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#080808", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#E8E0D0", maxWidth: 480, margin: "0 auto" },
  screen: { minHeight: "100vh", overflowY: "auto", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))", animation: "slideUp 0.25s ease" },

  // Modais — overlay centrado sobre fundo escuro, com scroll se o conteúdo for alto
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000, overflowY: "auto" },
  modalCard: { width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto", background: "#0F0F0F", border: "1px solid #222", borderRadius: 22, padding: "26px 22px", margin: "auto" },

  // Setup
  setup: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#080808" },
  setupCard: { width: "100%", maxWidth: 400, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 24, padding: "36px 28px" },
  logo: { fontSize: "1.15em", fontWeight: 800, color: "#F59E0B", marginBottom: 24, letterSpacing: "-0.02em" },
  stepDots: { display: "flex", gap: 6, marginBottom: 28, alignItems: "center" },
  setupTitle: { fontSize: "1.3em", fontWeight: 700, color: "#E8E0D0", lineHeight: 1.3, marginBottom: 8 },
  setupSub: { fontSize: "0.9em", color: "#8A8070", lineHeight: 1.6 },
  inputGroup: { display: "flex", alignItems: "center", gap: 12, background: "#080808", border: "1px solid #222", borderRadius: 16, padding: "12px 18px", marginTop: 12 },
  currency: { fontSize: "1em", color: "#F59E0B", fontWeight: 700 },
  bigInput: { flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "2em", fontWeight: 800, color: "#E8E0D0", fontFamily: "inherit", width: "100%" },
  dateInput: { width: "100%", background: "#080808", border: "1px solid #222", borderRadius: 12, padding: "16px 18px", color: "#E8E0D0", fontSize: "1em", fontFamily: "inherit", outline: "none", marginTop: 6 },
  dateTip: { fontSize: "0.82em", color: "#9F9582", marginTop: 10, textAlign: "center" },
  preview: { marginTop: 20, display: "flex", flexDirection: "column", gap: 12 },
  previewRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.92em" },
  btn: { width: "100%", background: "#F59E0B", border: "none", borderRadius: 14, padding: "17px", color: "#000", fontSize: "1em", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" },
  backBtnSetup: { background: "#080808", border: "1px solid #222", borderRadius: 14, padding: "17px 20px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: "0.95em" },

  // Validation
  valQuestion: { marginBottom: 24 },
  valQ: { fontSize: "0.95em", color: "#C8C0B0", lineHeight: 1.6, marginBottom: 12 },
  valOptions: { display: "flex", flexDirection: "column", gap: 10 },
  valOption: { background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95em", textAlign: "left", transition: "all 0.2s" },
  valLabel: { fontSize: "0.8em", fontWeight: 700, letterSpacing: "0.08em", color: "#9F9582", display: "block", marginBottom: 6 },

  // Dashboard
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 20px 14px" },
  headerSub: { fontSize: "0.75em", color: "#8A8070", marginTop: 3, letterSpacing: "0.04em" },
  iconBtn: { background: "transparent", border: "none", borderRadius: 10, padding: "8px", color: "#2A2A2A", cursor: "pointer", fontSize: "1.1em" },

  // Hero — O número que liberta
  heroCard: { margin: "10px 16px 20px", background: "linear-gradient(160deg,#141000,#0A0800)", border: "1px solid rgba(245,158,11,0.30)", borderRadius: 22, padding: "22px 22px 18px" },
  heroLabel: { fontSize: "0.72em", fontWeight: 700, letterSpacing: "0.14em", color: "#8A7040", marginBottom: 10 },
  heroAmount: { fontSize: "2.7em", fontWeight: 800, color: "#F59E0B", letterSpacing: "-0.03em", lineHeight: 1.05 },
  heroSub: { fontSize: "0.88em", color: "#6A5030", marginTop: 10 },
  heroDivider: { height: 1, background: "rgba(245,158,11,0.20)", margin: "16px 0 14px" },
  heroRow: { display: "flex", justifyContent: "space-between" },
  heroSmallLabel: { fontSize: "0.78em", color: "#9F9582", fontWeight: 600, marginBottom: 4 },
  heroSmall: { fontSize: "1em", fontWeight: 700, color: "#C8A040" },

  // Categories
  sectionLabel: { fontSize: "0.75em", fontWeight: 700, letterSpacing: "0.1em", color: "#9F9582", padding: "0 20px", marginBottom: 12 },
  categoryList: { display: "flex", flexDirection: "column", gap: 8, padding: "0 16px", marginBottom: 24 },
  categoryCard: { background: "#101010", border: "1px solid #1C1C1C", borderRadius: 18, padding: "14px 16px" },
  catHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  catEmoji: { fontSize: "1.3em", lineHeight: 1 },
  catName: { fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" },
  catLimit: { fontSize: "0.82em", color: "#9F9582", marginTop: 2 },
  barBg: { height: 5, background: "#1E1E1E", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  overAlert: { fontSize: "0.82em", color: "#EF4444", marginTop: 8, fontWeight: 600 },

  // Expenses
  expenseList: { padding: "0 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 },
  expenseRow: { display: "flex", alignItems: "center", gap: 12, background: "#0D0D0D", border: "1px solid #161616", borderRadius: 14, padding: "13px 16px" },
  expEmoji: { fontSize: "1.1em" },
  expDesc: { fontSize: "0.92em", fontWeight: 600, color: "#E8E0D0" },
  expDate: { fontSize: "0.78em", color: "#9F9582", marginTop: 2 },
  addBtn: { flex: 1, background: "#F59E0B", border: "none", borderRadius: 14, padding: "17px", color: "#000", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit" },

  // Shared
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 16px" },
  backBtn: { background: "transparent", border: "1px solid #1A1A1A", borderRadius: 10, padding: "9px 16px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88em" },
  screenTitle: { fontSize: "1em", fontWeight: 700, color: "#E8E0D0" },
  field: { marginBottom: 20 },
  label: { fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 8, display: "block" },
  input: { width: "100%", background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 12, padding: "15px 18px", color: "#E8E0D0", fontSize: "1em", fontFamily: "inherit", outline: "none" },
  inputPrefix: { position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#F59E0B", fontWeight: 700 },
  aiAvatar: { width: 34, height: 34, background: "linear-gradient(135deg,#F59E0B,#7A5A00)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95em", flexShrink: 0, marginRight: 10, marginTop: 2 },
};
