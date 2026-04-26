import type { Env, AIResult, AIReceiptData } from '../types';

// Vision-capable model required for receipt OCR
const DEFAULT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const SYSTEM_PROMPT = `You are a receipt OCR assistant. Analyze the receipt image carefully and return ONLY this JSON with no markdown, no explanation, no extra text:
{"receipts":[{"merchant_name":null,"receipt_date":null,"currency":"NZD","total_amount":null,"gst_amount":null,"suggested_category":null,"confidence_summary":0,"items":[],"raw_text":""}]}

CRITICAL RULES — follow exactly:
- merchant_name: exact business name as shown on receipt, or null
- receipt_date: MUST be "YYYY-MM-DD" format (e.g. "2026-03-15"). Read the year digit by digit — do NOT guess or round. If year is unclear, set null.
- total_amount: final total including GST as number, or null
- gst_amount: GST amount if shown, else compute total_amount * 15 / 115 rounded to 2dp, or null
- confidence_summary: integer 0-100
- items: [] (always empty — skip line items)
- raw_text: first 80 chars of visible text on receipt

suggested_category: choose EXACTLY one Chinese string from this list based on what was purchased:
- 餐饮招待 → food, beverages, groceries, supermarket, restaurant, cafe, fast food, alcohol, snacks
- 办公文具 → office supplies, stationery, printing, paper, pens
- 车辆交通 → fuel, petrol, parking, toll, transport, taxi, uber, bus, train
- 差旅住宿 → hotel, motel, accommodation, flights, travel
- 通讯网络 → phone, internet, mobile, telecom, data, broadband
- 专业服务 → accounting, legal, consulting, medical, dental, vet
- 设备技术 → electronics, hardware, computers, machinery, tools, appliances
- 市场推广 → advertising, marketing, photography, design, social media
- 培训教育 → courses, training, books, education, subscriptions
- 租金水电 → rent, power, electricity, gas, water, rates, insurance_property
- 保险费用 → insurance (life, health, vehicle)

For groceries/food stores (Countdown, Pak'nSave, New World, Coles, Woolworths, Foodstuffs, etc.) → ALWAYS use 餐饮招待`;



// OpenRouter fallback models if Google keys all fail
const OPENROUTER_FALLBACKS = [
  'baidu/qianfan-ocr-fast:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
];
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

async function callAI(
  endpoint: string,
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SYSTEM_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.1,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI API');
  return content;
}

