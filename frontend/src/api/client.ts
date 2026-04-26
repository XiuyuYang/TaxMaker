// ─── API Types ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  kind: string;
  gst_claim_mode: string;
  color: string;
  icon: string;
  is_active: number;
  sort_order: number;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  line_no: number;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number;
  suggested_category_id: string | null;
  final_category_id: string | null;
}

export interface Receipt {
  id: string;
  user_id: string;
  status: 'uploaded' | 'processing' | 'needs_review' | 'confirmed' | 'failed';
  source: string;
  image_r2_key: string;
  merchant_name: string | null;
  receipt_date: string | null;
  currency: string;
  total_amount: number | null;
  gst_amount: number | null;
  net_amount: number | null;
  suggested_category_id: string | null;
  final_category_id: string | null;
  reclassify_all: number;
  gst_treatment: string;
  ai_confidence: number | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  items?: ReceiptItem[];
}

export interface GSTSummary {
  period_start: string;
  period_end: string;
  total_purchases_inclusive: number;
  total_gst_claimable: number;
  total_gst_non_claimable: number;
  special_adjustments_count: number;
  box_11: number;
  box_12: number;
  box_13_adjustments: number;
  receipt_count: number;
}

// ─── Base path ────────────────────────────────────────────────────────────
// import.meta.env.BASE_URL is '/tax/' (set via vite base option). Strip the
// trailing slash so we can prefix paths like /api/auth/me → /tax/api/auth/me.
const BASE = (import.meta.env.BASE_URL ?? '/tax/').replace(/\/$/, '');

// ─── Helpers ──────────────────────────────────────────────────────────────
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return p ? `?${p}` : '';
}

// ─── API Object ───────────────────────────────────────────────────────────
export const api = {
  auth: {
    async me(): Promise<User> {
      const res = await request<{ user: User }>('/api/auth/me');
      return res.user;
    },
    async login(username: string, password: string): Promise<User> {
      const res = await request<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      return res.user;
    },
    async register(username: string, password: string): Promise<User> {
      const res = await request<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      return res.user;
    },
    logout(): Promise<void> {
      return request<void>('/api/auth/logout', { method: 'POST' });
    },
  },

  categories: {
    async list(): Promise<Category[]> {
      const res = await request<{ categories: Category[] }>('/api/categories');
      return res.categories;
    },
    async create(data: Partial<Category>): Promise<Category> {
      const res = await request<{ category: Category }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.category;
    },
    async update(id: string, data: Partial<Category>): Promise<Category> {
      const res = await request<{ category: Category }>(`/api/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res.category;
    },
    delete(id: string): Promise<void> {
      return request<void>(`/api/categories/${id}`, { method: 'DELETE' });
    },
  },

  receipts: {
    list(params?: { status?: string; page?: number; per_page?: number }): Promise<{ receipts: Receipt[]; total: number }> {
      return request<{ receipts: Receipt[]; total: number }>(`/api/receipts${qs(params ?? {})}`);
    },
    async get(id: string): Promise<Receipt> {
      const res = await request<{ receipt: Receipt; items: ReceiptItem[] }>(`/api/receipts/${id}`);
      return { ...res.receipt, items: res.items };
    },
    async upload(file: File, source: 'camera' | 'gallery'): Promise<Receipt> {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('source', source);
      const res = await request<{ receipt: Receipt }>('/api/receipts/upload', {
        method: 'POST',
        headers: {},
        body: fd,
      });
      return res.receipt;
    },
    async update(id: string, data: Partial<Receipt>): Promise<Receipt> {
      const res = await request<{ receipt: Receipt; items: ReceiptItem[] }>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return { ...res.receipt, items: res.items };
    },
    async confirm(id: string): Promise<Receipt> {
      const res = await request<{ receipt: Receipt }>(`/api/receipts/${id}/confirm`, { method: 'POST' });
      return res.receipt;
    },
    async reprocess(id: string): Promise<Receipt> {
      const res = await request<{ receipt: Receipt }>(`/api/receipts/${id}/reprocess`, { method: 'POST' });
      return res.receipt;
    },
    delete(id: string): Promise<void> {
      return request<void>(`/api/receipts/${id}`, { method: 'DELETE' });
    },
    imageUrl(id: string): string {
      return `${BASE}/api/receipts/${id}/image`;
    },
  },

  reports: {
    async gstSummary(period_start: string, period_end: string): Promise<GSTSummary> {
      const res = await request<{ summary: GSTSummary }>(`/api/reports/gst-summary${qs({ period_start, period_end })}`);
      return res.summary;
    },
  },

  exports: {
    createCsv(period_start: string, period_end: string): Promise<{ export_id: string }> {
      return request<{ export_id: string }>('/api/exports/csv', {
        method: 'POST',
        body: JSON.stringify({ period_start, period_end }),
      });
    },
    download(id: string): Promise<Response> {
      return fetch(`${BASE}/api/exports/${id}/download`, { credentials: 'include' });
    },
  },
};
