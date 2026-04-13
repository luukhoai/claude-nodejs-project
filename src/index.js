const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX = 100;          // requests per window

/** @type {Map<string, { count: number, resetTime: Date }>} */
const rateLimits = new Map();

/**
 * In-memory rate-limit middleware using a sliding window per IP.
 * Applies to all /api/* routes.
 */
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();

  let record = rateLimits.get(ip);

  // Initialise or reset window if expired
  if (!record || now > record.resetTime.getTime()) {
    record = { count: 0, resetTime: new Date(now + RATE_LIMIT_WINDOW_MS) };
    rateLimits.set(ip, record);
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetTime.getTime() - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      retryAfter,
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  }

  record.count += 1;
  next();
}

/**
 * Returns the current rate-limit record for an IP, resetting the window
 * if it has expired.
 */
function getRateLimitRecord(ip) {
  const now = Date.now();
  let record = rateLimits.get(ip);
  if (!record || now > record.resetTime.getTime()) {
    record = { count: 0, resetTime: new Date(now + RATE_LIMIT_WINDOW_MS) };
    rateLimits.set(ip, record);
  }
  return record;
}

// ─── Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply rate-limit middleware to all /api routes
app.use('/api', rateLimitMiddleware);

// Rate-limit status endpoint
app.get('/api/rate-limit-status', (req, res) => {
  const ip = req.ip || '127.0.0.1';
  const record = getRateLimitRecord(ip);
  res.json({
    ip,
    used: record.count,
    limit: RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - record.count),
    resetAt: record.resetTime.toISOString(),
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
});

// In-memory data store
const items = [
  { id: 1, name: 'Item One', description: 'A sample item' },
  { id: 2, name: 'Item Two', description: 'Another sample item' },
];

// GET all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// GET single item
app.get('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST new item
app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const newItem = {
    id: items.length + 1,
    name,
    description: description || '',
  };
  items.push(newItem);
  res.status(201).json(newItem);
});

// PUT update item
app.put('/api/items/:id', (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description !== undefined) item.description = description;
  res.json(item);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex((i) => i.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const deleted = items.splice(index, 1);
  res.json({ message: 'Item deleted', item: deleted[0] });
});

let server;
function getServer() {
  if (!server) {
    server = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
    app.server = server; // so supertest's app.address() resolves to the real server
  }
  return server;
}

if (require.main === module) {
  getServer();
}

module.exports = app;
module.exports.getServer = getServer;
module.exports.server = server;
module.exports.rateLimits = rateLimits;
module.exports.RATE_LIMIT_MAX = RATE_LIMIT_MAX;
module.exports.RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;
module.exports.getRateLimitRecord = getRateLimitRecord;
module.exports.rateLimitMiddleware = rateLimitMiddleware;
