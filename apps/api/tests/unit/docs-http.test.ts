/** Documentation HTTP/assets/error routing must work without acquiring a database client or reading .env. */
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiErrorResponseSchema } from '@ledger/contracts';
import { createApp } from '../../src/index.js';
import { openApiV1 } from '../../src/docs/index.js';
const query = vi.fn(async () => {
  throw new Error('Documentation must not query the database');
});
const connect = vi.fn(async () => {
  throw new Error('Documentation must not acquire a client');
});
const app = createApp({
  database: { query, connect },
  webOrigin: 'http://localhost:5173',
  logger: vi.fn(),
});
beforeEach(() => vi.clearAllMocks());

describe('primary API documentation HTTP routes', () => {
  it('redirects /api/docs to the UI with working relative local assets', async () => {
    await request(app).get('/api/docs').expect(308).expect('Location', '/api/docs/');
    const html = await request(app).get('/api/docs/').expect(200).expect('Content-Type', /html/);
    expect(html.text).toContain('Transaction Ledger API v1');
    expect(html.text).toContain('./swagger-ui-bundle.js');
    expect(html.text).not.toMatch(/(?:src|href)="https?:\/\/[^"]+\.(?:js|css)/);
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
  it('serves the versioned spec as JSON without leaking configuration or calling the database', async () => {
    const response = await request(app)
      .get('/api/docs/openapi.v1.json')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(response.body).toEqual(openApiV1);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.text).not.toMatch(/postgres(?:ql)?:\/\/|DATABASE_URL|pooler\.supabase/);
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([
    '/swagger-ui.css',
    '/swagger-ui-bundle.js',
    '/swagger-ui-standalone-preset.js',
    '/swagger-ui-init.js',
  ])('serves bundled UI asset %s locally with no database work', async (path) => {
    const asset = await request(app).get(`/api/docs${path}`).expect(200);
    expect(asset.text.length).toBeGreaterThan(100);
    if (path.endsWith('init.js')) {
      expect(asset.text).toContain('/api/docs/openapi.v1.json');
      expect(asset.text).toContain('"validatorUrl": null');
    }
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(['/package.json', '/missing.json', '/not-an-asset.js'])(
    'keeps unknown/private docs path %s in the safe JSON error pipeline',
    async (path) => {
      const response = await request(app).get(`/api/docs${path}`).expect(404);
      const parsed = apiErrorResponseSchema.parse(response.body);
      expect(parsed.error.code).toBe('ROUTE_NOT_FOUND');
      expect(parsed.error.support_ticket_id).toBe(response.headers['x-support-ticket-id']);
      expect(query).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    },
  );
});
