-- =============================================================================
-- 0004 — audit_log table (docs/security-and-ops.md §12.3)
--
-- Append-only HIPAA-style log. Every PHI read/write writes one row here.
-- Per CLAUDE.md hard rule #5 — never bypass this table when touching patient
-- data. The audit interceptor on the API side enforces this.
--
-- No FKs from audit_log → other tables, because we want the log to survive
-- even if records are hard-deleted (e.g., right-to-be-forgotten flows).
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  AuditID         bigint        NOT NULL AUTO_INCREMENT,
  EventTime       datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UserID          char(36)      NOT NULL,
  HCenterID       char(36)      NOT NULL,
  IPAddress       varchar(45)   NOT NULL,
  UserAgent       varchar(500)  NULL,
  Action          varchar(50)   NOT NULL,  -- View | Create | Update | Delete | Export | Print | Login | LoginFailed | Logout
  EntityType      varchar(100)  NOT NULL,  -- 'Patient', 'PatientVisit', etc.
  EntityID        char(36)      NULL,      -- nullable for actions like 'Login' that don't target a single entity
  PatientContext  char(36)      NULL,      -- always log which patient was touched, even for indirect actions
  ChangedFields   json          NULL,
  PreviousValues  json          NULL,
  NewValues       json          NULL,
  CorrelationID   char(36)      NOT NULL,
  Outcome         varchar(20)   NOT NULL DEFAULT 'success',  -- success | denied | error
  ErrorMessage    varchar(500)  NULL,
  PRIMARY KEY (AuditID),
  INDEX idx_audit_hcenter_time (HCenterID, EventTime),
  INDEX idx_audit_patient_time (PatientContext, EventTime),
  INDEX idx_audit_user_time    (UserID, EventTime),
  INDEX idx_audit_entity       (EntityType, EntityID),
  INDEX idx_audit_correlation  (CorrelationID)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
