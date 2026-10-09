CREATE TABLE IF NOT EXISTS ten_words_api_clients (
  id uuid PRIMARY KEY,
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  key_hash varchar(64) NOT NULL UNIQUE CHECK (length(key_hash)=64),
  key_prefix varchar(11) NOT NULL,
  scopes text[] NOT NULL CHECK (cardinality(scopes)>0 AND scopes <@ ARRAY['languages:read','lessons:read','audio:read']::text[]),
  rate_limit integer NOT NULL DEFAULT 120 CHECK (rate_limit BETWEEN 1 AND 120),
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute',now()),
  window_count integer NOT NULL DEFAULT 0 CHECK (window_count>=0),
  usage_count bigint NOT NULL DEFAULT 0 CHECK (usage_count>=0),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS ten_words_api_clients_owner_idx ON ten_words_api_clients(owner_id);
