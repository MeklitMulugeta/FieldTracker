import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('returns success status, expected message, and ISO timestamp', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('FieldTrack API is running');
    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('returns structured safe status from GET /api/health/supabase without leaking credentials', async () => {
    const response = await request(app).get('/api/health/supabase');

    expect(response.status).toBe(200);
    expect(typeof response.body.success).toBe('boolean');
    expect(response.body.runtimeEnv).toHaveProperty('supabaseUrlPresent');
    expect(response.body.runtimeEnv).toHaveProperty('publishableKeyPresent');
    expect(response.body.runtimeEnv).toHaveProperty('secretKeyPresent');
    expect(response.body.connectivity).toHaveProperty('networkReachable');
    expect(response.body.connectivity).toHaveProperty('publishableKeyAccepted');
    expect(response.body.connectivity).toHaveProperty('secretKeyAccepted');
  });

  it('returns 404 JSON payload for unknown routes', async () => {
    const response = await request(app).get('/api/nonexistent-endpoint');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Route not found');
  });
});
