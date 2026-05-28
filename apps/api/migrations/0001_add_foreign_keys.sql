-- =============================================================================
-- 0001 — Add foreign keys (docs/schema-fks-indexes.md §7)
--
-- EXCLUDED (orphan data — see scripts/audit/SUMMARY.md):
--   fk_pvpreg_visit  (pvpregnancydetails        → patientvisits)
--   fk_pvrsc_visit   (pvpriskstratificationchecks → patientvisits)
--   fk_pvpie_visit   (pvpinitialexam            → patientvisits)
--   fk_pnfs_visit    (prenatalflowsheetitems    → patientvisits)
--   fk_pvfd_visit    (pvfertilitydetails        → patientvisits)
--   fk_pvffs_visit   (pvfertilityflowsheetitems → patientvisits)
--   fk_ptpp_pt       (patientpreviouspregnancies → patients)
--   fk_ptlab_pt      (patientlabrequests        → patients)
--   fk_ppfg_pt       (ppfghistorycheclistitems  → patients)
--
-- All other §7 FKs are included below. Re-running this file after partial
-- success will FAIL on the already-added constraints — that is expected; edit
-- the file to remove applied statements and re-run.
-- =============================================================================

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

-- SKIPPED: fk_ptlab_pt (patientlabrequests → patients) — 14/14 orphan rows
-- SKIPPED: fk_ptpp_pt (patientpreviouspregnancies → patients) — 338/338 orphan rows
-- SKIPPED: fk_ppfg_pt (ppfghistorycheclistitems → patients) — 728/728 orphan rows

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
  ADD CONSTRAINT fk_pv_patient FOREIGN KEY (PatientID)        REFERENCES patients(PatientID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pv_doctor  FOREIGN KEY (Doctor)           REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pv_sched   FOREIGN KEY (SchedulingOfficer) REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pv_parent  FOREIGN KEY (ParentVisitID)    REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL;

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
  ADD CONSTRAINT fk_pvrv_visit FOREIGN KEY (PatientVisitID)     REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE,
  ADD CONSTRAINT fk_pvrv_proc  FOREIGN KEY (ProcedureHistoryID) REFERENCES procedurehistory(ProcedureHistoryID);

-- SKIPPED: fk_pvpreg_visit, fk_pvrsc_visit, fk_pvpie_visit, fk_pnfs_visit,
--          fk_pvfd_visit, fk_pvffs_visit — orphan-table FKs

ALTER TABLE patientpasiscore
  ADD CONSTRAINT fk_pasi_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

ALTER TABLE patientnutritionalhx
  ADD CONSTRAINT fk_ptnut_visit FOREIGN KEY (PatientVisitID) REFERENCES patientvisits(PatientVisitID) ON DELETE CASCADE;

-- ============================================================
-- 7.8 Scheduling
-- ============================================================
ALTER TABLE hcenterscheduleitems
  ADD CONSTRAINT fk_sch_hcenter FOREIGN KEY (HCenterID)               REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_sch_patient FOREIGN KEY (PatientID)               REFERENCES patients(PatientID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_visit   FOREIGN KEY (PatientVisitID)          REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_revisit FOREIGN KEY (PVRevisitID)             REFERENCES pvrevisits(PVRevisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sch_doctor  FOREIGN KEY (Doctor)                  REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_addsch  FOREIGN KEY (AddSchedulingOfficer)    REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_updsch  FOREIGN KEY (UpdateSchedulingOfficer) REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_sch_proc    FOREIGN KEY (ProcedureHistoryID)      REFERENCES procedurehistory(ProcedureHistoryID);

-- ============================================================
-- 7.9 Billing & Finance
-- ============================================================
ALTER TABLE patientbillingrecords
  ADD CONSTRAINT fk_pbr_visit    FOREIGN KEY (PatientVisitID)        REFERENCES patientvisits(PatientVisitID) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pbr_category FOREIGN KEY (TransactionCategoryID) REFERENCES transactioncategories(TransactionCategoryID),
  ADD CONSTRAINT fk_pbr_doctor   FOREIGN KEY (DoctorID)              REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pbr_user     FOREIGN KEY (UserID)                REFERENCES hcenterusers(UserId);

ALTER TABLE patientinvoices
  ADD CONSTRAINT fk_pinv_pt      FOREIGN KEY (PatientID)                REFERENCES patients(PatientID),
  ADD CONSTRAINT fk_pinv_hcenter FOREIGN KEY (HCenterID)                REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_pinv_user    FOREIGN KEY (AddedByUserID)            REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_pinv_ins     FOREIGN KEY (PatientInsuranceDetailID) REFERENCES patientinsurancedetails(PatientInsuranceDetailID);

ALTER TABLE hcenterfinancaltransactions
  ADD CONSTRAINT fk_ft_hcenter   FOREIGN KEY (HCenterID)                REFERENCES hcenters(HCenterID),
  ADD CONSTRAINT fk_ft_wallet    FOREIGN KEY (WalletID)                 REFERENCES wallets(WalletID),
  ADD CONSTRAINT fk_ft_srcwallet FOREIGN KEY (SourceWallet)             REFERENCES wallets(WalletID),
  ADD CONSTRAINT fk_ft_category  FOREIGN KEY (TransactionCategoryID)    REFERENCES transactioncategories(TransactionCategoryID),
  ADD CONSTRAINT fk_ft_pt        FOREIGN KEY (PatientID)                REFERENCES patients(PatientID),
  ADD CONSTRAINT fk_ft_pbr       FOREIGN KEY (PatientBillingRecordID)   REFERENCES patientbillingrecords(PatientBillingRecordID),
  ADD CONSTRAINT fk_ft_inv       FOREIGN KEY (PatientInvoiceID)         REFERENCES patientinvoices(PatientInvoiceID),
  ADD CONSTRAINT fk_ft_ins       FOREIGN KEY (PatientInsuranceDetailID) REFERENCES patientinsurancedetails(PatientInsuranceDetailID),
  ADD CONSTRAINT fk_ft_adduser   FOREIGN KEY (AddUserID)                REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_upduser   FOREIGN KEY (UpdateUserID)             REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_owner     FOREIGN KEY (OwnerUserID)              REFERENCES hcenterusers(UserId),
  ADD CONSTRAINT fk_ft_emp       FOREIGN KEY (EmployeeUserID)           REFERENCES hcenterusers(UserId);

SET FOREIGN_KEY_CHECKS = 1;
