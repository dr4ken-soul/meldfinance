import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app.js';

const app = createApp();

/**
 * Vercel rewrites /api/* requests to this function and passes the original
 * route in __meld_path. Restore the application route before Express handles
 * the request, keeping the local API paths identical to the deployed paths.
 */
export default function handler(request: IncomingMessage, response: ServerResponse) {
  const rewrittenUrl = new URL(request.url ?? '/', 'https://meld.invalid');
  const route = rewrittenUrl.searchParams.get('__meld_path') ?? '';
  rewrittenUrl.searchParams.delete('__meld_path');

  const remainingQuery = rewrittenUrl.searchParams.toString();
  request.url = `/api/${route}${remainingQuery ? `?${remainingQuery}` : ''}`;

  return app(request, response);
}
