import { Router, type Request, type Response } from 'express';
import { getVerifiedMeldUser, requireVerifiedFirebaseUser } from '../auth.js';

export const authRoutes = Router();

authRoutes.get('/me', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ user });
});
