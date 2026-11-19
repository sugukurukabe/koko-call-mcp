-- JP Bids MCP Cloudflare D1 schema: user feedback, self-healing audit log, and daily rollups
-- Zero PII: message_sanitized is redacted before INSERT (JWT/keys/emails/phone numbers stripped).

CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  context TEXT NOT NULL,
  lang TEXT NOT NULL,
  message_sanitized TEXT NOT NULL,
  country TEXT NOT NULL,
  client_family TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_tool_name ON user_feedback (tool_name);

CREATE TABLE IF NOT EXISTS self_healing_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  target TEXT NOT NULL,
  detail_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_self_healing_created_at ON self_healing_events (created_at DESC);

CREATE TABLE IF NOT EXISTS daily_rollups (
  day_utc TEXT NOT NULL,
  rpc_method TEXT NOT NULL,
  target_name TEXT NOT NULL,
  outcome TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  zero_hits INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  p50_ms REAL NOT NULL DEFAULT 0,
  p95_ms REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day_utc, rpc_method, target_name, outcome)
);
