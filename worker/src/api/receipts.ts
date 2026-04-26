import { Hono } from 'hono';
import type { Env, Receipt, ReceiptItem } from '../types';
import { sha256hex, generateId } from '../lib/crypto';
import { recognizeReceipt } from '../lib/ai';
import { COOKIE_NAME } from './auth';

const receipts = new Hono<{ Bindings: Env }>();

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

// ── Allowed MIME types ────────────────────────────────────────────────────────

const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

// ── Category name → ID lookup ─────────────────────────────────────────────────

const SYSTEM_CATEGORY_MAP: Record<string, string> = {
  '办公文具': 'cat_office',
  '差旅住宿': 'cat_travel',
  '车辆交通': 'cat_transport',
  '餐饮招待': 'cat_food',
  '通讯网络': 'cat_comms',
  '专业服务': 'cat_professional',
  '设备技术': 'cat_equipment',
  '市场推广': 'cat_marketing',
  '培训教育': 'cat_training',
  '租金水电': 'cat_rent',
  '保险费用': 'cat_insurance',
  // Legacy aliases (for backwards compat with old AI output)
  '办公用品': 'cat_office',
  '差旅': 'cat_travel',
  '交通': 'cat_transport',
  '餐饮': 'cat_food',
  '通讯': 'cat_comms',
  '娱乐': 'cat_food',
  '其他': 'cat_office',
};

// ── Keyword-based category fallback (when AI returns null) ────────────────────
// Returns a Chinese category name or null
function guessCategoryFromText(merchant: string | null, rawText: string): string | null {
  // Use merchant name as primary signal (more reliable than raw text)
  const m = (merchant ?? '').toLowerCase();
  const full = (m + ' ' + rawText).toLowerCase();

  // Transport FIRST — fuel wins over grocery brand name (e.g. "pak'nsave fuel")
  if (/fuel|petrol|diesel/.test(m)) return '车辆交通';
  if (/z energy|bp |gull |mobil |caltex|shell\b|ampol|speedway/.test(m)) return '车辆交通';
  if (/parking|carpark|car park|vtnz|wof |warrant|rego\b|registration/.test(m)) return '车辆交通';
  if (/uber|lyft|taxi|cab\b|bus |train |ferry/.test(m)) return '车辆交通';
  // Also check raw text for transport keywords
  if (/fuel|petrol|diesel|z energy|gull petrol|bp petrol/.test(full) && !/restaurant|cafe|supermarket/.test(m)) return '车辆交通';

  // Food / groceries
  const FOOD_BRANDS = ['countdown','pak\'nsave','new world','fresh choice','four square','foodstuffs','woolworths','coles','aldi','costco','bin inn'];
  if (FOOD_BRANDS.some(b => m.includes(b))) return '餐饮招待';
  if (/restaurant|cafe|coffee|mcdonald|kfc|burger|pizza|subway|bakery|takeaway|noodle|sushi|kebab|fish.?chip/.test(m)) return '餐饮招待';
  if (/supermarket|grocery|liquor|bottle.?shop/.test(m)) return '餐饮招待';

  // Accommodation / travel
  if (/hotel|motel|airbnb|accommodation|lodge|hostel|flight|airline|airport|travel/.test(m)) return '差旅住宿';

  // Telecom
  if (/spark|vodafone|2degrees|skinny|one nz|telecom|broadband|internet|mobile|phone plan/.test(m)) return '通讯网络';

  // Professional services
  if (/accounting|lawyer|solicitor|legal|consultant|doctor|gp |medical|dental|pharmacy|chemist|vet |veterinary/.test(m)) return '专业服务';

  // Equipment / electronics
  if (/bunnings|mitre 10|placemakers|harvey norman|jb hi.?fi|noel leeming|pb tech|computer|laptop|monitor|printer|hardware|tool/.test(m)) return '设备技术';

  // Office supplies
  if (/warehouse stationery|officeworks|paper|stationery|printing|office supply/.test(m)) return '办公文具';

  // Rent / utilities
  if (/rent|rates|power|electric|gas bill|water bill|council|body corp/.test(m)) return '租金水电';

  // Insurance
  if (/insurance|aa insurance|state insurance|tower insurance|ami insurance/.test(m)) return '保险费用';

  // Marketing
  if (/advertising|google ads|facebook ads|instagram|linkedin|marketing|design|photography/.test(m)) return '市场推广';

  return null;
}

