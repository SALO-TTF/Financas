# Klaco — Guião para a reunião técnica com o banco

Objetivo do documento: ajudar a apresentar a arquitetura e o fluxo de pagamento ao banco.
Segue a ordem do diagrama (`Klaco-Arquitetura.png`). Cada secção tem **o que mostrar** e
**o que dizer**. No fim há respostas para as perguntas prováveis.

Regra geral: ser claro sobre o que já existe e o que depende desta integração. A
arquitetura está desenhada e a app funciona; a ligação ao gateway é o que se vem tratar.

---

## Abertura (30 segundos)

> "A Klaco é uma aplicação de finanças pessoais para o mercado angolano. Diz ao utilizador,
> todos os dias, quanto pode gastar sem comprometer o orçamento até ao próximo pagamento.
> Funciona por subscrição, e é aí que precisamos da integração de pagamentos convosco."

Mostrar: a app aberta (demo).

---

## 1. Demo do produto (2–3 min)

**Mostrar, por esta ordem:**
1. Entrada / conta.
2. O número do dia (quanto pode gastar hoje).
3. Registar uma despesa — o número ajusta-se.
4. Ir a **subscrever** → aparece o ecrã com os métodos de pagamento
   (Multicaixa Express, Referência, Débito direto).

**Dizer, ao chegar ao ecrã de pagamento:**
> "Este é o ponto exato onde a vossa solução entra. Hoje é uma demonstração visual; o que
> queremos é ligar estes métodos ao gateway, para o pagamento acontecer aqui dentro e o
> acesso ser ativado automaticamente."

---

## 2. Arquitetura — seguir o diagrama (3–4 min)

Mostrar `Klaco-Arquitetura.png` e percorrer as camadas:

**Desenvolvimento e distribuição**
> "O código está no GitHub e é publicado na Vercel, que serve a aplicação com HTTPS."

**Cliente (a app)**
> "A Klaco é uma aplicação web instalável (PWA) — corre no telemóvel do utilizador, sem
> depender de lojas de aplicações."

**Backend (Supabase)**
> "As contas, os dados e o estado das subscrições ficam no Supabase. É aqui que registamos
> se um utilizador está em período experimental ou é subscritor ativo."

**Pagamento (onde o banco entra)**
> "Quando o utilizador paga, a app inicia a cobrança no gateway — na prática, a AppyPay,
> com quem o BAI já tem convénio. Suportamos três métodos: Multicaixa Express via GPO/EMIS,
> Referência, e Débito direto. A ideia é dar flexibilidade — cada pessoa paga como preferir."

**A volta (webhook) — o ponto-chave**
> "Depois de o pagamento ser confirmado, o gateway envia-nos uma notificação automática
> (webhook). O nosso backend recebe-a e ativa o acesso do utilizador na hora, sem
> intervenção manual. Cada transação leva o identificador do utilizador, para ligarmos o
> pagamento à conta certa."

---

## 3. Onde entram Multicaixa Express, Referência, GPO e Débito direto

Se pedirem detalhe, explicar assim:
- **Multicaixa Express** — o utilizador confirma o pagamento na app MCX; processado via
  **GPO / EMIS**.
- **Referência** — geramos uma referência que o utilizador paga em ATM ou homebanking.
- **Débito direto** — débito autorizado diretamente da conta do utilizador.
- **GPO (EMIS)** — a infraestrutura da rede Multicaixa por onde as operações são
  processadas e liquidadas para a conta da empresa no BAI.

Mensagem a passar: **a app é agnóstica ao método** — encaminha para o gateway e reage à
confirmação. Adicionar ou remover métodos é configuração, não reconstrução.

---

## 4. Estado atual (ser transparente)

> "A arquitetura está desenhada e a aplicação está a funcionar. A base de dados e a lógica
> de ativação estão especificadas. O que falta — e é o motivo desta reunião — é ligar o
> gateway: precisamos das credenciais, do ambiente de testes, e do formato das
> notificações de confirmação. Com isso, ligamos os métodos e ativamos o fluxo automático."

Não afirmar que a integração já está a funcionar. A honestidade aqui passa credibilidade.

---

## 5. O que pedimos ao banco / AppyPay (fechar a reunião)

1. Suporte aos métodos: Multicaixa Express (GPO), Referência e, se possível, Débito direto.
2. **Webhook** de confirmação de pagamento — para ativação automática.
3. **Ambiente de testes (sandbox)** — para integrar e validar.
4. **Credenciais** e documentação técnica da API.
5. **Estrutura de custos** — por transação e eventuais custos fixos.

---

## Perguntas prováveis do banco — respostas preparadas

**"Onde recebem a confirmação do pagamento?"**
> "Temos uma função no backend (Supabase Edge Function) preparada para receber o webhook.
> Está pronta a apontar para o vosso endpoint; falta ligar às vossas credenciais e ao
> formato do payload."

**"Como associam o pagamento ao utilizador?"**
> "Enviamos um identificador da conta (referência do comerciante) no momento em que o
> pagamento é iniciado. Esse identificador volta na confirmação, e é assim que ativamos a
> conta certa."

**"Que volume esperam?"**
> "Estamos em fase de arranque / validação. O modelo é de subscrição mensal e anual."
> (Dar números realistas se os tiverem; não inflacionar.)

**"Têm sandbox / quando conseguem integrar?"**
> "Assim que tivermos credenciais e acesso ao sandbox, a integração do nosso lado é rápida
> — a estrutura já está preparada."

**"Qual a stack?"**
> "Frontend em React (PWA), publicado na Vercel. Backend no Supabase (base de dados, Auth,
> e Edge Functions para o webhook)."

**"É seguro?"**
> "Sim. HTTPS em toda a app. As chaves sensíveis vivem só no servidor. O webhook valida a
> assinatura do gateway antes de ativar qualquer acesso."

---

## Checklist para levar à reunião

- [ ] App a funcionar no telemóvel (demo), com uma conta de teste limpa.
- [ ] Diagrama de arquitetura (`Klaco-Arquitetura.png`) — impresso ou no ecrã.
- [ ] Documento de fluxo de pagamento (o que já foi enviado ao banco).
- [ ] Este guião.
- [ ] Anotar o que o banco pedir (credenciais, sandbox, custos, prazos).
