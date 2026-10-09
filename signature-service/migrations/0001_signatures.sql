CREATE TABLE signatures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved')),
  image_key TEXT NOT NULL UNIQUE,
  image_width INTEGER NOT NULL,
  image_height INTEGER NOT NULL,
  page TEXT CHECK(page IN ('left', 'right')),
  x REAL, y REAL, display_width REAL, display_height REAL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX signatures_status ON signatures(status, created_at);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
