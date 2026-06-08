# 💰 Minhas Finanças — Guia para o Developer

## O que é este projecto
App de gestão financeira pessoal para o mercado angolano.
Modelo 60/30/10 (personalizável), cálculo de gasto diário seguro, assistente IA integrado.

---

## Estrutura de ficheiros

```
minhas-financas/
├── package.json          ← dependências do projecto
├── vercel.json           ← configuração de deploy na Vercel
├── public/
│   └── index.html        ← página base
└── src/
    ├── index.js          ← ponto de entrada React
    └── App.jsx           ← toda a aplicação (componentes + lógica)
```

---

## Como fazer o deploy na Vercel (passo a passo)

### 1. Instalar dependências localmente (para testar)
```bash
npm install
npm start
```
Abre http://localhost:3000 no browser para testar.

### 2. Criar conta na Vercel
- Vai a https://vercel.com
- Regista com GitHub (gratuito)

### 3. Colocar o código no GitHub
```bash
git init
git add .
git commit -m "Minhas Financas v1"
git remote add origin https://github.com/SEU_USER/minhas-financas.git
git push -u origin main
```

### 4. Deploy na Vercel
- Na Vercel, clica "Add New Project"
- Liga ao repositório GitHub criado acima
- Framework: Create React App (detecta automaticamente)
- Clica "Deploy"
- Em 2 minutos tens o link público, ex: `minhas-financas.vercel.app`

### 5. Domínio personalizado (opcional)
- Na Vercel → Settings → Domains
- Adiciona `minhasfinancas.ao` ou similar

---

## Variável de ambiente obrigatória

A app chama a API da Anthropic para o assistente IA.
O proxy já está configurado no Claude.ai para o protótipo,
mas para produção precisas de:

1. Criar conta em https://console.anthropic.com
2. Gerar uma API Key
3. Na Vercel → Settings → Environment Variables:
   ```
   REACT_APP_ANTHROPIC_KEY=sk-ant-...
   ```
4. No código (App.jsx), na função `askAI`, adicionar o header:
   ```js
   headers: {
     "Content-Type": "application/json",
     "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
     "anthropic-version": "2023-06-01"
   }
   ```

---

## Próximas funcionalidades a desenvolver (fase 2)

### Base de dados (Supabase — gratuito)
- Guardar despesas permanentemente (agora ficam só na sessão)
- Histórico de meses anteriores
- Manter dados após os 14 dias de teste

### Recolha de pré-reservas (Airtable ou Google Sheets)
- Quando o utilizador faz pré-reserva, o contacto deve ir para uma base de dados
- Usar a API do Airtable:
  ```js
  await fetch('https://api.airtable.com/v0/BASE_ID/Reservas', {
    method: 'POST',
    headers: { Authorization: 'Bearer AIRTABLE_KEY' },
    body: JSON.stringify({ fields: { Email: email, Data: new Date().toISOString() } })
  })
  ```

### Sincronização bancária (fase 3)
- Integração com API dos bancos angolanos (BAI, BFA, BIC, Atlantico)
- Importação automática de transacções

---

## Tecnologias usadas
- React 18 (frontend)
- Anthropic Claude API (assistente IA)
- CSS-in-JS inline styles (sem biblioteca externa de UI)
- Fontes: Plus Jakarta Sans (Google Fonts)

## Contacto do projecto
Protótipo criado para validação de mercado — versão de teste 14 dias.
