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
async function askAI(messages, userData) {
  const system = `És um assistente financeiro chamado "Minhas Finanças".
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "Erro na resposta.";
}

// ── SETUP (multi-step, with free back navigation + editable %) ────────────────
function SetupScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [salario, setSalario] = useState("");
  const [salarioDisplay, setSalarioDisplay] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(todayStr());
  const [proximoPagamento, setProximoPagamento] = useState("");
  const [pct, setPct] = useState({ ...DEFAULT_PCT });

  // Format number while typing: "1000000" → "1.000.000"
  const handleSalarioChange = (raw) => {
    const digits = raw.replace(/\D/g, "");
    setSalario(digits);
    if (digits === "") { setSalarioDisplay(""); return; }
    const num = parseInt(digits, 10);
    const formatted = String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setSalarioDisplay(formatted);
  };

  // Independent fields. Allow empty while typing — validate on total only.
  const handlePct = (id, raw) => {
    // Allow empty string while user is clearing to retype
    if (raw === "" || raw === "-") {
      setPct(prev => ({ ...prev, [id]: "" }));
      return;
    }
    const val = Math.min(100, Math.max(0, parseInt(raw) || 0));
    setPct(prev => ({ ...prev, [id]: val }));
  };


  const totalPct = Object.values(pct).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const sal = parseFloat(salario) || 0;

  const steps = [
    // Step 0 – rendimento
    {
      title: "Qual é o teu rendimento mensal?",
      subtitle: "Inclui salário, negócio, rendas — tudo que entra",
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
          {sal > 0 && (
            <div style={{ textAlign: "center", margin: "8px 0 4px", fontSize: "0.78em", color: "#666", letterSpacing: "0.04em" }}>
              {fmtKz(sal)} — valor confirmado
            </div>
          )}
          {sal > 0 && (
            <div style={S.preview}>
              {CATS.map(c => (
                <div key={c.id} style={S.previewRow}>
                  <span style={{ color: "#888" }}>{c.emoji} {c.label}</span>
                  <span style={{ color: c.color, fontWeight: 700 }}>
                    {fmtKz(sal * pct[c.id] / 100)}
                    <span style={{ color: "#555", fontWeight: 400, fontSize: "0.8em" }}> · {pct[c.id]}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    // Step 1 – percentagens
    {
      title: "Ajusta as tuas percentagens",
      subtitle: "Sugerimos 60 · 30 · 10 — mas podes personalizar. O total tem de ser 100%.",
      valid: totalPct === 100,
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {CATS.map(c => (
            <div key={c.id} style={{ background: "#0A0A0A", border: `1px solid ${pct[c.id] > 0 ? c.color + "40" : "#1E1E1E"}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9em", color: "#DDD" }}>{c.emoji} {c.label}</div>
                  <div style={{ fontSize: "0.72em", color: "#555", marginTop: 2 }}>{c.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min="0" max="100"
                    value={pct[c.id] === "" ? "" : pct[c.id]}
                    onChange={e => handlePct(c.id, e.target.value)}
                    style={{ width: 58, background: "#111", border: `2px solid ${c.color}`, borderRadius: 8, padding: "6px 8px", color: c.color, fontWeight: 800, fontSize: "1.1em", fontFamily: "inherit", outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: "#555", fontSize: "0.9em" }}>%</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, height: 5, background: "#1A1A1A", borderRadius: 3, overflow: "hidden", marginRight: 10 }}>
                  <div style={{ width: `${pct[c.id]}%`, height: "100%", background: c.color, borderRadius: 3, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: "0.8em", color: c.color, fontWeight: 700 }}>{fmtKz(sal * pct[c.id] / 100)}</span>
              </div>
            </div>
          ))}
          <div style={{
            textAlign: "center", fontSize: "0.9em", fontWeight: 800,
            color: totalPct === 100 ? "#22C55E" : totalPct > 100 ? "#EF4444" : "#F59E0B",
            padding: "12px", borderRadius: 12,
            background: totalPct === 100 ? "#22C55E15" : totalPct > 100 ? "#EF444415" : "#F59E0B15",
            border: `2px solid ${totalPct === 100 ? "#22C55E40" : totalPct > 100 ? "#EF444440" : "#F59E0B40"}`,
            fontSize: "1em",
          }}>
            {totalPct === 100
              ? "✅ Total: 100% — perfeito!"
              : totalPct > 100
                ? `🔴 Total: ${totalPct}% — excedeste em ${totalPct - 100}%`
                : `🟡 Total: ${totalPct}% — ainda faltam ${100 - totalPct}%`}
          </div>
          {totalPct !== 100 && (
            <button
              onClick={() => {
                // Auto-fix: set last category to make up the difference
                const lastCat = CATS[CATS.length - 1];
                const othersSum = CATS.slice(0,-1).reduce((s,c) => s + pct[c.id], 0);
                setPct(prev => ({ ...prev, [lastCat.id]: Math.max(0, 100 - othersSum) }));
              }}
              style={{ width: "100%", background: "#1A1A1A", border: "1px dashed #333", borderRadius: 10, padding: "8px", color: "#666", fontSize: "0.78em", cursor: "pointer", fontFamily: "inherit" }}>
              Ajustar automaticamente para 100%
            </button>
          )}
        </div>
      ),
    },
    // Step 2 – último recebimento
    {
      title: "Quando recebeste o último pagamento?",
      subtitle: "Para calcular o teu orçamento deste período",
      valid: !!dataRecebimento,
      body: (
        <div>
          <input type="date" value={dataRecebimento}
            onChange={e => setDataRecebimento(e.target.value)} style={S.dateInput} />
          <div style={S.dateTip}>📅 Podes alterar esta data sempre que quiseres</div>
        </div>
      ),
    },
    // Step 3 – próximo pagamento
    {
      title: "Quando recebes o próximo pagamento?",
      subtitle: "Calculamos automaticamente quanto podes gastar por dia",
      valid: !!proximoPagamento && proximoPagamento > todayStr(),
      body: (
        <div>
          <input type="date" value={proximoPagamento}
            onChange={e => setProximoPagamento(e.target.value)} style={S.dateInput} />
          {proximoPagamento && (
            <div style={{ ...S.dateTip, color: daysUntil(proximoPagamento) > 0 ? "#22C55E" : "#EF4444" }}>
              📊 {daysUntil(proximoPagamento)} dias a partir de hoje até ao próximo pagamento
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
        <div style={S.logo}>💰 Minhas Finanças</div>

        {/* Step indicators – clickable to go back */}
        <div style={S.stepDots}>
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => i < step && setStep(i)}
              style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i < step ? "#F59E0B" : i === step ? "#F59E0B" : "#2A2A2A",
                border: "none", cursor: i < step ? "pointer" : "default",
                transition: "all 0.3s", padding: 0,
              }}
            />
          ))}
        </div>

        <h2 style={S.setupTitle}>{cur.title}</h2>
        <p style={S.setupSub}>{cur.subtitle}</p>

        <div style={{ margin: "24px 0" }}>{cur.body}</div>

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={S.backBtnSetup}>
              ← Voltar
            </button>
          )}
          <button
            disabled={!cur.valid}
            onClick={() => {
              if (step < steps.length - 1) setStep(step + 1);
              else onComplete({ salario: sal, dataRecebimento, proximoPagamento, pct });
            }}
            style={{ ...S.btn, opacity: cur.valid ? 1 : 0.4, flex: 1 }}
          >
            {step < steps.length - 1 ? "Continuar →" : "Começar 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VALIDATION SCREEN (Kaufman pre-test) ──────────────────────────────────────
function ValidationScreen({ onDone }) {
  const [bankSync, setBankSync] = useState(null);    // "sim" | "nao" | null
  const [reserva, setReserva] = useState(null);       // "sim" | "nao" | null
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = bankSync !== null && reserva !== null;

  if (submitted) {
    return (
      <div style={S.setup}>
        <div style={{ ...S.setupCard, textAlign: "center" }}>
          <div style={{ fontSize: "3em", marginBottom: 16 }}>🎉</div>
          <div style={S.logo}>Obrigada!</div>
          <p style={{ color: "#888", fontSize: "0.92em", lineHeight: 1.6, marginBottom: 24 }}>
            O teu feedback é valioso. {reserva === "sim" ? "Vamos contactar-te assim que o app estiver disponível!" : "Podes continuar a usar a versão de teste à vontade."}
          </p>
          <button onClick={onDone} style={S.btn}>Entrar no app →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={S.logo}>💰 Minhas Finanças</div>
        <div style={{ background: "#F59E0B15", border: "1px solid #F59E0B30", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.72em", fontWeight: 700, color: "#F59E0B", letterSpacing: "0.08em" }}>VERSÃO DE TESTE</div>
          <div style={{ fontSize: "0.82em", color: "#888", marginTop: 4 }}>Estamos a validar o produto. A tua opinião define o futuro da app.</div>
        </div>

        {/* Question 1 */}
        <div style={S.valQuestion}>
          <p style={S.valQ}>📱 Gostavas que a app ligasse automaticamente ao teu banco, para não teres de inserir despesas manualmente?</p>
          <div style={S.valOptions}>
            {["sim", "nao"].map(v => (
              <button key={v} onClick={() => setBankSync(v)}
                style={{ ...S.valOption, borderColor: bankSync === v ? "#F59E0B" : "#1E1E1E", background: bankSync === v ? "#F59E0B15" : "#0A0A0A", color: bankSync === v ? "#F59E0B" : "#888" }}>
                {v === "sim" ? "✅ Sim, com certeza!" : "❌ Prefiro inserir eu"}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2 */}
        <div style={S.valQuestion}>
          <p style={S.valQ}>🚀 Queres fazer uma pré-reserva? O app terá uma versão paga — reservar agora garante acesso antecipado e preço especial.</p>
          <div style={S.valOptions}>
            {["sim", "nao"].map(v => (
              <button key={v} onClick={() => setReserva(v)}
                style={{ ...S.valOption, borderColor: reserva === v ? "#22C55E" : "#1E1E1E", background: reserva === v ? "#22C55E15" : "#0A0A0A", color: reserva === v ? "#22C55E" : "#888" }}>
                {v === "sim" ? "✅ Quero reservar!" : "❌ Só quero testar"}
              </button>
            ))}
          </div>
        </div>

        {/* Email if reserva sim */}
        {reserva === "sim" && (
          <div style={{ marginBottom: 16 }}>
            <label style={S.valLabel}>O teu e-mail ou telemóvel (para te contactarmos)</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="exemplo@gmail.com ou +244 9XX XXX XXX"
              style={{ ...S.dateInput, marginTop: 6 }}
            />
          </div>
        )}

        <button
          disabled={!canSubmit}
          onClick={() => setSubmitted(true)}
          style={{ ...S.btn, opacity: canSubmit ? 1 : 0.4, marginTop: 4 }}
        >
          {reserva === "sim" ? "Guardar pré-reserva 🎯" : "Continuar para o app →"}
        </button>

        <button onClick={onDone} style={{ width: "100%", background: "transparent", border: "none", color: "#444", fontSize: "0.82em", marginTop: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Saltar esta etapa
        </button>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardScreen({ state, onAddExpense, onOpenChat, onOpenCharts, onOpenGoals }) {
  const { salario, dataRecebimento, proximoPagamento, despesas, pct, objectivos = [] } = state;

  // Period: dataRecebimento → proximoPagamento
  const diasRestantes = daysUntil(proximoPagamento);
  const diasPassados = daysSince(dataRecebimento);
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
  const taxaDiaria = diasPeriodo > 0 ? salario / diasPeriodo : salario;
  const orcamentoRestante = taxaDiaria * diasRestantes;

  // Saldo real = salary - expenses - goals reserved
  const totalComprometido = totalGasto + totalReservado;
  const saldoAjustado = orcamentoRestante - totalComprometido;
  const gastoDiario = diasRestantes > 0 ? saldoAjustado / diasRestantes : saldoAjustado;
  const saldo = salario - totalComprometido;

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
          <div style={S.logo}>💰 Minhas Finanças</div>
          <div style={S.headerSub}>kwanza a kwanza, o futuro constrói-se</div>
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
        <div style={{ ...S.heroSub, color: heroPositive ? "#7A6A40" : "#8A4030" }}>
          {gastoDiario >= 0
            ? `${diasRestantes} dias até ao próximo pagamento`
            : `Precisas de compensar nos próximos ${diasRestantes} dias`}
        </div>

        {/* Context line: vs expected */}
        {diasPassados > 0 && totalGasto > 0 && (
          <div style={{
            marginTop: 10,
            fontSize: "0.75em",
            color: acimaDoEsperado ? "#EF444490" : "#22C55E90",
            fontWeight: 600,
          }}>
            {acimaDoEsperado
              ? `⚠️ ${fmtKz(diferencaVsEsperado)} acima do ritmo ideal`
              : `✓ ${fmtKz(diferencaVsEsperado)} abaixo do ritmo — bom trabalho!`}
          </div>
        )}

        <div style={S.heroDivider} />
        <div style={S.heroRow}>
          <div>
            <div style={S.heroSmallLabel}>Sobra este mês</div>
            <div style={{ ...S.heroSmall, color: saldo >= 0 ? "#C8A040" : "#EF4444", fontSize: "1.1em", fontWeight: 800 }}>{fmtKz(saldo)}</div>
            {totalReservado > 0 && <div style={{ fontSize: "0.68em", color: "#F59E0B80", marginTop: 2 }}>incl. {fmtKz(totalReservado)} em obj.</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.heroSmallLabel}>Total gasto</div>
            <div style={{ ...S.heroSmall, color: "#888" }}>{fmtKz(totalGasto)}</div>
          </div>
        </div>
        {/* Progress bar: spending vs salary */}
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, salario > 0 ? (totalGasto / salario) * 100 : 0)}%`, height: "100%", background: saldo >= 0 ? "#F59E0B" : "#EF4444", borderRadius: 2, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "0.68em", color: "#4A3A20" }}>
            <span>0</span>
            <span style={{ color: "#4A3A20" }}>{salario > 0 ? ((totalGasto/salario)*100).toFixed(1) : 0}% do rendimento usado</span>
            <span>{fmtKz(salario)}</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={S.sectionTitle}>DISTRIBUIÇÃO {Object.values(pct).join(" · ")}</div>
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
                  <div style={S.catDesc}>{c.desc}</div>
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
                : <div style={{ fontSize: "0.72em", color: "#22863A", marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>✓</span>
                    <span>Ainda tens <strong style={{ color: c.color }}>{fmtKz(restante)}</strong> disponíveis nesta categoria</span>
                  </div>
              }
            </div>
          );
        })}
      </div>

      {/* Recent expenses */}
      {despesas.length > 0 && (
        <>
          <div style={S.sectionTitle}>ÚLTIMAS DESPESAS</div>
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

      {/* Add expense FAB */}
      <div style={{ padding: "0 16px 100px" }}>
        <button onClick={onAddExpense} style={S.addBtn}>+ Registar despesa</button>
      </div>
    </div>
  );
}

// ── SETTINGS (edit salário, datas, percentagens) ──────────────────────────────
function SettingsScreen({ state, onSave, onBack }) {
  const [salario, setSalario] = useState(String(state.salario));
  const [dataRecebimento, setDataRecebimento] = useState(state.dataRecebimento);
  const [proximoPagamento, setProximoPagamento] = useState(state.proximoPagamento);
  const [pct, setPct] = useState({ ...state.pct });

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
                  <span style={{ color: "#555" }}>%</span>
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

        <button disabled={!valid} onClick={() => onSave({ salario: sal, dataRecebimento, proximoPagamento, pct })}
          style={{ ...S.btn, opacity: valid ? 1 : 0.4 }}>
          Guardar alterações
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
                <span style={{ fontSize: "0.68em", fontWeight: 700, color: categoria === c.id ? c.color : "#666", textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description with suggestions */}
        <div style={S.field}>
          <label style={S.label}>O QUE COMPRASTE?</label>
          <input value={descricao}
            onChange={e => { setDescricao(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            placeholder="Escreve ou escolhe abaixo..."
            style={S.input} />

          {/* Suggestions grid */}
          {showSugg && filtered.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "0.68em", color: "#444", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
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
                      color: descricao === s.nome ? cat?.color : "#888",
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
                <span style={{ color: "#555" }}>Estás a gastar:</span>
                <span style={{ fontWeight: 700, color: "#F59E0B" }}>{fmtKz(v)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78em" }}>
                <span style={{ color: "#555" }}>Saldo após esta despesa:</span>
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
                        <div style={{ fontSize: "0.72em", color: "#555", marginTop: 2 }}>{cat?.emoji} {cat?.label}</div>
                      </div>
                    </div>
                    <button onClick={() => onDeleteGoal(obj.id)}
                      style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "1em" }}>✕</button>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72em", color: "#555", marginBottom: 6 }}>
                      <span>Acumulado: <strong style={{ color: cat?.color }}>{fmtKz(obj.acumulado)}</strong></span>
                      <span>Alvo: <strong style={{ color: "#DDD" }}>{fmtKz(obj.valorAlvo)}</strong></span>
                    </div>
                    {/* Circle progress */}
                    <div style={{ position: "relative", height: 8, background: "#1A1A1A", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pctConcluido}%`, background: cat?.color, borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7em", marginTop: 4 }}>
                      <span style={{ color: cat?.color, fontWeight: 700 }}>{pctConcluido.toFixed(0)}% concluído</span>
                      {mesesRestantes && <span style={{ color: "#555" }}>~{mesesRestantes} meses para atingir</span>}
                    </div>
                  </div>

                  {/* Monthly impact */}
                  <div style={{ background: "#0A0A0A", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em" }}>
                      <span style={{ color: "#555" }}>Poupança mensal para objectivo</span>
                      <span style={{ color: "#F59E0B", fontWeight: 700 }}>-{fmtKz(obj.poupancaMensal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em", marginTop: 6 }}>
                      <span style={{ color: "#555" }}>Disponível restante em {cat?.label}</span>
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
                    <span style={{ fontSize: "0.62em", fontWeight: 700, color: categoria === c.id ? c.color : "#555", textAlign: "center" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: "transparent", border: "1px solid #222", borderRadius: 12, padding: "13px", color: "#555", cursor: "pointer", fontFamily: "inherit" }}>
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
            <div style={{ fontSize: "0.85em", color: "#555" }}>Define um objectivo e vê quanto tempo demoras a atingi-lo.</div>
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
              <div style={{ fontSize: "0.68em", color: "#555", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>{item.label.toUpperCase()}</div>
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
                      <div style={{ fontSize: "0.7em", color: "#555", marginTop: 2 }}>
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
                            <span style={{ fontSize: "0.7em", fontWeight: 800, color: "#444", minWidth: 16 }}>#{i + 1}</span>
                            <span style={{ fontSize: "0.9em", fontWeight: 600, color: "#DDD" }}>{nome}</span>
                            {cat && <span style={{ fontSize: "0.65em", background: `${cat.color}20`, color: cat.color, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{cat.label}</span>}
                          </div>
                          <span style={{ fontWeight: 700, color: "#EF4444", fontSize: "0.88em" }}>{fmtKz(total)}</span>
                        </div>
                        <div style={{ height: 3, background: "#1A1A1A", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${pctBar}%`, height: "100%", background: cat?.color || "#F59E0B", borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: "0.68em", color: "#444", marginTop: 3 }}>{pctBar.toFixed(1)}% do total gasto</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#444" }}>
            <div style={{ fontSize: "3em", marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, color: "#666", marginBottom: 8 }}>Ainda sem dados</div>
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
    content: `Olá! Sou o assistente de **Minhas Finanças** 💰\n\nVejo que tens **${fmtKz(saldo)}** disponíveis e **${dias} dias** até ao próximo pagamento. Podes gastar até **${fmtKz(Math.max(0, dias > 0 ? saldo / dias : saldo))} por dia** em segurança.\n\nO que queres saber?`,
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
                style={{ background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 12, padding: "11px 16px", color: "#888", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88em" }}>
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
function PreReservaBanner({ diasTrial, onReservar, onFechar }) {
  const [email, setEmail] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);
  const urgent = diasTrial <= 2;

  if (done) return (
    <div style={{
      margin: "0 16px 16px",
      background: "#0A1A0A",
      border: "1px solid #22C55E40",
      borderRadius: 16,
      padding: "16px",
      animation: "slideUp 0.3s ease",
    }}>
      <div style={{ fontSize: "1.3em", marginBottom: 6 }}>✅</div>
      <div style={{ fontWeight: 700, color: "#22C55E", fontSize: "0.9em" }}>Pré-reserva guardada!</div>
      <div style={{ fontSize: "0.78em", color: "#555", marginTop: 4 }}>Vamos contactar-te quando o app estiver disponível.</div>
    </div>
  );

  return (
    <div style={{
      margin: "0 16px 16px",
      background: urgent ? "linear-gradient(135deg,#1A0800,#120600)" : "linear-gradient(135deg,#12100A,#0C0A06)",
      border: `1px solid ${urgent ? "#EF444440" : "#F59E0B30"}`,
      borderRadius: 16,
      padding: "14px 16px",
      animation: "slideUp 0.3s ease",
      position: "relative",
    }}>
      {/* Close button — only if not urgent */}
      {!urgent && (
        <button onClick={onFechar} style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: "1em" }}>✕</button>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: "1.4em", lineHeight: 1 }}>{urgent ? "⏳" : "🚀"}</span>
        <div style={{ flex: 1 }}>
          {urgent ? (
            <>
              <div style={{ fontWeight: 800, color: "#EF4444", fontSize: "0.9em", marginBottom: 4 }}>
                Teste termina em {diasTrial} dia{diasTrial !== 1 ? "s" : ""}!
              </div>
              <div style={{ fontSize: "0.78em", color: "#999", lineHeight: 1.5 }}>
                Não percas o teu histórico. Faz a pré-reserva e garante acesso antecipado com preço especial.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: "#F59E0B", fontSize: "0.88em", marginBottom: 3 }}>
                Estás a gostar? Garante o teu lugar 🎯
              </div>
              <div style={{ fontSize: "0.76em", color: "#666", lineHeight: 1.5 }}>
                Pré-reserva = acesso antecipado + preço especial. Ainda tens {diasTrial} dias de teste.
              </div>
            </>
          )}

          {!expanded ? (
            <button onClick={() => setExpanded(true)} style={{
              marginTop: 10, background: urgent ? "#EF4444" : "#F59E0B",
              border: "none", borderRadius: 10, padding: "9px 16px",
              color: "#000", fontWeight: 700, fontSize: "0.82em",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Quero pré-reservar →
            </button>
          ) : (
            <div style={{ marginTop: 10 }}>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="E-mail ou telemóvel (+244...)"
                style={{ width: "100%", background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 10, padding: "10px 12px", color: "#E8E0D0", fontSize: "0.84em", fontFamily: "inherit", outline: "none", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={!email.trim()}
                  onClick={() => { onReservar(email); setDone(true); }}
                  style={{ flex: 1, background: "#F59E0B", border: "none", borderRadius: 10, padding: "10px", color: "#000", fontWeight: 700, fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit", opacity: email.trim() ? 1 : 0.4 }}>
                  Confirmar reserva
                </button>
                <button onClick={() => setExpanded(false)}
                  style={{ background: "transparent", border: "1px solid #2A2A2A", borderRadius: 10, padding: "10px 14px", color: "#666", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82em" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TRIAL EXPIRED SCREEN ───────────────────────────────────────────────────────
function TrialExpiredScreen({ onReservar }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (done) return (
    <div style={S.setup}>
      <div style={{ ...S.setupCard, textAlign: "center" }}>
        <div style={{ fontSize: "3em", marginBottom: 12 }}>🎉</div>
        <div style={S.logo}>Pré-reserva confirmada!</div>
        <p style={{ color: "#888", fontSize: "0.9em", lineHeight: 1.6, marginTop: 12 }}>
          Vamos contactar-te assim que o app estiver disponível com o teu preço especial.
        </p>
      </div>
    </div>
  );

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={{ fontSize: "2.5em", marginBottom: 12 }}>⏰</div>
        <div style={{ ...S.logo, marginBottom: 8 }}>O teu teste de 14 dias terminou</div>
        <p style={{ color: "#888", fontSize: "0.88em", lineHeight: 1.6, marginBottom: 24 }}>
          Esperamos que tenhas descoberto o valor de saber exactamente quanto podes gastar por dia.<br /><br />
          Faz a pré-reserva e garante acesso quando o app lançar — com preço de fundador.
        </p>
        <div style={S.field}>
          <label style={S.label}>O TEU E-MAIL OU TELEMÓVEL</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="+244 9XX XXX XXX ou email@gmail.com"
            style={S.dateInput} />
        </div>
        <button disabled={!email.trim()} onClick={() => { onReservar(email); setDone(true); }}
          style={{ ...S.btn, opacity: email.trim() ? 1 : 0.4 }}>
          Garantir o meu lugar 🚀
        </button>
        <div style={{ textAlign: "center", fontSize: "0.75em", color: "#333", marginTop: 16 }}>
          Sem spam. Apenas o contacto de lançamento.
        </div>
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
            color: active === t.id ? "#F59E0B" : "#444",
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

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const TRIAL_DAYS = 14;
const BANNER_FROM_DAY = 4; // show banner starting day 4

const INIT = {
  setup: false,
  salario: 0,
  dataRecebimento: todayStr(),
  proximoPagamento: addMonths(todayStr(), 1),
  pct: { ...DEFAULT_PCT },
  despesas: [],
  objectivos: [],        // list of savings goals
  setupDate: null,
  reservas: [],
  bannerDismissed: false,
};

export default function App() {
  const [state, setState] = useState(INIT);
  const [screen, setScreen] = useState("setup");
  const [showBanner, setShowBanner] = useState(false);

  // Trial day calculation (uses daysSince helper)
  const trialDaysUsed = state.setupDate ? daysSince(state.setupDate) : 0;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  const trialExpired = state.setup && trialDaysUsed >= TRIAL_DAYS;
  const showBannerEligible = state.setup && trialDaysUsed >= BANNER_FROM_DAY && !trialExpired;

  const handleSetupDone = (data) => {
    setState(prev => ({ ...prev, ...data, setup: true, setupDate: todayStr() }));
    setScreen("validation");
  };

  const handleSettingsSave = (data) => {
    setState(prev => ({ ...prev, ...data }));
    setScreen("dashboard");
  };

  const handleAddExpense = (expense) => {
    setState(prev => ({ ...prev, despesas: [...prev.despesas, expense] }));
    if (showBannerEligible) setShowBanner(true);
    setScreen("dashboard");
  };

  const handleSaveGoal = (goal) => {
    setState(prev => ({ ...prev, objectivos: [...(prev.objectivos || []), goal] }));
  };

  const handleDeleteGoal = (id) => {
    setState(prev => ({ ...prev, objectivos: (prev.objectivos || []).filter(g => g.id !== id) }));
  };

  const handleReservar = (email) => {
    setState(prev => ({ ...prev, reservas: [...prev.reservas, { email, date: todayStr() }] }));
  };

  // If trial expired, show expired screen
  if (trialExpired && screen !== "setup" && screen !== "validation") {
    return (
      <div style={S.app}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input { -webkit-appearance: none; }
          @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <TrialExpiredScreen onReservar={handleReservar} />
      </div>
    );
  }

  // Which tabs show the bottom nav
  const showNav = ["dashboard","goals","settings","charts","chat"].includes(screen);
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
      {screen === "validation" && <ValidationScreen onDone={() => setScreen("dashboard")} />}
      {screen === "dashboard"  && (
        <>
          <DashboardScreen
            state={state}
            onAddExpense={() => setScreen("add")}
            onOpenChat={() => setScreen("chat")}
            onOpenCharts={() => setScreen("charts")}
            onOpenGoals={() => setScreen("goals")}
            onSettings={() => setScreen("settings")}
          />
          {/* Trial countdown chip always visible from day 4 */}
          {showBannerEligible && (
            <div style={{ padding: "0 16px 8px", marginTop: -8 }}>
              <div style={{ fontSize: "0.72em", color: trialDaysLeft <= 2 ? "#EF4444" : "#555", textAlign: "center" }}>
                {trialDaysLeft <= 2
                  ? `⏳ Teste termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""}`
                  : `⏱ Versão de teste — ${trialDaysLeft} dias restantes`}
              </div>
            </div>
          )}
          {/* Banner — appears after first expense post day 4, closeable until urgent */}
          {showBanner && showBannerEligible && (
            <PreReservaBanner
              diasTrial={trialDaysLeft}
              onReservar={handleReservar}
              onFechar={() => setShowBanner(false)}
            />
          )}
        </>
      )}
      {screen === "settings"   && <SettingsScreen state={state} onSave={handleSettingsSave} onBack={() => setScreen("dashboard")} />}
      {screen === "add"        && <AddExpenseScreen onSave={handleAddExpense} onBack={() => setScreen("dashboard")}
                                    despesasAnteriores={state.despesas}
                                    saldoRestante={state.salario - state.despesas.reduce((s,d) => s+d.valor, 0)} />}
      {screen === "goals"      && <GoalsScreen state={state} onBack={() => setScreen("dashboard")} onSaveGoal={handleSaveGoal} onDeleteGoal={handleDeleteGoal} />}
      {screen === "charts"     && <ChartsScreen state={state} onBack={() => setScreen("dashboard")} />}
      {screen === "chat"       && <ChatScreen state={state} onBack={() => setScreen("dashboard")} />}

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

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#080808", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#E8E0D0", maxWidth: 480, margin: "0 auto" },
  screen: { minHeight: "100vh", overflowY: "auto", paddingBottom: 100, animation: "slideUp 0.25s ease" },

  // Setup
  setup: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "linear-gradient(160deg,#0A0A0A 60%,#12100A)" },
  setupCard: { width: "100%", maxWidth: 400, background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 24, padding: "32px 24px" },
  logo: { fontSize: "1.25em", fontWeight: 800, color: "#F59E0B", marginBottom: 20, letterSpacing: "-0.02em" },
  stepDots: { display: "flex", gap: 6, marginBottom: 24, alignItems: "center" },
  setupTitle: { fontSize: "1.25em", fontWeight: 700, color: "#F0ECE4", lineHeight: 1.3, marginBottom: 6 },
  setupSub: { fontSize: "0.85em", color: "#666", lineHeight: 1.5 },
  inputGroup: { display: "flex", alignItems: "center", gap: 10, background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "10px 16px", marginTop: 8 },
  currency: { fontSize: "1.1em", color: "#F59E0B", fontWeight: 700 },
  bigInput: { flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "1.8em", fontWeight: 800, color: "#F0ECE4", fontFamily: "inherit", width: "100%" },
  dateInput: { width: "100%", background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "14px 16px", color: "#F0ECE4", fontSize: "0.95em", fontFamily: "inherit", outline: "none", marginTop: 4 },
  dateTip: { fontSize: "0.78em", color: "#555", marginTop: 10, textAlign: "center" },
  preview: { marginTop: 18, display: "flex", flexDirection: "column", gap: 10 },
  previewRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88em" },
  btn: { width: "100%", background: "#F59E0B", border: "none", borderRadius: 14, padding: "15px", color: "#000", fontSize: "0.95em", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  backBtnSetup: { background: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 14, padding: "15px 18px", color: "#888", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: "0.9em" },

  // Validation
  valQuestion: { marginBottom: 20 },
  valQ: { fontSize: "0.9em", color: "#CCC", lineHeight: 1.5, marginBottom: 10 },
  valOptions: { display: "flex", flexDirection: "column", gap: 8 },
  valOption: { background: "#0A0A0A", border: "1px solid #1E1E1E", borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88em", textAlign: "left", transition: "all 0.2s" },
  valLabel: { fontSize: "0.75em", fontWeight: 700, letterSpacing: "0.08em", color: "#555", display: "block", marginBottom: 4 },

  // Dashboard
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 10px" },
  headerSub: { fontSize: "0.7em", color: "#3A3A3A", marginTop: 2 },
  iconBtn: { background: "transparent", border: "1px solid #1E1E1E", borderRadius: 10, padding: "8px 12px", color: "#555", cursor: "pointer", fontSize: "0.9em" },
  heroCard: { margin: "0 16px 18px", background: "linear-gradient(135deg,#1C1400,#0F0C00)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "24px 22px" },
  heroLabel: { fontSize: "0.65em", fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B", marginBottom: 6 },
  heroAmount: { fontSize: "2.4em", fontWeight: 800, color: "#F59E0B", letterSpacing: "-0.02em", lineHeight: 1 },
  heroSub: { fontSize: "0.8em", color: "#7A6A40", marginTop: 5 },
  heroDivider: { height: 1, background: "rgba(245,158,11,0.1)", margin: "18px 0" },
  heroRow: { display: "flex", justifyContent: "space-between" },
  heroSmallLabel: { fontSize: "0.68em", color: "#5A4A30", marginBottom: 3 },
  heroSmall: { fontSize: "0.95em", fontWeight: 700, color: "#C8A040" },
  sectionTitle: { fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#3A3A3A", padding: "0 20px", marginBottom: 10 },
  categoryList: { display: "flex", flexDirection: "column", gap: 10, padding: "0 16px", marginBottom: 18 },
  categoryCard: { background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 14, padding: "14px" },
  catHeader: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  catEmoji: { fontSize: "1.4em", lineHeight: 1 },
  catName: { fontSize: "0.88em", fontWeight: 700, color: "#DDD", marginBottom: 2 },
  catDesc: { fontSize: "0.7em", color: "#555" },
  catLimit: { fontSize: "0.7em", color: "#444", marginTop: 2 },
  barBg: { height: 5, background: "#1A1A1A", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  overAlert: { fontSize: "0.72em", color: "#EF4444", marginTop: 7, fontWeight: 600 },
  expenseList: { padding: "0 16px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 },
  expenseRow: { display: "flex", alignItems: "center", gap: 10, background: "#0F0F0F", border: "1px solid #1A1A1A", borderRadius: 12, padding: "11px 14px" },
  expEmoji: { fontSize: "1.2em" },
  expDesc: { fontSize: "0.88em", fontWeight: 600, color: "#DDD" },
  expDate: { fontSize: "0.7em", color: "#555", marginTop: 2 },
  actions: { display: "flex", gap: 10, padding: "0 16px" },
  addBtn: { flex: 1, background: "#F59E0B", border: "none", borderRadius: 14, padding: "15px", color: "#000", fontWeight: 700, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit" },
  chatBtn: { background: "#0F0F0F", border: "1px solid #2A2A2A", borderRadius: 14, padding: "15px 18px", color: "#DDD", fontWeight: 600, fontSize: "0.92em", cursor: "pointer", fontFamily: "inherit" },

  // Shared
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 14px" },
  backBtn: { background: "transparent", border: "1px solid #1E1E1E", borderRadius: 10, padding: "8px 14px", color: "#777", cursor: "pointer", fontFamily: "inherit", fontSize: "0.84em" },
  screenTitle: { fontSize: "0.95em", fontWeight: 700, color: "#DDD" },
  field: { marginBottom: 18 },
  label: { fontSize: "0.7em", fontWeight: 700, letterSpacing: "0.08em", color: "#555", marginBottom: 6, display: "block" },
  input: { width: "100%", background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 12, padding: "13px 16px", color: "#E8E0D0", fontSize: "0.95em", fontFamily: "inherit", outline: "none" },
  inputPrefix: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#F59E0B", fontWeight: 700 },
  aiAvatar: { width: 32, height: 32, background: "linear-gradient(135deg,#F59E0B,#92640A)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9em", flexShrink: 0, marginRight: 8, marginTop: 2 },
};
