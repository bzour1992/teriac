-- 0009_attachments.sql
--
-- One polymorphic attachments table that every domain reuses: lab results,
-- ECG strips, scanned IDs, insurance cards, signed Rx PDFs, etc.
--
-- `EntityType` + `EntityID` form the polymorphic link to the row this
-- attachment belongs to. We index that pair for fast per-entity lookups, and
-- index `(HCenterID, UploadedAt)` for tenant-wide reports.
--
-- `StorageBackend` + `StorageKey` are the swap point — switching a clinic
-- from local FS to S3/R2 just rewrites these two columns + moves the bytes.
-- Every other consumer continues to look up the row by AttachmentID.

CREATE TABLE attachments (
  AttachmentID      CHAR(36)      NOT NULL,
  HCenterID         CHAR(36)      NOT NULL,
  EntityType        VARCHAR(60)   NOT NULL,
  EntityID          CHAR(36)      NOT NULL,
  PatientContext    CHAR(36)      NULL,
  StorageBackend    VARCHAR(20)   NOT NULL DEFAULT 'local',
  StorageKey        VARCHAR(500)  NOT NULL,
  OriginalFileName  VARCHAR(255)  NOT NULL,
  MimeType          VARCHAR(100)  NOT NULL,
  SizeBytes         BIGINT        NOT NULL,
  Checksum          CHAR(64)      NULL,
  ThumbnailKey      VARCHAR(500)  NULL,
  Category          VARCHAR(40)   NULL,
  Notes             VARCHAR(500)  NULL,
  UploadedBy        CHAR(36)      NOT NULL,
  UploadedAt        DATETIME(3)   NOT NULL,
  DeletedAt         DATETIME(3)   NULL,
  PRIMARY KEY (AttachmentID),
  KEY idx_att_entity         (EntityType, EntityID, DeletedAt),
  KEY idx_att_hcenter_time   (HCenterID, UploadedAt),
  KEY idx_att_patient        (PatientContext, UploadedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
