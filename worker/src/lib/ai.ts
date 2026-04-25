import type { Env, AIResult, AIReceiptData } from '../types';

// Vision-capable model required for receipt OCR
const DEFAULT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const SYSTEM_PROMPT = `Parse the receipt image and return ONLY this JSON (no markdown, no explanation):
{"receipts":[{"merchant_name":null,"receipt_date":null,"currency":"NZD","total_amount":null,"gst_amount":null,"suggested_category":null,"confidence_summary":0,"items":[],"raw_text":""}]}

Categories for suggested_category field (use EXACTLY one of these strings):
办公文具 差旅住宿 车辆交通 餐饮招待 通讯网络 专业服务 设备技术 市场推广 培训教育 租金水电 保险费用

Rules:
- merchant_name: store/business name as string or null
- receipt_date: "YYYY-MM-DD" or null
- total_amount: total number including GST, or null
- gst_amount: GST amount (if shown) or total*15/115 rounded to 2dp, or null
- suggested_category: pick best matching category from the list above (never null if any fits)
- confidence_summary: 0-100 integer
- items: empty array [] (skip line items to save space)
- raw_text: first 100 chars of visible text only
- For multiple receipts in one image, add multiple objects to receipts array`;


export async function recognizeReceipt(
  imageBase64: string,
  mimeType: string,
  env: Env
): Promise<AIResult> {
  const endpoint = env.AI_ENDPOINT ?? DEFAULT_ENDPOINT;
  const model = env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite';

  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
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
      'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from Gemini API');
  }

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

function normalizeAIResult(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null) return;
  const r = parsed as Record<string, unknown>;
  if (!Array.isArray(r['receipts'])) return;
  for (const rec of r['receipts'] as unknown[]) {
    if (typeof rec !== 'object' || rec === null) continue;
    const obj = rec as Record<string, unknown>;
    // Coerce string numbers to actual numbers
    for (const field of ['total_amount', 'gst_amount', 'confidence_summary']) {
      if (field in obj) obj[field] = toNum(obj[field]);
    }
    // Ensure items is always an array
    if (!Array.isArray(obj['items'])) obj['items'] = [];
    for (const item of obj['items'] as unknown[]) {
      if (typeof item !== 'object' || item === null) continue;
      const i = item as Record<string, unknown>;
      for (const f of ['line_total', 'quantity', 'unit_price']) {
        if (f in i) i[f] = toNum(i[f]);
      }
    }
    // Ensure currency and raw_text are strings
    if (typeof obj['currency'] !== 'string') obj['currency'] = 'NZD';
    if (typeof obj['raw_text'] !== 'string') obj['raw_text'] = '';
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
