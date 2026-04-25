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
// The /tax prefix is stripped at the entry point (export default below) before
// Hono sees the request, so pathnames here are already dist-root-relative.

app.all('*', async (c) => {
  const url = new URL(c.req.url);

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

// ── Entry point ───────────────────────────────────────────────────────────────
// In production the Worker is mounted at /tax/* so every request arrives with
// the /tax prefix (e.g. /tax/api/auth/me, /tax/dashboard). Strip that prefix
// once here so all Hono routes and the ASSETS binding work with plain paths
// (/api/auth/me, /dashboard) in both production and local dev.

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const basePath = (env.BASE_PATH || '/tax').replace(/\/$/, '');

    if (url.pathname.startsWith(basePath + '/') || url.pathname === basePath) {
      url.pathname = url.pathname.slice(basePath.length) || '/';
      if (!url.pathname.startsWith('/')) url.pathname = '/' + url.pathname;
      request = new Request(url.toString(), request);
    }

    return app.fetch(request, env, ctx);
  },
};
