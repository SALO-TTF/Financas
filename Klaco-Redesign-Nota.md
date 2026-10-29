# Klaco — Redesign do frontend (ícones próprios, Início, Definições, barra)

**Ficheiro alterado:** `src/App.jsx` (o zip leva o projeto completo). Sem dependências novas, sem alterações a lógica, cálculos, pagamentos, subscrições, teste de 7 dias, RPC, notificações ou formato dos dados (`perfis.dados`).

## O que mudou

| Área | Alteração |
|---|---|
| Ícones | `Icone` (SVG próprio de dois tons, 70 ícones), `Sol` (marca) e `Emo`. Substituem todos os emojis da interface. Mesmo desenho em qualquer telemóvel. |
| Dados guardados | Os emojis guardados nos dados (categorias, objetivos, sugestões) **continuam a ser texto**; `EMOJI_ICONE` converte-os em ícone ao mostrar. Emoji desconhecido não aparece (ou usa o `fallback`). |
| Barra de baixo | Ícones novos, separador ativo com destaque, etiqueta a 11 px (antes ~8 px). |
| Início | Cabeçalho com o sol + «Klaco»; cartão «Pagar já» **no topo** (substitui o bloco do fundo; 5 dias normal, 2 dias mais forte, último dia vermelho); número do dia com o «i» visível; categorias com ícone; botão fixo «Adicionar» (abre o mesmo menu gasto/entrada). |
| Janela do «i» | Frase original + apelo «Regista sempre gastos e entradas. O número fica mais certo.» Caixa da conta removida. |
| Definições | Grupos (Conta, O teu dinheiro, Comunidade e ajuda); cartão de conta com «Pagar já»; «Convidar amigos» (antes «Comunidade e convites»). |
| Contraste | Texto `#6A6050` (3,1:1) passou a `#9F9582` (6,4:1), 30 ocorrências. |

## Pontos a saber

- **Cabeçalho do Início:** deixou de mostrar «Olá, {nome}» e a frase «o teu dinheiro. a tua liberdade.» (como no desenho aprovado).
- **Etiqueta «DISTRIBUIÇÃO»:** passou a seguir a ordem das categorias (60 · 30 · 10). Antes usava `Object.values(pct)`, cuja ordem podia diferir.
- **`AnelContagem`:** o valor por defeito de `total` era 14 (da duração antiga do teste); passou a `TRIAL_DAYS`.
- **Tamanhos em px nos botões:** os botões não herdam o tamanho da letra do navegador, por isso os textos de botões principais ficaram fixos em px.
- **Emojis mantidos de propósito** (textos enviados para fora da app, não interface): mensagens de WhatsApp das conquistas (💪, 🔥, e o emoji do nível) e a legenda sugerida do Instagram (🌅).
- `Icone` e `Sol` usam `dangerouslySetInnerHTML` com strings estáticas definidas no código (nenhum conteúdo do utilizador entra nelas).

## Não alterado (a decidir à parte)

O cálculo do «Podes gastar hoje» e do «hoje» por categoria **não foi tocado**. Continua pendente a decisão sobre a fórmula (o número principal subtrai o gasto já feito a um valor proporcional aos dias que faltam).

## Verificação

Compila (Babel). A app foi executada num navegador com dados simulados (sem Supabase) e verificados os ecrãs Início, Definições, registo de gasto, objetivos, convites, avaliação, suporte, notificações, teste expirado e os três estados do «Pagar já». Repeti os testes lógicos anteriores (datas em Luanda, métricas por RPC, notificações) sem alterações de resultado. **Não foi testado contra o Supabase real nem em dispositivos.** Convém confirmar no telemóvel: botão fixo «Adicionar» com a barra do iPhone (safe-area) e tamanhos de letra grandes.
