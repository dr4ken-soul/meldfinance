import { config, hasMailjetConfig } from './config.js';
import { HttpError } from './errors.js';

type MeldEmailKind = 'verification' | 'password_reset';

const templates: Record<MeldEmailKind, { id: string; subject: string }> = {
  verification: {
    id: config.MAILJET_VERIFICATION_TEMPLATE_ID,
    subject: 'Confirm your email address to finish setting up Meld',
  },
  password_reset: {
    id: config.MAILJET_PASSWORD_RESET_TEMPLATE_ID,
    subject: 'Reset your Meld password',
  },
};

export async function sendMeldEmail(input: { kind: MeldEmailKind; to: string; actionUrl: string }) {
  if (!hasMailjetConfig()) {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Meld email delivery is not configured for this environment yet.');
  }

  const template = templates[input.kind];
  let response: Response;
  try {
    response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_SECRET_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: config.MAILJET_FROM_EMAIL, Name: config.MAILJET_FROM_NAME },
          To: [{ Email: input.to }],
          TemplateID: Number(template.id),
          TemplateLanguage: true,
          TemplateErrorDeliver: false,
          Subject: template.subject,
          Variables: { actionUrl: input.actionUrl },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(502, 'EMAIL_DELIVERY_FAILED', 'Meld could not send that email. Please try again shortly.');
  }

  const result = await response.json().catch(() => null) as { Messages?: Array<{ Status?: string }> } | null;
  if (!response.ok || !result?.Messages?.length || result.Messages.some((message) => message.Status !== 'success')) {
    throw new HttpError(502, 'EMAIL_DELIVERY_FAILED', 'Meld could not send that email. Please try again shortly.');
  }
}
