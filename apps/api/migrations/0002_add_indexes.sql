-- =============================================================================
-- 0002 — Add indexes (docs/schema-fks-indexes.md §8)
--
-- MariaDB 10.5+ supports `CREATE INDEX IF NOT EXISTS`, so this migration is
-- safely re-runnable.
-- =============================================================================

-- 8.1 Patients (high-traffic search & filtering)
CREATE INDEX IF NOT EXISTS idx_pt_hcenter_deleted  ON patients(HCenterID, IsDeleted);
CREATE INDEX IF NOT EXISTS idx_pt_hcenter_national ON patients(HCenterID, NationalID);
CREATE INDEX IF NOT EXISTS idx_pt_hcenter_mobile   ON patients(HCenterID, MobileNumber);
CREATE INDEX IF NOT EXISTS idx_pt_hcenter_email    ON patients(HCenterID, Email);
CREATE INDEX IF NOT EXISTS idx_pt_hcenter_dob      ON patients(HCenterID, DateOfBirth);
-- FULLTEXT cannot use IF NOT EXISTS in all versions; CREATE will error on re-run.
-- Wrap in a conditional so re-runs don't fail.
SET @ftx_pt_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'patients' AND index_name = 'ftx_pt_name');
SET @sql := IF(@ftx_pt_exists = 0,
  'CREATE FULLTEXT INDEX ftx_pt_name ON patients(FirstName, SecondName, ThirdName, LastName)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8.2 Visits
CREATE INDEX IF NOT EXISTS idx_pv_patient_date ON patientvisits(PatientID, VisitDate, IsDeleted);
CREATE INDEX IF NOT EXISTS idx_pv_doctor_date  ON patientvisits(Doctor, VisitDate);
CREATE INDEX IF NOT EXISTS idx_pv_parent       ON patientvisits(ParentVisitID);

-- 8.3 Scheduling
CREATE INDEX IF NOT EXISTS idx_sch_hcenter_date ON hcenterscheduleitems(HCenterID, ScheduledInDate);
CREATE INDEX IF NOT EXISTS idx_sch_doctor_date  ON hcenterscheduleitems(Doctor, ScheduledInDate);
CREATE INDEX IF NOT EXISTS idx_sch_patient      ON hcenterscheduleitems(PatientID);
CREATE INDEX IF NOT EXISTS idx_sch_status       ON hcenterscheduleitems(HCenterID, StatusID, ScheduledInDate);

-- 8.4 Billing & finance
CREATE INDEX IF NOT EXISTS idx_ft_hcenter_date  ON hcenterfinancaltransactions(HCenterID, AddDate);
CREATE INDEX IF NOT EXISTS idx_ft_wallet_date   ON hcenterfinancaltransactions(WalletID, AddDate);
CREATE INDEX IF NOT EXISTS idx_ft_patient_date  ON hcenterfinancaltransactions(PatientID, AddDate);
CREATE INDEX IF NOT EXISTS idx_ft_invoice       ON hcenterfinancaltransactions(PatientInvoiceID);
CREATE INDEX IF NOT EXISTS idx_ft_type_date     ON hcenterfinancaltransactions(HCenterID, TransactionType, AddDate);
CREATE INDEX IF NOT EXISTS idx_inv_hcenter_date ON patientinvoices(HCenterID, InvoiceDate);
CREATE INDEX IF NOT EXISTS idx_inv_patient_date ON patientinvoices(PatientID, InvoiceDate);
CREATE INDEX IF NOT EXISTS idx_pbr_visit        ON patientbillingrecords(PatientVisitID);
CREATE INDEX IF NOT EXISTS idx_pbr_date         ON patientbillingrecords(RecordDate);

-- 8.5 Patient history (1:N tables — query by PatientID)
CREATE INDEX IF NOT EXISTS idx_allerg_pt   ON allergies(PatientID);
CREATE INDEX IF NOT EXISTS idx_chronic_pt  ON chronicdiseases(PatientID);
CREATE INDEX IF NOT EXISTS idx_ptltm_pt    ON patientlongtermmedicines(PatientID);
CREATE INDEX IF NOT EXISTS idx_ptprob_pt   ON patientproblems(PatientID, IsActive);
CREATE INDEX IF NOT EXISTS idx_pfihd_pt    ON pfihereditarydiseases(PatientID);
CREATE INDEX IF NOT EXISTS idx_ptimm_pt    ON patientimmunizations(PatientID);
CREATE INDEX IF NOT EXISTS idx_ptjob_pt    ON patientjobs(PatientID, IsCurrent);
CREATE INDEX IF NOT EXISTS idx_ptlab_pt    ON patientlabrequests(PatientID, IsDelivered);
CREATE INDEX IF NOT EXISTS idx_ptpp_pt     ON patientpreviouspregnancies(PatientID);
CREATE INDEX IF NOT EXISTS idx_ptins_pt    ON patientinsurancedetails(PatientID, IsActive);
CREATE INDEX IF NOT EXISTS idx_ptsn_pt     ON patientspecialnotes(PatientID);
CREATE INDEX IF NOT EXISTS idx_pttest_pt   ON patienttests(PatientID, RecordDate);
CREATE INDEX IF NOT EXISTS idx_pteco_pt    ON patientechocardiogramtests(PatientID, TestDate);
CREATE INDEX IF NOT EXISTS idx_proc_pt     ON procedurehistory(PatientID, ProcedureDate);
CREATE INDEX IF NOT EXISTS idx_ptbsr_pt    ON patientbodysystemreview(PatientID, RecordDate);
CREATE INDEX IF NOT EXISTS idx_ptbspe_pt   ON patientbodysystemphysicalexam(PatientID, RecordDate);

-- 8.6 Visit sub-records (query by PatientVisitID)
CREATE INDEX IF NOT EXISTS idx_pvac_visit   ON pvassessmentconditions(PatientVisitID, IsDeleted);
CREATE INDEX IF NOT EXISTS idx_pvpm_visit   ON pvplanmedications(PatientVisitID);
CREATE INDEX IF NOT EXISTS idx_pvgp_visit   ON pvgprescription(PatientVisitID);
CREATE INDEX IF NOT EXISTS idx_pvrv_visit   ON pvrevisits(PatientVisitID, IsDeleted, RevisitDate);
CREATE INDEX IF NOT EXISTS idx_avr_visit    ON aftervisitrecommendations(PatientVisitID, IsDone);
CREATE INDEX IF NOT EXISTS idx_pvpmhc_visit ON pvpmhconditions(PatientVisitID);
CREATE INDEX IF NOT EXISTS idx_pvpmhm_visit ON pvpmhmedications(PatientVisitID);
CREATE INDEX IF NOT EXISTS idx_pnfs_visit   ON prenatalflowsheetitems(PatientVisitID, ReadingDate);

-- 8.7 Coding lookups (typeahead search)
CREATE INDEX IF NOT EXISTS idx_icd10_code  ON `icd10-cm2012`(Code);
SET @ftx_icd_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'icd10-cm2012' AND index_name = 'ftx_icd10');
SET @sql := IF(@ftx_icd_exists = 0,
  'CREATE FULLTEXT INDEX ftx_icd10 ON `icd10-cm2012`(ShortDesc, LongDesc)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_cpt_code    ON cptcodes(CPT_CODE);
SET @ftx_cpt_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'cptcodes' AND index_name = 'ftx_cpt');
SET @sql := IF(@ftx_cpt_exists = 0,
  'CREATE FULLTEXT INDEX ftx_cpt ON cptcodes(SHORT_DESCRIPTION, LONG_DESCRIPTION, FULL_DESCRIPTION)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_hcpc_code   ON hcpcs(HCPCCode);
SET @ftx_med_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'medicines' AND index_name = 'ftx_med');
SET @sql := IF(@ftx_med_exists = 0,
  'CREATE FULLTEXT INDEX ftx_med ON medicines(TradeName, scientificName)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_mc_verified ON medicalconditions(IsVerified, MedicalConditionName);
SET @ftx_mc_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'medicalconditions' AND index_name = 'ftx_mc');
SET @sql := IF(@ftx_mc_exists = 0,
  'CREATE FULLTEXT INDEX ftx_mc ON medicalconditions(MedicalConditionName, Description, SearchKeywords)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8.8 Users
CREATE INDEX IF NOT EXISTS idx_user_hcenter_active ON hcenterusers(HCenterID, IsActive);
CREATE INDEX IF NOT EXISTS idx_user_username       ON hcenterusers(UserName);