async function categoryNameToId(
  name: string | null,
  userId: string,
  db: D1Database
): Promise<string | null> {
  if (!name) return null;

  // Try system map first
  if (SYSTEM_CATEGORY_MAP[name]) return SYSTEM_CATEGORY_MAP[name];

  // Try user's custom categories
  const custom = await db
    .prepare(`SELECT id FROM categories WHERE user_id = ? AND name = ? AND is_active = 1`)
    .bind(userId, name)
    .first<{ id: string }>();

  return custom?.id ?? 'cat_office';
}

// ── Background: recognizeAndSave ──────────────────────────────────────────────

async function recognizeAndSave(
  receiptId: string,
  r2Key: string,
  mimeType: string,
  userId: string,
  env: Env
): Promise<void> {
  const now = () => new Date().toISOString();
  const model = env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite';
  const aiRunId = generateId();

  // Create AI run record
  await env.DB.prepare(
    `INSERT INTO ai_runs (id, receipt_id, provider, model, status, started_at)
     VALUES (?, ?, 'gemini', ?, 'running', ?)`
  )
    .bind(aiRunId, receiptId, model, now())
    .run();

  // Mark receipt as processing
  await env.DB.prepare(
    `UPDATE receipts SET status = 'processing', updated_at = ? WHERE id = ?`
  )
    .bind(now(), receiptId)
    .run();

  try {
    // Fetch from R2
    const obj = await env.R2.get(r2Key);
    if (!obj) throw new Error(`R2 object not found: ${r2Key}`);

    const arrayBuffer = await obj.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    // Call Gemini
    const result = await recognizeReceipt(base64, mimeType, env);

    // Process each detected receipt
    for (let receiptIdx = 0; receiptIdx < result.receipts.length; receiptIdx++) {
      const receiptData = result.receipts[receiptIdx];

      // First receipt updates the original record; additional ones create new records
      let targetReceiptId = receiptId;
      if (receiptIdx > 0) {
        targetReceiptId = generateId();
        await env.DB.prepare(
          `INSERT INTO receipts (id, user_id, status, source, image_r2_key, image_mime, created_at, updated_at)
           VALUES (?, ?, 'uploaded', 'gallery', ?, ?, ?, ?)`
        )
          .bind(targetReceiptId, userId, r2Key, mimeType, now(), now())
          .run();
      }

      // Map suggested category — fall back to keyword matching if AI returned null
      const aiCategory = receiptData.suggested_category
        ?? guessCategoryFromText(receiptData.merchant_name, receiptData.raw_text ?? '');
      const suggestedCategoryId = await categoryNameToId(aiCategory, userId, env.DB);

      // Determine GST treatment from category
      let gstTreatment: '100_claimable' | '0_claimable' | 'special_adjustment' = '100_claimable';
      if (suggestedCategoryId) {
        const cat = await env.DB.prepare(
          `SELECT gst_claim_mode FROM categories WHERE id = ?`
        )
          .bind(suggestedCategoryId)
          .first<{ gst_claim_mode: string }>();

        if (cat?.gst_claim_mode === 'non_claimable') gstTreatment = '0_claimable';
        else if (cat?.gst_claim_mode === 'special_adjustment') gstTreatment = 'special_adjustment';
      }

      const netAmount =
        receiptData.total_amount != null && receiptData.gst_amount != null
          ? Math.round((receiptData.total_amount - receiptData.gst_amount) * 100) / 100
          : null;

      // Update/set receipt fields
      await env.DB.prepare(
        `UPDATE receipts SET
          status = 'needs_review',
          merchant_name = ?,
          receipt_date = ?,
          currency = ?,
          total_amount = ?,
          gst_amount = ?,
          net_amount = ?,
          suggested_category_id = ?,
          final_category_id = ?,
          gst_treatment = ?,
          ai_provider = 'gemini',
          ai_model = ?,
          ai_confidence = ?,
          updated_at = ?
         WHERE id = ?`
      )
        .bind(
          receiptData.merchant_name,
          receiptData.receipt_date ?? null,
          receiptData.currency,
          receiptData.total_amount,
          receiptData.gst_amount,
          netAmount,
          suggestedCategoryId,
          suggestedCategoryId,
          gstTreatment,
          model,
          receiptData.confidence_summary,
          now(),
          targetReceiptId
        )
        .run();

      // Insert receipt items (each with per-item category)
      await env.DB.prepare(`DELETE FROM receipt_items WHERE receipt_id = ?`)
        .bind(targetReceiptId)
        .run();

      for (let i = 0; i < receiptData.items.length; i++) {
        const item = receiptData.items[i];
        const itemCatId = await categoryNameToId(item.suggested_category, userId, env.DB);
        await env.DB.prepare(
          `INSERT INTO receipt_items (receipt_id, line_no, description, quantity, unit_price, line_total, suggested_category_id, final_category_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            targetReceiptId,
            i + 1,
            item.description,
            item.quantity ?? null,
            item.unit_price ?? null,
            item.line_total,
            itemCatId,
            itemCatId
          )
          .run();
      }
    }

    // Mark AI run success
    await env.DB.prepare(
      `UPDATE ai_runs SET status = 'success', response_json = ?, finished_at = ? WHERE id = ?`
    )
      .bind(JSON.stringify(result), now(), aiRunId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE receipts SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`
      ).bind(message, now(), receiptId),
      env.DB.prepare(
        `UPDATE ai_runs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`
      ).bind(message, now(), aiRunId),
    ]);
  }
}

