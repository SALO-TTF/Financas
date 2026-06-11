import { useState, useRef, useEffect } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
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

const todayStr = () => new Date().toISOString().split("T")[0];
const addMonths = (dateStr, n) => {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
};
// Days from today TO a future date (next payment)
const daysUntil = (dateStr) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
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

// ── AI ────────────────────────────────────────────────────────────────────────
//async function askAI(messages, userData) {
//  const system = `És um assistente financeiro chamado "Klaco".
//Falas português europeu. És directo, empático e prático. Nunca julgas.

//DADOS DO UTILIZADOR:
//${JSON.stringify(userData, null, 2)}

//REGRAS:
//- Responde sempre com base nos dados reais acima
//- Usa valores em Kwanzas (Kz)
//- Dá conselhos práticos para o contexto angolano
//- Se perguntarem o que fazer com o investimento: sugere BODIVA, imobiliário, negócio próprio, dólares, poupança bancária
//- Máximo 150 palavras por resposta
//- Usa emojis com moderação`;

 // const res = await fetch("https://api.anthropic.com/v1/messages", {
 //   method: "POST",
 //   headers: { "Content-Type": "application/json" },
 //   body: JSON.stringify({
 //     model: "claude-sonnet-4-20250514",
 //     max_tokens: 1000,
 //     system,
 //     messages,
 //   }),
 // });
 // const data = await res.json();
 // return data.content?.map(b => b.text || "").join("") || "Erro na resposta.";
//}
// ── AI ────────────────────────────────────────────────────────────────────────
async function askAI(messages, userData) {
  const system = `És um assistente financeiro chamado "Klaco".
Falas português europeu. És directo, empático e prático. Nunca julgas.

DADOS DO UTILIZADOR:
${JSON.stringify(userData, null, 2)}

REGRAS:
- Responde sempre com base nos dados reais acima
- Usa valores em Kwanzas (Kz)
- Dá conselhos práticos para o contexto angolano
- Se perguntarem o que fazer com o investimento: sugere BODIVA, imobiliário, negócio próprio, dólares, poupança bancária
- Máximo 150 palavras por resposta
- Usa emojis com moderação`;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Erro no Servidor:", errorData);
      return `Erro ao processar o pedido (${res.status}).`;
    }

    const data = await res.json();
    return data.content?.map(b => b.text || "").join("") || "Erro na resposta.";
  } catch (error) {
    console.error("Erro na comunicação com o servidor:", error);
    return "Não consegui ligar ao servidor da IA. Tenta novamente.";
  }
}

