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
  const [dataRecebimento, setDataRecebimento] = useState(todayStr());
  const [proximoPagamento, setProximoPagamento] = useState("");
  const [pct, setPct] = useState({ ...DEFAULT_PCT });

  // Auto-balance percentages: when one changes, spread remainder to others proportionally
  const handlePct = (id, raw) => {
    const val = Math.min(100, Math.max(0, parseInt(raw) || 0));
    const others = CATS.filter(c => c.id !== id);
    const used = val;
    const remaining = 100 - used;
    const otherSum = others.reduce((s, c) => s + pct[c.id], 0);
    const newPct = { ...pct, [id]: val };
    if (otherSum === 0) {
      const share = Math.floor(remaining / others.length);
      others.forEach((c, i) => {
        newPct[c.id] = i === others.length - 1 ? remaining - share * (others.length - 1) : share;
      });
    } else {
      others.forEach(c => {
        newPct[c.id] = Math.round((pct[c.id] / otherSum) * remaining);
      });
      // fix rounding
      const total = Object.values(newPct).reduce((a, b) => a + b, 0);
      if (total !== 100) newPct[others[others.length - 1].id] += 100 - total;
    }
    setPct(newPct);
  };

  const totalPct = Object.values(pct).reduce((a, b) => a + b, 0);
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
              type="number"
              value={salario}
              onChange={e => setSalario(e.target.value)}
              placeholder="0"
              style={S.bigInput}
            />
          </div>
          {sal > 0 && (
            <div style={{ textAlign: "center", margin: "8px 0 4px", fontSize: "0.82em", color: "#555", letterSpacing: "0.04em" }}>
              {fmtKz(sal)}
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
                    value={pct[c.id]}
                    onChange={e => handlePct(c.id, e.target.value)}
                    style={{ width: 52, background: "#111", border: `1px solid ${c.color}60`, borderRadius: 8, padding: "6px 8px", color: c.color, fontWeight: 800, fontSize: "1em", fontFamily: "inherit", outline: "none", textAlign: "center" }}
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
            textAlign: "center", fontSize: "0.82em", fontWeight: 700,
            color: totalPct === 100 ? "#22C55E" : "#EF4444",
            padding: "8px", borderRadius: 8,
            background: totalPct === 100 ? "#22C55E10" : "#EF444410",
          }}>
            {totalPct === 100 ? "✓ Total: 100% — perfeito!" : `Total: ${totalPct}% — faltam ${100 - totalPct}%`}
          </div>
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
function DashboardScreen({ state, onAddExpense, onOpenChat, onSettings }) {
  const { salario, dataRecebimento, proximoPagamento, despesas, pct } = state;

  // Period: dataRecebimento → proximoPagamento
  const diasRestantes = daysUntil(proximoPagamento);           // today → next payment
  const diasPassados = daysSince(dataRecebimento);              // last payment → today
  const diasPeriodo = diasRestantes + diasPassados;             // full period length

  const gastosPorCat = {};
  CATS.forEach(c => {
    gastosPorCat[c.id] = despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0);
  });
  const totalGasto = Object.values(gastosPorCat).reduce((a, b) => a + b, 0);

  // Daily rate based on FULL period (e.g. 100.000 Kz / 30 days = 3.333 Kz/day)
  const taxaDiaria = diasPeriodo > 0 ? salario / diasPeriodo : salario;

  // Budget allocated for remaining days
  const orcamentoRestante = taxaDiaria * diasRestantes;

  // Adjusted daily = (budget for remaining days - what was actually spent) / remaining days
  // Spend less → daily goes UP. Spend more → daily goes DOWN. Auto-redistributes.
  const saldoAjustado = orcamentoRestante - totalGasto;
  const gastoDiario = diasRestantes > 0 ? saldoAjustado / diasRestantes : saldoAjustado;

  // Saldo total disponível = full salary minus everything spent
  const saldo = salario - totalGasto;

  // Context: are we on track?
  const gastoEsperadoAteHoje = taxaDiaria * diasPassados;
  const acimaDoEsperado = totalGasto > gastoEsperadoAteHoje;
  const diferencaVsEsperado = Math.abs(totalGasto - gastoEsperadoAteHoje);

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
        <button onClick={onSettings} style={S.iconBtn}>⚙️</button>
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
            <div style={S.heroSmallLabel}>Saldo disponível</div>
            <div style={{ ...S.heroSmall, color: saldo >= 0 ? "#C8A040" : "#EF4444" }}>{fmtKz(saldo)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.heroSmallLabel}>Rendimento</div>
            <div style={S.heroSmall}>{fmtKz(salario)}</div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={S.sectionTitle}>DISTRIBUIÇÃO {Object.values(pct).join(" · ")}</div>
      <div style={S.categoryList}>
        {CATS.map(c => {
          const gasto = gastosPorCat[c.id];
          const orc = salario * pct[c.id] / 100;
          const pctUsed = orc > 0 ? Math.min(100, (gasto / orc) * 100) : 0;
          const over = gasto > orc;
          const restante = orc - gasto;
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
                  </div>
                  <div style={S.catLimit}>/ {fmtKz(orc)} ({pct[c.id]}%)</div>
                </div>
              </div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${pctUsed}%`, background: over ? "#EF4444" : c.color }} />
              </div>
              {over
                ? <div style={S.overAlert}>⚠️ Excedeste em {fmtKz(gasto - orc)}</div>
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

      <div style={S.actions}>
        <button onClick={onAddExpense} style={S.addBtn}>+ Registar despesa</button>
        <button onClick={onOpenChat} style={S.chatBtn}>💬 IA</button>
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

  const handlePct = (id, raw) => {
    const val = Math.min(100, Math.max(0, parseInt(raw) || 0));
    const others = CATS.filter(c => c.id !== id);
    const remaining = 100 - val;
    const otherSum = others.reduce((s, c) => s + pct[c.id], 0);
    const newPct = { ...pct, [id]: val };
    if (otherSum === 0) {
      const share = Math.floor(remaining / others.length);
      others.forEach((c, i) => { newPct[c.id] = i === others.length - 1 ? remaining - share * (others.length - 1) : share; });
    } else {
      others.forEach(c => { newPct[c.id] = Math.round((pct[c.id] / otherSum) * remaining); });
      const total = Object.values(newPct).reduce((a, b) => a + b, 0);
      if (total !== 100) newPct[others[others.length - 1].id] += 100 - total;
    }
    setPct(newPct);
  };

  const totalPct = Object.values(pct).reduce((a, b) => a + b, 0);
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

// ── ADD EXPENSE ───────────────────────────────────────────────────────────────
function AddExpenseScreen({ onSave, onBack }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("necessidades");
  const [data, setData] = useState(todayStr());

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Nova despesa</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={S.field}>
          <label style={S.label}>DESCRIÇÃO</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="ex: Mercado, Combustível, Netflix..." style={S.input} />
        </div>
        <div style={S.field}>
          <label style={S.label}>VALOR (Kz)</label>
          <div style={{ position: "relative" }}>
            <span style={S.inputPrefix}>Kz</span>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)}
              placeholder="0" style={{ ...S.input, paddingLeft: 44 }} />
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>CATEGORIA</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCategoria(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F0F0F", border: `1px solid ${categoria === c.id ? c.color : "#1E1E1E"}`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                <span style={{ fontSize: "1.3em" }}>{c.emoji}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.88em", color: categoria === c.id ? c.color : "#DDD" }}>{c.label}</div>
                  <div style={{ fontSize: "0.72em", color: "#555" }}>{c.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={S.field}>
          <label style={S.label}>DATA</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={S.dateInput} />
        </div>
        <button
          disabled={!descricao || !valor || parseFloat(valor) <= 0}
          onClick={() => onSave({ id: Date.now(), descricao, valor: parseFloat(valor), categoria, data })}
          style={{ ...S.btn, opacity: descricao && valor && parseFloat(valor) > 0 ? 1 : 0.4 }}>
          Guardar despesa
        </button>
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
  setupDate: null,       // date string when user first set up
  reservas: [],          // list of {email, date} pre-reservations
  bannerDismissed: false,// user closed banner (resets after each new expense)
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
    // Show banner after saving if eligible
    if (showBannerEligible) setShowBanner(true);
    setScreen("dashboard");
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
      {screen === "add"        && <AddExpenseScreen onSave={handleAddExpense} onBack={() => setScreen("dashboard")} />}
      {screen === "chat"       && <ChatScreen state={state} onBack={() => setScreen("dashboard")} />}
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