// ── POST /upload ──────────────────────────────────────────────────────────────

receipts.post('/upload', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Expected multipart/form-data' }, 400);
  }

  const imageFile = formData.get('image') as File | null;
  if (!imageFile || typeof imageFile !== 'object' || !('size' in imageFile)) {
    return c.json({ error: 'Missing image file field' }, 400);
  }

  const source = (formData.get('source') as string) ?? 'gallery';
  if (!['camera', 'gallery'].includes(source)) {
    return c.json({ error: 'source must be camera or gallery' }, 400);
  }

  const mimeType = imageFile.type || 'image/jpeg';
  const ext = ALLOWED_MIMES[mimeType];
  if (!ext) {
    return c.json(
      { error: `File type not allowed. Supported: ${Object.keys(ALLOWED_MIMES).join(', ')}` },
      415
    );
  }

  const maxMb = parseFloat(c.env.MAX_UPLOAD_MB ?? '10');
  const maxBytes = maxMb * 1024 * 1024;
  if (imageFile.size > maxBytes) {
    return c.json({ error: `File too large. Max size: ${maxMb}MB` }, 413);
  }

  const receiptId = generateId();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const r2Key = `receipts/${userId}/${yyyy}/${mm}/${receiptId}/original.${ext}`;

  const arrayBuffer = await imageFile.arrayBuffer();

  // Upload to R2
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: mimeType },
  });

  const nowStr = now.toISOString();

  // Insert receipt record
  await c.env.DB.prepare(
    `INSERT INTO receipts (id, user_id, status, source, image_r2_key, image_mime, created_at, updated_at)
     VALUES (?, ?, 'uploaded', ?, ?, ?, ?, ?)`
  )
    .bind(receiptId, userId, source, r2Key, mimeType, nowStr, nowStr)
    .run();

  const receipt = await c.env.DB.prepare('SELECT * FROM receipts WHERE id = ?')
    .bind(receiptId)
    .first<Receipt>();

  // Trigger AI recognition in background
  c.executionCtx.waitUntil(
    recognizeAndSave(receiptId, r2Key, mimeType, userId, c.env)
  );

  return c.json({ receipt }, 202);
});

