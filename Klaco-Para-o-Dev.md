# Klaco — O que falta ligar no backend

Este documento junta **tudo o que precisa de ser feito pelo programador** — as partes
que dependem de servidor (Supabase), do gateway de pagamento, ou de envio de SMS, e que
não podem viver só no interface (App.jsx).

O interface (App.jsx) já está construído e funcional. Em cada ponto abaixo, procura o
marcador `[DEV]` no código para veres o sítio exato onde ligar.

---

## 1. Autenticação (Supabase Auth) — App.jsx ~linha 126

O ecrã de entrada aceita **email OU número de telefone** (em Angola muitos não têm email).
O código já deteta qual foi usado (`emailValido` vs `telValido`).

A ligar:
- **Email:** `supabase.auth.signUp({ email, password })`, `signInWithPassword`, `resetPasswordForEmail`.
- **Telefone:** `supabase.auth.signInWithOtp({ phone })` — envia código por SMS; depois `verifyOtp`.
  - Recuperação de acesso por telefone = novo código SMS.
  - **Atenção:** o SMS tem custo por envio. Confirmar fornecedor de SMS configurado no Supabase.
- Normalizar o telefone para formato internacional (+244XXXXXXXXX) antes de enviar.

## 2. Guardar e sincronizar os dados do utilizador (Supabase) — App.jsx ~linha 2462

Hoje o estado é guardado no localStorage (só funciona no mesmo aparelho).
Para funcionar em **qualquer aparelho** onde a pessoa faça login:
- Ao entrar, carregar o estado do utilizador da base de dados (em vez de/complementar o localStorage).
- Sempre que o estado muda, gravar no Supabase.
- Isto cobre: dados do perfil, despesas, entradas, objectivos, etiquetas, consentimentos, etc.

## 3. Pagamento por referência / gateway — App.jsx ~linha 1666

O ecrã de pagamento está em **modo temporário** (transferência por IBAN + comprovativo por WhatsApp),
com activação manual. Quando o gateway estiver activo (decisão actual: **AppyPay** no arranque,
migrar para **Kyami** com escala):
- Gerar referência de pagamento para cada plano (mensal 500 Kz / anual 5.000 Kz).
- **Webhook** que recebe a confirmação do pagamento e **reactiva o acesso automaticamente**.
- Voltar a activar o ecrã de pagamento automático (substituir o fluxo IBAN/WhatsApp).
- Cobrir os métodos: Multicaixa Express, referência (qualquer banco/ATM), Unitel Money.

## 4. Notificações push — App.jsx ~linha 829

Só enviar a quem deu consentimento. Há **dois consentimentos independentes** no estado:
- `notifLembrete` — lembrete diário.
- `notifNovidades` — novidades e promoções.
- O backend só deve enviar cada tipo a quem tem o respectivo consentimento a `true`.

## 5. Sistema de convites "Convida e ganha" — App.jsx ~linha 1890

O interface já mostra a recompensa ("Convida 1 amigo, ganha 1 mês grátis quando ele pagar")
e gera o link com `?ref=CODIGO`. Falta a automação:
- Link único por utilizador (o `?ref=` identifica quem convidou). Substituir o domínio
  `klaco.ao` pelo domínio real.
- Ao criar conta, ler o `?ref=` do link e registar quem convidou quem.
- **Detectar quando o convidado PAGA** (via webhook do gateway) — só aí a recompensa conta.
- Creditar **1 mês grátis** ao convidador.
- Aplicar esse mês grátis na **próxima renovação** do convidador (mensal ou anual).
- Contar quantos cada utilizador trouxe (para o `inviteCount`).

## 6. Rastreio de convites do influencer (manual por agora)

Modelo actual: o código/link do influencer dá **30 dias grátis** ao público dele (em vez dos 14).
Sem comissão por agora (barganha = estatuto/fidelização). Medir quantos vieram por ele:
- Por agora é manual (via WhatsApp / código).
- Com backend: associar um código de influencer e contar quantos pagaram por esse código.

## 7. Publicidade — rastreio de cliques (fase de escala)

Quando houver publicidade (patrocínio fixo, não CPM), medir **dentro da app**:
- Registar cada clique num anúncio (guardar no Supabase).
- Painel simples por anunciante: quantas pessoas viram, quantas clicaram.
- Isto dá ao Klaco o controlo da medição (não depender do anunciante reportar).

## 8. Histórico de períodos (para os padrões de comportamento) — ChartsScreen

O ecrã de análise mostra padrões de gasto. O insight "comparação com o período anterior"
precisa que o backend **guarde o resumo de cada período fechado** (`historicoPeriodos`):
- Ao fechar um período (novo pagamento), guardar `{ totalGasto, data }`.
- O interface já usa `historicoPeriodos` se existir.

## 9. Rendimento variável — já preparado no interface

Para quem marca "rendimento varia todos os meses", a app mostra um modal a pedir o valor
quando muda o período (`ConfirmarSalarioModal`). Isto usa `periodoSalarioConfirmado` vs
`dataRecebimento`. Com o backend, garantir que a detecção de "novo período" é fiável
(actualizar `dataRecebimento`/`proximoPagamento` quando o período roda).

---

## Roadmap pós-validação (funcionalidades futuras, ainda NÃO construídas)

- **Registo por áudio:** a pessoa fala ("saída com amigos, 10 mil") e a app transcreve,
  categoriza e insere. Precisa de IA (transcrição + interpretação) — tem custo por uso.
  Colocado no roadmap pós-validação.

---

## Notas de contexto importantes

- **Preço:** mensal 500 Kz, anual 5.000 Kz ("2 meses grátis"). 14 dias grátis de teste.
- **Gateway:** decisão actual = AppyPay no arranque (sem custo fixo), migrar para Kyami
  quando houver ~140+ subscritores mensais (onde o custo fixo do Kyami compensa).
- **Dados de pagamento manual (temporário):** BFA, IBAN AO06.0006.0000.6680.4757.3011.9,
  beneficiário SALO. TTF, comprovativo por WhatsApp +244 927 677 540.
- **Entidade legal:** a preencher quando a empresa estiver constituída.
- **Memória:** o interface funciona no aparelho (localStorage). No ambiente de pré-visualização
  a memória não persiste — testar sempre no ambiente real (Vercel).
