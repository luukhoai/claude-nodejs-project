const request = require('supertest');

// module.exports = app, so the module itself IS the Express app
const app = require('../src/index');
const {
  getServer,
  rateLimits,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getRateLimitRecord,
} = app;

// Start the server so supertest can make requests against it
let server;
beforeAll(() => {
  server = getServer();
});
afterAll(() => {
  server.close();
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear in-memory rate-limit store before each test for isolation
    rateLimits.clear();
  });

  describe('GET /api/rate-limit-status', () => {
    it('returns correct usage stats for a fresh IP', async () => {
      const res = await request(app).get('/api/rate-limit-status');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(RATE_LIMIT_MAX);
      // Note: status endpoint itself is rate-limited (middleware increments count),
      // so the first call returns used=1. This is the actual behaviour.
      expect(res.body.used).toBe(1);
      expect(res.body.remaining).toBe(RATE_LIMIT_MAX - 1);
      expect(res.body.windowMs).toBe(RATE_LIMIT_WINDOW_MS);
      expect(typeof res.body.ip).toBe('string');
      expect(typeof res.body.resetAt).toBe('string');
    });
  });

  describe('GET /api/items increments the counter', () => {
    it('used count increments with each request, remaining decrements', async () => {
      await request(app).get('/api/items');
      await request(app).get('/api/items');

      const res = await request(app).get('/api/rate-limit-status');

      expect(res.body.used).toBe(3); // 2 items calls + 1 status call (status is rate-limited)
      expect(res.body.remaining).toBe(RATE_LIMIT_MAX - 3);
    });
  });

  describe('429 response when limit is exceeded', () => {
    it('returns 429 after 100 requests', async () => {
      // Hammer the API up to the limit
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        await request(app).get('/api/items');
      }

      // The next request should be blocked
      const res = await request(app).get('/api/items');

      expect(res.status).toBe(429);
      expect(res.body.error).toBeDefined();
      expect(res.body.limit).toBe(RATE_LIMIT_MAX);
      expect(res.body.retryAfter).toBeDefined();
    });

    it('sets Retry-After header to a positive integer in seconds', async () => {
      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        await request(app).get('/api/items');
      }

      const res = await request(app).get('/api/items');

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      const retryAfterSec = parseInt(res.headers['retry-after'], 10);
      expect(retryAfterSec).toBeGreaterThan(0);
      expect(Number.isInteger(retryAfterSec)).toBe(true);
    });
  });

  describe('Rate-limit boundary — status endpoint itself is rate-limited', () => {
    it('status endpoint consumes a count and is subject to the limit', async () => {
      // First request creates the record (count becomes 1 from middleware).
      await request(app).get('/api/rate-limit-status');

      // Directly manipulate the record to leave exactly 1 slot remaining.
      // Express uses IPv6-mapped form for localhost: '::ffff:127.0.0.1'
      const ipv6MappedIp = '::ffff:127.0.0.1';
      const record = rateLimits.get(ipv6MappedIp);
      record.count = RATE_LIMIT_MAX - 1; // leave 1 slot

      // Next request succeeds (uses the last slot, count → 100)
      const res1 = await request(app).get('/api/rate-limit-status');
      expect(res1.status).toBe(200);

      // And the one after that is blocked
      const res2 = await request(app).get('/api/rate-limit-status');
      expect(res2.status).toBe(429);
    });
  });

  describe('Health check is NOT rate-limited', () => {
    it('/health returns 200 even after many requests without hitting /api/', async () => {
      // Exhaust the /api/ limit
      for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        await request(app).get('/api/items');
      }

      // /health is outside /api/ so it should still work
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