// ── GET / — list receipts ─────────────────────────────────────────────────────

receipts.get('/', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const status = c.req.query('status');
  const periodStart = c.req.query('period_start');
  const periodEnd = c.req.query('period_end');
  const categoryId = c.req.query('category_id');
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('per_page') ?? '20', 10)));
  const offset = (page - 1) * perPage;

  const conditions: string[] = ['r.user_id = ?'];
  const bindings: unknown[] = [userId];

  if (status) {
    conditions.push('r.status = ?');
    bindings.push(status);
  }
  if (periodStart) {
    conditions.push('r.receipt_date >= ?');
    bindings.push(periodStart);
  }
  if (periodEnd) {
    conditions.push('r.receipt_date <= ?');
    bindings.push(periodEnd);
  }
  if (categoryId) {
    conditions.push('(r.final_category_id = ? OR r.suggested_category_id = ?)');
    bindings.push(categoryId, categoryId);
  }

  const where = conditions.join(' AND ');

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM receipts r WHERE ${where}`
  )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;

  const result = await c.env.DB.prepare(
    `SELECT r.* FROM receipts r WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...bindings, perPage, offset)
    .all<Receipt>();

  return c.json({
    receipts: result.results,
    total,
    page,
    per_page: perPage,
  });
});

// ── GET /:id — single receipt with items ──────────────────────────────────────

receipts.get('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT * FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Receipt>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  const items = await c.env.DB.prepare(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY line_no'
  )
    .bind(id)
    .all<ReceiptItem>();

  return c.json({ receipt, items: items.results });
});

// ── GET /:id/image — stream image from R2 ────────────────────────────────────

