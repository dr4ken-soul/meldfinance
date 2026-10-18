# Meld account email templates

These are responsive, table-based HTML designs for Meld's Mailjet transactional templates. They use Meld's stone, deep-ink and restrained teal palette, with a text wordmark, the existing Meld symbol, one clear action, a copyable fallback link and a concise security note.

## Templates

- `verification.html` — subject: **Confirm your email address to finish setting up Meld**
- `password-reset.html` — subject: **Reset your Meld password**
- Matching `.txt` files provide accessible plain-text alternatives for email clients that do not render HTML.

Both templates use the Mailjet transactional variable `{{var:actionUrl}}`. The server generates a Firebase Admin verification or password-reset link and rewrites its action-code parameters to Meld's `/auth/action` page before passing it as `actionUrl`. Firebase remains the authority that validates and applies the one-time code. The templates intentionally avoid user-controlled display-name interpolation.

## Delivery configuration

Firebase remains Meld's identity authority and generates one-time verification and password-reset action links through Firebase Admin. The server sends them through Mailjet using the template IDs and server-side environment variables below. The browser must never receive Mailjet credentials. Production inbox delivery and branded action-page behavior still require a fresh end-to-end test after the template changes are published and the current app build is deployed.

Required server variables: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME`, `MAILJET_VERIFICATION_TEMPLATE_ID` and `MAILJET_PASSWORD_RESET_TEMPLATE_ID`. The configured templates must be published in Mailjet and their `actionUrl` variable must remain `{{var:actionUrl}}`.

The Mailjet templates must be published in Mailjet before they can be used for sends; a template left in Draft is not an active template. Firebase's built-in sender is not used by the current API routes. `/auth/action` is Meld's branded handler; it validates the one-time Firebase action code through the Firebase web SDK.

The sender `meldfinances@gmail.com` appeared active in the supplied Mailjet screenshot. Gmail/free-mail sender identities may still have weaker deliverability than an authenticated domain, so inbox and spam-folder testing remains necessary. A healthy environment-variable check does not prove Mailjet accepted a particular message or that it arrived in the inbox.

Keep Firebase as the identity authority if Mailjet is adopted. Generate one-time verification/reset links on the server with Firebase Admin, then send those links through the configured mail provider. Never log the links or provider credentials.
