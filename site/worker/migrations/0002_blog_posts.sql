CREATE TABLE IF NOT EXISTS blog_posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  markdown TEXT NOT NULL,
  published_at TEXT,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;