receipts.get('/:id/image', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT image_r2_key, image_mime FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ image_r2_key: string; image_mime: string }>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  const obj = await c.env.R2.get(receipt.image_r2_key);
  if (!obj) return c.json({ error: 'Image not found in storage' }, 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': receipt.image_mime,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

// ── PATCH /:id — update receipt ───────────────────────────────────────────────

receipts.patch('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT * FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Receipt>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const patch = body as Record<string, unknown>;
  const updates: string[] = [];
  const values: unknown[] = [];
  const now = new Date().toISOString();

  const editableStringFields = [
    'merchant_name',
    'receipt_date',
    'currency',
    'notes',
    'gst_treatment',
    'final_category_id',
  ];

  for (const field of editableStringFields) {
    if (field in patch) {
      if (field === 'gst_treatment') {
        const valid = ['100_claimable', '0_claimable', 'special_adjustment'];
        if (!valid.includes(patch[field] as string)) {
          return c.json({ error: `gst_treatment must be one of: ${valid.join(', ')}` }, 400);
        }
      }
      updates.push(`${field} = ?`);
      values.push(patch[field] ?? null);
    }
  }

  const editableNumberFields = ['total_amount', 'gst_amount', 'net_amount'];
  for (const field of editableNumberFields) {
    if (field in patch) {
      updates.push(`${field} = ?`);
      values.push(patch[field] ?? null);
    }
  }

  // Auto-recalculate net_amount when total_amount or gst_amount changes
  // but net_amount is not explicitly provided in the patch
  if (('total_amount' in patch || 'gst_amount' in patch) && !('net_amount' in patch)) {
    // Fetch current values to fill in the blanks
    const current = await c.env.DB.prepare('SELECT total_amount, gst_amount FROM receipts WHERE id = ?')
      .bind(id)
      .first<{ total_amount: number | null; gst_amount: number | null }>();
    const total = (patch['total_amount'] as number | null | undefined) ?? current?.total_amount ?? null;
    const gst = (patch['gst_amount'] as number | null | undefined) ?? current?.gst_amount ?? null;
    if (total != null && gst != null) {
      updates.push('net_amount = ?');
      values.push(Math.round((total - gst) * 100) / 100);
    }
  }

  if ('reclassify_all' in patch) {
    updates.push('reclassify_all = ?');
    values.push(patch['reclassify_all'] ? 1 : 0);
  }

  // Handle items update
  const newItems = patch['items'];
  if (Array.isArray(newItems)) {
    await c.env.DB.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').bind(id).run();

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i] as Record<string, unknown>;
      await c.env.DB.prepare(
        `INSERT INTO receipt_items (receipt_id, line_no, description, quantity, unit_price, line_total, suggested_category_id, final_category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          i + 1,
          item['description'] ?? '',
          item['quantity'] ?? null,
          item['unit_price'] ?? null,
          item['line_total'] ?? 0,
          item['suggested_category_id'] ?? null,
          item['final_category_id'] ?? null
        )
        .run();
    }
  }

  if (updates.length === 0 && !Array.isArray(newItems)) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now, id);

    await c.env.DB.prepare(
      `UPDATE receipts SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();
  }

  // If reclassify_all is set and a final_category_id is provided,
  // propagate the category to all line items of this receipt.
  if (patch['reclassify_all'] && 'final_category_id' in patch) {
    await c.env.DB.prepare(
      'UPDATE receipt_items SET final_category_id = ? WHERE receipt_id = ?'
    )
      .bind(patch['final_category_id'] ?? null, id)
      .run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM receipts WHERE id = ?')
    .bind(id)
    .first<Receipt>();

  const items = await c.env.DB.prepare(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY line_no'
  )
    .bind(id)
    .all<ReceiptItem>();

  return c.json({ receipt: updated, items: items.results });
});

// ── POST /:id/confirm ─────────────────────────────────────────────────────────

receipts.post('/:id/confirm', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT * FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Receipt>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  if (!receipt.total_amount || !receipt.receipt_date) {
    return c.json(
      { error: 'Cannot confirm: total_amount and receipt_date are required' },
      422
    );
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE receipts SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(now, now, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM receipts WHERE id = ?')
    .bind(id)
    .first<Receipt>();

  return c.json({ receipt: updated });
});

// ── POST /:id/reprocess ───────────────────────────────────────────────────────

receipts.post('/:id/reprocess', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT * FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<Receipt>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  const now = new Date().toISOString();

  // Reset AI fields
  await c.env.DB.prepare(
    `UPDATE receipts SET
      status = 'uploaded',
      merchant_name = NULL,
      receipt_date = NULL,
      total_amount = NULL,
      gst_amount = NULL,
      net_amount = NULL,
      suggested_category_id = NULL,
      ai_provider = NULL,
      ai_model = NULL,
      ai_confidence = NULL,
      failure_reason = NULL,
      updated_at = ?
     WHERE id = ?`
  )
    .bind(now, id)
    .run();

  // Trigger reprocessing
  c.executionCtx.waitUntil(
    recognizeAndSave(receipt.id, receipt.image_r2_key, receipt.image_mime, userId, c.env)
  );

  const updated = await c.env.DB.prepare('SELECT * FROM receipts WHERE id = ?')
    .bind(id)
    .first<Receipt>();

  return c.json({ receipt: updated });
});

// ── DELETE /:id — permanently delete a receipt and its image ─────────────────

receipts.delete('/:id', async (c) => {
  const userId = await requireAuth(c);
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');

  const receipt = await c.env.DB.prepare(
    'SELECT image_r2_key FROM receipts WHERE id = ? AND user_id = ?'
  )
    .bind(id, userId)
    .first<{ image_r2_key: string | null }>();

  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

  // Best-effort delete from R2 (ignore failures so DB cleanup still proceeds)
  if (receipt.image_r2_key) {
    try {
      await c.env.R2.delete(receipt.image_r2_key);
    } catch { /* ignore — DB cleanup is the source of truth */ }
  }

  // Cascade-delete items first, then the receipt itself
  await c.env.DB.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM receipts WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();

  return c.json({ ok: true });
});

export default receipts;
