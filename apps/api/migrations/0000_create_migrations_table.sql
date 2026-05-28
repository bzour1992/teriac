-- Bootstrap: tracking table for our hand-rolled migrations.
-- Drizzle-kit's own __drizzle_migrations table is separate; this one is for the
-- SQL files in apps/api/migrations/ that we apply via scripts/run-migrations.sh.

CREATE TABLE IF NOT EXISTS _teriac_migrations (
  id           varchar(64)  NOT NULL,
  applied_at   datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  duration_ms  int          NOT NULL,
  checksum     varchar(64)  NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
