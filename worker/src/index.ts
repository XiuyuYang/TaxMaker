import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import authRouter from './api/auth';
import categoriesRouter from './api/categories';
import receiptsRouter from './api/receipts';
import reportsRouter from './api/reports';
import exportsRouter from './api/exports';

const app = new Hono<{ Bindings: Env }>();

// ── CORS for local development ────────────────────────────────────────────────

app.use('*', cors({
  origin: (origin) => {
    if (
      origin === 'http://localhost:5173' ||
      origin === 'http://127.0.0.1:5173' ||
      origin === 'http://localhost:4173'
    ) {
      return origin;
    }
    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
  credentials: true,
  maxAge: 600,
}));

// ── API routes ────────────────────────────────────────────────────────────────

app.route('/api/auth', authRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/receipts', receiptsRouter);
app.route('/api/reports', reportsRouter);
app.route('/api/exports', exportsRouter);

// ── 404 for unmatched /api/* routes ──────────────────────────────────────────

app.all('/api/*', (c) => {
  return c.json({ error: 'API endpoint not found' }, 404);
});

// ── Serve frontend SPA for all other routes ───────────────────────────────────
// The Worker is mounted at /tax/* on the domain, but Vite builds assets relative
// to the dist/ root. Strip the /tax prefix before looking up assets so that
// e.g. /tax/assets/index.js → /assets/index.js in the dist folder.

app.all('*', async (c) => {
  const basePath = (c.env.BASE_PATH || '/tax').replace(/\/$/, ''); // e.g. "/tax"
  const url = new URL(c.req.url);
  let pathname = url.pathname;

  // Strip the base path prefix so ASSETS can find files in the dist root
  if (pathname.startsWith(basePath + '/') || pathname === basePath) {
    pathname = pathname.slice(basePath.length) || '/';
  }
  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  url.pathname = pathname;
  const assetReq = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.raw.body,
    redirect: 'manual',
  });

  let res = await c.env.ASSETS.fetch(assetReq);

  // SPA fallback: for client-side routes that don't match a file, serve index.html
  if (res.status === 404) {
    url.pathname = '/index.html';
    res = await c.env.ASSETS.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
  }

  return res;
});

// ── Global error handler ──────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error(`[Worker Error] ${c.req.method} ${c.req.url}:`, err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  return c.json({ error: message }, 500);
});

export default app;
