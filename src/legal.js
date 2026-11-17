// ── Textos legais da Klaco (versão 1.0) ────────────────────────────────────────
// FONTE OFICIAL: PDF "Klaco — Termos de Uso, Reembolso e Segurança" (7 páginas). Transcrição fiel:
// o texto, os prazos, os contactos, a numeração e os campos entre parênteses rectos estão como no PDF
// (verificado frase a frase). Única diferença: o ponto "Não damos aconselhamento financeiro." na
// secção 2 dos Termos, acrescentado pela cliente em 16/11/2026 e incluído também no PDF actualizado.
//
// • **texto** → negrito (como no PDF).
// • [texto] → campo pendente de confirmação, mostrado tal como está no PDF. Lista em LEGAL_PENDENTES.
// • Para mudar um texto: actualizar primeiro o PDF oficial e depois este ficheiro. Uma mudança relevante
//   obriga a mudar LEGAL_VERSAO e a acrescentar a versão em public.termos_versoes (SQL dos termos).

export const LEGAL_VERSAO = "1.0";

export const DOCS_LEGAIS = {
  "termos": {
    "id": "termos",
    "titulo": "Termos de Uso",
    "intro": "Estes termos explicam como podes usar a Klaco e o que podemos esperar uns dos outros. Ao criares a tua conta, aceitas estes termos.",
    "versaoTexto": "Versão 1.0 · em vigor desde [data de publicação]",
    "seccoes": [
      {
        "t": "1. Quem somos",
        "blocos": [
          {
            "p": "A Klaco é uma aplicação, fornecida pela **JEZ CONSULTORIA, (SU), LDA**, NIF 5003294706, com sede em RUA LOPEZ DE LIMA - BAIRRO INGOMBOTA, TORRE DO CARMO, Município: INGOMBOTA, Luanda, Angola."
          },
          {
            "l": [
              "WhatsApp: 952 272 299",
              "Problemas técnicos: suporte@klaco.app",
              "Pagamentos e comprovativos: invoice@klaco.app",
              "Sugestões, elogios e assuntos comerciais: comercial@klaco.app"
            ]
          }
        ]
      },
      {
        "t": "2. O que a Klaco é e o que não é",
        "blocos": [
          {
            "p": "A Klaco ajuda-te a saber quanto podes gastar por dia até ao teu próximo pagamento, com base no teu rendimento, nas datas e nos gastos e entradas que registas."
          },
          {
            "l": [
              "O número “Podes gastar hoje” é uma estimativa. Depende do que registas.",
              "A Klaco não é um banco nem uma instituição financeira. Não tocamos no teu dinheiro e não nos ligamos à tua conta bancária. Os valores regista-os tu.",
              "Não damos conselhos de investimento. “Investimento” é só uma parte da divisão do teu orçamento.",
              "**Não damos aconselhamento financeiro.** Não fazemos recomendações personalizadas de investimento, crédito, seguros, impostos ou assuntos jurídicos, nem te dizemos que produtos financeiros escolher. Os números e as sugestões da app servem só para te ajudar a organizar o teu orçamento. Para decisões financeiras importantes, fala com um profissional habilitado.",
              "As decisões sobre o teu dinheiro são tuas."
            ]
          }
        ]
      },
      {
        "t": "3. A tua conta",
        "blocos": [
          {
            "l": [
              "A Klaco é para maiores de 18 anos.",
              "Entras com o teu e-mail ou telefone e um código de confirmação. Depois defines um PIN de 4 dígitos.",
              "Dá-nos dados verdadeiros e mantém-nos atualizados.",
              "Não partilhes o PIN nem os códigos de confirmação. Se achares que alguém entrou na tua conta, fala connosco logo.",
              "Uma conta por pessoa. Não vendas nem emprestes a tua conta."
            ]
          }
        ]
      },
      {
        "t": "4. Teste gratuito de 7 dias",
        "blocos": [
          {
            "l": [
              "Tens 7 dias gratuitos, a contar do dia em que crias a conta. Não pedimos pagamento nem dados de cartão.",
              "Quando o teste acaba, o acesso fica bloqueado até pagares. Os teus dados ficam guardados durante [12 meses] para continuares de onde paraste."
            ]
          }
        ]
      },
      {
        "t": "5. Planos e preços",
        "blocos": [
          {
            "tabela": {
              "cab": [
                "Plano",
                "Preço",
                "Duração"
              ],
              "linhas": [
                [
                  "Mensal",
                  "1.000 Kz",
                  "1 mês"
                ],
                [
                  "Anual",
                  "10.000 Kz (preço de tabela: 12.000 Kz)",
                  "12 meses"
                ]
              ]
            }
          },
          {
            "l": [
              "Os preços são em kwanzas, [com todos os impostos incluídos].",
              "Podemos ter ofertas, como o plano anual a 6.000 Kz (50%) durante o teste. Valem as condições que vires na app na altura do pagamento.",
              "Se mudarmos os preços, o novo preço só vale para pagamentos feitos depois do aviso. O período que já pagaste não muda."
            ]
          }
        ]
      },
      {
        "t": "6. Como pagas",
        "blocos": [
          {
            "ol": [
              "Escolhes o plano na app.",
              "Escolhes o plano na app.",
              "A app mostra um código de referência e o valor a pagar, conforme o plano que escolheste.",
              "Pagas nos canais digitais do teu banco, com esse código de referência.",
              "O acesso é ativado na hora, assim que o pagamento é confirmado."
            ]
          },
          {
            "l": [
              "O acesso conta a partir da confirmação do pagamento.",
              "Não há renovação automática. Nunca te debitamos nada sozinhos. Quando o período acaba, o acesso termina e podes pagar de novo.",
              "Paga só com o código de referência que aparece dentro da app. Nunca pagues um código ou uma conta que te enviem por mensagem.",
              "Se precisares de fatura, pede em invoice@klaco.app."
            ]
          }
        ]
      },
      {
        "t": "8. Convida e ganha",
        "blocos": [
          {
            "l": [
              "Quando um amigo entra pelo teu convite e paga uma subscrição, ganhas 1 mês grátis, aplicado no teu próximo pagamento.",
              "O mês grátis não é dinheiro e não se transfere. Se o teu amigo receber reembolso, o mês grátis é retirado.",
              "Contas falsas ou criadas só para ganhar meses grátis não contam."
            ]
          }
        ]
      },
      {
        "t": "9. Como deves usar a Klaco",
        "blocos": [
          {
            "p": "Usa a Klaco para uso pessoal e de forma legal. Não podes:"
          },
          {
            "l": [
              "entrar na conta de outra pessoa;",
              "criar várias contas para teres o teste grátis outra vez, nem contornar o pagamento;",
              "copiar, desmontar ou alterar a app, nem usar programas automáticos (robôs) para a usar;",
              "enviar vírus ou fazer o que prejudique a app ou outros utilizadores;",
              "usar a Klaco para atividades ilegais."
            ]
          },
          {
            "p": "Se violares estas regras, podemos suspender a tua conta e dizemos-te porquê. Em casos graves, a suspensão pode ser imediata."
          }
        ]
      },
      {
        "t": "10. Os teus dados",
        "blocos": [
          {
            "p": "Os teus registos (rendimento, datas, gastos, entradas e objetivos) são teus. Usamo-los só para a Klaco funcionar para ti e melhorarmos a tua experiência, e não os vendemos. Tratamos os teus dados pessoais nos termos da Lei n.º 22/11, de 17 de Junho (Proteção de Dados Pessoais). Podes pedir a eliminação da tua conta e dos teus dados em suporte@klaco.app. Vê também a Política de Segurança e a Política de Privacidade."
          }
        ]
      },
      {
        "t": "11. Disponibilidade e mudanças na Klaco",
        "blocos": [
          {
            "p": "Queremos que a Klaco funcione sempre, mas pode haver interrupções, por exemplo por manutenção ou falhas de internet ou de fornecedores. Quando soubermos antes, avisamos. Podemos melhorar e mudar a Klaco. Se uma mudança retirar de forma importante o que pagaste, podes pedir o reembolso do tempo que falta."
          }
        ]
      },
      {
        "t": "12. Responsabilidade",
        "blocos": [
          {
            "p": "Fazemos o possível para a Klaco funcionar bem. Não nos responsabilizamos por decisões financeiras que tomes com base nela, nem por erros que venham de valores errados que registaste. Isto não limita os direitos que a Lei n.º 15/03, de 22 de Julho (Defesa do Consumidor), te dá."
          }
        ]
      },
      {
        "t": "13. Mudanças a estes termos",
        "blocos": [
          {
            "p": "Podemos mudar estes termos. Se a mudança te prejudicar, avisamos na app ou por e-mail com [15 dias] de antecedência. Se não concordares, podes deixar de usar a Klaco e pedir o reembolso do tempo que pagaste e não usaste."
          }
        ]
      },
      {
        "t": "14. Lei aplicável e reclamações",
        "blocos": [
          {
            "p": "Estes termos regem-se pela lei angolana. Se tiveres um problema, fala primeiro connosco no WhatsApp 952 272 299 ou em suporte@klaco.app. Respondemos em [5 dias úteis]."
          },
          {
            "p": "Se alguma parte destes termos for inválida, as restantes continuam a valer."
          }
        ]
      }
    ]
  },
  "reembolso": {
    "id": "reembolso",
    "titulo": "Política de Reembolso",
    "intro": "Tens 7 dias úteis para desistir de um pagamento e receber o valor de volta, sem teres de dar explicações.",
    "versaoTexto": "Versão 1.0 · em vigor desde [data de publicação]",
    "seccoes": [
      {
        "t": "1. Quando tens direito a reembolso",
        "blocos": [
          {
            "tabela": {
              "cab": [
                "Situação",
                "O que devolvemos",
                "Quando podes pedir"
              ],
              "linhas": [
                [
                  "Queres desistir",
                  "O valor total que pagaste",
                  "Em 7 dias úteis, a contar do dia em que ativámos o teu acesso"
                ],
                [
                  "Pagaste a mais, ou duas vezes",
                  "O valor a mais",
                  "Assim que detetares"
                ]
              ]
            }
          },
          {
            "p": "A desistência vale para qualquer pagamento teu, mensal ou anual, incluindo o plano anual a 6.000 Kz da oferta do teste."
          }
        ]
      },
      {
        "t": "2. Quando não há reembolso",
        "blocos": [
          {
            "l": [
              "Passados os 7 dias úteis, e se não for nenhuma das situações acima, o período que pagaste mantém-se até ao fim. Não devolvemos meses já pagos que não usaste.",
              "Se a tua conta foi suspensa por violares os Termos de Uso, podemos não devolver o tempo que falta.",
              "O teste gratuito não custa nada, por isso não há nada a devolver.",
              "O mês grátis do “Convida e ganha” não se troca por dinheiro."
            ]
          }
        ]
      },
      {
        "t": "3. Como pedir",
        "blocos": [
          {
            "p": "Envia uma mensagem para invoice@klaco.app ou para o WhatsApp 952 272 299 com:"
          },
          {
            "ol": [
              "o teu nome e o e-mail ou telefone da tua conta;",
              "a data e o valor do pagamento, com o comprovativo;",
              "o motivo, ou apenas “quero desistir”;",
              "o IBAN da conta onde queres receber o dinheiro, em teu nome."
            ]
          },
          {
            "p": "Nunca nos mandes o teu PIN nem os códigos de confirmação. Não precisamos deles."
          }
        ]
      },
      {
        "t": "4. O que acontece a seguir",
        "blocos": [
          {
            "l": [
              "Respondemos ao teu pedido em [2 dias úteis].",
              "Se o aprovarmos, devolvemos o dinheiro por transferência em [3 dias úteis], sem descontar nenhuma taxa.",
              "O acesso pago termina quando devolvemos o dinheiro. A tua conta volta ao estado em que estava antes do pagamento e os teus dados continuam guardados nos termos habituais."
            ]
          }
        ]
      }
    ]
  },
  "seguranca": {
    "id": "seguranca",
    "titulo": "Política de Segurança",
    "intro": null,
    "versaoTexto": null,
    "seccoes": [
      {
        "t": "1. O que fazemos para proteger os teus dados",
        "blocos": [
          {
            "l": [
              "**Entrada na conta:** Entras com um código de confirmação enviado para o teu e-mail ou telefone.",
              "**Cada pessoa só vê os seus dados:** a base de dados só deixa cada utilizador ver e alterar a sua própria conta.",
              "**Dados cifrados:** guardamos os dados num fornecedor de alojamento que informa cifrar todos os dados guardados e em trânsito.",
              "**Estado da conta e plano:** apenas nós alteramos, quando confirmamos um pagamento. Não se alteram a partir da app.",
              "**Pagamentos:** pagas por transferência bancária. Não pedimos nem guardamos dados de cartão."
            ]
          }
        ]
      },
      {
        "t": "2. O PIN: o que faz e o que não faz",
        "blocos": [
          {
            "p": "O PIN é um bloqueio da app no teu telemóvel. Serve para que alguém que pegue no teu telemóvel não abra a Klaco. Não substitui o código de confirmação."
          }
        ]
      },
      {
        "t": "3. O que te pedimos",
        "blocos": [
          {
            "l": [
              "Não partilhes o PIN nem os códigos de confirmação com ninguém. Nós nunca os pedimos.",
              "Toca em “Sair da conta” se usares a Klaco num telemóvel que não é teu."
            ]
          }
        ]
      },
      {
        "t": "4. Cuidado com burlas de pagamento",
        "blocos": [
          {
            "p": "Como os pagamentos são por transferência, há quem finja ser da Klaco para receber o teu dinheiro."
          },
          {
            "l": [
              "Paga só para a conta que aparece dentro da app, depois de entrares na tua conta.",
              "Os nossos contactos oficiais são só estes: WhatsApp 952 272 299, suporte@klaco.app, invoice@klaco.app, comercial@klaco.app e Instagram @klacoapp.",
              "Nunca pedimos o teu PIN, códigos de confirmação ou dados do teu cartão ou do teu banco.",
              "Recebeste um pedido estranho? Não pagues e fala connosco."
            ]
          }
        ]
      },
      {
        "t": "5. Em caso de emergência",
        "blocos": [
          {
            "l": [
              "Se perderes o telemóvel ou achares que alguém entrou na tua conta, fala connosco logo, em suporte@klaco.app ou no WhatsApp 952 272 299."
            ]
          }
        ]
      },
      {
        "t": "7. O teu controlo sobre os teus dados",
        "blocos": [
          {
            "p": "Podes pedir o acesso, a correção ou a eliminação dos teus dados em suporte@klaco.app, nos termos da Lei de Proteção de Dados Pessoais."
          }
        ]
      }
    ]
  }
};

