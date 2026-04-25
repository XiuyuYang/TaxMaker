import { Hono } from 'hono';
import type { Env, Receipt, Export } from '../types';
import { sha256hex, generateId } from '../lib/crypto';
import { COOKIE_NAME } from './auth';

const exportsRouter = new Hono<{ Bindings: Env }>();

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

// ── CSV generation ────────────────────────────────────────────────────────────

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(
  receipts: Array<Receipt & { category_name: string | null }>
): string {
  const headers = [
    'receipt_id',
    'date',
    'merchant',
    'total_amount',
    'gst_amount',
    'net_amount',
    'category',
    'gst_treatment',
    'status',
    'notes',
  ];

  const rows = receipts.map((r) => [
    escapeCSV(r.id),
    escapeCSV(r.receipt_date),
    escapeCSV(r.merchant_name),
    escapeCSV(r.total_amount),
    escapeCSV(r.gst_amount),
    escapeCSV(r.net_amount),
    escapeCSV(r.category_name),
    escapeCSV(r.gst_treatment),
    escapeCSV(r.status),
    escapeCSV(r.notes),
  ]);

  const lines = [headers.join(','), ...rows.map((row) => row.join(','))];
  return lines.join('\r\n');
}

// ── POST /csv ─────────────────────────────────────────────────────────────────

exportsRouter.post('/csv', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { period_start, period_end } = body as Record<string, unknown>;

  if (typeof period_start !== 'string' || typeof period_end !== 'string') {
    return c.json({ error: 'period_start and period_end are required strings' }, 400);
  }

  // Fetch confirmed receipts with category name
  const result = await c.env.DB.prepare(
    `SELECT r.*, c.name as category_name
     FROM receipts r
     LEFT JOIN categories c ON c.id = r.final_category_id
     WHERE r.user_id = ?
       AND r.status = 'confirmed'
       AND r.receipt_date >= ?
       AND r.receipt_date <= ?
     ORDER BY r.receipt_date ASC`
  )
    .bind(userId, period_start, period_end)
    .all<Receipt & { category_name: string | null }>();

  const receipts = result.results;
  const csvContent = generateCSV(receipts);

  const exportId = generateId();
  const r2Key = `exports/${userId}/${period_start}_${period_end}/receipts.csv`;
  const now = new Date().toISOString();

  // Store in R2
  await c.env.R2.put(r2Key, csvContent, {
    httpMetadata: { contentType: 'text/csv; charset=utf-8' },
  });

  // Insert export record
  await c.env.DB.prepare(
    `INSERT INTO exports (id, user_id, export_type, period_start, period_end, status, r2_key, created_at, finished_at)
     VALUES (?, ?, 'csv', ?, ?, 'ready', ?, ?, ?)`
  )
    .bind(exportId, userId, period_start, period_end, r2Key, now, now)
    .run();

  return c.json({
    export_id: exportId,
    download_url: `/api/exports/${exportId}/download`,
    receipt_count: receipts.length,
  }, 201);
});

// ── GET /:id — get export status ──────────────────────────────────────────────

exportsRouter.get('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const exportRecord = await c.env.DB.prepare(
    'SELECT * FROM exports WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Export>();

  if (!exportRecord) return c.json({ error: 'Export not found' }, 404);

  return c.json({ export: exportRecord });
});

// ── GET /:id/download — stream file from R2 ───────────────────────────────────

exportsRouter.get('/:id/download', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const exportRecord = await c.env.DB.prepare(
    'SELECT * FROM exports WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Export>();

  if (!exportRecord) return c.json({ error: 'Export not found' }, 404);
  if (exportRecord.status !== 'ready' || !exportRecord.r2_key) {
    return c.json({ error: 'Export not ready' }, 409);
  }

  const obj = await c.env.R2.get(exportRecord.r2_key);
  if (!obj) return c.json({ error: 'File not found in storage' }, 404);

  const filename = `taxmaker_${exportRecord.period_start}_${exportRecord.period_end}.csv`;

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

export default exportsRouter;
