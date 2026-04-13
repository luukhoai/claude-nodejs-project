# Ticket #1: Add Rate-Limiting Endpoint to the API

## Issue

Add a rate-limiting endpoint to the API. This should track and limit API request counts per client (identified by IP address), exposing current usage status and allowing clients to understand their rate limit state.

---

## Analysis     (swe-analyzer, 2026-04-13)

### Codebase Overview

- **Project type**: Express.js REST API (Node.js, single-file `src/index.js`)
- **Dependencies**: `express` only (no existing rate-limiting or caching libraries)
- **Test setup**: Jest with `supertest` — no existing test files in the project root
- **Server pattern**: Module exports `app` + `getServer()` for testability

### Existing Patterns

The `src/index.js` file uses:
- Express router-level middleware: `app.use(express.json())`
- Standard REST handler pattern: `(req, res) => { ... res.json(...) }`
- In-memory data store (`items` array) — same approach should be used for rate-limit state
- No existing middleware architecture beyond JSON parsing

### What Needs to Be Built

1. **Rate-limit middleware**: Track requests per client IP using an in-memory store (since no Redis/database is available). Apply a configurable request limit (e.g., 100 requests per window).

2. **Rate-limit status endpoint**: `GET /api/rate-limit-status` — returns the current client's request count, limit, and remaining requests.

3. **Middleware application**: Apply rate-limit tracking to all `/api/*` routes so counts are tracked on every API request.

4. **Rate-limit response**: When limit is exceeded, return HTTP 429 Too Many Requests with a `Retry-After` header and JSON error body.

### Implementation Strategy

- Use `req.ip` (Express's built-in IP detection, requires `trust proxy` setting if behind a proxy) to identify clients.
- Use a simple in-memory `Map<string, { count: number, resetTime: Date }>` for rate-limit tracking — consistent with the existing in-memory pattern.
- Use a sliding window approach: reset counts after a configurable time window (default: 60 seconds).
- Expose `GET /api/rate-limit-status` so clients can introspect their current usage.
- No external rate-limit packages (like `express-rate-limit`) — implement manually for clarity and testability.

### Edge Cases

- Client IP detection in test environments (use a fallback IP)
- Concurrent requests (Map operations are not atomic — use a mutex or accept race conditions as acceptable for this scope)
- Memory growth from long-running servers (the Map should auto-expire entries on reset)

---

## Recommended Approach

1. Add `rateLimitMiddleware` function that increments per-IP counters and blocks requests over the limit (429).
2. Add `rateLimitStatusHandler` for the `GET /api/rate-limit-status` endpoint.
3. Wire middleware into `app.use('/api', rateLimitMiddleware)` so all `/api` routes are tracked.
4. Use a `Map` with per-IP reset timestamps for a clean sliding window.

---

## Files to Modify

### `src/index.js`
- Add `rateLimits` Map and `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` constants.
- Add `rateLimitMiddleware` function: check/increment count per IP, return 429 if exceeded.
- Add `GET /api/rate-limit-status` handler: return `{ used, limit, remaining, resetAt }`.
- Apply middleware: `app.use('/api', rateLimitMiddleware)`.

### New: `test/rateLimit.test.js`
- Tests for: status endpoint returns correct counts, requests exceeding limit get 429, window reset works.
- Use `supertest` to make requests and assert responses.

---

## Implementation  (swe-developer, 2026-04-13)

### Changes to `src/index.js`

**Rate-limit constants and state**
- `RATE_LIMIT_WINDOW_MS = 60_000` (60-second sliding window)
- `RATE_LIMIT_MAX = 100` (requests per window per IP)
- `rateLimits` — `Map<string, { count: number, resetTime: Date }>` for per-IP tracking

**`rateLimitMiddleware(req, res, next)`**
- Reads `req.ip || '127.0.0.1'` as client identifier
- Initialises/resets the per-IP record when window expires
- Returns `429` with `Retry-After` header and JSON body when limit exceeded
- Increments count and calls `next()` if within limit

**`getRateLimitRecord(ip)`** — helper that initialises/resets a record; used by the status endpoint

**`GET /api/rate-limit-status`**
- Returns: `{ ip, used, limit, remaining, resetAt, windowMs }`

**Middleware wired** via `app.use('/api', rateLimitMiddleware)` so all `/api/*` routes are tracked

**Test helpers exported**
`module.exports` now also exports: `rateLimits`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `getRateLimitRecord`, `rateLimitMiddleware`

---



- No external packages needed beyond what's already in `package.json`.
- The implementation should be consistent with the single-file, in-memory pattern already established.
- If a real rate-limit store (Redis) is needed in the future, the middleware abstraction allows easy swapping.

---

## Tests       (swe-tester, 2026-04-13)

**Test file created**: `test/rateLimit.test.js` (new — no existing test suite)

**Result: 6/6 PASS ✅**

| Test | Result |
|---|---|
| `GET /api/rate-limit-status` returns correct usage stats for a fresh IP | ✅ PASS |
| `GET /api/items` increments counter correctly | ✅ PASS |
| Returns 429 after 100 requests | ✅ PASS |
| `Retry-After` header is a positive integer in seconds | ✅ PASS |
| Status endpoint itself is rate-limited (`/api/*`) | ✅ PASS |
| `/health` is NOT rate-limited (outside `/api/`) | ✅ PASS |

**Coverage**: 62.96% statements / 44.11% branches / 50% functions / 67.1% lines — below 70% thresholds. Gaps are in pre-existing items CRUD routes (POST, PUT, DELETE, GET/:id), not rate-limit code.

**Key implementation issue found**: `GET /api/rate-limit-status` double-counts requests — both `rateLimitMiddleware` (middleware layer) and `getRateLimitRecord()` (handler layer) independently create/reset the same record, so a status check consumes 2 count units instead of 1.