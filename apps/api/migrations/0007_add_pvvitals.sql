-- =============================================================================
-- 0007 — Add pvvitals table for per-visit vital signs recording
--
-- Captures: BP (SBP/DBP), pulse, temperature (°C), SpO2, height, weight,
-- BMI, respiratory rate. One row per recording; a visit can have multiple
-- readings (e.g. pre/post medication check).
-- =============================================================================

CREATE TABLE IF NOT EXISTS pvvitals (
  PVVitalsID         char(36)     NOT NULL,
  PatientVisitID     char(36)     NOT NULL,
  RecordedAt         datetime(3)  NOT NULL,
  RecordedByUserID   char(36)     DEFAULT NULL,

  -- Anthropometric
  HeightCm           double       DEFAULT NULL,
  WeightKg           double       DEFAULT NULL,
  BMI                double       DEFAULT NULL,  -- auto-computed; stored for history

  -- Cardiovascular
  SBP                int          DEFAULT NULL COMMENT 'Systolic BP mmHg',
  DBP                int          DEFAULT NULL COMMENT 'Diastolic BP mmHg',
  PulseRate          int          DEFAULT NULL COMMENT 'Heart rate bpm',

  -- Respiratory / temperature
  TemperatureC       double       DEFAULT NULL COMMENT 'Body temperature Celsius',
  RespiratoryRate    int          DEFAULT NULL COMMENT 'Breaths per minute',
  SpO2               double       DEFAULT NULL COMMENT 'Oxygen saturation %',

  Notes              varchar(500) DEFAULT NULL,

  PRIMARY KEY (PVVitalsID),
  KEY idx_pvv_visit (PatientVisitID),
  CONSTRAINT fk_pvv_visit FOREIGN KEY (PatientVisitID)
    REFERENCES patientvisits (PatientVisitID) ON DELETE CASCADE,
  CONSTRAINT fk_pvv_user  FOREIGN KEY (RecordedByUserID)
    REFERENCES hcenterusers (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
