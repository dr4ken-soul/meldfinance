# Meld app

Meld is a web-first bill-payment project for Nigerian consumers. This repository is the replacement rebuild after the earlier implementation was lost. It contains the public site, Firebase account flow, Express API and Phase 2 NGN sandbox bill-payment flow. Supabase migrations `001_user_profiles` and `002_bill_payments` have been applied. Vercel Production has the Firebase web configuration and Supabase connection, but Firebase Admin and provider sandbox credentials still need to be configured before end-to-end signup and payment tests can run.

## Current implementation

- Responsive public pages, selected Meld artwork, service bento, continuously looping capability ribbon and product-preview markup.
- Firebase email/password registration and sign-in UI, Firebase-managed email verification links, and Firebase ID-token verification at the Express API boundary.
- Supabase Postgres profile and sandbox payment persistence keyed to Firebase UID, with versioned SQL migrations.
- Health/readiness reporting. A configured indicator means the server has the necessary settings; it does not prove email inbox placement or payment readiness.
- Signed-in Pay and Activity screens for NGN sandbox checkout, biller verification/plan lookup, transaction records and pending-status checks.

All biller and checkout requests are sandbox-only. They do not charge real funds or deliver live utility service. Meld Balance, deposits, conversions, stablecoin settlement, KYC, schedules and a full receipt/PDF workflow remain outside Phase 2.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS recommended).
- npm.
- Firebase Auth, Supabase Postgres, VTPass sandbox and Flutterwave test credentials before complete end-to-end tests.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and add the Firebase, Supabase and sandbox settings described below. Never commit `.env` or share private keys in chat.
3. Apply pending database migrations with `npm run db:migrate`.
4. Run `npm run dev` and open `http://127.0.0.1:5173`.
5. Check `http://127.0.0.1:4000/api/health`. A database state of `connected` and Firebase state of `configured` indicate server connectivity/configuration only. Send a real verification email and complete the signup flow to confirm delivery and account persistence.

### Firebase Authentication setup

