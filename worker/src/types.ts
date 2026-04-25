export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  AI_ENDPOINT?: string;
  BASE_PATH?: string;
  SESSION_DAYS?: string;
  MAX_UPLOAD_MB?: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_prefix: string | null;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  kind: 'system' | 'custom';
  gst_claim_mode: 'claimable' | 'non_claimable' | 'mixed' | 'special_adjustment';
  color: string;
  icon: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  status: 'uploaded' | 'processing' | 'needs_review' | 'confirmed' | 'failed';
  source: 'camera' | 'gallery';
  image_r2_key: string;
  image_mime: string;
  merchant_name: string | null;
  receipt_date: string | null;
  currency: string;
  total_amount: number | null;
  gst_amount: number | null;
  net_amount: number | null;
  suggested_category_id: string | null;
  final_category_id: string | null;
  reclassify_all: number;
  gst_treatment: '100_claimable' | '0_claimable' | 'special_adjustment';
  ai_provider: string | null;
  ai_model: string | null;
  ai_confidence: number | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
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

export interface AIRun {
  id: string;
  receipt_id: string;
  provider: string;
  model: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  prompt_version: string;
  response_json: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface Export {
  id: string;
  user_id: string;
  export_type: 'gst_summary' | 'csv' | 'pdf_archive';
  period_start: string;
  period_end: string;
  status: 'generating' | 'ready' | 'failed';
  r2_key: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface AIReceiptData {
  merchant_name: string | null;
  receipt_date: string | null;
  currency: string;
  total_amount: number | null;
  gst_amount: number | null;
  suggested_category: string | null;
  confidence_summary: number;
  items: Array<{
    description: string;
    quantity: number | null;
    unit_price: number | null;
    line_total: number;
    suggested_category: string | null;
  }>;
  raw_text?: string;
}

export interface AIResult {
  receipts: AIReceiptData[];
}