export async function recognizeReceipt(
  imageBase64: string,
  mimeType: string,
  env: Env
): Promise<AIResult> {
  const googleEndpoint = env.AI_ENDPOINT ?? DEFAULT_ENDPOINT;
  const model = env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite';

  // Build Google API key pool from GEMINI_API_KEYS (comma-separated) or single GEMINI_API_KEY
  // Note: GEMINI_API_KEY may be an OpenRouter key (starts with 'sk-') — exclude from Google pool
  const rawKeys = env.GEMINI_API_KEYS
    ? env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
    : [];
  const primaryKey = env.GEMINI_API_KEY?.trim() ?? '';
  if (primaryKey && !primaryKey.startsWith('sk-')) rawKeys.push(primaryKey);
  // Deduplicate while preserving order
  const googleKeys = [...new Set(rawKeys)];

  // OpenRouter auth key: prefer GEMINI_API_KEY if it's an OpenRouter key, else try GEMINI_API_KEYS last entry
  const openRouterKey = primaryKey.startsWith('sk-') ? primaryKey : '';

  let lastError: Error | null = null;
  let content: string | null = null;

  // ── Phase 1: Try each Google key in rotation ────────────────────────────────
  for (const key of googleKeys) {
    try {
      content = await callAI(googleEndpoint, key, model, imageBase64, mimeType);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only hard-fail on clear content-level errors (not key/quota errors)
      const msg = lastError.message;
      const isKeyError = msg.includes('429') || msg.includes('401') || msg.includes('403')
        || msg.includes('API_KEY_INVALID') || msg.includes('RESOURCE_EXHAUSTED')
        || msg.includes('quota') || msg.includes('credits');
      if (!isKeyError) throw lastError; // bad image, malformed request etc — no point retrying
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // ── Phase 2: Fall back to OpenRouter free models ────────────────────────────
  if (!content && openRouterKey) {
    for (const fbModel of OPENROUTER_FALLBACKS) {
      try {
        content = await callAI(OPENROUTER_ENDPOINT, openRouterKey, fbModel, imageBase64, mimeType);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        // Hard-stop only on OpenRouter-level auth failure (not provider/model errors)
        const isOpenRouterAuth = (msg.includes('401') || msg.includes('403'))
          && !msg.includes('provider') && !msg.includes('Provider');
        if (isOpenRouterAuth) throw lastError;
        // For any other error (429 rate limit, 400 model rejection, etc.) try next model
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  if (!content) throw lastError ?? new Error('All AI models exhausted');

  // ── Parse JSON response ─────────────────────────────────────────────────────

  // Strip markdown fences and extract JSON object
  let cleaned = content
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // If still not starting with {, try to find the JSON object
  if (!cleaned.startsWith('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to recover truncated JSON by closing open structures
    const recovered = repairTruncatedJson(cleaned);
    try {
      parsed = JSON.parse(recovered);
    } catch {
      throw new Error(`Failed to parse Gemini JSON response: ${cleaned.slice(0, 800)}`);
    }
  }

  normalizeAIResult(parsed);
  if (!isValidAIResult(parsed)) {
    throw new Error(`Gemini response missing required fields: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  return parsed;
}

function isValidReceiptData(r: unknown): r is AIReceiptData {
  if (typeof r !== 'object' || r === null) return false;
  const obj = r as Record<string, unknown>;

  if (typeof obj['currency'] !== 'string') return false;
  if (typeof obj['confidence_summary'] !== 'number') return false;
  if (!Array.isArray(obj['items'])) return false;

  const nullableStrings = ['merchant_name', 'receipt_date', 'suggested_category'];
  for (const field of nullableStrings) {
    if (!(field in obj)) return false;
    if (obj[field] !== null && typeof obj[field] !== 'string') return false;
  }

  const nullableNumbers = ['total_amount', 'gst_amount'];
  for (const field of nullableNumbers) {
    if (!(field in obj)) return false;
    if (obj[field] !== null && typeof obj[field] !== 'number') return false;
  }

  for (const item of obj['items'] as unknown[]) {
    if (typeof item !== 'object' || item === null) return false;
    const i = item as Record<string, unknown>;
    if (typeof i['description'] !== 'string') return false;
    if (i['line_total'] !== null && typeof i['line_total'] !== 'number') return false;
  }

  return true;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}

/** Normalize a date string to YYYY-MM-DD regardless of input format. */
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const s = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m}-${d}`;
  }

  // Fallback: return first 10 chars if it looks date-like
  const slice = s.slice(0, 10).replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

function normalizeAIResult(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null) return;
  const r = parsed as Record<string, unknown>;
  if (!Array.isArray(r['receipts'])) return;
  for (const rec of r['receipts'] as unknown[]) {
    if (typeof rec !== 'object' || rec === null) continue;
    const obj = rec as Record<string, unknown>;

    // Coerce string numbers to actual numbers
    for (const field of ['total_amount', 'gst_amount']) {
      if (field in obj) obj[field] = toNum(obj[field]);
    }
    // confidence_summary: coerce and normalise to 0-100 range
    const rawConf = toNum(obj['confidence_summary']);
    obj['confidence_summary'] = rawConf === null
      ? 50
      : rawConf <= 1 ? Math.round(rawConf * 100) : rawConf;

    // Normalise date to YYYY-MM-DD
    obj['receipt_date'] = normalizeDate(obj['receipt_date']);

    // Ensure items is always an array
    if (!Array.isArray(obj['items'])) obj['items'] = [];
    for (const item of obj['items'] as unknown[]) {
      if (typeof item !== 'object' || item === null) continue;
      const i = item as Record<string, unknown>;
      // Field aliases for Baidu OCR model (item_description → description, price → line_total)
      if (typeof i['item_description'] === 'string' && typeof i['description'] !== 'string') {
        i['description'] = i['item_description'];
      }
      if (i['price'] !== undefined && i['line_total'] === undefined) {
        i['line_total'] = i['price'];
      }
      // Coerce numeric fields
      for (const f of ['line_total', 'quantity', 'unit_price']) {
        if (f in i) i[f] = toNum(i[f]);
      }
      // Ensure description exists
      if (typeof i['description'] !== 'string') i['description'] = '';
    }
    // Ensure currency and raw_text are strings
    if (typeof obj['currency'] !== 'string') obj['currency'] = 'NZD';
    if (typeof obj['raw_text'] !== 'string') obj['raw_text'] = '';
    // Ensure nullable string fields exist (some models omit them)
    for (const f of ['merchant_name', 'receipt_date', 'suggested_category']) {
      if (!(f in obj)) obj[f] = null;
    }
    // Ensure nullable number fields exist
    for (const f of ['total_amount', 'gst_amount']) {
      if (!(f in obj)) obj[f] = null;
    }
    // Ensure confidence_summary is present
    if (typeof obj['confidence_summary'] !== 'number') obj['confidence_summary'] = 50;
  }
}

function repairTruncatedJson(s: string): string {
  // Remove any trailing incomplete property/value
  let t = s.replace(/,?\s*"[^"]*"?\s*:\s*[^,\}\]]*$/, '');
  t = t.replace(/,\s*$/, '');
  // Close open arrays and objects
  const opens: string[] = [];
  let inStr = false;
  let escape = false;
  for (const ch of t) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if (ch === '}' || ch === ']') opens.pop();
  }
  return t + opens.reverse().join('');
}

export function isValidAIResult(result: unknown): result is AIResult {
  if (typeof result !== 'object' || result === null) return false;
  const r = result as Record<string, unknown>;
  if (!Array.isArray(r['receipts']) || r['receipts'].length === 0) return false;
  return (r['receipts'] as unknown[]).every(isValidReceiptData);
}
