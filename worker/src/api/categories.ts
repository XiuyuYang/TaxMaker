import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, Category } from '../types';
import { sha256hex } from '../lib/crypto';
import { COOKIE_NAME } from './auth';

const categories = new Hono<{ Bindings: Env }>();

// ── Auth middleware ───────────────────────────────────────────────────────────

async function requireAuth(c: { req: { raw: Request }; env: Env }): Promise<string | null> {
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
    `SELECT user_id FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
  )
    .bind(hash)
    .first<{ user_id: string }>();

  return session?.user_id ?? null;
}

// ── GET / — list categories ───────────────────────────────────────────────────

categories.get('/', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  // ?include_inactive=true returns deactivated user categories too (so the
  // display layer can resolve names for receipts that still reference them)
  const includeInactive = c.req.query('include_inactive') === 'true';
  const sql = includeInactive
    ? `SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) ORDER BY is_active DESC, sort_order`
    : `SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND is_active = 1 ORDER BY sort_order`;

  const result = await c.env.DB.prepare(sql).bind(userId).all<Category>();

  return c.json({ categories: result.results });
});

// ── POST / — create custom category ──────────────────────────────────────────

categories.post('/', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { name, gst_claim_mode, color, icon } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    return c.json({ error: 'name must be 1-50 characters' }, 400);
  }

  const validModes = ['claimable', 'non_claimable', 'mixed', 'special_adjustment'];
  if (typeof gst_claim_mode !== 'string' || !validModes.includes(gst_claim_mode)) {
    return c.json({ error: `gst_claim_mode must be one of: ${validModes.join(', ')}` }, 400);
  }

  const finalColor = typeof color === 'string' ? color : '#8A98A3';
  const finalIcon = typeof icon === 'string' ? icon : 'tag';

  // Determine next sort_order for user's custom categories
  const maxSort = await c.env.DB.prepare(
    `SELECT MAX(sort_order) as m FROM categories WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ m: number | null }>();

  const sortOrder = (maxSort?.m ?? 0) + 1;

  await c.env.DB.prepare(
    `INSERT INTO categories (user_id, name, kind, gst_claim_mode, color, icon, sort_order)
     VALUES (?, ?, 'custom', ?, ?, ?, ?)`
  )
    .bind(userId, name.trim(), gst_claim_mode, finalColor, finalIcon, sortOrder)
    .run();

  const created = await c.env.DB.prepare(
    `SELECT * FROM categories WHERE user_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(userId, name.trim())
    .first<Category>();

  return c.json({ category: created }, 201);
});

// ── PATCH /:id — update custom category ──────────────────────────────────────

categories.patch('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  // Only allow editing user's own custom categories
  const existing = await c.env.DB.prepare(
    `SELECT * FROM categories WHERE id = ? AND user_id = ? AND kind = 'custom'`
  )
    .bind(id, userId)
    .first<Category>();

  if (!existing) {
    return c.json({ error: 'Category not found or not editable' }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const patch = body as Record<string, unknown>;
  const updates: string[] = [];
  const values: unknown[] = [];

  if ('name' in patch) {
    const name = patch['name'];
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      return c.json({ error: 'name must be 1-50 characters' }, 400);
    }
    updates.push('name = ?');
    values.push(name.trim());
  }

  if ('gst_claim_mode' in patch) {
    const validModes = ['claimable', 'non_claimable', 'mixed', 'special_adjustment'];
    const mode = patch['gst_claim_mode'];
    if (typeof mode !== 'string' || !validModes.includes(mode)) {
      return c.json({ error: `gst_claim_mode must be one of: ${validModes.join(', ')}` }, 400);
    }
    updates.push('gst_claim_mode = ?');
    values.push(mode);
  }

  if ('color' in patch) {
    updates.push('color = ?');
    values.push(patch['color']);
  }

  if ('icon' in patch) {
    updates.push('icon = ?');
    values.push(patch['icon']);
  }

  if ('is_active' in patch) {
    updates.push('is_active = ?');
    values.push(patch['is_active'] ? 1 : 0);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<Category>();

  return c.json({ category: updated });
});

// ── DELETE /:id — delete custom category ─────────────────────────────────────

categories.delete('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  // Only allow deleting user's own custom categories
  const existing = await c.env.DB.prepare(
    `SELECT * FROM categories WHERE id = ? AND user_id = ? AND kind = 'custom'`
  )
    .bind(id, userId)
    .first<Category>();

  if (!existing) {
    return c.json({ error: 'Category not found or not deletable' }, 404);
  }

  // Check if any receipts reference this category
  const receiptRef = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM receipts
     WHERE (suggested_category_id = ? OR final_category_id = ?) AND user_id = ?`
  )
    .bind(id, id, userId)
    .first<{ count: number }>();

  const itemRef = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM receipt_items
     WHERE suggested_category_id = ? OR final_category_id = ?`
  )
    .bind(id, id)
    .first<{ count: number }>();

  const hasRefs = (receiptRef?.count ?? 0) > 0 || (itemRef?.count ?? 0) > 0;

  if (hasRefs) {
    // Soft delete: mark inactive
    await c.env.DB.prepare(
      `UPDATE categories SET is_active = 0 WHERE id = ?`
    )
      .bind(id)
      .run();
    return c.json({ ok: true, deleted: false, reason: 'Category deactivated (still referenced by receipts)' });
  } else {
    // Hard delete
    await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    return c.json({ ok: true, deleted: true });
  }
});

export default categories;
