# Meld account email templates

These are responsive, table-based HTML designs for Meld's Mailjet transactional templates. They use Meld's stone, deep-ink and restrained teal palette, with a text wordmark, the existing Meld symbol, one clear action, a copyable fallback link and a concise security note.

## Templates

- `verification.html` — subject: **Confirm your email address to finish setting up Meld**
- `password-reset.html` — subject: **Reset your Meld password**
- Matching `.txt` files provide accessible plain-text alternatives for email clients that do not render HTML.

Both templates use the Mailjet transactional variable `{{var:actionUrl}}`. Send the Firebase Admin-generated verification or password-reset URL as the `actionUrl` variable. The templates intentionally avoid user-controlled display-name interpolation.

## Delivery configuration

Firebase remains Meld's identity authority and generates one-time verification and password-reset action links through Firebase Admin. The app code is wired to send those links through Mailjet using the template IDs and server-side environment variables below. The browser must never receive Mailjet credentials. Production activation is pending a successful Mailjet credential check and deployment.

Required server variables: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME`, `MAILJET_VERIFICATION_TEMPLATE_ID` and `MAILJET_PASSWORD_RESET_TEMPLATE_ID`. The configured templates must be published in Mailjet and their `actionUrl` variable must remain `{{var:actionUrl}}`.

Firebase's built-in sender is not used for these two messages. The Firebase action-link handler still validates and applies the one-time code. If Meld's branded `/auth/action` page is desired instead of Firebase's default action page, set Firebase Authentication's email-template action URL to `https://meld-app-sage.vercel.app/auth/action`.

The sender `meldfinances@gmail.com` appeared active in the supplied Mailjet screenshot. However, the API credentials currently stored in Vercel returned HTTP 401 during a read-only Mailjet authentication check, so sending and template availability are not yet verified. Gmail/free-mail sender identities may still have weaker deliverability than an authenticated domain, so inbox and spam-folder testing remains necessary. Do not claim guaranteed inbox placement.

Keep Firebase as the identity authority if Mailjet is adopted. Generate one-time verification/reset links on the server with Firebase Admin, then send those links through the configured mail provider. Never log the links or provider credentials.
