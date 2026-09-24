CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  platform TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, kind, platform)
) WITHOUT ROWID;