// ── SETUP (multi-step, with free back navigation + editable %) ────────────────
function SetupScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [salario, setSalario] = useState("");
  const [salarioDisplay, setSalarioDisplay] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(todayStr());
  const [proximoPagamento, setProximoPagamento] = useState("");
  const [semEntradaInicial, setSemEntradaInicial] = useState(false); // começou agora

  const handleSalarioChange = (raw) => {
    const digits = raw.replace(/\D/g, "");
    setSalario(digits);
    if (digits === "") { setSalarioDisplay(""); return; }
    const num = parseInt(digits, 10);
    setSalarioDisplay(String(num).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
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
              Olá, <span style={{ color: "#F59E0B", fontWeight: 700 }}>{primeiroNome}</span> 👋
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
                  <span style={{ color: "#A09880", fontSize: "0.92em" }}>{c.emoji} {c.label}</span>
                  <span style={{ color: c.color, fontWeight: 700, fontSize: "0.95em" }}>
                    {fmtKz(sal * DEFAULT_PCT[c.id] / 100)}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: "0.78em", color: "#6A6050", textAlign: "center", marginTop: 4 }}>
                Podes ajustar estas percentagens nas Definições
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 24, fontSize: "0.88em", color: "#6A6050", textAlign: "center", lineHeight: 1.6 }}>
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
              {semEntradaInicial && <span style={{ color: "#000", fontWeight: 800, fontSize: "0.8em" }}>✓</span>}
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
                ⚠️ A data tem de ser no futuro
              </div>
            )}
            {datasValidas && (
              <div style={{ fontSize: "0.82em", color: "#22C55E", marginTop: 8 }}>
                ✓ {daysUntil(proximoPagamento)} dias até ao pagamento
              </div>
            )}
          </div>

          {semEntradaInicial && (
            <div style={{ background: "#141000", border: "1px solid #2A2010", borderRadius: 12, padding: "12px 14px", fontSize: "0.82em", color: "#C8C0B0", lineHeight: 1.55 }}>
              🌅 Como ainda não recebeste, vamos calcular o teu dia a dia a partir do teu primeiro pagamento. Até lá, o teu número será associado a essa data.
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
        <div style={S.logo}>☀️ Klaco</div>

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
          <div style={{ fontSize: "0.78em", color: "#6A6050", marginLeft: 6 }}>
            {step + 1} de {steps.length}
          </div>
        </div>

        <h2 style={S.setupTitle}>{cur.title}</h2>
        <p style={S.setupSub}>{cur.subtitle}</p>

        <div style={{ margin: "24px 0" }}>{cur.body}</div>

        {/* Botão inactivo explica o que falta */}
        {!cur.valid && step === 0 && nome.trim().length < 2 && (
          <div style={{ fontSize: "0.82em", color: "#6A6050", textAlign: "center", marginBottom: 10 }}>
            Escreve o teu nome para continuar
          </div>
        )}
        {!cur.valid && step === 1 && sal === 0 && (
          <div style={{ fontSize: "0.82em", color: "#6A6050", textAlign: "center", marginBottom: 10 }}>
            Escreve o teu rendimento para continuar
          </div>
        )}
        {!cur.valid && step === 2 && !datasValidas && (
          <div style={{ fontSize: "0.82em", color: "#6A6050", textAlign: "center", marginBottom: 10 }}>
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
              else onComplete({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct: { ...DEFAULT_PCT }, semEntradaInicial });
            }}
            style={{ ...S.btn, opacity: cur.valid ? 1 : 0.35, flex: 1 }}
          >
            {step < steps.length - 1 ? "Continuar →" : "Ver quanto posso gastar 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardScreen({ state, onAddExpense, onAddEntrada, onVerDespesas, onVerEntradas, onOpenChat, onOpenCharts, onOpenGoals, onOpenConvite }) {
  const { salario, dataRecebimento, proximoPagamento, despesas, pct, objectivos = [], entradasExtra = [], semEntradaInicial = false } = state;
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Entradas extra (13º, bónus, subsídios) deste período somam ao rendimento
  const totalExtra = entradasExtra.reduce((s, e) => s + (e.valor || 0), 0);
  const rendimentoPeriodo = salario + totalExtra;

  // Period: dataRecebimento → proximoPagamento
  // Se o utilizador começou agora (sem entrada inicial), o período conta a partir de hoje
  const diasRestantes = daysUntil(proximoPagamento);
  const diasPassados = semEntradaInicial ? 0 : daysSince(dataRecebimento);
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

  // Hero tone
  const heroPositive = gastoDiario >= taxaDiaria;

  return (
    <div style={S.screen}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>
            {state.nome
              ? `Olá, ${state.nome.split(" ")[0]} 👋`
              : "☀️ Klaco"}
          </div>
          <div style={S.headerSub}>o teu dinheiro. a tua liberdade.</div>
        </div>

      </div>

      {/* Hero */}
      <div style={{
        ...S.heroCard,
        background: heroPositive
          ? "linear-gradient(135deg,#1C1400,#0F0C00)"
          : "linear-gradient(135deg,#1A0800,#100500)",
        borderColor: heroPositive ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.25)",
      }}>
        <div style={{ ...S.heroLabel, color: heroPositive ? "#F59E0B" : "#EF4444" }}>
          {gastoDiario >= 0 ? "PODES GASTAR HOJE" : "LIMITE DIÁRIO EXCEDIDO"}
        </div>
        <div style={{ ...S.heroAmount, color: heroPositive ? "#F59E0B" : "#EF4444" }}>
          {gastoDiario >= 0 ? fmtKz(gastoDiario) : fmtKz(Math.abs(gastoDiario))}
        </div>
        <div style={{ ...S.heroSub, color: heroPositive ? "#A08850" : "#C06040" }}>
          {gastoDiario >= 0
            ? `${diasRestantes} dias até ao próximo pagamento`
            : `Precisas de compensar nos próximos ${diasRestantes} dias`}
        </div>

        <div style={S.heroDivider} />
        <div style={S.heroRow}>
          <div>
            <div style={S.heroSmallLabel}>Sobra este mês</div>
            <div style={{ ...S.heroSmall, color: saldo >= 0 ? "#C8A040" : "#EF4444" }}>{fmtKz(saldo)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.heroSmallLabel}>Já gastaste</div>
            <div style={{ ...S.heroSmall, color: "#6A6050" }}>{fmtKz(totalGasto)}</div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={S.sectionLabel}>DISTRIBUIÇÃO {Object.values(pct).join(" · ")}</div>
      <div style={S.categoryList}>
        {CATS.map(c => {
          const gasto = gastosPorCat[c.id];
          const reservado = reservadoPorCat[c.id] || 0;
          const orc = salario * pct[c.id] / 100;
          const totalUsado = gasto + reservado;
          const pctUsed = orc > 0 ? Math.min(100, (totalUsado / orc) * 100) : 0;
          const over = totalUsado > orc;
          const restante = orc - totalUsado;
          return (
            <div key={c.id} style={S.categoryCard}>
              <div style={S.catHeader}>
                <span style={S.catEmoji}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={S.catName}>{c.label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: over ? "#EF4444" : c.color, fontWeight: 700, fontSize: "0.9em" }}>
                    {fmtKz(gasto)}
                    {reservado > 0 && <span style={{ fontSize: "0.75em", color: "#F59E0B", display: "block" }}>+ {fmtKz(reservado)} obj.</span>}
                  </div>
                  <div style={S.catLimit}>/ {fmtKz(orc)} ({pct[c.id]}%)</div>
                </div>
              </div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${pctUsed}%`, background: over ? "#EF4444" : c.color }} />
              </div>
              {over
                ? <div style={S.overAlert}>⚠️ Excedeste em {fmtKz(totalUsado - orc)}</div>
                : <div style={{ fontSize: "0.82em", color: "#22C55E", marginTop: 8, fontWeight: 600 }}>
                    ✓ {fmtKz(restante)} disponível
                  </div>
              }
            </div>
          );
        })}
      </div>

      {/* Últimas despesas com "ver todas" */}
      {despesas.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginBottom: 12 }}>
            <span style={{ ...S.sectionLabel, padding: 0, marginBottom: 0 }}>ÚLTIMAS DESPESAS</span>
            <button onClick={onVerDespesas} style={{ background: "transparent", border: "none", color: "#F59E0B", fontSize: "0.8em", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver todas →</button>
          </div>
          <div style={S.expenseList}>
            {[...despesas].reverse().slice(0, 5).map(d => {
              const cat = CATS.find(c => c.id === d.categoria);
              return (
                <div key={d.id} style={S.expenseRow}>
                  <span style={S.expEmoji}>{cat?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.expDesc}>{d.descricao}</div>
                    <div style={S.expDate}>{d.data}</div>
                  </div>
                  <div style={{ color: "#EF4444", fontWeight: 600 }}>-{fmtKz(d.valor)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Entradas extra com "ver todas" */}
      {entradasExtra.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginBottom: 12, marginTop: 4 }}>
            <span style={{ ...S.sectionLabel, padding: 0, marginBottom: 0 }}>OUTRAS ENTRADAS</span>
            <button onClick={onVerEntradas} style={{ background: "transparent", border: "none", color: "#F59E0B", fontSize: "0.8em", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver todas →</button>
          </div>
          <div style={S.expenseList}>
            {[...entradasExtra].reverse().slice(0, 3).map(e => (
              <div key={e.id || e.nome} style={S.expenseRow}>
                <span style={S.expEmoji}>💰</span>
                <div style={{ flex: 1 }}>
                  <div style={S.expDesc}>{e.nome}</div>
                  <div style={S.expDate}>{e.data}</div>
                </div>
                <div style={{ color: "#22C55E", fontWeight: 600 }}>+{fmtKz(e.valor)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Botão único com lista pendente: Despesa ou Entrada */}
      <div style={{ padding: "0 16px 100px" }}>
        {!showAddMenu ? (
          <button onClick={() => setShowAddMenu(true)} style={S.addBtn}>+ Adicionar</button>
        ) : (
          <div style={{ background: "#0D0D0D", border: "1px solid #F59E0B40", borderRadius: 14, overflow: "hidden", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => { setShowAddMenu(false); onAddExpense(); }}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1A1A1A", padding: "16px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <span style={{ fontSize: "1.2em" }}>🛒</span> Registar uma despesa
            </button>
            <button onClick={() => { setShowAddMenu(false); onAddEntrada(); }}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1A1A1A", padding: "16px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <span style={{ fontSize: "1.2em" }}>💰</span> Adicionar uma entrada (salário extra, 13º, bónus)
            </button>
            <button onClick={() => setShowAddMenu(false)}
              style={{ width: "100%", background: "transparent", border: "none", padding: "13px", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onOpenChat} style={{
            flex: 1, background: "transparent", border: "1px solid #1A1A1A",
            borderRadius: 12, padding: "12px", color: "#8A8070",
            fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            💬 Assistente IA
          </button>
          <button onClick={onOpenCharts} style={{
            flex: 1, background: "transparent", border: "1px solid #1A1A1A",
            borderRadius: 12, padding: "12px", color: "#8A8070",
            fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            📊 Ver gráficos
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS (edit salário, datas, percentagens) ──────────────────────────────
function SettingsScreen({ state, onSave, onBack, onOpenConvite }) {
  const [nome, setNome] = useState(state.nome || "");
  const [salario, setSalario] = useState(String(state.salario));
  const [dataRecebimento, setDataRecebimento] = useState(state.dataRecebimento);
  const [proximoPagamento, setProximoPagamento] = useState(state.proximoPagamento);
  const [pct, setPct] = useState({ ...state.pct });
  const [guardado, setGuardado] = useState(false);

  // Número de WhatsApp da empresa
  const WHATSAPP_SUPORTE = "244923933353";
  const abrirSuporte = () => {
    const msg = encodeURIComponent("Olá! Preciso de ajuda com a Klaco: ");
    window.open(`https://wa.me/${WHATSAPP_SUPORTE}?text=${msg}`, "_blank");
  };

  // Simple independent control — allow clearing to retype
  const handlePct = (id, raw) => {
    if (raw === "" || raw === "-") {
      setPct(prev => ({ ...prev, [id]: "" }));
      return;
    }
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
        <div style={S.screenTitle}>Definições</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={S.field}>
          <label style={S.label}>O TEU NOME</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="O teu nome"
            style={S.input}
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>RENDIMENTO MENSAL (Kz)</label>
          <div style={{ ...S.inputGroup, marginTop: 0 }}>
            <span style={S.currency}>Kz</span>
            <input type="number" value={salario} onChange={e => setSalario(e.target.value)}
              style={S.bigInput} />
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
                <span style={{ fontWeight: 600, fontSize: "0.9em", color: "#DDD" }}>{c.emoji} {c.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number" min="0" max="100"
                    value={pct[c.id]}
                    onChange={e => handlePct(c.id, e.target.value)}
                    style={{ width: 52, background: "#111", border: `1px solid ${c.color}60`, borderRadius: 8, padding: "5px 8px", color: c.color, fontWeight: 800, fontFamily: "inherit", outline: "none", textAlign: "center", fontSize: "0.95em" }}
                  />
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
            {totalPct === 100 ? "✓ 100% — perfeito!" : `Total: ${totalPct}%`}
          </div>
        </div>

        <button disabled={!valid} onClick={() => { onSave({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct }); setGuardado(true); setTimeout(() => setGuardado(false), 2600); }}
          style={{ ...S.btn, opacity: valid ? 1 : 0.4, marginBottom: 12 }}>
          Guardar alterações
        </button>
        {guardado && (
          <div style={{ background: "#0A1A0A", border: "1px solid #22C55E40", borderRadius: 12, padding: "12px 16px", marginBottom: 12, animation: "slideUp 0.2s ease", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1em" }}>✓</span>
            <span style={{ fontSize: "0.86em", color: "#22C55E", fontWeight: 600 }}>Guardado. O teu número já reflete as alterações.</span>
          </div>
        )}

        {/* NOTIFICAÇÕES — lembrete diário de hábito */}
        <div style={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.9em", fontWeight: 700, color: "#E8E0D0" }}>🔔 Lembrete diário</div>
              <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>«Sabe quanto podes gastar hoje 🌅»</div>
            </div>
            {/* [DEV] Ligar ao sistema de notificações push do backend */}
            <div style={{ width: 44, height: 26, borderRadius: 13, background: "#F59E0B", position: "relative", cursor: "pointer" }}>
              <div style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "#000" }} />
            </div>
          </div>
        </div>

        {/* SUPORTE — WhatsApp */}
        <button onClick={abrirSuporte}
          style={{ width: "100%", background: "#25D366", border: "none", borderRadius: 14, padding: "15px", color: "#000", fontWeight: 800, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
          💬 Suporte e dúvidas (WhatsApp)
        </button>

        <button onClick={onOpenConvite}
          style={{ width: "100%", background: "transparent", border: "1px solid #F59E0B30", borderRadius: 14, padding: "15px", color: "#F59E0B", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit" }}>
          🤝 Comunidade e convites
        </button>
      </div>
    </div>
  );
}

// ── ADD EXPENSE (with smart suggestions + custom library) ─────────────────────
function AddExpenseScreen({ onSave, onBack, despesasAnteriores, saldoRestante }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [categoria, setCategoria] = useState("necessidades");
  const [data, setData] = useState(todayStr());
  const [showSugg, setShowSugg] = useState(true);

  // Build suggestion list: pre-defined + user's own past descriptions (deduplicated)
  const pastNames = [...new Set(despesasAnteriores.map(d => d.descricao))];
  const catSugg = SUGESTOES[categoria] || [];
  const predefinedNames = catSugg.map(s => s.nome);
  // User's past expenses in this category not already in predefined
  const userCustom = pastNames
    .filter(n => despesasAnteriores.some(d => d.categoria === categoria && d.descricao === n))
    .filter(n => !predefinedNames.includes(n))
    .map(n => ({ nome: n, emoji: "📝" }));
  const allSugg = [...catSugg, ...userCustom];
  const filtered = descricao.trim()
    ? allSugg.filter(s => s.nome.toLowerCase().includes(descricao.toLowerCase()))
    : allSugg;

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
        <div style={S.screenTitle}>Nova despesa</div>
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
                <span style={{ fontSize: "1.4em" }}>{c.emoji}</span>
                <span style={{ fontSize: "0.68em", fontWeight: 700, color: categoria === c.id ? c.color : "#8A8070", textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description with suggestions */}
        <div style={S.field}>
          <label style={S.label}>O QUE GASTASTE?</label>
          <input value={descricao}
            onChange={e => { setDescricao(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            placeholder="Escreve ou escolhe abaixo..."
            style={S.input} />

          {/* Suggestions grid */}
          {showSugg && filtered.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "0.68em", color: "#6A6050", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
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
                    <span>{s.emoji}</span>
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
              inputMode="numeric"
              value={valorDisplay}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, "");
                setValor(digits);
                if (digits === "") { setValorDisplay(""); return; }
                setValorDisplay(String(parseInt(digits,10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
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

        <button
          disabled={!descricao || !valor || v <= 0}
          onClick={() => onSave({ id: Date.now(), descricao, valor: v, categoria, data })}
          style={{ ...S.btn, opacity: descricao && v > 0 ? 1 : 0.4 }}>
          Guardar despesa
        </button>
      </div>
    </div>
  );
}

// ── GOALS SCREEN ─────────────────────────────────────────────────────────────
function GoalsScreen({ state, onBack, onSaveGoal, onDeleteGoal }) {
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

  const EMOJIS = ["🎯","🚗","🏠","✈️","📱","💍","🎓","💼","🏖️","🛒","💊","🎁"];

  const handleNumInput = (raw, setSt, setDisp) => {
    const digits = raw.replace(/\D/g, "");
    setSt(digits);
    if (!digits) { setDisp(""); return; }
    setDisp(String(parseInt(digits,10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
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
                      <span style={{ fontSize: "1.8em" }}>{obj.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95em", color: "#DDD" }}>{obj.nome}</div>
                        <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 2 }}>{cat?.emoji} {cat?.label}</div>
                      </div>
                    </div>
                    <button onClick={() => onDeleteGoal(obj.id)}
                      style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "1em" }}>✕</button>
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
                </div>
              );
            })}
          </div>
        )}

        {/* Add goal form */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            style={{ width: "100%", background: "#0F0F0F", border: "1px dashed #2A2A2A", borderRadius: 14, padding: "16px", color: "#F59E0B", fontWeight: 700, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit" }}>
            + Adicionar objectivo
          </button>
        ) : (
          <div style={{ background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 16, padding: "18px" }}>
            <div style={{ fontWeight: 700, color: "#DDD", marginBottom: 16, fontSize: "0.95em" }}>Novo objectivo</div>

            {/* Emoji picker */}
            <div style={S.field}>
              <label style={S.label}>ESCOLHE UM ÍCONE</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    style={{ background: emoji === e ? "#F59E0B20" : "#111", border: `1px solid ${emoji === e ? "#F59E0B" : "#222"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: "1.3em" }}>
                    {e}
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
                    <span style={{ fontSize: "1.2em" }}>{c.emoji}</span>
                    <span style={{ fontSize: "0.62em", fontWeight: 700, color: categoria === c.id ? c.color : "#8A8070", textAlign: "center" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: "transparent", border: "1px solid #222", borderRadius: 12, padding: "13px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button
                disabled={!nome || !valorAlvo || !poupancaMensal}
                onClick={() => {
                  onSaveGoal({ id: Date.now(), nome, emoji, valorAlvo: parseInt(valorAlvo), poupancaMensal: parseInt(poupancaMensal), categoria, acumulado: 0 });
                  setShowForm(false);
                  setNome(""); setValorAlvo(""); setValorAlvoDisplay(""); setPoupancaMensal(""); setPoupancaMensalDisplay(""); setEmoji("🎯");
                }}
                style={{ flex: 2, background: "#F59E0B", border: "none", borderRadius: 12, padding: "13px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: nome && valorAlvo && poupancaMensal ? 1 : 0.4 }}>
                Guardar objectivo
              </button>
            </div>
          </div>
        )}

        {objectivos.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#333" }}>
            <div style={{ fontSize: "2.5em", marginBottom: 10 }}>🎯</div>
            <div style={{ fontSize: "0.85em", color: "#8A8070" }}>Define um objectivo e vê quanto tempo demoras a atingi-lo.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CHARTS SCREEN ────────────────────────────────────────────────────────────
function ChartsScreen({ state, onBack }) {
  const { salario, despesas, pct } = state;
  const totalGasto = despesas.reduce((s, d) => s + d.valor, 0);
  const saldo = salario - totalGasto;

  // Per category totals
  const catTotals = CATS.map(c => ({
    ...c,
    gasto: despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0),
    orcamento: salario * pct[c.id] / 100,
  }));

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
                          {c.emoji} {c.label}
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
                            <span style={{ fontSize: "0.7em", fontWeight: 800, color: "#6A6050", minWidth: 16 }}>#{i + 1}</span>
                            <span style={{ fontSize: "0.9em", fontWeight: 600, color: "#DDD" }}>{nome}</span>
                            {cat && <span style={{ fontSize: "0.65em", background: `${cat.color}20`, color: cat.color, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{cat.label}</span>}
                          </div>
                          <span style={{ fontWeight: 700, color: "#EF4444", fontSize: "0.88em" }}>{fmtKz(total)}</span>
                        </div>
                        <div style={{ height: 3, background: "#1A1A1A", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${pctBar}%`, height: "100%", background: cat?.color || "#F59E0B", borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: "0.68em", color: "#6A6050", marginTop: 3 }}>{pctBar.toFixed(1)}% do total gasto</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#6A6050" }}>
            <div style={{ fontSize: "3em", marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, color: "#8A8070", marginBottom: 8 }}>Ainda sem dados</div>
            <div style={{ fontSize: "0.85em" }}>Regista as tuas primeiras despesas para ver os gráficos.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CHAT ──────────────────────────────────────────────────────────────────────
function ChatScreen({ state, onBack }) {
  const { salario, proximoPagamento, despesas, pct } = state;
  const dias = daysUntil(proximoPagamento);
  const totalGasto = despesas.reduce((s, d) => s + d.valor, 0);
  const saldo = salario - totalGasto;

  const gastosPorCat = {};
  CATS.forEach(c => {
    gastosPorCat[c.label] = despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0);
  });

  const userData = {
    salarioMensal: `${salario} Kz`,
    saldoDisponivel: `${Math.round(saldo)} Kz`,
    diasAtePagamento: dias,
    gastoDiarioSeguro: `${Math.round(dias > 0 ? saldo / dias : saldo)} Kz`,
    totalGasto: `${totalGasto} Kz`,
    gastosPorCategoria: gastosPorCat,
    orcamento: {
      necessidades: `${Math.round(salario * pct.necessidades / 100)} Kz (${pct.necessidades}%)`,
      qualidadeDeVida: `${Math.round(salario * pct.qualidade / 100)} Kz (${pct.qualidade}%)`,
      investimento: `${Math.round(salario * pct.investimento / 100)} Kz (${pct.investimento}%)`,
    },
  };

  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `Olá! Sou o assistente da **Klaco** ☀️\n\nVejo que tens **${fmtKz(saldo)}** disponíveis e **${dias} dias** até ao próximo pagamento. Podes gastar até **${fmtKz(Math.max(0, dias > 0 ? saldo / dias : saldo))} por dia** em segurança.\n\nO que queres saber?`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const quickQ = ["Estou a gastar bem?", "O que faço com o valor investido?", "Como poupo mais este mês?", "Onde estou a gastar demais?"];

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const reply = await askAI(newMsgs.map(m => ({ role: m.role, content: m.content })), userData);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de ligação. Tenta novamente." }]);
    }
    setLoading(false);
  };

  const renderMsg = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "#F59E0B" }}>{p.slice(2, -2)}</strong>
        : p
    );

  return (
    <div style={{ ...S.screen, display: "flex", flexDirection: "column", height: "100vh", paddingBottom: 0 }}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Assistente IA</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            {m.role === "assistant" && <div style={S.aiAvatar}>💰</div>}
            <div style={{
              maxWidth: "82%",
              background: m.role === "user" ? "#1C1600" : "#131313",
              border: `1px solid ${m.role === "user" ? "rgba(245,158,11,0.3)" : "#1E1E1E"}`,
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
              padding: "12px 16px",
              fontSize: "0.92em",
              lineHeight: 1.7,
              color: m.role === "user" ? "#F59E0B" : "#DDD",
              whiteSpace: "pre-wrap",
            }}>
              {renderMsg(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={S.aiAvatar}>💰</div>
            <div style={{ background: "#131313", border: "1px solid #1E1E1E", borderRadius: "4px 18px 18px 18px", padding: "14px 18px", display: "flex", gap: 5 }}>
              {[0, 0.15, 0.3].map((d, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", animation: `pulse 1.2s ${d}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        {messages.length <= 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {quickQ.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                style={{ background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 12, padding: "11px 16px", color: "#A09880", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88em" }}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: "1px solid #141414", background: "#080808" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Pergunta sobre as tuas finanças..."
          style={{ flex: 1, background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 12, padding: "12px 16px", color: "#E8E0D0", fontSize: "0.92em", fontFamily: "inherit", outline: "none" }} />
        <button onClick={() => send(input)} disabled={!input.trim() || loading}
          style={{ background: "#F59E0B", border: "none", borderRadius: 10, width: 44, height: 44, color: "#000", fontSize: "1.1em", fontWeight: 700, cursor: "pointer", opacity: input.trim() && !loading ? 1 : 0.4 }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ── PRÉ-RESERVA BANNER (shown after saving expense from day 4 onwards) ─────────
// ── TRIAL EXPIRED SCREEN — Pagamento ─────────────────────────────────────────
function TrialExpiredScreen() {
  // [DEV] Substituir pelos dados reais de pagamento por referência
  const REFERENCIA_PAGAMENTO = "[referência de pagamento aqui]";
  const ENTIDADE = "[entidade aqui]";
  const VALOR = "500 Kz";

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={{ fontSize: "2.5em", marginBottom: 12 }}>🔓</div>
        <div style={{ ...S.logo, marginBottom: 8 }}>Os teus 14 dias terminaram</div>
        <p style={{ color: "#A09880", fontSize: "0.92em", lineHeight: 1.6, marginBottom: 8 }}>
          Já sabes o que é abrir o telemóvel e saber exactamente quanto podes gastar hoje.
        </p>
        <p style={{ color: "#E8E0D0", fontSize: "0.95em", lineHeight: 1.6, marginBottom: 28, fontWeight: 600 }}>
          Continua a gastar sem culpa por apenas {VALOR} por mês.
        </p>

        {/* Dados de pagamento por referência */}
        <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 14 }}>
            PAGA POR REFERÊNCIA
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Entidade</span>
            <span style={{ color: "#E8E0D0", fontSize: "1em", fontWeight: 700, fontFamily: "monospace" }}>{ENTIDADE}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Referência</span>
            <span style={{ color: "#E8E0D0", fontSize: "1em", fontWeight: 700, fontFamily: "monospace" }}>{REFERENCIA_PAGAMENTO}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #1A1A1A" }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Valor</span>
            <span style={{ color: "#F59E0B", fontSize: "1.2em", fontWeight: 800 }}>{VALOR}</span>
          </div>
        </div>

        <div style={{ fontSize: "0.85em", color: "#8A8070", lineHeight: 1.6, textAlign: "center", marginBottom: 20 }}>
          Paga pela app do teu banco, Multicaixa Express ou ATM. O acesso é reactivado automaticamente após o pagamento.
        </div>

        {/* [DEV] Botão opcional: link directo de pagamento se a gateway suportar */}
        <button style={{ ...S.btn }}
          onClick={() => { /* [DEV] abrir link de pagamento da gateway aqui */ }}>
          Já paguei — reactivar acesso
        </button>
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({ active, onHome, onGoals, onSettings }) {
  const tabs = [
    { id: "dashboard", label: "Início",      emoji: "🏠", action: onHome },
    { id: "goals",     label: "Objectivos",  emoji: "🎯", action: onGoals },
    { id: "settings",  label: "Definições",  emoji: "⚙️", action: onSettings },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480,
      background: "#0C0C0C",
      borderTop: "1px solid #1A1A1A",
      display: "flex",
      zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={t.action}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, padding: "10px 8px 12px",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}>
          <span style={{
            fontSize: "1.5em", lineHeight: 1,
            filter: active === t.id ? "none" : "grayscale(1) opacity(0.4)",
            transition: "all 0.15s",
          }}>{t.emoji}</span>
          <span style={{
            fontSize: "0.62em", fontWeight: active === t.id ? 700 : 400,
            color: active === t.id ? "#F59E0B" : "#6A6050",
            letterSpacing: "0.04em",
          }}>{t.label}</span>
          {active === t.id && (
            <div style={{ width: 20, height: 3, borderRadius: 2, background: "#F59E0B", marginTop: 1 }} />
          )}
        </button>
      ))}
    </div>
  );
}

// ── SISTEMA DE CONVITES ───────────────────────────────────────────────────────
function ConviteScreen({ inviteCode, inviteCount, diasAtivos, onBack }) {
  const [copied, setCopied] = useState(false);
  const nivel = getNivel(diasAtivos);
  const nextNivel = NIVEIS[NIVEIS.indexOf(nivel) + 1];
  const link = `https://app.minhasfinancas.ao/entrar?ref=${inviteCode}`;

  const handleCopy = () => {
    const msg = `Descobri este app que me diz exactamente quanto posso gastar hoje — sem culpa, sem restrições. Experimenta: ${link}`;
    navigator.clipboard?.writeText(msg).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Descobri este app que me diz exactamente quanto posso gastar hoje — sem culpa, sem restrições. Experimenta: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Convida amigos</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Nível actual */}
        <div style={{
          background: "linear-gradient(135deg,#1C1400,#0F0C00)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 20, padding: "22px 20px", marginBottom: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: "3em", marginBottom: 8 }}>{nivel.emoji}</div>
          <div style={{ fontSize: "0.65em", fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B80", marginBottom: 4 }}>
            O TEU NÍVEL
          </div>
          <div style={{ fontSize: "1.4em", fontWeight: 800, color: "#F59E0B" }}>{nivel.label}</div>
          <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 6, lineHeight: 1.5 }}>{nivel.desc}</div>
          {nextNivel && (
            <div style={{ marginTop: 14, fontSize: "0.72em", color: "#6A6050" }}>
              Próximo nível: <span style={{ color: "#F59E0B80" }}>{nextNivel.emoji} {nextNivel.label}</span> em {nextNivel.dias - diasAtivos} dias
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
            <div style={{ fontSize: "1.8em" }}>🤝</div>
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

        {/* O que partilhas */}
        <div style={{ fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#6A6050", marginBottom: 10 }}>
          A MENSAGEM QUE PARTILHAS
        </div>
        <div style={{
          background: "#0F0F0F", border: "1px solid #1E1E1E",
          borderRadius: 14, padding: "16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: "0.88em", color: "#A09880", lineHeight: 1.6 }}>
            "Descobri este app que me diz exactamente quanto posso gastar hoje — sem culpa, sem restrições."
          </div>
          <div style={{ marginTop: 10, fontSize: "0.75em", color: "#6A6050", fontFamily: "monospace", wordBreak: "break-all" }}>
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
            <span style={{ fontSize: "1.2em" }}>📱</span> Partilhar no WhatsApp
          </button>
          <button onClick={handleCopy} style={{
            background: copied ? "#22C55E15" : "#0F0F0F",
            border: `1px solid ${copied ? "#22C55E40" : "#2A2A2A"}`,
            borderRadius: 14, padding: "15px",
            color: copied ? "#22C55E" : "#A09880", fontWeight: 700, fontSize: "0.9em",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {copied ? "✓ Copiado!" : "Copiar mensagem"}
          </button>
        </div>

        {/* Todos os níveis */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#6A6050", marginBottom: 12 }}>
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
                  <span style={{ fontSize: "1.5em" }}>{n.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88em", color: atingido ? "#DDD" : "#8A8070" }}>{n.label}</div>
                    <div style={{ fontSize: "0.7em", color: "#6A6050", marginTop: 2 }}>{n.desc}</div>
                  </div>
                  <div style={{ fontSize: "0.7em", color: atingido ? "#22C55E" : "#333", fontWeight: 700 }}>
                    {atingido ? "✓" : `${n.dias}d`}
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
function ConquistaModal({ nivel, diasAtivos, onPartilhar, onFechar }) {
  const handleWhatsApp = () => {
    const msgs = [
      `Dia ${diasAtivos} a gastar com intenção. Sem surpresas no fim do mês. 💪`,
      `${diasAtivos} dias e o dinheiro ainda está no lugar certo. 🔥`,
      `Nível ${nivel.label} desbloqueado. ${diasAtivos} dias a saber exactamente o que posso gastar. ${nivel.emoji}`,
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
        <div style={{ fontSize: "4em", marginBottom: 12, animation: "pulse 1.5s infinite" }}>{nivel.emoji}</div>
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
            Partilhar no WhatsApp 📱
          </button>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none", color: "#6A6050",
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
  const link = `https://app.minhasfinancas.ao/entrar?ref=${inviteCode}`;

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Descobri este app que me diz exactamente quanto posso gastar hoje — sem culpa, sem restrições. Experimenta: ${link}`
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
        <div style={{ fontSize: "2em", marginBottom: 16, textAlign: "center" }}>🤝</div>
        <div style={{ fontSize: "1.2em", fontWeight: 800, color: "#E8E0D0", marginBottom: 10, lineHeight: 1.3 }}>
          Conheces alguém que precisava de saber isto?
        </div>
        <div style={{ fontSize: "0.92em", color: "#8A8070", lineHeight: 1.6, marginBottom: 28 }}>
          A maioria das pessoas não sabe quanto pode gastar hoje. Tu já sabes. Partilha com alguém que importa.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handleWhatsApp} style={{
            background: "#25D366", border: "none", borderRadius: 14,
            padding: "17px", color: "#000", fontWeight: 800,
            fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit",
          }}>
            Partilhar no WhatsApp 📱
          </button>
          <button onClick={onFechar} style={{
            background: "transparent", border: "none",
            color: "#6A6050", fontSize: "0.88em",
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
    const digits = raw.replace(/\D/g, "");
    setValor(digits);
    setValorDisplay(digits === "" ? "" : String(parseInt(digits,10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
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
          Recebeste algo além do salário? Adiciona aqui — entra no que podes gastar este período. 🌅
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
  const [data, setData] = useState(item.data || todayStr());
  const v = parseFloat(String(valor).replace(/\D/g, "")) || 0;
  const valido = nome.trim().length > 0 && v > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "slideUp 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px" }}>
        <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 20 }}>
          Editar {isDespesa ? "despesa" : "entrada"}
        </div>
        <div style={S.field}>
          <label style={S.label}>{isDespesa ? "DESCRIÇÃO" : "NOME"}</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>VALOR (Kz)</label>
          <input type="number" value={valor} onChange={e => setValor(e.target.value)} style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>DATA</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={S.dateInput} />
        </div>
        <button disabled={!valido}
          onClick={() => { onSave(isDespesa ? { descricao: nome.trim(), valor: v, data } : { nome: nome.trim(), valor: v, data }); onClose(); }}
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
          <div style={{ fontSize: "0.78em", color: "#6A6050", marginTop: 2 }}>{despesas.length} despesa{despesas.length !== 1 ? "s" : ""}</div>
        </div>
        {despesas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6A6050", fontSize: "0.9em", padding: "40px 0" }}>Ainda não registaste despesas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...despesas].reverse().map(d => {
              const cat = CATS.find(c => c.id === d.categoria);
              return (
                <button key={d.id} onClick={() => setEditing(d)}
                  style={{ ...S.expenseRow, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}>
                  <span style={S.expEmoji}>{cat?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.expDesc}>{d.descricao}</div>
                    <div style={S.expDate}>{d.data} · {cat?.label}</div>
                  </div>
                  <div style={{ color: "#EF4444", fontWeight: 600 }}>-{fmtKz(d.valor)}</div>
                  <span style={{ color: "#6A6050", marginLeft: 8, fontSize: "0.9em" }}>✎</span>
                </button>
              );
            })}
          </div>
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
          <div style={{ fontSize: "0.78em", color: "#6A6050", marginTop: 2 }}>{entradas.length} entrada{entradas.length !== 1 ? "s" : ""}</div>
        </div>
        {entradas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6A6050", fontSize: "0.9em", padding: "40px 0" }}>Ainda não tens entradas extra.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {[...entradas].reverse().map(e => (
              <button key={e.id || e.nome} onClick={() => setEditing(e)}
                style={{ ...S.expenseRow, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}>
                <span style={S.expEmoji}>💰</span>
                <div style={{ flex: 1 }}>
                  <div style={S.expDesc}>{e.nome}</div>
                  <div style={S.expDate}>{e.data}</div>
                </div>
                <div style={{ color: "#22C55E", fontWeight: 600 }}>+{fmtKz(e.valor)}</div>
                <span style={{ color: "#6A6050", marginLeft: 8, fontSize: "0.9em" }}>✎</span>
              </button>
            ))}
          </div>
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

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const TRIAL_DAYS = 14;

const INIT = {
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
};

export default function App() {
  const [state, setState] = useState(INIT);
  const [screen, setScreen] = useState("setup");

  // Trial day calculation (uses daysSince helper)
  const trialDaysUsed = state.setupDate ? daysSince(state.setupDate) : 0;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  const trialExpired = state.setup && trialDaysUsed >= TRIAL_DAYS;

  const handleSetupDone = (data) => {
    setState(prev => ({ ...prev, ...data, setup: true, setupDate: todayStr() }));
    setScreen("dashboard");
  };

  const handleSettingsSave = (data) => {
    setState(prev => ({ ...prev, ...data }));
    setScreen("dashboard");
  };

  const handleAddExpense = (expense) => {
    const isPrimeiraDespesa = state.despesas.length === 0;
    const jaViuHoje = state.conviteDiasMostrados?.includes(trialDaysUsed);
    // Dias em que o convite proactivo aparece: dia 0 (1ª despesa), dia 3
    // Dia 7 é coberto pelo ConquistaModal (nível Consciente)
    const diaDeConvite = (isPrimeiraDespesa && trialDaysUsed === 0) ||
                         (trialDaysUsed === 3 && !jaViuHoje);

    setState(prev => ({
      ...prev,
      despesas: [...prev.despesas, expense],
      conviteDiasMostrados: diaDeConvite
        ? [...(prev.conviteDiasMostrados || []), trialDaysUsed]
        : prev.conviteDiasMostrados || [],
    }));

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
    setState(prev => ({ ...prev, objectivos: [...(prev.objectivos || []), goal] }));
  };

  const handleDeleteGoal = (id) => {
    setState(prev => ({ ...prev, objectivos: (prev.objectivos || []).filter(g => g.id !== id) }));
  };

  // Conquista: mostra modal quando utilizador atinge novo nível
  const diasAtivos = state.setupDate ? daysSince(state.setupDate) : 0;
  const nivelAtual = getNivel(diasAtivos);
  const [conquistaVista, setConquistaVista] = useState(false);
  const [conquistaModal, setConquistaModal] = useState(false);
  const [conviteMomento, setConviteMomento] = useState(false); // modal após 1ª despesa

  useEffect(() => {
    if (!state.setup) return;
    const marcos = NIVEIS.map(n => n.dias);
    if (marcos.includes(diasAtivos) && !conquistaVista) {
      setConquistaModal(true);
      setConquistaVista(true);
    }
  }, [diasAtivos, state.setup]);

  // If trial expired, show expired screen
  if (trialExpired && screen !== "setup") {
    return (
      <div style={S.app}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input { -webkit-appearance: none; }
          @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <TrialExpiredScreen />
      </div>
    );
  }

  // Which tabs show the bottom nav
  const showNav = ["dashboard","goals","settings","charts","chat","convite"].includes(screen);
  const navActive = ["goals","settings"].includes(screen) ? screen : "dashboard";

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

      {screen === "setup"      && <SetupScreen onComplete={handleSetupDone} />}
      {screen === "dashboard"  && (
        <>
          <DashboardScreen
            state={state}
            onAddExpense={() => setScreen("add")}
            onAddEntrada={() => setScreen("addEntrada")}
            onVerDespesas={() => setScreen("todasDespesas")}
            onVerEntradas={() => setScreen("todasEntradas")}
            onOpenChat={() => setScreen("chat")}
            onOpenCharts={() => setScreen("charts")}
            onOpenGoals={() => setScreen("goals")}
            onSettings={() => setScreen("settings")}
            onOpenConvite={() => setScreen("convite")}
          />
          {/* Chip de contagem do teste — visível durante o trial */}
          {state.setup && !trialExpired && (
            <div style={{ padding: "0 16px 8px", marginTop: -8 }}>
              <div style={{ fontSize: "0.72em", color: trialDaysLeft <= 2 ? "#EF4444" : "#8A8070", textAlign: "center" }}>
                {trialDaysLeft <= 2
                  ? `⏳ Teste termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""}`
                  : `⏱ Versão de teste — ${trialDaysLeft} dias restantes`}
              </div>
            </div>
          )}
        </>
      )}
      {screen === "settings"   && <SettingsScreen state={state} onSave={handleSettingsSave} onBack={() => setScreen("dashboard")} onOpenConvite={() => setScreen("convite")} />}
      {screen === "convite"     && <ConviteScreen inviteCode={state.inviteCode} inviteCount={state.inviteCount} diasAtivos={diasAtivos} onBack={() => setScreen("dashboard")} />}
      {screen === "add"        && <AddExpenseScreen onSave={handleAddExpense} onBack={() => setScreen("dashboard")}
                                    despesasAnteriores={state.despesas}
                                    saldoRestante={state.salario - state.despesas.reduce((s,d) => s+d.valor, 0)} />}
      {screen === "addEntrada" && <AddEntradaScreen onSave={handleAddEntrada} onBack={() => setScreen("dashboard")} />}
      {screen === "todasDespesas" && <AllDespesasScreen despesas={state.despesas} onEdit={handleEditExpense} onDelete={handleDeleteExpense} onBack={() => setScreen("dashboard")} />}
      {screen === "todasEntradas" && <AllEntradasScreen entradas={state.entradasExtra || []} onEdit={handleEditEntrada} onDelete={handleDeleteEntrada} onBack={() => setScreen("dashboard")} onAdd={() => setScreen("addEntrada")} />}
      {screen === "goals"      && <GoalsScreen state={state} onBack={() => setScreen("dashboard")} onSaveGoal={handleSaveGoal} onDeleteGoal={handleDeleteGoal} />}
      {screen === "charts"     && <ChartsScreen state={state} onBack={() => setScreen("dashboard")} />}
      {screen === "chat"       && <ChatScreen state={state} onBack={() => setScreen("dashboard")} />}

      {/* Modal de conquista — dias 1, 7, 14, 30, 60 */}
      {conquistaModal && !conviteMomento && (
        <ConquistaModal
          nivel={nivelAtual}
          diasAtivos={diasAtivos}
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

      {/* Bottom Navigation */}
      {showNav && (
        <BottomNav
          active={navActive}
          onHome={() => setScreen("dashboard")}
          onGoals={() => setScreen("goals")}
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
  screen: { minHeight: "100vh", overflowY: "auto", paddingBottom: 100, animation: "slideUp 0.25s ease" },

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
  dateTip: { fontSize: "0.82em", color: "#6A6050", marginTop: 10, textAlign: "center" },
  preview: { marginTop: 20, display: "flex", flexDirection: "column", gap: 12 },
  previewRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.92em" },
  btn: { width: "100%", background: "#F59E0B", border: "none", borderRadius: 14, padding: "17px", color: "#000", fontSize: "1em", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" },
  backBtnSetup: { background: "#080808", border: "1px solid #222", borderRadius: 14, padding: "17px 20px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: "0.95em" },

  // Validation
  valQuestion: { marginBottom: 24 },
  valQ: { fontSize: "0.95em", color: "#C8C0B0", lineHeight: 1.6, marginBottom: 12 },
  valOptions: { display: "flex", flexDirection: "column", gap: 10 },
  valOption: { background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95em", textAlign: "left", transition: "all 0.2s" },
  valLabel: { fontSize: "0.8em", fontWeight: 700, letterSpacing: "0.08em", color: "#6A6050", display: "block", marginBottom: 6 },

  // Dashboard
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 20px 14px" },
  headerSub: { fontSize: "0.75em", color: "#8A8070", marginTop: 3, letterSpacing: "0.04em" },
  iconBtn: { background: "transparent", border: "none", borderRadius: 10, padding: "8px", color: "#2A2A2A", cursor: "pointer", fontSize: "1.1em" },

  // Hero — O número que liberta
  heroCard: { margin: "0 16px 24px", background: "linear-gradient(160deg,#141000,#0A0800)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 24, padding: "32px 24px" },
  heroLabel: { fontSize: "0.72em", fontWeight: 700, letterSpacing: "0.14em", color: "#8A7040", marginBottom: 10 },
  heroAmount: { fontSize: "3.2em", fontWeight: 800, color: "#F59E0B", letterSpacing: "-0.03em", lineHeight: 1 },
  heroSub: { fontSize: "0.88em", color: "#6A5030", marginTop: 10 },
  heroDivider: { height: 1, background: "rgba(245,158,11,0.08)", margin: "20px 0" },
  heroRow: { display: "flex", justifyContent: "space-between" },
  heroSmallLabel: { fontSize: "0.75em", color: "#6A5030", marginBottom: 4 },
  heroSmall: { fontSize: "1em", fontWeight: 700, color: "#C8A040" },

  // Categories
  sectionLabel: { fontSize: "0.75em", fontWeight: 700, letterSpacing: "0.1em", color: "#6A6050", padding: "0 20px", marginBottom: 12 },
  categoryList: { display: "flex", flexDirection: "column", gap: 8, padding: "0 16px", marginBottom: 24 },
  categoryCard: { background: "#0D0D0D", border: "1px solid #161616", borderRadius: 16, padding: "16px" },
  catHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  catEmoji: { fontSize: "1.3em", lineHeight: 1 },
  catName: { fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" },
  catLimit: { fontSize: "0.82em", color: "#6A6050", marginTop: 2 },
  barBg: { height: 4, background: "#161616", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  overAlert: { fontSize: "0.82em", color: "#EF4444", marginTop: 8, fontWeight: 600 },

  // Expenses
  expenseList: { padding: "0 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 },
  expenseRow: { display: "flex", alignItems: "center", gap: 12, background: "#0D0D0D", border: "1px solid #161616", borderRadius: 14, padding: "13px 16px" },
  expEmoji: { fontSize: "1.1em" },
  expDesc: { fontSize: "0.92em", fontWeight: 600, color: "#E8E0D0" },
  expDate: { fontSize: "0.78em", color: "#6A6050", marginTop: 2 },
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