1. Open [Meld Firebase Authentication providers](https://console.firebase.google.com/project/meld-finance/authentication/providers) and enable **Email/Password**. Firebase sends an email verification link, not a numeric OTP.
2. Register a Web app and copy its `apiKey`, `authDomain`, `projectId` and `appId` into the four `VITE_FIREBASE_*` variables in `.env`.
3. Open [Meld Firebase Authentication settings](https://console.firebase.google.com/project/meld-finance/authentication/settings). Under **Authorized domains**, add `meld-app-sage.vercel.app` as a hostname only, without `https://`. Local development can use `localhost` and/or `127.0.0.1` separately.
4. Customize the verification-email template with Meld's project name if desired. Firebase sends the verification link using its managed email flow; a custom domain is not required for the initial test. The verification link returns to the current site origin, so the origin must be authorized.
5. Open [Meld Firebase Admin SDK service accounts](https://console.firebase.google.com/project/meld-finance/settings/serviceaccounts/adminsdk) and generate a private key. Keep the downloaded JSON outside the repository. Copy its `project_id`, `client_email` and `private_key` fields to the server-only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` values. In `.env`, encode private-key line breaks as `\n`. In Vercel, add the client email and private key as server environment values. Never place these values in a `VITE_` variable, send them in chat, or commit the key file.

Firebase's managed sender is the current choice. A custom domain is optional for this default sender; test delivery to more than one mailbox and check inbox, spam and promotions folders. Firebase currently documents a Spark-plan limit of 1,000 address-verification emails per day, subject to change ([Firebase Auth limits](https://firebase.google.com/docs/auth/limits)). If repeated tests show poor placement, the agreed fallback is to keep Firebase as the identity/verification authority, generate its verification action link through Firebase Admin, and deliver that link with Mailjet. That would require a verified Mailjet sender and a code/configuration change; Mailjet notes that SPF/DKIM cannot be configured for free webmail domains, so a personal freemail sender may still have weak deliverability. Mailjet is not a guaranteed fix and is not enabled now.

### Supabase Postgres setup

1. Open the [Meld Supabase database settings](https://supabase.com/dashboard/project/bgxvndunjjcbwdqbxbxi/settings/database) and use **Connect → Transaction pooler**.
2. Use the Transaction Pooler URI for Vercel serverless database requests. Keep the URL secret. The production database URL is currently scoped to Vercel **Production** only; do not copy production credentials into Preview or Development. Use a separate database before configuring those environments.
3. Run `npm run db:migrate` from the app folder. It creates `meld_schema_migrations` and applies profile and bill-payment tables. The current migrations have been applied to the configured Supabase project; the command can safely check and apply pending migrations again.
4. Restart the app and confirm the health endpoint can connect. If the migration or profile sync fails, account access remains unavailable; it must not silently grant access.

Supabase Free is suitable for learning and a prototype, not a guarantee of continuous production availability. Free projects can be paused after low database activity over a seven-day window ([pausing details](https://supabase.com/docs/guides/platform/free-project-pausing)); the free database has a 500 MB size quota before it becomes read-only ([database size limits](https://supabase.com/docs/guides/platform/database-size)). Recheck current limits and backup requirements before relying on it for a public service; do not store real payment credentials or money-movement records until the production data plan is reviewed.

The browser does not connect directly to Postgres. Firebase owns authentication credentials. The Express API verifies ID tokens and uses the server-only database connection for Meld profiles and sandbox payment records. Sensitive bill-recipient fields are encrypted while pending and cleared once a terminal result is recorded.

### Phase 2 sandbox provider setup

1. Create a [VTPass sandbox account](https://sandbox.vtpass.com/register), then obtain the sandbox API key, public key and secret key from the sandbox account/API settings. Add them as `VTPASS_API_KEY`, `VTPASS_PUBLIC_KEY` and `VTPASS_SECRET_KEY`.
2. Create a [Flutterwave account](https://app.flutterwave.com/register), sign in to the [Flutterwave dashboard](https://app.flutterwave.com/login), and retrieve the **Test Secret Key** under API keys. Use only a key beginning `FLWSECK_TEST-` and set it as `FLUTTERWAVE_SECRET_KEY`.
3. In Flutterwave webhook settings, set a new webhook secret/hash and use `https://meld-app-sage.vercel.app/api/payments/flutterwave-webhook` as the webhook URL. Add the same hash as `FLUTTERWAVE_WEBHOOK_HASH` in Vercel Production.
4. `PAYMENT_DATA_ENCRYPTION_KEY` is a server-only 32-byte random key encoded as 64 hexadecimal characters. A key has already been generated for the current local and Vercel Production setup. Keep the local and deployed values matched. Do not post or commit it.
5. Add provider keys in the [Vercel project environment settings](https://vercel.com/psycho-projects/meld-app/settings/environment-variables), keep them server-only, select Production, then redeploy. Add separate sandbox values for Preview/Development only if those environments are deliberately configured.

Provider keys are required before the sandbox readiness indicator turns on. VTPass and Flutterwave sandbox activity is not real bill payment and is not evidence that electricity, airtime, data or TV service was delivered.

### Deployment direction

Vercel hosts both the Vite web app and Express API as a Vercel Function. [Vercel's Express documentation](https://vercel.com/docs/frameworks/backend/express) supports this request/response API shape and avoids an extra hosting service and cross-origin setup. The project is `meld-app` at `https://meld-app-sage.vercel.app`, and is being connected to GitHub auto-deployment for `dr4ken-soul/meldfinance`; CLI deployments remain available. Render is not required for the current request/response web/API scope. Revisit a separate persistent worker only if future scheduled-payment or reconciliation workloads need processes that must remain running between requests.

## Environment variables

`.env.example` lists required variable names and contains no live credentials. `VITE_FIREBASE_*` values are browser application configuration. Keep `FIREBASE_PRIVATE_KEY`, `SUPABASE_DATABASE_URL`, VTPass keys, Flutterwave test keys and `PAYMENT_DATA_ENCRYPTION_KEY` server-side. Vercel Production already has the Firebase web configuration and Supabase URL. Firebase Admin and biller/checkout credentials remain user-provided setup; never copy secret values into the documentation or chat.

## Commands

- `npm run dev` — start the Vite client and Express API.
- `npm run db:migrate` — apply pending versioned SQL migrations to Supabase.
- `npm run build` — type-check the client and server, then build the production client bundle.
- `npm test` — run client and API tests.
- `npm run lint` — lint source and configuration.
- `npm run assets:optimize` — create responsive WebP delivery artwork and installable PNG icons from the selected source image pack. The original image-pack masters are left unchanged.

## Project boundaries

Do not edit `Documents/MELD.md` unless Paul explicitly asks. Keep Chapter 3 untouched. Consult `APP_BLUEPRINT.md`, `FRONTEND_SPEC.md`, `BUILD_GUIDE.md` and `CLAUDE.md` for approved design, architecture and build decisions. Provider credentials, database schema and implementation status must agree with the current code and evidence.

Before enabling a payment-provider integration, confirm sandbox credentials, callback/webhook configuration, idempotency and reconciliation behavior. Production deployment needs its own environment setup, security review, database backup plan, privacy review and end-to-end tests.
