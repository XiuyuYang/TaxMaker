import { Hono } from 'hono';
import type { Env, Receipt } from '../types';
import { sha256hex } from '../lib/crypto';
import { summarizeGST, gstFromInclusive } from '../lib/gst';
import { COOKIE_NAME } from './auth';

const reports = new Hono<{ Bindings: Env }>();

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── GET /gst-summary ──────────────────────────────────────────────────────────

reports.get('/gst-summary', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const periodStart = c.req.query('period_start');
  const periodEnd = c.req.query('period_end');

  if (!periodStart || !periodEnd) {
    return c.json({ error: 'period_start and period_end query params are required' }, 400);
  }

  // Fetch all confirmed receipts in period with category info
  const result = await c.env.DB.prepare(
    `SELECT r.*, c.gst_claim_mode as category_gst_claim_mode, c.name as category_name, c.id as category_id
     FROM receipts r
     LEFT JOIN categories c ON c.id = r.final_category_id
     WHERE r.user_id = ?
       AND r.status = 'confirmed'
       AND r.receipt_date >= ?
       AND r.receipt_date <= ?
     ORDER BY r.receipt_date ASC`
  )
    .bind(userId, periodStart, periodEnd)
    .all<Receipt & { category_gst_claim_mode: string | null; category_name: string | null; category_id: string | null }>();

  const receiptRows = result.results;

  // Compute GST summary
  const summary = summarizeGST(
    receiptRows.map((r) => ({ ...r, category_gst_claim_mode: r.category_gst_claim_mode })),
    periodStart,
    periodEnd
  );

  // Build per-category breakdown
  const categoryMap = new Map<
    string,
    {
      category_id: string | null;
      category_name: string | null;
      gst_claim_mode: string | null;
      receipt_count: number;
      total_inclusive: number;
      total_gst: number;
    }
  >();

  for (const r of receiptRows) {
    const catKey = r.final_category_id ?? '__uncategorized__';
    if (!categoryMap.has(catKey)) {
      categoryMap.set(catKey, {
        category_id: r.final_category_id,
        category_name: r.category_name,
        gst_claim_mode: r.category_gst_claim_mode,
        receipt_count: 0,
        total_inclusive: 0,
        total_gst: 0,
      });
    }
    const entry = categoryMap.get(catKey)!;
    const amount = r.total_amount ?? 0;
    const gst = r.gst_amount ?? gstFromInclusive(amount);
    entry.receipt_count += 1;
    entry.total_inclusive += amount;
    entry.total_gst += gst;
  }

  const breakdown = Array.from(categoryMap.values()).map((e) => ({
    ...e,
    total_inclusive: Math.round(e.total_inclusive * 100) / 100,
    total_gst: Math.round(e.total_gst * 100) / 100,
  }));

  return c.json({ summary, breakdown });
});

export default reports;
