## 7. Recommended Foreign Keys (Full SQL)

These FKs are inferred from naming conventions and clinical sense. Run **after** verifying data integrity (clean up orphans first).

```sql
-- ============================================================
-- PREREQUISITE: Clean orphaned data
-- ============================================================
-- Find orphans first (example):
-- SELECT p.* FROM patients p LEFT JOIN hcenters h ON h.HCenterID = p.HCenterID WHERE h.HCenterID IS NULL;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 7.1 Geographic
-- ============================================================
ALTER TABLE cities
  ADD CONSTRAINT fk_cities_country FOREIGN KEY (CountryID) REFERENCES countries(CountryID);

-- ============================================================
-- 7.2 HCenter scoping
-- ============================================================
ALTER TABLE hcenters
  ADD CONSTRAINT fk_hcenters_country FOREIGN KEY (CountryID) REFERENCES countries(CountryID),
  ADD CONSTRAINT fk_hcenters_city    FOREIGN KEY (CityID)    REFERENCES cities(CityID);

ALTER TABLE hcenterpage
  ADD CONSTRAINT fk_hcpage_hcenter FOREIGN KEY (HCenterID) REFERENCES hcenters(HCenterID) ON DELETE CASCADE;

ALTER TABLE hcentersystemsettings
  ADD CONSTRAINT fk_hcsettings_hcenter FOREIGN KEY (HCenterID) REFERENCES hcenters(HCenterID) ON DELETE CASCADE;

ALTER TABLE hcenterspecialities
  ADD CONSTRAINT fk_hcspec_hcenter   FOREIGN KEY (HCenterID)    REFERENCES hcenters(HCenterID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_hcspec_specialty FOREIGN KEY (SpecialityID) REFERENCES specialities(SpecialityID);

ALTER TABLE wallets
  ADD CONSTRAINT fk_wallets_hcenter FOREIGN KEY (HCenterID) REFERENCES hcenters(HCenterID) ON DELETE CASCADE;

ALTER TABLE transactioncategories
  ADD CONSTRAINT fk_txcat_hcenter   FOREIGN KEY (HCenterID)           REFERENCES hcenters(HCenterID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_txcat_procedure FOREIGN KEY (MedicalProcedureID)  REFERENCES medicalprocedures(MedicalProcedureID),
  ADD CONSTRAINT fk_txcat_diagtest  FOREIGN KEY (DiagnosticTestID)    REFERENCES diagnostictests(DiagnosticTestID),
  ADD CONSTRAINT fk_txcat_cpt       FOREIGN KEY (CPTCodeID)           REFERENCES cptcodes(CPTCodeID),
  ADD CONSTRAINT fk_txcat_hcpc      FOREIGN KEY (HCPCID)              REFERENCES hcpcs(HCPCID);

-- ============================================================
-- 7.3 Users
-- ============================================================
ALTER TABLE hcenterusers
  ADD CONSTRAINT fk_users_hcenter   FOREIGN KEY (HCenterID)           REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_users_specialty FOREIGN KEY (HCenterSpecialityID) REFERENCES hcenterspecialities(HCenterSpecialityID);

ALTER TABLE hcuserspermissions
  ADD CONSTRAINT fk_userperm_user FOREIGN KEY (UserID)       REFERENCES hcenterusers(UserId) ON DELETE CASCADE,
  ADD CONSTRAINT fk_userperm_perm FOREIGN KEY (PermissionID) REFERENCES permissions(PermissionID);

ALTER TABLE hcupvqsections
  ADD CONSTRAINT fk_hcupvq_user FOREIGN KEY (UserId) REFERENCES hcenterusers(UserId) ON DELETE CASCADE;

ALTER TABLE hcenteruserfavcptcodes
  ADD CONSTRAINT fk_favcpt_user FOREIGN KEY (HCenterUserID) REFERENCES hcenterusers(UserId) ON DELETE CASCADE,
  ADD CONSTRAINT fk_favcpt_cpt  FOREIGN KEY (CPTCodeID)     REFERENCES cptcodes(CPTCodeID);

-- ============================================================
-- 7.4 Reference data
-- ============================================================
ALTER TABLE bodysystemannotationimages
  ADD CONSTRAINT fk_bsai_bs FOREIGN KEY (BodySystemID) REFERENCES bodysystems(BodySystemID);

ALTER TABLE bodysystemschecklistitems
  ADD CONSTRAINT fk_bschk_bs FOREIGN KEY (BodySystemID) REFERENCES bodysystems(BodySystemID);

ALTER TABLE cptcodes
  ADD CONSTRAINT fk_cpt_specialty FOREIGN KEY (SpecialtyID) REFERENCES specialities(SpecialityID);

ALTER TABLE medicines
  ADD CONSTRAINT fk_med_country FOREIGN KEY (CountryID) REFERENCES countries(CountryID),
  ADD CONSTRAINT fk_med_city    FOREIGN KEY (CityID)    REFERENCES cities(CityID);

-- ============================================================
-- 7.5 Patient core
-- ============================================================
ALTER TABLE patients
  ADD CONSTRAINT fk_pt_hcenter  FOREIGN KEY (HCenterID)       REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_pt_country  FOREIGN KEY (Nationality)     REFERENCES countries(CountryID),
  ADD CONSTRAINT fk_pt_race     FOREIGN KEY (HumanRaceID)     REFERENCES humanraces(HumanRaceID),
  ADD CONSTRAINT fk_pt_marital  FOREIGN KEY (MaritalStatusID) REFERENCES maritalstatuses(MaritalStatusID);

ALTER TABLE patientarabicinfo
  ADD CONSTRAINT fk_ptar_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientadditionalinfo
  ADD CONSTRAINT fk_ptai_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientsaddetails
  ADD CONSTRAINT fk_ptsad_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientjobs
  ADD CONSTRAINT fk_ptjob_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patienteducationalhistory
  ADD CONSTRAINT fk_ptedu_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientspecialnotes
  ADD CONSTRAINT fk_ptsn_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientchecklist
  ADD CONSTRAINT fk_ptchk_pt   FOREIGN KEY (PatientID)       REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptchk_item FOREIGN KEY (ChecklistItemID) REFERENCES checklistitems(ChecklistItemID);

ALTER TABLE patienttestbehaviors
  ADD CONSTRAINT fk_pttb_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientinsurancedetails
  ADD CONSTRAINT fk_ptins_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

-- ============================================================
-- 7.6 Patient history
-- ============================================================
ALTER TABLE allergies
  ADD CONSTRAINT fk_allerg_pt   FOREIGN KEY (PatientID)          REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_allerg_cond FOREIGN KEY (MedicalConditionID) REFERENCES medicalconditions(MedicalConditionID);

ALTER TABLE chronicdiseases
  ADD CONSTRAINT fk_chronic_pt   FOREIGN KEY (PatientID)          REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_chronic_cond FOREIGN KEY (MedicalConditionID) REFERENCES medicalconditions(MedicalConditionID);

ALTER TABLE patientlongtermmedicines
  ADD CONSTRAINT fk_ptltm_pt  FOREIGN KEY (PatientID)  REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptltm_med FOREIGN KEY (MedicineID) REFERENCES medicines(MedicineID);

ALTER TABLE patientproblems
  ADD CONSTRAINT fk_ptprob_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE pfihereditarydiseases
  ADD CONSTRAINT fk_pfihd_pt   FOREIGN KEY (PatientID)          REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pfihd_cond FOREIGN KEY (MedicalConditionID) REFERENCES medicalconditions(MedicalConditionID);

ALTER TABLE patientimmunizationhistory
  ADD CONSTRAINT fk_ptimmhx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientimmunizations
  ADD CONSTRAINT fk_ptimm_pt  FOREIGN KEY (PatientID)              REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptimm_vac FOREIGN KEY (ImmunizationsVaccineID) REFERENCES immunizationsvaccines(ImmunizationsVaccineID);

ALTER TABLE patientlabrequests
  ADD CONSTRAINT fk_ptlab_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientantenatalhx
  ADD CONSTRAINT fk_ptanthx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientnatalhx
  ADD CONSTRAINT fk_ptnathx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientneonatalhx
  ADD CONSTRAINT fk_ptneohx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientgdhx
  ADD CONSTRAINT fk_ptgdhx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientmalerelatedhistory
  ADD CONSTRAINT fk_ptmhx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientfemalerelatedhistory
  ADD CONSTRAINT fk_ptfhx_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientpreviouspregnancies
  ADD CONSTRAINT fk_ptpp_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientgeneralappearance
  ADD CONSTRAINT fk_ptga_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientgeneralreviewquestionaire
  ADD CONSTRAINT fk_ptgrq_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientdiagnosticstudies
  ADD CONSTRAINT fk_ptdiag_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientprimarydentaleruptions
  ADD CONSTRAINT fk_ptpde_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE patientpermanentdentaleruptions
  ADD CONSTRAINT fk_ptperde_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;
ALTER TABLE ppfghistorycheclistitems
  ADD CONSTRAINT fk_ppfg_pt FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE;

ALTER TABLE patientbodysystemreview
  ADD CONSTRAINT fk_ptbsr_pt    FOREIGN KEY (PatientID)      REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptbsr_bs    FOREIGN KEY (BodySystemID)   REFERENCES bodysystems(BodySystemID),
  ADD CONSTRAINT fk_ptbsr_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

ALTER TABLE patientbodysystemphysicalexam
  ADD CONSTRAINT fk_ptbspe_pt    FOREIGN KEY (PatientID)      REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptbspe_bs    FOREIGN KEY (BodySystemID)   REFERENCES bodysystems(BodySystemID),
  ADD CONSTRAINT fk_ptbspe_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

ALTER TABLE pbspexamchecklistitem
  ADD CONSTRAINT fk_pbsp_review FOREIGN KEY (PatientBodySystemReviewID) REFERENCES patientbodysystemreview(PatientBodySystemReviewID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pbsp_item   FOREIGN KEY (BodySystemChecklistItemID) REFERENCES bodysystemschecklistitems(BodySystemChecklistItemID);

ALTER TABLE patientdstitems
  ADD CONSTRAINT fk_ptdst_pt   FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ptdst_item FOREIGN KEY (ItemID)    REFERENCES denverscreeningtestitems(ItemID);

ALTER TABLE patientechocardiogramtests
  ADD CONSTRAINT fk_pteco_pt    FOREIGN KEY (PatientID)      REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pteco_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

ALTER TABLE patienttests
  ADD CONSTRAINT fk_pttest_pt    FOREIGN KEY (PatientID)        REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pttest_test  FOREIGN KEY (DiagnosticTestID) REFERENCES diagnostictests(DiagnosticTestID),
  ADD CONSTRAINT fk_pttest_visit FOREIGN KEY (PatientVisitID)   REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

ALTER TABLE procedurehistory
  ADD CONSTRAINT fk_proc_pt   FOREIGN KEY (PatientID)          REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_proc_proc FOREIGN KEY (MedicalProcedureID) REFERENCES medicalprocedures(MedicalProcedureID);

-- ============================================================
-- 7.7 Visits and sub-records
-- ============================================================
ALTER TABLE patientvisits
  ADD CONSTRAINT fk_pv_patient FOREIGN KEY (PatientID)    REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pv_doctor  FOREIGN KEY (Doctor)       REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pv_sched   FOREIGN KEY (SchedulingOfficer) REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pv_parent  FOREIGN KEY (ParentVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

ALTER TABLE aftervisitrecommendations
  ADD CONSTRAINT fk_avr_visit     FOREIGN KEY (PatientVisitID)    REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_avr_requester FOREIGN KEY (RequestedByUserId) REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_avr_processor FOREIGN KEY (ProcessedByUserID) REFERENCES hcenterusers(UserId);

ALTER TABLE pvassessmentconditions
  ADD CONSTRAINT fk_pvac_visit FOREIGN KEY (PatientVisitID)    REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvac_cond  FOREIGN KEY (MedicalConditionID) REFERENCES medicalconditions(MedicalConditionID);

ALTER TABLE pvpmhconditions
  ADD CONSTRAINT fk_pvpmhc_visit FOREIGN KEY (PatientVisitID)    REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvpmhc_cond  FOREIGN KEY (MedicalConditionID) REFERENCES medicalconditions(MedicalConditionID);

ALTER TABLE pvpmhmedications
  ADD CONSTRAINT fk_pvpmhm_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvpmhm_med   FOREIGN KEY (MedicineID)     REFERENCES medicines(MedicineID);

ALTER TABLE pvplanmedications
  ADD CONSTRAINT fk_pvpm_visit FOREIGN KEY (PatientVisitID)         REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvpm_med   FOREIGN KEY (MedicineID)             REFERENCES medicines(MedicineID),
  ADD CONSTRAINT fk_pvpm_dx    FOREIGN KEY (PVAssessmentConditionID) REFERENCES pvassessmentconditions(PVAssessmentConditionID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pvpm_presc FOREIGN KEY (PrescribedBy)           REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pvpm_sugg  FOREIGN KEY (SuggestedBy)            REFERENCES hcenterusers(UserId);

ALTER TABLE pvgprescription
  ADD CONSTRAINT fk_pvgp_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE pvrevisits
  ADD CONSTRAINT fk_pvrv_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvrv_proc  FOREIGN KEY (ProcedureHistoryID) REFERENCES procedurehistory(ProcedureHistoryID);

ALTER TABLE pvpregnancydetails
  ADD CONSTRAINT fk_pvpreg_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE pvpriskstratificationchecks
  ADD CONSTRAINT fk_pvrsc_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE pvpinitialexam
  ADD CONSTRAINT fk_pvpie_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE prenatalflowsheetitems
  ADD CONSTRAINT fk_pnfs_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE pvfertilitydetails
  ADD CONSTRAINT fk_pvfd_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE pvfertilityflowsheetitems
  ADD CONSTRAINT fk_pvffs_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE patientpasiscore
  ADD CONSTRAINT fk_pasi_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE patientnutritionalhx
  ADD CONSTRAINT fk_ptnut_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

-- ============================================================
-- 7.8 Scheduling
-- ============================================================
ALTER TABLE hcenterscheduleitems
  ADD CONSTRAINT fk_sch_hcenter FOREIGN KEY (HCenterID)              REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_sch_patient FOREIGN KEY (PatientID)              REFERENCES patients(PatientID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_visit   FOREIGN KEY (PatientVisitID)         REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_revisit FOREIGN KEY (PVRevisitID)            REFERENCES pvrevisits(PVRevisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_doctor  FOREIGN KEY (Doctor)                 REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_addsch  FOREIGN KEY (AddSchedulingOfficer)   REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_updsch  FOREIGN KEY (UpdateSchedulingOfficer) REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_proc    FOREIGN KEY (ProcedureHistoryID)     REFERENCES procedurehistory(ProcedureHistoryID);

-- ============================================================
-- 7.9 Billing & Finance
-- ============================================================
ALTER TABLE patientbillingrecords
  ADD CONSTRAINT fk_pbr_visit   FOREIGN KEY (PatientVisitID)        REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pbr_category FOREIGN KEY (TransactionCategoryID) REFERENCES transactioncategories(TransactionCategoryID),
  ADD CONSTRAINT fk_pbr_doctor  FOREIGN KEY (DoctorID)              REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pbr_user    FOREIGN KEY (UserID)                REFERENCES hcenterusers(UserId);

ALTER TABLE patientinvoices
  ADD CONSTRAINT fk_pinv_pt      FOREIGN KEY (PatientID)               REFERENCES patients(PatientID),
  ADD CONSTRAINT fk_pinv_hcenter FOREIGN KEY (HCenterID)               REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_pinv_user    FOREIGN KEY (AddedByUserID)           REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pinv_ins     FOREIGN KEY (PatientInsuranceDetailID) REFERENCES patientinsurancedetails(PatientInsuranceDetailID);

ALTER TABLE hcenterfinancaltransactions
  ADD CONSTRAINT fk_ft_hcenter   FOREIGN KEY (HCenterID)               REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_ft_wallet    FOREIGN KEY (WalletID)                REFERENCES wallets(WalletID),
  ADD CONSTRAINT fk_ft_srcwallet FOREIGN KEY (SourceWallet)            REFERENCES wallets(WalletID),
  ADD CONSTRAINT fk_ft_category  FOREIGN KEY (TransactionCategoryID)   REFERENCES transactioncategories(TransactionCategoryID),
  ADD CONSTRAINT fk_ft_pt        FOREIGN KEY (PatientID)               REFERENCES patients(PatientID),
  ADD CONSTRAINT fk_ft_pbr       FOREIGN KEY (PatientBillingRecordID)  REFERENCES patientbillingrecords(PatientBillingRecordID),
  ADD CONSTRAINT fk_ft_inv       FOREIGN KEY (PatientInvoiceID)        REFERENCES patientinvoices(PatientInvoiceID),
  ADD CONSTRAINT fk_ft_ins       FOREIGN KEY (PatientInsuranceDetailID) REFERENCES patientinsurancedetails(PatientInsuranceDetailID),
  ADD CONSTRAINT fk_ft_adduser   FOREIGN KEY (AddUserID)               REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_upduser   FOREIGN KEY (UpdateUserID)            REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_owner     FOREIGN KEY (OwnerUserID)             REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_emp       FOREIGN KEY (EmployeeUserID)          REFERENCES hcenterusers(UserId);

SET FOREIGN_KEY_CHECKS = 1;
```

