-- TaxMaker D1 Schema
-- NZ GST Receipt Management System

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  revoked_at  TEXT,
  user_agent  TEXT,
  ip_prefix   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'custom' CHECK(kind IN ('system','custom')),
  gst_claim_mode TEXT NOT NULL DEFAULT 'claimable' CHECK(gst_claim_mode IN ('claimable','non_claimable','mixed','special_adjustment')),
  color       TEXT NOT NULL DEFAULT '#8A98A3',
  icon        TEXT NOT NULL DEFAULT 'tag',
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

CREATE TABLE IF NOT EXISTS receipts (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','processing','needs_review','confirmed','failed')),
  source                TEXT NOT NULL DEFAULT 'gallery' CHECK(source IN ('camera','gallery')),
  image_r2_key          TEXT NOT NULL,
  image_mime            TEXT NOT NULL DEFAULT 'image/jpeg',
  merchant_name         TEXT,
  receipt_date          TEXT,
  currency              TEXT NOT NULL DEFAULT 'NZD',
  total_amount          REAL,
  gst_amount            REAL,
  net_amount            REAL,
  suggested_category_id TEXT REFERENCES categories(id),
  final_category_id     TEXT REFERENCES categories(id),
  reclassify_all        INTEGER NOT NULL DEFAULT 0,
  gst_treatment         TEXT NOT NULL DEFAULT '100_claimable' CHECK(gst_treatment IN ('100_claimable','0_claimable','special_adjustment')),
  ai_provider           TEXT,
  ai_model              TEXT,
  ai_confidence         REAL,
  failure_reason        TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  confirmed_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_receipts_user   ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_date   ON receipts(user_id, receipt_date);

CREATE TABLE IF NOT EXISTS receipt_items (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt_id            TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  line_no               INTEGER NOT NULL,
  description           TEXT NOT NULL,
  quantity              REAL,
  unit_price            REAL,
  line_total            REAL NOT NULL,
  suggested_category_id TEXT REFERENCES categories(id),
  final_category_id     TEXT REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_items_receipt ON receipt_items(receipt_id);

CREATE TABLE IF NOT EXISTS ai_runs (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt_id     TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL DEFAULT 'gemini',
  model          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','success','failed')),
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  response_json  TEXT,
  error_message  TEXT,
  started_at     TEXT,
  finished_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_receipt ON ai_runs(receipt_id);

CREATE TABLE IF NOT EXISTS exports (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_type  TEXT NOT NULL CHECK(export_type IN ('gst_summary','csv','pdf_archive')),
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','ready','failed')),
  r2_key       TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  finished_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_exports_user ON exports(user_id);

-- ── Seed system categories (NZ IRD business expense categories) ──────────────
INSERT OR IGNORE INTO categories (id, user_id, name, kind, gst_claim_mode, color, icon, sort_order) VALUES
  ('cat_office',       NULL, '办公文具',   'system', 'claimable',         '#7B61FF', 'briefcase', 1),
  ('cat_travel',       NULL, '差旅住宿',   'system', 'claimable',         '#E0A62B', 'calendar',  2),
  ('cat_transport',    NULL, '车辆交通',   'system', 'claimable',         '#3D8CF5', 'car',       3),
  ('cat_food',         NULL, '餐饮招待',   'system', 'special_adjustment','#F2704E', 'coffee',    4),
  ('cat_comms',        NULL, '通讯网络',   'system', 'claimable',         '#13B5B1', 'send',      5),
  ('cat_professional', NULL, '专业服务',   'system', 'claimable',         '#D94F8A', 'users',     6),
  ('cat_equipment',    NULL, '设备技术',   'system', 'claimable',         '#F59E0B', 'monitor',   7),
  ('cat_marketing',    NULL, '市场推广',   'system', 'claimable',         '#10B981', 'megaphone', 8),
  ('cat_training',     NULL, '培训教育',   'system', 'claimable',         '#6366F1', 'book',      9),
  ('cat_rent',         NULL, '租金水电',   'system', 'claimable',         '#8B5CF6', 'home',      10),
  ('cat_insurance',    NULL, '保险费用',   'system', 'claimable',         '#EC4899', 'shield',    11);
