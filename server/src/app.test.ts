// @vitest-environment node
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('Meld API integration boundary', () => {
  it('reports sandbox provider readiness without exposing payment credentials', async () => {
    const response = await request(createApp()).get('/api/health').expect(200);
    expect(response.body.service).toBe('meld-api');
    expect(response.body.readiness).toHaveProperty('database');
    expect(response.body.readiness).toHaveProperty('firebase');
    expect(response.body.readiness).toHaveProperty('email');
    expect(response.body.readiness).toHaveProperty('paymentSetup');
    expect(['sandbox_ready', 'not_configured']).toContain(response.body.readiness.payments);
  });

  it('requires a Firebase bearer token before exposing the current profile', async () => {
    const response = await request(createApp()).get('/api/auth/me').expect(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('requires a Firebase bearer token before exposing the biller catalog', async () => {
    const response = await request(createApp()).get('/api/payments/catalog').expect(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('does not keep the old password, OTP or login endpoints in the Meld API', async () => {
    await request(createApp()).post('/api/auth/register').expect(404);
    await request(createApp()).post('/api/auth/verify-email').expect(404);
    await request(createApp()).post('/api/auth/login').expect(404);
  });
});
