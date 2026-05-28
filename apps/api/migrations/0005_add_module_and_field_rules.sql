-- =============================================================================
-- 0005 — Per-tenant module toggle + per-tenant field rules
--
-- From CLAUDE.md:
--   - hcentermodules: which specialty modules are enabled per HCenter.
--     Only superadmins can write. ModuleEnabledGuard reads this.
--   - hcenterfieldrules: per-tenant field visibility/requirement, replacing the
--     hardcoded Is*Required columns going forward.
-- =============================================================================

CREATE TABLE IF NOT EXISTS hcentermodules (
  HCenterID    char(36)     NOT NULL,
  ModuleKey    varchar(50)  NOT NULL,
  IsEnabled    tinyint(1)   NOT NULL DEFAULT 0,
  EnabledAt    datetime(3)  NULL,
  EnabledBy    char(36)     NULL,
  DisabledAt   datetime(3)  NULL,
  DisabledBy   char(36)     NULL,
  Notes        varchar(500) NULL,
  PRIMARY KEY (HCenterID, ModuleKey),
  CONSTRAINT fk_hcmod_hcenter  FOREIGN KEY (HCenterID)  REFERENCES hcenters(HCenterID) ON DELETE CASCADE,
  CONSTRAINT fk_hcmod_enabledby  FOREIGN KEY (EnabledBy)  REFERENCES hcenterusers(UserId),
  CONSTRAINT fk_hcmod_disabledby FOREIGN KEY (DisabledBy) REFERENCES hcenterusers(UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hcenterfieldrules (
  HCenterID     char(36)     NOT NULL,
  EntityName    varchar(100) NOT NULL,  -- 'patient', 'visit', 'invoice', etc.
  FieldName     varchar(100) NOT NULL,  -- 'phone', 'nationality', etc.
  Visibility    varchar(20)  NOT NULL DEFAULT 'visible',  -- hidden | visible | readonly
  Requirement   varchar(20)  NOT NULL DEFAULT 'optional', -- optional | required | conditional
  ConditionJson json         NULL,                          -- predicate for `conditional`
  DefaultValue  varchar(500) NULL,
  LabelEn       varchar(200) NULL,
  LabelAr       varchar(200) NULL,
  UpdatedBy     char(36)     NULL,
  UpdatedAt     datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (HCenterID, EntityName, FieldName),
  CONSTRAINT fk_hcfr_hcenter   FOREIGN KEY (HCenterID) REFERENCES hcenters(HCenterID) ON DELETE CASCADE,
  CONSTRAINT fk_hcfr_updatedby FOREIGN KEY (UpdatedBy) REFERENCES hcenterusers(UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: enable core modules for every existing HCenter (auth/patient/scheduling/visit
-- are core per CLAUDE.md and cannot be disabled — but they get a row anyway so the
-- module-toggle UI shows them as read-only enabled).
INSERT IGNORE INTO hcentermodules (HCenterID, ModuleKey, IsEnabled, EnabledAt)
SELECT h.HCenterID, m.ModuleKey, 1, NOW(3)
FROM hcenters h
CROSS JOIN (
  SELECT 'auth' AS ModuleKey UNION ALL
  SELECT 'patient' UNION ALL
  SELECT 'scheduling' UNION ALL
  SELECT 'visit' UNION ALL
  SELECT 'billing' UNION ALL
  SELECT 'finance' UNION ALL
  SELECT 'reports'
) m;
