-- =============================================================================
-- 0003 — Add auth + super-admin + locale columns to hcenterusers
--
-- Per CLAUDE.md (no password column today + ModuleEnabledGuard needs IsSuperAdmin
-- + JWT carries `lang` claim from PreferredLanguage) and security-and-ops.md
-- §12.2 (argon2id/bcrypt cost ≥ 12, lockout after 5 failed logins).
--
-- All columns nullable or with defaults — safe to apply to a populated table.
-- Existing rows: password_hash stays NULL until the user is migrated/sets one.
-- =============================================================================

ALTER TABLE hcenterusers
  ADD COLUMN IF NOT EXISTS PasswordHash           varchar(255) NULL AFTER UserName,
  ADD COLUMN IF NOT EXISTS PasswordChangedAt      datetime(3)  NULL AFTER PasswordHash,
  ADD COLUMN IF NOT EXISTS FailedLoginAttempts    int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS LockedUntil            datetime(3)  NULL,
  ADD COLUMN IF NOT EXISTS LastLoginAt            datetime(3)  NULL,
  ADD COLUMN IF NOT EXISTS LastLoginIp            varchar(45)  NULL,
  ADD COLUMN IF NOT EXISTS IsSuperAdmin           tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS PreferredLanguage      char(2)      NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS MfaEnabled             tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS MfaSecret              varchar(64)  NULL,
  ADD COLUMN IF NOT EXISTS CreatedAt              datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS UpdatedAt              datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- Lookup index for login by username.
CREATE INDEX IF NOT EXISTS idx_user_login ON hcenterusers(UserName, IsActive);