---

## 8. Recommended Indexes (Full SQL)

```sql
-- ============================================================
-- 8.1 Patients (high-traffic search & filtering)
-- ============================================================
CREATE INDEX idx_pt_hcenter_deleted  ON patients(HCenterID, IsDeleted);
CREATE INDEX idx_pt_hcenter_national ON patients(HCenterID, NationalID);
CREATE INDEX idx_pt_hcenter_mobile   ON patients(HCenterID, MobileNumber);
CREATE INDEX idx_pt_hcenter_email    ON patients(HCenterID, Email);
CREATE INDEX idx_pt_hcenter_dob      ON patients(HCenterID, DateOfBirth);
CREATE FULLTEXT INDEX ftx_pt_name    ON patients(FirstName, SecondName, ThirdName, LastName);

-- 8.2 Visits
CREATE INDEX idx_pv_patient_date ON patientvisits(PatientID, VisitDate DESC, IsDeleted);
CREATE INDEX idx_pv_doctor_date  ON patientvisits(Doctor, VisitDate);
CREATE INDEX idx_pv_parent       ON patientvisits(ParentVisitID);

-- 8.3 Scheduling
CREATE INDEX idx_sch_hcenter_date ON hcenterscheduleitems(HCenterID, ScheduledInDate);
CREATE INDEX idx_sch_doctor_date  ON hcenterscheduleitems(Doctor, ScheduledInDate);
CREATE INDEX idx_sch_patient      ON hcenterscheduleitems(PatientID);
CREATE INDEX idx_sch_status       ON hcenterscheduleitems(HCenterID, StatusID, ScheduledInDate);

-- 8.4 Billing & finance
CREATE INDEX idx_ft_hcenter_date  ON hcenterfinancaltransactions(HCenterID, AddDate DESC);
CREATE INDEX idx_ft_wallet_date   ON hcenterfinancaltransactions(WalletID, AddDate);
CREATE INDEX idx_ft_patient_date  ON hcenterfinancaltransactions(PatientID, AddDate);
CREATE INDEX idx_ft_invoice       ON hcenterfinancaltransactions(PatientInvoiceID);
CREATE INDEX idx_ft_type_date     ON hcenterfinancaltransactions(HCenterID, TransactionType, AddDate);
CREATE INDEX idx_inv_hcenter_date ON patientinvoices(HCenterID, InvoiceDate DESC);
CREATE INDEX idx_inv_patient_date ON patientinvoices(PatientID, InvoiceDate DESC);
CREATE INDEX idx_pbr_visit        ON patientbillingrecords(PatientVisitID);
CREATE INDEX idx_pbr_date         ON patientbillingrecords(RecordDate);

-- 8.5 Patient history (1:N tables — query by PatientID)
CREATE INDEX idx_allerg_pt   ON allergies(PatientID);
CREATE INDEX idx_chronic_pt  ON chronicdiseases(PatientID);
CREATE INDEX idx_ptltm_pt    ON patientlongtermmedicines(PatientID);
CREATE INDEX idx_ptprob_pt   ON patientproblems(PatientID, IsActive);
CREATE INDEX idx_pfihd_pt    ON pfihereditarydiseases(PatientID);
CREATE INDEX idx_ptimm_pt    ON patientimmunizations(PatientID);
CREATE INDEX idx_ptjob_pt    ON patientjobs(PatientID, IsCurrent);
CREATE INDEX idx_ptlab_pt    ON patientlabrequests(PatientID, IsDelivered);
CREATE INDEX idx_ptpp_pt     ON patientpreviouspregnancies(PatientID);
CREATE INDEX idx_ptins_pt    ON patientinsurancedetails(PatientID, IsActive);
CREATE INDEX idx_ptsn_pt     ON patientspecialnotes(PatientID);
CREATE INDEX idx_pttest_pt   ON patienttests(PatientID, RecordDate DESC);
CREATE INDEX idx_pteco_pt    ON patientechocardiogramtests(PatientID, TestDate DESC);
CREATE INDEX idx_proc_pt     ON procedurehistory(PatientID, ProcedureDate DESC);
CREATE INDEX idx_ptbsr_pt    ON patientbodysystemreview(PatientID, RecordDate DESC);
CREATE INDEX idx_ptbspe_pt   ON patientbodysystemphysicalexam(PatientID, RecordDate DESC);

-- 8.6 Visit sub-records (query by PatientVisitID)
CREATE INDEX idx_pvac_visit  ON pvassessmentconditions(PatientVisitID, IsDeleted);
CREATE INDEX idx_pvpm_visit  ON pvplanmedications(PatientVisitID);
CREATE INDEX idx_pvgp_visit  ON pvgprescription(PatientVisitID);
CREATE INDEX idx_pvrv_visit  ON pvrevisits(PatientVisitID, IsDeleted, RevisitDate);
CREATE INDEX idx_avr_visit   ON aftervisitrecommendations(PatientVisitID, IsDone);
CREATE INDEX idx_pvpmhc_visit ON pvpmhconditions(PatientVisitID);
CREATE INDEX idx_pvpmhm_visit ON pvpmhmedications(PatientVisitID);
CREATE INDEX idx_pnfs_visit   ON prenatalflowsheetitems(PatientVisitID, ReadingDate);

-- 8.7 Coding lookups (typeahead search)
CREATE INDEX idx_icd10_code  ON `icd10-cm2012`(Code);
CREATE FULLTEXT INDEX ftx_icd10 ON `icd10-cm2012`(ShortDesc, LongDesc);
CREATE INDEX idx_cpt_code    ON cptcodes(CPT_CODE);
CREATE FULLTEXT INDEX ftx_cpt ON cptcodes(SHORT_DESCRIPTION, LONG_DESCRIPTION, FULL_DESCRIPTION);
CREATE INDEX idx_hcpc_code   ON hcpcs(HCPCCode);
CREATE FULLTEXT INDEX ftx_med ON medicines(TradeName, scientificName);
CREATE INDEX idx_mc_verified ON medicalconditions(IsVerified, MedicalConditionName);
CREATE FULLTEXT INDEX ftx_mc ON medicalconditions(MedicalConditionName, Description, SearchKeywords);

-- 8.8 Users
CREATE INDEX idx_user_hcenter_active ON hcenterusers(HCenterID, IsActive);
CREATE INDEX idx_user_username        ON hcenterusers(UserName);
```

> **Tip:** For very large `icd10-cm2012` (65k+ rows), and CPT/HCPCS, consider offloading typeahead to **Meilisearch** or **OpenSearch** for sub-50ms search. MySQL FULLTEXT works but is less ergonomic.


---

