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
function AuthScreen({ onAuth }) {
  const [modo, setModo] = useState("inicio"); // inicio | criar | entrar | recuperar
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [erro, setErro] = useState("");
  const [recuperado, setRecuperado] = useState(false);

  // Identificador: aceita EMAIL ou TELEFONE (em Angola muitos não têm email).
  const val = email.trim();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  // Telefone angolano: 9 dígitos (ex: 9XXXXXXXX), com ou sem +244 / espaços
  const telLimpo = val.replace(/[\s\-()]/g, "").replace(/^\+?244/, "");
  const telValido = /^9\d{8}$/.test(telLimpo);
  const idValido = emailValido || telValido;
  const passValida = password.length >= 6;

  // [DEV] Ligar ao Supabase Auth: criar utilizador, validar login, recuperar acesso.
  //       Suportar DUAS vias de autenticação:
  //       - EMAIL:    supabase.auth.signUp / signInWithPassword / resetPasswordForEmail
  //       - TELEFONE: supabase.auth.signInWithOtp({ phone }) — envia código por SMS.
  //       Detetar qual foi usado (emailValido vs telValido) e chamar o método certo.
  //       NOTA: o SMS tem custo por envio — confirmar fornecedor de SMS no Supabase.
  const submeterCriar = () => {
    setErro("");
    if (!idValido) { setErro("Escreve um email ou número de telefone válido."); return; }
    if (!passValida) { setErro("A password precisa de pelo menos 6 caracteres."); return; }
    // [DEV] Se emailValido -> signUp({email,password}); se telValido -> signInWithOtp({phone})
    onAuth(val);
  };
  const submeterEntrar = () => {
    setErro("");
    if (!idValido || !passValida) { setErro("Verifica os teus dados e a password."); return; }
    // [DEV] Email -> signInWithPassword; Telefone -> verificar código SMS (OTP)
    onAuth(val);
  };
  const submeterRecuperar = () => {
    setErro("");
    if (!idValido) { setErro("Escreve o email ou telefone da tua conta."); return; }
    // [DEV] Email -> resetPasswordForEmail; Telefone -> enviar código de recuperação por SMS
    setRecuperado(true);
  };

  const campoEmail = (
    <div style={S.field}>
      <label style={S.label}>EMAIL OU TELEFONE</label>
      <input type="text" inputMode="text" autoCapitalize="none" value={email}
        onChange={e => setEmail(e.target.value)} placeholder="o.teu@email.com ou 9XX XXX XXX" style={S.input} />
      <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 6 }}>
        Podes usar o teu email ou o teu número de telefone.
      </div>
    </div>
  );
  const campoPass = (
    <div style={S.field}>
      <label style={S.label}>PALAVRA-PASSE</label>
      <div style={{ position: "relative" }}>
        <input type={showPass ? "text" : "password"} value={password}
          onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
          style={{ ...S.input, paddingRight: 70 }} />
        <button onClick={() => setShowPass(v => !v)}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.8em", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          {showPass ? "Esconder" : "Mostrar"}
        </button>
      </div>
    </div>
  );
  const msgErro = erro && (
    <div style={{ fontSize: "0.82em", color: "#EF4444", marginBottom: 12 }}>{erro}</div>
  );

  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <div style={S.logo}>☀️ Klaco</div>

        {modo === "inicio" && (
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

        {modo === "criar" && (
          <>
            <h2 style={S.setupTitle}>Cria a tua conta</h2>
            <p style={{ ...S.setupSub, marginBottom: 20 }}>É rápido. Só precisas de um email e uma palavra-passe.</p>
            {campoEmail}
            {campoPass}
            {msgErro}
            <button onClick={submeterCriar}
              style={{ ...S.btn, opacity: (idValido && passValida) ? 1 : 0.5, marginBottom: 12 }}>
              Criar conta
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

        {modo === "entrar" && (
          <>
            <h2 style={S.setupTitle}>Bem-vindo de volta</h2>
            <p style={{ ...S.setupSub, marginBottom: 20 }}>Entra na tua conta para continuar.</p>
            {campoEmail}
            {campoPass}
            {msgErro}
            <button onClick={submeterEntrar}
              style={{ ...S.btn, opacity: (idValido && passValida) ? 1 : 0.5, marginBottom: 10 }}>
              Entrar
            </button>
            <button onClick={() => { setModo("recuperar"); setErro(""); setRecuperado(false); }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#F59E0B", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit", marginBottom: 14, fontWeight: 600 }}>
              Esqueci-me da palavra-passe
            </button>
            <button onClick={() => { setModo("inicio"); setErro(""); }}
              style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
              ← Voltar
            </button>
          </>
        )}

        {modo === "recuperar" && (
          <>
            <h2 style={S.setupTitle}>Recuperar palavra-passe</h2>
            {recuperado ? (
              <>
                <p style={{ ...S.setupSub, marginBottom: 24, lineHeight: 1.6 }}>
                  🌅 Se existir uma conta com esse email, vais receber instruções para criar uma nova palavra-passe.
                </p>
                <button onClick={() => { setModo("entrar"); setRecuperado(false); }} style={S.btn}>Voltar a entrar</button>
              </>
            ) : (
              <>
                <p style={{ ...S.setupSub, marginBottom: 20 }}>Escreve o email da tua conta e enviamos-te instruções.</p>
                {campoEmail}
                {msgErro}
                <button onClick={submeterRecuperar}
                  style={{ ...S.btn, opacity: idValido ? 1 : 0.5, marginBottom: 14 }}>
                  Enviar instruções
                </button>
                <button onClick={() => { setModo("entrar"); setErro(""); }}
                  style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
                  ← Voltar
                </button>
              </>
            )}
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
                    🌅 Sempre que receberes, vamos perguntar-te quanto recebeste desta vez, para o teu número ficar certo.
                  </div>
                )}
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
              else {
                onComplete({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct: { ...DEFAULT_PCT }, semEntradaInicial, rendimentoVariavel, periodoSalarioConfirmado: dataRecebimento, despesas: [] });
              }
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
function DashboardScreen({ state, onAddExpense, onAddEntrada, onOpenCharts, onOpenGoals, onOpenConvite }) {
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
        {aguardaPrimeiroPagamento ? (
          <>
            <div style={{ ...S.heroLabel, color: "#F59E0B" }}>O TEU PRIMEIRO PAGAMENTO ESTÁ A CHEGAR</div>
            <div style={{ ...S.heroAmount, color: "#F59E0B", fontSize: "2.2em" }}>Em breve 🌅</div>
            <div style={{ ...S.heroSub, color: "#A08850", lineHeight: 1.5 }}>
              A partir de {dataPrimeiroFmt}, vais saber exactamente quanto podes gastar todos os dias.
            </div>
            <div style={S.heroDivider} />
            <div style={{ fontSize: "0.85em", color: "#8A8070", lineHeight: 1.5 }}>
              Faltam {diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}. Até lá, podes ir conhecendo a Klaco. 👇
            </div>
          </>
        ) : (
          <>
            <div style={{ ...S.heroLabel, color: heroPositive ? "#F59E0B" : "#EF4444" }}>
              {gastoDiario >= 0 ? "PODES GASTAR HOJE" : "LIMITE DIÁRIO EXCEDIDO"}
            </div>
            <button onClick={() => setShowComoCalcula(true)}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "block", width: "100%" }}>
              <div style={{ ...S.heroAmount, color: heroPositive ? "#F59E0B" : "#EF4444" }}>
                {gastoDiario >= 0 ? fmtKz(gastoDiario) : `−${fmtKz(Math.abs(gastoDiario))}`}
                <span style={{ fontSize: "0.35em", color: "#6A6050", marginLeft: 8, verticalAlign: "middle" }}>ⓘ</span>
              </div>
            </button>
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
          </>
        )}
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
                  {aguardaPrimeiroPagamento ? (
                    <div style={{ color: "#8A8070", fontWeight: 700, fontSize: "0.85em" }}>em breve</div>
                  ) : (
                    <>
                      <div style={{ color: over ? "#EF4444" : c.color, fontWeight: 700, fontSize: "0.9em" }}>
                        {fmtKz(gasto)}
                        {reservado > 0 && <span style={{ fontSize: "0.75em", color: "#F59E0B", display: "block" }}>+ {fmtKz(reservado)} obj.</span>}
                      </div>
                      <div style={S.catLimit}>/ {fmtKz(orc)} ({pct[c.id]}%)</div>
                    </>
                  )}
                </div>
              </div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${aguardaPrimeiroPagamento ? 0 : pctUsed}%`, background: over ? "#EF4444" : c.color }} />
              </div>
              {aguardaPrimeiroPagamento
                ? <div style={{ fontSize: "0.82em", color: "#8A8070", marginTop: 8, fontWeight: 600 }}>🌅 Em breve saberás</div>
                : over
                ? <div style={S.overAlert}>⚠️ Excedeste em {fmtKz(totalUsado - orc)}</div>
                : <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: "0.82em", color: "#22C55E", fontWeight: 600 }}>
                      ✓ {fmtKz(restante)} disponível
                    </span>
                    {diasRestantes > 0 && restante > 0 && (
                      <span style={{ fontSize: "0.75em", color: "#8A8070" }}>
                        hoje: {fmtKz(restante / diasRestantes)}
                      </span>
                    )}
                  </div>
              }
            </div>
          );
        })}
      </div>

      {/* Botão único com lista pendente: Despesa ou Entrada */}
      <div style={{ padding: "0 16px 100px" }}>
        {!showAddMenu ? (
          <button onClick={() => setShowAddMenu(true)} style={S.addBtn}>+ Adicionar</button>
        ) : (
          <div style={{ background: "#0D0D0D", border: "1px solid #F59E0B40", borderRadius: 14, overflow: "hidden", animation: "slideUp 0.2s ease" }}>
            <button onClick={() => { setShowAddMenu(false); onAddExpense(); }}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1A1A1A", padding: "16px", color: "#E8E0D0", fontWeight: 700, fontSize: "0.95em", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <span style={{ fontSize: "1.2em" }}>🛒</span> Novo registo (gasto ou investimento)
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
        <button onClick={onOpenCharts} style={{
          width: "100%", background: "transparent", border: "1px solid #1A1A1A",
          borderRadius: 12, padding: "12px", color: "#8A8070",
          fontSize: "0.82em", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginTop: 10,
        }}>
          📊 Ver gráficos
        </button>
      </div>

      {/* Modal: como é calculado o número */}
      {showComoCalcula && (
        <div onClick={() => setShowComoCalcula(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, animation: "slideUp 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 20, padding: "26px 22px" }}>
            <div style={{ fontSize: "1.6em", marginBottom: 10 }}>🌅</div>
            <div style={{ fontSize: "1.1em", fontWeight: 800, color: "#E8E0D0", marginBottom: 14 }}>Como calculamos o teu número</div>
            <p style={{ fontSize: "0.9em", color: "#C8C0B0", lineHeight: 1.65, marginBottom: 14 }}>
              Pegamos no que tens para este período, tiramos o que já gastaste, e dividimos pelos dias que faltam até ao próximo pagamento.
            </p>
            <div style={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 12, padding: "14px 16px", fontSize: "0.85em", color: "#A09880", lineHeight: 1.6, marginBottom: 16 }}>
              O que tens, menos o que já gastaste, a dividir pelos dias que faltam. É o que podes gastar hoje sem ficar sem nada.
            </div>
            <p style={{ fontSize: "0.88em", color: "#F59E0B", fontWeight: 600, lineHeight: 1.5, marginBottom: 18 }}>
              Quanto mais registas o que gastas, mais certo fica o teu número. 🌅
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
          Estas são as descrições que guardaste. Aparecem como sugestão quando lanças uma despesa, para não teres de escrever sempre o mesmo. 🏷️
        </p>
        {!temAlguma && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#6A6050" }}>
            <div style={{ fontSize: "2.5em", marginBottom: 12 }}>🏷️</div>
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
                <span style={{ fontSize: "1.1em" }}>{cat.emoji}</span>
                <span style={{ fontSize: "0.8em", fontWeight: 700, color: cat.color, letterSpacing: "0.04em" }}>{cat.label.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {lista.map((nome, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0F0F0F", border: "1px solid #1E1E1E", borderRadius: 20, padding: "8px 12px 8px 14px" }}>
                    <span style={{ fontSize: "0.85em", color: "#DDD" }}>{nome}</span>
                    <button onClick={() => onDelete(cat.id, nome)}
                      style={{ background: "transparent", border: "none", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontSize: "1em", padding: 0, lineHeight: 1 }}>
                      ✕
                    </button>
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

function SettingsScreen({ state, onToggleNotif, onBack, onEditarDados, onVerDespesas, onVerEntradas, onOpenConvite, onVerEtiquetas }) {
  // Número de WhatsApp da empresa
  const WHATSAPP_SUPORTE = "244923933353";
  const abrirSuporte = () => {
    const msg = encodeURIComponent("Olá! Preciso de ajuda com a Klaco: ");
    window.open(`https://wa.me/${WHATSAPP_SUPORTE}?text=${msg}`, "_blank");
  };

  const Opcao = ({ emoji, titulo, sub, onClick, cor = "#E8E0D0" }) => (
    <button onClick={onClick}
      style={{ width: "100%", background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14, textAlign: "left", marginBottom: 10 }}>
      <span style={{ fontSize: "1.4em" }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.95em", fontWeight: 700, color: cor }}>{titulo}</div>
        {sub && <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ color: "#6A6050", fontSize: "1.1em" }}>›</span>
    </button>
  );

  const Toggle = ({ emoji, titulo, sub, ativo, onToggle }) => (
    <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
          <span style={{ fontSize: "1.4em" }}>{emoji}</span>
          <div>
            <div style={{ fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" }}>{titulo}</div>
            <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        <button onClick={onToggle}
          style={{ width: 46, height: 28, borderRadius: 14, background: ativo ? "#F59E0B" : "#2A2A2A", position: "relative", cursor: "pointer", flexShrink: 0, border: "none", transition: "background 0.2s", padding: 0 }}>
          <div style={{ position: "absolute", top: 3, left: ativo ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: ativo ? "#000" : "#666", transition: "left 0.2s" }} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.screen}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={S.screenTitle}>Definições</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "0 16px" }}>
        <Opcao emoji="👤" titulo="Editar os meus dados" sub="Nome, rendimento, datas e percentagens" onClick={onEditarDados} />
        <Opcao emoji="🛒" titulo="Todas as despesas" sub="Ver, editar ou apagar" onClick={onVerDespesas} />
        <Opcao emoji="🏷️" titulo="As minhas etiquetas" sub="Descrições guardadas para lançar mais rápido" onClick={onVerEtiquetas} />
        <Opcao emoji="💰" titulo="Todas as entradas" sub="13º, bónus, subsídios e mais" onClick={onVerEntradas} />
        <Opcao emoji="🤝" titulo="Comunidade e convites" sub="Convida amigos para a Klaco" onClick={onOpenConvite} cor="#F59E0B" />
        <Opcao emoji="💬" titulo="Suporte e dúvidas" sub="Fala connosco no WhatsApp" onClick={abrirSuporte} cor="#22C55E" />

        {/* NOTIFICAÇÕES — dois consentimentos independentes */}
        <div style={{ fontSize: "0.72em", fontWeight: 700, letterSpacing: "0.08em", color: "#6A6050", margin: "18px 4px 10px" }}>NOTIFICAÇÕES</div>

        {/* [DEV] Cada interruptor reflecte o consentimento. O backend só envia cada tipo a quem tem o respectivo consentimento ligado. */}
        <Toggle
          emoji="🔔"
          titulo="Lembrete diário"
          sub="Saber quanto podes gastar hoje 🌅"
          ativo={state.notifLembrete}
          onToggle={() => onToggleNotif("notifLembrete")}
        />
        <Toggle
          emoji="📣"
          titulo="Novidades e promoções"
          sub="Ofertas e atualizações da Klaco"
          ativo={state.notifNovidades}
          onToggle={() => onToggleNotif("notifNovidades")}
        />
      </div>
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
    const digits = raw.replace(/\D/g, "");
    setSalario(digits);
    setSalarioDisplay(digits === "" ? "" : String(parseInt(digits,10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
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
                <span style={{ fontWeight: 600, fontSize: "0.9em", color: "#DDD" }}>{c.emoji} {c.label}</span>
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
            {totalPct === 100 ? "✓ 100% — perfeito!" : `Total: ${totalPct}%`}
          </div>
        </div>

        <button disabled={!valid} onClick={() => { onSave({ nome: nome.trim(), salario: sal, dataRecebimento, proximoPagamento, pct }); setGuardado(true); setTimeout(() => setGuardado(false), 2600); }}
          style={{ ...S.btn, opacity: valid ? 1 : 0.4, marginBottom: 12 }}>
          Guardar alterações
        </button>
        {guardado && (
          <div style={{ background: "#0A1A0A", border: "1px solid #22C55E40", borderRadius: 12, padding: "12px 16px", marginBottom: 20, animation: "slideUp 0.2s ease", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1em" }}>✓</span>
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
                <span style={{ fontSize: "1.4em" }}>{c.emoji}</span>
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

        {/* Guardar como etiqueta — só se a descrição for nova */}
        {descricaoNova && (
          <button onClick={() => setGuardarEtiqueta(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: guardarEtiqueta ? "#F59E0B15" : "#0A0A0A", border: `1px solid ${guardarEtiqueta ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", marginBottom: 16, textAlign: "left" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${guardarEtiqueta ? "#F59E0B" : "#444"}`, background: guardarEtiqueta ? "#F59E0B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {guardarEtiqueta && <span style={{ color: "#000", fontWeight: 800, fontSize: "0.7em" }}>✓</span>}
            </div>
            <span style={{ fontSize: "0.85em", color: "#C8C0B0" }}>🏷️ Guardar "{descricao.trim()}" para a próxima vez</span>
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
  const SUGESTOES_OBJ = [
    { nome: "Fundo de emergência", emoji: "🏥" },
    { nome: "Viagem", emoji: "✈️" },
    { nome: "Comprar carro", emoji: "🚗" },
    { nome: "Casa", emoji: "🏠" },
    { nome: "Estudos", emoji: "🎓" },
    { nome: "Casamento", emoji: "💍" },
    { nome: "Telemóvel", emoji: "📱" },
  ];

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
                        <div style={{ fontSize: "0.72em", color: "#8A8070", marginTop: 2 }}>
                          {cat?.emoji} {cat?.label}
                          {obj.acumulacaoAuto && <span style={{ color: "#22C55E", marginLeft: 6 }}>· 🔄 Automático</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => abrirEdicao(obj)}
                        style={{ background: "transparent", border: "none", color: "#8A8070", cursor: "pointer", fontSize: "0.95em", padding: "4px 6px" }}>✎</button>
                      <button onClick={() => onDeleteGoal(obj.id)}
                        style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "1em", padding: "4px 6px" }}>✕</button>
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
                          style={{ background: "transparent", border: "1px solid #222", borderRadius: 10, padding: "10px 12px", color: "#8A8070", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82em" }}>
                          ✕
                        </button>
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
                      🎉 Objectivo atingido!
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
              <label style={S.label}>SUGESTÕES</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGESTOES_OBJ.map(s => (
                  <button key={s.nome} onClick={() => { setNome(s.nome); setEmoji(s.emoji); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: nome === s.nome ? "#F59E0B20" : "#111", border: `1px solid ${nome === s.nome ? "#F59E0B" : "#222"}`, borderRadius: 20, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ fontSize: "0.95em" }}>{s.emoji}</span>
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
                    <span style={{ fontSize: "1.2em" }}>{c.emoji}</span>
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
                {acumulacaoAuto && <span style={{ color: "#000", fontWeight: 800, fontSize: "0.7em" }}>✓</span>}
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
  const { salario, despesas, pct, historicoPeriodos = [] } = state;
  const totalGasto = despesas.reduce((s, d) => s + d.valor, 0);
  const saldo = salario - totalGasto;

  // Per category totals
  const catTotals = CATS.map(c => ({
    ...c,
    gasto: despesas.filter(d => d.categoria === c.id).reduce((s, d) => s + d.valor, 0),
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
                  <span style={{ fontSize: "1.3em", flexShrink: 0 }}>{ins.emoji}</span>
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

// ── PRÉ-RESERVA BANNER (shown after saving expense from day 4 onwards) ─────────
// ── TRIAL EXPIRED SCREEN — Pagamento ─────────────────────────────────────────
function TrialExpiredScreen({ comprovativoEnviado, planoInicial, onComprovativo }) {
  // ── MODO TEMPORÁRIO (transferência por IBAN + comprovativo por WhatsApp) ──
  // [DEV] Quando o ProxyPay estiver activo, voltar ao pagamento automático por referência.
  const WHATSAPP = "244927677540";
  const BANCO = "BFA";
  const IBAN = "AO06.0006.0000.6680.4757.3011.9";
  const BENEFICIARIO = "SALO. TTF";

  const [etapa, setEtapa] = useState("escolha"); // escolha | pagamento
  const [plano, setPlano] = useState(planoInicial || "anual");
  const [copiado, setCopiado] = useState(false);

  const dados = plano === "anual"
    ? { valor: "5.000 Kz", periodo: "por ano", nome: "Anual" }
    : { valor: "500 Kz", periodo: "por mês", nome: "Mensal" };

  const copiarIban = () => {
    const limpo = IBAN.replace(/\./g, "");
    try { navigator.clipboard.writeText(limpo); } catch (e) {}
    setCopiado(true);
  };

  const abrirWhatsApp = () => {
    const msg = encodeURIComponent("Olá! Segue o comprovativo de pagamento 🙂");
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, "_blank");
  };

  const enviarComprovativo = () => {
    abrirWhatsApp();
    onComprovativo(plano); // marca na memória que já avançou para o envio
  };

  // ── ECRÃ DE ESPERA — depois de enviar o comprovativo (com saída) ──
  if (comprovativoEnviado) {
    return (
      <div style={S.setup}>
        <div style={S.setupCard}>
          <div style={{ fontSize: "3em", marginBottom: 16, textAlign: "center" }}>🌅</div>
          <div style={{ ...S.logo, marginBottom: 12, textAlign: "center" }}>Estamos a confirmar</div>
          <p style={{ color: "#C8C0B0", fontSize: "0.95em", lineHeight: 1.7, textAlign: "center", marginBottom: 20 }}>
            Recebemos o teu pedido. Assim que confirmarmos o teu comprovativo, ativamos o teu acesso — e avisamos-te pelo WhatsApp. 🙂
          </p>
          <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 14, padding: "16px 18px", fontSize: "0.86em", color: "#A09880", lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
            Ainda não enviaste o comprovativo no WhatsApp? Abre a conversa e anexa-o, para ativarmos o teu acesso.
          </div>
          <button onClick={abrirWhatsApp}
            style={{ width: "100%", background: "#25D366", border: "none", borderRadius: 14, padding: "16px", color: "#000", fontWeight: 800, fontSize: "0.98em", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
            Abrir o WhatsApp
          </button>
          <button onClick={() => { onComprovativo(null); setEtapa("escolha"); }}
            style={{ width: "100%", background: "transparent", border: "none", color: "#8A8070", fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit" }}>
            Ainda não paguei / mudar de plano
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
          <div style={{ fontSize: "2.5em", marginBottom: 12 }}>🔓</div>
          <div style={{ ...S.logo, marginBottom: 8 }}>Os teus 14 dias gratuitos acabaram</div>
          <p style={{ color: "#A09880", fontSize: "0.92em", lineHeight: 1.6, marginBottom: 22 }}>
            Já sabes o que é abrir o telemóvel e saber exactamente quanto podes gastar hoje. Continua a gastar sem culpa.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <button onClick={() => setPlano("anual")}
              style={{ position: "relative", textAlign: "left", background: plano === "anual" ? "#F59E0B12" : "#0A0A0A", border: `2px solid ${plano === "anual" ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ position: "absolute", top: -10, right: 16, background: "#F59E0B", color: "#000", fontSize: "0.68em", fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>2 MESES GRÁTIS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${plano === "anual" ? "#F59E0B" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {plano === "anual" && <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.95em", fontWeight: 800, color: "#E8E0D0" }}>Anual</div>
                  <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>
                    <span style={{ textDecoration: "line-through" }}>6.000 Kz</span> &nbsp;5.000 Kz por ano
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
                  <div style={{ fontSize: "0.78em", color: "#8A8070", marginTop: 2 }}>500 Kz por mês</div>
                </div>
              </div>
            </button>
          </div>

          <button onClick={() => { setCopiado(false); setEtapa("pagamento"); }} style={S.btn}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ── PÁGINA 2 — PAGAMENTO ──
  return (
    <div style={S.setup}>
      <div style={S.setupCard}>
        <button onClick={() => setEtapa("escolha")}
          style={{ background: "transparent", border: "none", color: "#8A8070", fontSize: "0.88em", cursor: "pointer", fontFamily: "inherit", marginBottom: 16, padding: 0 }}>
          ‹ Mudar de plano
        </button>

        <div style={{ ...S.logo, marginBottom: 4, fontSize: "1.1em" }}>Plano {dados.nome}</div>
        <p style={{ color: "#A09880", fontSize: "0.88em", marginBottom: 20 }}>
          Faz a transferência e envia-nos o comprovativo. 🌅
        </p>

        {/* Dados de transferência */}
        <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: 16, padding: "20px", marginBottom: 18 }}>
          <div style={{ fontSize: "0.78em", fontWeight: 700, letterSpacing: "0.08em", color: "#8A8070", marginBottom: 14 }}>
            FAZ A TRANSFERÊNCIA PARA
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Banco</span>
            <span style={{ color: "#E8E0D0", fontSize: "1em", fontWeight: 700 }}>{BANCO}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Beneficiário</span>
            <span style={{ color: "#E8E0D0", fontSize: "1em", fontWeight: 700 }}>{BENEFICIARIO}</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#8A8070", fontSize: "0.88em", marginBottom: 6 }}>IBAN</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#E8E0D0", fontSize: "0.92em", fontWeight: 700, fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}>{IBAN}</span>
              <button onClick={copiarIban}
                style={{ background: copiado ? "#22C55E" : "#F59E0B", border: "none", borderRadius: 8, padding: "6px 12px", color: "#000", fontWeight: 800, fontSize: "0.78em", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #1A1A1A" }}>
            <span style={{ color: "#8A8070", fontSize: "0.88em" }}>Valor a transferir</span>
            <span style={{ color: "#F59E0B", fontSize: "1.2em", fontWeight: 800 }}>{dados.valor} <span style={{ fontSize: "0.6em", color: "#8A8070", fontWeight: 600 }}>{dados.periodo}</span></span>
          </div>
        </div>

        {/* 3 passos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {[
            "Copia o IBAN e paga pela app do teu banco.",
            "Faz um print ou descarrega o comprovativo.",
            "Volta aqui e carrega no botão para enviar.",
          ].map((txt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F59E0B", color: "#000", fontWeight: 800, fontSize: "0.85em", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: "0.88em", color: "#C8C0B0", lineHeight: 1.4 }}>{txt}</span>
            </div>
          ))}
        </div>

        {/* Botão de enviar — só aparece depois de copiar o IBAN */}
        {copiado && (
          <button onClick={enviarComprovativo}
            style={{ width: "100%", background: "#25D366", border: "none", borderRadius: 14, padding: "16px", color: "#000", fontWeight: 800, fontSize: "0.98em", cursor: "pointer", fontFamily: "inherit", animation: "slideUp 0.3s ease" }}>
            Enviar comprovativo pelo WhatsApp
          </button>
        )}
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
  // [DEV] Substituir pelo domínio real da Klaco. O ?ref= identifica quem convidou,
  //       para creditar automaticamente 1 mês grátis quando o convidado subscrever.
  const link = `https://klaco.ao/entrar?ref=${inviteCode}`;
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

        {/* Recompensa — 1 mês grátis quando o amigo subscrever */}
        <div style={{
          background: "linear-gradient(135deg,#0A1A0A,#081208)",
          border: "1px solid #22C55E40",
          borderRadius: 16, padding: "18px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.6em" }}>🎁</span>
            <div style={{ fontSize: "1em", fontWeight: 800, color: "#22C55E" }}>Convida 1 amigo, ganha 1 mês grátis</div>
          </div>
          <div style={{ fontSize: "0.83em", color: "#A09880", lineHeight: 1.6 }}>
            Quando um amigo entra pelo teu convite e <strong style={{ color: "#C8C0B0" }}>paga a subscrição</strong>, ganhas <strong style={{ color: "#22C55E" }}>1 mês grátis</strong>. Aplicamos na tua próxima renovação. 🌅
          </div>
        </div>

        {/* O que partilhas */}
        <div style={{ fontSize: "0.68em", fontWeight: 700, letterSpacing: "0.1em", color: "#6A6050", marginBottom: 10 }}>
          A MENSAGEM QUE PARTILHAS
        </div>
        <div style={{
          background: "#0F0F0F", border: "1px solid #1E1E1E",
          borderRadius: 14, padding: "16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: "0.88em", color: "#A09880", lineHeight: 1.6 }}>
            "Descobri a Klaco — diz-me todos os dias quanto posso gastar, sem culpa. Entra pelo meu convite:"
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
  // [DEV] Substituir pelo domínio real da Klaco.
  const link = `https://klaco.ao/entrar?ref=${inviteCode}`;

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
        <div style={{ fontSize: "2em", marginBottom: 16, textAlign: "center" }}>🤝</div>
        <div style={{ fontSize: "1.2em", fontWeight: 800, color: "#E8E0D0", marginBottom: 10, lineHeight: 1.3 }}>
          Conheces alguém que precisava de saber isto?
        </div>
        <div style={{ fontSize: "0.92em", color: "#8A8070", lineHeight: 1.6, marginBottom: 16 }}>
          A maioria das pessoas não sabe quanto pode gastar hoje. Tu já sabes. Partilha com alguém que importa.
        </div>
        <div style={{ background: "#0A1A0A", border: "1px solid #22C55E30", borderRadius: 12, padding: "12px 14px", marginBottom: 24, fontSize: "0.82em", color: "#A09880", lineHeight: 1.5 }}>
          🎁 E quando essa pessoa subscrever, ganhas <strong style={{ color: "#22C55E" }}>1 mês grátis</strong>.
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
  const [valorDisplay, setValorDisplay] = useState(
    item.valor ? String(item.valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
  );
  const [data, setData] = useState(item.data || todayStr());
  const handleValor = (raw) => {
    const digits = raw.replace(/\D/g, "");
    setValor(digits);
    setValorDisplay(digits === "" ? "" : String(parseInt(digits,10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };
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

// ── CONSENTIMENTO DE NOTIFICAÇÕES (aparece uma vez, após o 1º número) ─────────
function ConfirmarSalarioModal({ salarioAnterior, onConfirmar }) {
  const [valor, setValor] = useState(String(salarioAnterior || ""));
  const [display, setDisplay] = useState(salarioAnterior ? String(salarioAnterior).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");
  const handleInput = (raw) => {
    const digits = raw.replace(/\D/g, "");
    setValor(digits);
    setDisplay(digits === "" ? "" : String(parseInt(digits, 10)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };
  return (
    <div style={S.modalOverlay}>
      <div style={S.modalCard}>
        <div style={{ fontSize: "2.2em", textAlign: "center", marginBottom: 12 }}>🌅</div>
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

function NotifConsentModal({ onGuardar }) {
  const [lembrete, setLembrete] = useState(false);
  const [novidades, setNovidades] = useState(false);

  const Check = ({ ativo }) => (
    <div style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${ativo ? "#F59E0B" : "#3A3A3A"}`, background: ativo ? "#F59E0B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
      {ativo && <span style={{ color: "#000", fontWeight: 800, fontSize: "0.85em" }}>✓</span>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 250, animation: "slideUp 0.3s ease" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#0D0D0D", border: "1px solid #1A1A1A", borderRadius: "24px 24px 0 0", padding: "28px 24px 36px" }}>
        <div style={{ fontSize: "1.6em", marginBottom: 8 }}>🌅</div>
        <div style={{ fontSize: "1.2em", fontWeight: 800, color: "#E8E0D0", marginBottom: 6 }}>Como queres que a Klaco fale contigo?</div>
        <p style={{ fontSize: "0.86em", color: "#8A8070", marginBottom: 22, lineHeight: 1.5 }}>
          Escolhe o que preferes receber. Podes mudar isto quando quiseres nas Definições.
        </p>

        <button onClick={() => setLembrete(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: lembrete ? "#F59E0B10" : "#0A0A0A", border: `1px solid ${lembrete ? "#F59E0B" : "#1E1E1E"}`, borderRadius: 14, padding: "16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 12 }}>
          <Check ativo={lembrete} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.95em", fontWeight: 700, color: "#E8E0D0" }}>Lembrete diário</div>
            <div style={{ fontSize: "0.8em", color: "#8A8070", marginTop: 2 }}>Saber quanto podes gastar hoje 🌅</div>
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
        <p style={{ fontSize: "0.74em", color: "#6A6050", textAlign: "center", marginTop: 12, lineHeight: 1.4 }}>
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
  comprovativoEnviado: false, // pagamento: já abriu o WhatsApp para enviar o comprovativo?
  etiquetasCustom: {}, // descrições personalizadas por categoria: { necessidades: ["..."], ... }
  planoEscolhido: "anual",    // plano que escolheu no ecrã de pagamento
  rendimentoVariavel: false,  // true se o salário muda de mês para mês
  periodoSalarioConfirmado: null, // qual dataRecebimento já teve o salário confirmado
};

export default function App() {
  // Lê o estado guardado no aparelho (memória entre sessões no mesmo dispositivo).
  // [DEV] Para memória entre APARELHOS (login em qualquer telemóvel), ligar ao Supabase:
  //       ao entrar, carregar o estado do utilizador da base de dados em vez do localStorage.
  const carregarEstado = () => {
    try {
      const guardado = window.localStorage.getItem("klaco_state");
      if (guardado) return { ...INIT, ...JSON.parse(guardado) };
    } catch (e) {}
    return INIT;
  };

  const [state, setState] = useState(carregarEstado);
  const [screen, setScreen] = useState("auth");

  // Sempre que o estado muda, guarda no aparelho.
  // [DEV] Substituir/complementar por gravação no Supabase para sincronizar entre aparelhos.
  useEffect(() => {
    try {
      window.localStorage.setItem("klaco_state", JSON.stringify(state));
    } catch (e) {}
  }, [state]);

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

  // Trial day calculation (uses daysSince helper)
  const trialDaysUsed = state.setupDate ? daysSince(state.setupDate) : 0;
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  const trialExpired = state.setup && trialDaysUsed >= TRIAL_DAYS;

  const handleDispensarDica = () => {
    setState(prev => ({ ...prev, dicaRegistoMostrada: true }));
  };

  const handleComprovativoEnviado = (plano) => {
    // plano === null significa "ainda não paguei / mudar de plano" — volta ao ecrã de pagamento
    if (plano === null) {
      setState(prev => ({ ...prev, comprovativoEnviado: false }));
      return;
    }
    setState(prev => ({ ...prev, comprovativoEnviado: true, planoEscolhido: plano }));
  };

  const handleToggleNotif = (chave) => {
    setState(prev => ({ ...prev, [chave]: !prev[chave] }));
  };

  const handleNotifConsent = ({ lembrete, novidades }) => {
    setState(prev => ({ ...prev, notifLembrete: lembrete, notifNovidades: novidades, notifPerguntado: true }));
  };

  const handleAuth = (email) => {
    setState(prev => ({ ...prev, conta: true, email }));
    setScreen("setup");
  };

  const handleSetupDone = (data) => {
    setState(prev => ({ ...prev, ...data, setup: true, setupDate: todayStr() }));
    setScreen("dashboard");
  };

  const handleSettingsSave = (data) => {
    setState(prev => ({ ...prev, ...data }));
    setScreen("dashboard");
  };

  const handleAddExpense = (expense, guardarEtiqueta) => {
    const isPrimeiraDespesa = state.despesas.length === 0;
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
        <TrialExpiredScreen
          comprovativoEnviado={state.comprovativoEnviado}
          planoInicial={state.planoEscolhido}
          onComprovativo={handleComprovativoEnviado}
        />
      </div>
    );
  }

  // Which tabs show the bottom nav
  const showNav = ["dashboard","goals","settings","charts","convite","editarDados","todasDespesas","todasEntradas","addEntrada","etiquetas"].includes(screen);
  const navActive = ["goals","settings","editarDados","todasDespesas","todasEntradas","etiquetas"].includes(screen) ? "settings" : ["goals"].includes(screen) ? screen : "dashboard";

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
          />
          {/* Confirmação de rendimento — só para quem tem rendimento variável, quando muda o período */}
          {state.setup && state.rendimentoVariavel && state.periodoSalarioConfirmado !== state.dataRecebimento && (
            <ConfirmarSalarioModal salarioAnterior={state.salario} onConfirmar={handleConfirmarSalario} />
          )}
          {/* Cartão de consentimento de notificações — aparece uma vez */}
          {state.setup && !state.notifPerguntado && (
            <NotifConsentModal onGuardar={handleNotifConsent} />
          )}
          {/* Dica de registo — aparece no 2º/3º dia de uso, uma vez */}
          {state.setup && !state.dicaRegistoMostrada && trialDaysUsed >= 1 && trialDaysUsed <= 3 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ background: "#141000", border: "1px solid #2A2010", borderRadius: 14, padding: "16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: "1.3em" }}>🌅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.9em", fontWeight: 700, color: "#E8E0D0", marginBottom: 3 }}>Faz o teu número ficar mais certo</div>
                  <div style={{ fontSize: "0.82em", color: "#A09880", lineHeight: 1.5 }}>Sempre que gastas, regista. Quanto mais registas, mais real fica o que podes gastar.</div>
                </div>
                <button onClick={handleDispensarDica}
                  style={{ background: "transparent", border: "none", color: "#8A8070", cursor: "pointer", fontSize: "1.1em", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
          )}
          {/* Chip de contagem do teste — visível durante o trial */}
          {state.setup && !trialExpired && (
            <div style={{ padding: "0 16px 8px", marginTop: -8 }}>
              <div style={{ fontSize: "0.72em", color: trialDaysLeft <= 2 ? "#EF4444" : "#8A8070", textAlign: "center" }}>
                {trialDaysLeft <= 2
                  ? `⏳ Os teus 14 dias gratuitos terminam em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""}`
                  : `🌅 Período gratuito — ${trialDaysLeft} de 14 dias grátis restantes`}
              </div>
            </div>
          )}
        </>
      )}
      {screen === "settings"   && <SettingsScreen state={state} onToggleNotif={handleToggleNotif} onBack={() => setScreen("dashboard")} onEditarDados={() => setScreen("editarDados")} onVerDespesas={() => setScreen("todasDespesas")} onVerEntradas={() => setScreen("todasEntradas")} onOpenConvite={() => setScreen("convite")} onVerEtiquetas={() => setScreen("etiquetas")} />}
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