export const ORDEM_DOCS_LEGAIS = ["termos", "reembolso", "seguranca"];

// Pontos pendentes de confirmação da cliente (o texto mantém os parênteses rectos).
export const LEGAL_PENDENTES = [
  {
    "doc": "termos",
    "onde": "Versão / entrada em vigor",
    "campo": "[data de publicação]"
  },
  {
    "doc": "termos",
    "onde": "4. Teste gratuito de 7 dias",
    "campo": "[12 meses]"
  },
  {
    "doc": "termos",
    "onde": "5. Planos e preços",
    "campo": "[com todos os impostos incluídos]"
  },
  {
    "doc": "termos",
    "onde": "13. Mudanças a estes termos",
    "campo": "[15 dias]"
  },
  {
    "doc": "termos",
    "onde": "14. Lei aplicável e reclamações",
    "campo": "[5 dias úteis]"
  },
  {
    "doc": "reembolso",
    "onde": "Versão / entrada em vigor",
    "campo": "[data de publicação]"
  },
  {
    "doc": "reembolso",
    "onde": "4. O que acontece a seguir",
    "campo": "[2 dias úteis]"
  },
  {
    "doc": "reembolso",
    "onde": "4. O que acontece a seguir",
    "campo": "[3 dias úteis]"
  }
];
