CREATE TABLE IF NOT EXISTS blobs (
  store TEXT NOT NULL,
  key TEXT NOT NULL,
  part INTEGER NOT NULL DEFAULT 0,
  data BLOB,
  meta TEXT,
  ctype TEXT,
  updated INTEGER,
  PRIMARY KEY (store, key, part)
);
