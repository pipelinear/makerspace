CREATE TABLE r2_usage (
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('read', 'write')),
  count INTEGER NOT NULL CHECK(count > 0),
  PRIMARY KEY(day, kind)
);
CREATE INDEX r2_usage_kind_day ON r2_usage(kind, day);

-- Track reservations too, so concurrent or interrupted uploads stay within
-- the storage cap. Old images get their previous maximum size as an estimate.
CREATE TABLE r2_storage (
  object_key TEXT PRIMARY KEY,
  byte_count INTEGER NOT NULL CHECK(byte_count > 0),
  created_at INTEGER NOT NULL
);
INSERT INTO r2_storage(object_key, byte_count, created_at)
SELECT image_key, 2097152, created_at FROM signatures;
