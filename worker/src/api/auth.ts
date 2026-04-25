import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, User, Session } from '../types';
import { hashPassword, verifyPassword, generateSessionToken, sha256hex } from '../lib/crypto';

export const COOKIE_NAME = 'tm_session';

const auth = new Hono<{ Bindings: Env }>();

// ── Helper: resolve session from cookie ──────────────────────────────────────

export async function getSession(
  c: { req: { raw: Request }; env: Env }
): Promise<string | null> {
  const cookieHeader = (c.req.raw as Request).headers.get('Cookie') ?? '';
  let token: string | undefined;
  for (const pair of cookieHeader.split(';')) {
    const [k, v] = pair.trim().split('=');
    if (k?.trim() === COOKIE_NAME) {
      token = decodeURIComponent(v?.trim() ?? '');
      break;
    }
  }

  if (!token) return null;

  const hash = await sha256hex(token);

  const session = await c.env.DB.prepare(
    `SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
  )
    .bind(hash)
    .first<Session>();

  if (!session) return null;

  return session.user_id;
}

// ── Shared cookie helper ─────────────────────────────────────────────────────

function sessionCookieOptions(env: Env) {
  const days = parseInt(env.SESSION_DAYS ?? '30', 10);
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: days * 86400,
  };
}

// ── POST /register ────────────────────────────────────────────────────────────

auth.post('/register', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return c.json(
      { error: 'Username must be 3-30 characters: letters, digits, or underscores' },
      400
    );
  }
  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  // Check uniqueness (case-insensitive via COLLATE NOCASE on column)
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  )
    .bind(username)
    .first<{ id: string }>();

  if (existing) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const { token, hash } = await generateSessionToken();

  const days = parseInt(c.env.SESSION_DAYS ?? '30', 10);
  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();

  // Insert user and session in one batch
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (username, password_hash) VALUES (?, ?)`
    ).bind(username, passwordHash),
    c.env.DB.prepare(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ((SELECT id FROM users WHERE username = ?), ?, ?)`
    ).bind(username, hash, expiresAt),
  ]);

  const user = await c.env.DB.prepare(
    'SELECT id, username, created_at FROM users WHERE username = ?'
  )
    .bind(username)
    .first<Pick<User, 'id' | 'username' | 'created_at'>>();

  if (!user) {
    return c.json({ error: 'Registration failed' }, 500);
  }

  setCookie(c, COOKIE_NAME, token, sessionCookieOptions(c.env));

  return c.json({ user: { id: user.id, username: user.username } }, 201);
});

// ── POST /login ───────────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'username and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ?'
  )
    .bind(username)
    .first<User>();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const { token, hash } = await generateSessionToken();
  const days = parseInt(c.env.SESSION_DAYS ?? '30', 10);
  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
    ).bind(user.id, hash, expiresAt),
    c.env.DB.prepare(
      `UPDATE users SET last_login_at = ? WHERE id = ?`
    ).bind(now, user.id),
  ]);

  setCookie(c, COOKIE_NAME, token, sessionCookieOptions(c.env));

  return c.json({ user: { id: user.id, username: user.username } });
});

// ── POST /logout ──────────────────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE_NAME);

  if (token) {
    const hash = await sha256hex(token);
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`
    )
      .bind(now, hash)
      .run();
  }

  deleteCookie(c, COOKIE_NAME, { path: '/' });

  return c.json({ ok: true });
});

// ── GET /me ───────────────────────────────────────────────────────────────────

auth.get('/me', async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const hash = await sha256hex(token);

  const session = await c.env.DB.prepare(
    `SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
  )
    .bind(hash)
    .first<Session>();

  if (!session) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, created_at FROM users WHERE id = ?'
  )
    .bind(session.user_id)
    .first<Pick<User, 'id' | 'username' | 'created_at'>>();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  return c.json({ user });
});

export default auth;
