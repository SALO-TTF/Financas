# Lembrete diário por push — ESQUELETO, NÃO ACTIVO

Nada nesta pasta está ligado à app nem foi publicado. A versão actual entrega apenas o lembrete
**interno** (aparece na lista de notificações quando a pessoa abre a app), através da RPC
`public.registar_lembrete_diario` (ver `supabase/sql-para-revisao/20261116090100_lembrete_diario.sql`).

Para haver notificação no telemóvel com a app fechada são precisas peças que hoje não existem:

1. **Chaves VAPID** (par público/privado). A pública vai para o frontend; a privada só para os
   segredos da Edge Function. Nunca no frontend.
2. **Tabela de subscrições push** (ex.: `push_subscricoes(user_id, endpoint, p256dh, auth, criada_em)`),
   com RLS para cada utilizador gerir só as suas. SQL a desenhar e rever à parte.
3. **Registo da subscrição no frontend**: depois de a pessoa ligar "Lembrete diário",
   `Notification.requestPermission()` → `registration.pushManager.subscribe({ userVisibleOnly: true,
   applicationServerKey })` → gravar a subscrição. No iPhone só funciona com a app instalada no ecrã
   principal (iOS 16.4+).
4. **Handler no service worker** (`public/service-worker.js`): eventos `push` (mostrar a notificação)
   e `notificationclick` (abrir a app). Exemplo em `service-worker-push.exemplo.js`.
5. **Edge Function agendada** (Supabase Cron, uma vez por dia, hora de Luanda): para cada
   utilizador com `dados.notifLembrete = true` e subscrição activa, calcular o valor do dia
   e enviar. **Atenção:** o cálculo "Podes gastar hoje" vive hoje no frontend (`calcularFinancas`
   em `src/App.jsx`). Para o push, essa função tem de ser portada para a Edge Function (é pura e
   não depende do React), senão o número do push não bate com o da app. Usar a mesma
   `chave_evento` `lembrete_diario:AAAA-MM-DD` para não duplicar com o lembrete interno.

Até estas peças existirem e serem testadas, a app não deve prometer notificações com a app fechada.
