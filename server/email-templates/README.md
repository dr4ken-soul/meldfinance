# Meld account email templates

These are responsive, table-based HTML templates for a future custom transactional-email sender. They use Meld's stone, deep-ink and restrained teal palette, with a text wordmark, the existing Meld symbol, one clear action, a copyable fallback link and a concise security note.

## Templates

- `verification.html` — subject: **Confirm your email address to finish setting up Meld**
- `password-reset.html` — subject: **Reset your Meld password**
- Matching `.txt` files provide accessible plain-text alternatives for email clients that do not render HTML.

Both templates use the Mailjet transactional variable `{{var:actionUrl}}`. Send the Firebase Admin-generated verification or password-reset URL as the `actionUrl` variable. The templates intentionally avoid user-controlled display-name interpolation.

## Important delivery boundary

Firebase Authentication's built-in sender does **not** accept a fully custom HTML email layout. Firebase Console supports its documented sender/subject/message fields, while the custom `/auth/action` page in Meld controls the branded page users see after opening a link. Firebase documents full custom templates through the Admin SDK-generated action-link plus a separate email sender.

These HTML files are design assets only. The current app still sends Firebase-managed emails; these templates are not wired to Mailjet and do not change production email. To activate the full HTML design, Meld needs a transactional sender integration, verified sender address, API credentials and an end-to-end inbox test. Mailjet can verify an individual sender address, but it warns that freemail senders such as Gmail may be sent to spam or rejected. Do not claim reliable public delivery until sender authentication and inbox testing are complete.

Keep Firebase as the identity authority if Mailjet is adopted. Generate one-time verification/reset links on the server with Firebase Admin, then send those links through the configured mail provider. Never log the links or provider credentials.
