# Klaco — Guião para a reunião com o BAI

Material a apresentar: a **demo do produto** e a **arquitetura com os fluxos** (onde o
BAI Paga, as Referências e o GPO encaixam).

---

## O que levar
- Demo do produto: `klaco-demo.html` (abre no telemóvel/portátil, funciona offline).
- Diagrama da arquitetura: `Klaco-Arquitetura.png`.
- Este guião.

---

## 1. Abertura (1 min)

O que é a Klaco, numa frase: uma app de finanças pessoais que diz à pessoa, todos os
dias, quanto pode gastar sem ficar sem dinheiro até ao próximo pagamento. Mercado:
Angola. Moeda: Kwanzas.

O objetivo da reunião: definir a **integração do pagamento** — como o cliente paga a
subscrição dentro da app e como o acesso é ativado.

---

## 2. Demonstração do produto (3–5 min)

Mostrar no telemóvel:
- Criar conta e o número do dia ("quanto posso gastar hoje").
- Lançar uma despesa e ver o número ajustar-se.
- Chegar ao **ecrã de pagamento** — este é o ponto que liga ao banco. É aqui que o
  cliente escolhe o plano e paga.

Planos atuais: Mensal 1.000 Kz/mês · Anual 12.000 Kz/ano (com desconto no período de
teste). Estes valores são geridos pela Klaco; ao banco interessa o meio de cobrança.

---

## 3. Arquitetura e fluxos (5 min) — usar o diagrama

Percorrer o diagrama da esquerda para a direita:

**Cliente → App → Backend.** A app corre no telemóvel; o backend (Supabase) guarda as
contas e o estado de acesso de cada cliente.

**O gateway (centro): BAI Paga / AppyPay.** É o ponto de integração. Quando o cliente
paga, o gateway processa e **confirma automaticamente** à Klaco (por webhook), e a conta
é ativada sozinha — sem intervenção manual.

**Os três métodos (direita), onde o banco entra:**
- **BAI Paga** — pagamento direto pelo gateway do banco, confirmação imediata.
- **Referências** — o cliente paga em qualquer ATM ou homebanking, com uma referência
  gerada pela app.
- **GPO (Multicaixa Express)** — serviço da EMIS, o cliente confirma na app MCX Express.

**O fluxo (rodapé do diagrama):** cliente escolhe o plano → paga (BAI Paga / Referência /
GPO) → o gateway confirma → o webhook avisa a Klaco → a conta é ativada automaticamente.

---

## 4. O que precisamos do banco (pedido concreto)

- Ativar/confirmar o convénio com a **AppyPay** (o BAI já trabalha com a AppyPay).
- Credenciais e ambiente de testes (sandbox) para ligar o gateway.
- Confirmar quais métodos ficam disponíveis no arranque (BAI Paga, Referências, GPO).
- Requisitos e prazos da integração.

---

## 5. Estado atual (ser transparente)

- O produto está **funcional** e em testes com utilizadores.
- A arquitetura de pagamento está **desenhada**; a ligação automática (webhook +
  ativação) fica pronta assim que houver credenciais e sandbox — depende desta reunião.
- Enquanto o gateway não está ligado, a Klaco valida no mercado com um fluxo de
  pagamento assistido; a integração com o banco substitui-o pela ativação automática.

---

## 6. Respostas a perguntas prováveis

- **"Quem processa o pagamento?"** O gateway (BAI Paga / AppyPay). A Klaco não guarda
  dados de cartão nem movimenta dinheiro diretamente.
- **"Como sabem que o cliente pagou?"** O gateway confirma automaticamente por webhook;
  a app ativa a conta a partir dessa confirmação.
- **"Que dados são partilhados?"** O mínimo para identificar o pagamento (referência do
  pagamento, plano, valor). Sem dados sensíveis no lado do cliente.
- **"É seguro?"** O acesso de cada cliente é isolado (cada um só vê os seus dados). As
  operações sensíveis passam por um backend seguro, nunca pelo telemóvel.

---

## Identificação
Empresa: **JEZ CONSULTORIA SU LDA**
Contacto de integração: Jezreel Madiwano · jezreel.madiwano@salotf.com · +244 926 778 213
