-- =============================================================================
-- 0006 — Convert JSON columns to LONGTEXT
--
-- MariaDB stores JSON as LONGTEXT under the hood and auto-creates
-- `CHECK (json_valid(col))` constraints on every JSON column. drizzle-kit 0.31
-- introspection hangs when it encounters these CHECK constraints.
--
-- Fix: declare the columns as LONGTEXT directly. We validate JSON shape at the
-- application layer using zod (writes only flow through our NestJS services).
-- This drops the implicit CHECK constraints in the process.
--
-- Tables affected: audit_log (3 cols), hcenterfieldrules (1 col).
-- Both tables are empty so this is data-safe.
-- =============================================================================

ALTER TABLE audit_log
  MODIFY ChangedFields  LONGTEXT NULL,
  MODIFY PreviousValues LONGTEXT NULL,
  MODIFY NewValues      LONGTEXT NULL;

ALTER TABLE hcenterfieldrules
  MODIFY ConditionJson  LONGTEXT NULL;
