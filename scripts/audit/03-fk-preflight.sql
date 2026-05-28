-- =============================================================================
-- FK pre-flight: for every FK in docs/schema-fks-indexes.md §7, count rows that
-- would be REJECTED if the FK were added today. Zero means the FK is safe.
-- =============================================================================

-- Patients → hcenters / countries / humanraces / maritalstatuses
SELECT 'patients.HCenterID         → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM patients pt LEFT JOIN hcenters x ON x.HCenterID=pt.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'patients.Nationality       → countries'          AS fk_target, COUNT(*) AS orphan_rows FROM patients pt LEFT JOIN countries x ON x.CountryID=pt.Nationality WHERE pt.Nationality IS NOT NULL AND x.CountryID IS NULL;
SELECT 'patients.HumanRaceID       → humanraces'         AS fk_target, COUNT(*) AS orphan_rows FROM patients pt LEFT JOIN humanraces x ON x.HumanRaceID=pt.HumanRaceID WHERE pt.HumanRaceID IS NOT NULL AND x.HumanRaceID IS NULL;
SELECT 'patients.MaritalStatusID   → maritalstatuses'    AS fk_target, COUNT(*) AS orphan_rows FROM patients pt LEFT JOIN maritalstatuses x ON x.MaritalStatusID=pt.MaritalStatusID WHERE pt.MaritalStatusID IS NOT NULL AND x.MaritalStatusID IS NULL;

-- Geographic
SELECT 'cities.CountryID           → countries'          AS fk_target, COUNT(*) AS orphan_rows FROM cities c LEFT JOIN countries x ON x.CountryID=c.CountryID WHERE x.CountryID IS NULL;
SELECT 'hcenters.CountryID         → countries'          AS fk_target, COUNT(*) AS orphan_rows FROM hcenters h LEFT JOIN countries x ON x.CountryID=h.CountryID WHERE x.CountryID IS NULL;
SELECT 'hcenters.CityID            → cities'             AS fk_target, COUNT(*) AS orphan_rows FROM hcenters h LEFT JOIN cities x ON x.CityID=h.CityID WHERE h.CityID IS NOT NULL AND x.CityID IS NULL;
SELECT 'medicines.CountryID        → countries'          AS fk_target, COUNT(*) AS orphan_rows FROM medicines m LEFT JOIN countries x ON x.CountryID=m.CountryID WHERE x.CountryID IS NULL;
SELECT 'medicines.CityID           → cities'             AS fk_target, COUNT(*) AS orphan_rows FROM medicines m LEFT JOIN cities x ON x.CityID=m.CityID WHERE m.CityID IS NOT NULL AND x.CityID IS NULL;

-- Users
SELECT 'hcenterusers.HCenterID     → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM hcenterusers u LEFT JOIN hcenters x ON x.HCenterID=u.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'hcenterusers.HCenterSpec…  → hcenterspecialities' AS fk_target, COUNT(*) AS orphan_rows FROM hcenterusers u LEFT JOIN hcenterspecialities x ON x.HCenterSpecialityID=u.HCenterSpecialityID WHERE u.HCenterSpecialityID IS NOT NULL AND x.HCenterSpecialityID IS NULL;
SELECT 'hcuserspermissions.UserID  → hcenterusers'       AS fk_target, COUNT(*) AS orphan_rows FROM hcuserspermissions up LEFT JOIN hcenterusers x ON x.UserId=up.UserID WHERE x.UserId IS NULL;
SELECT 'hcuserspermissions.Perm    → permissions'        AS fk_target, COUNT(*) AS orphan_rows FROM hcuserspermissions up LEFT JOIN permissions x ON x.PermissionID=up.PermissionID WHERE x.PermissionID IS NULL;

-- Visit FKs
SELECT 'patientvisits.PatientID    → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientvisits v LEFT JOIN patients x ON x.PatientID=v.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientvisits.Doctor       → hcenterusers'       AS fk_target, COUNT(*) AS orphan_rows FROM patientvisits v LEFT JOIN hcenterusers x ON x.UserId=v.Doctor WHERE x.UserId IS NULL;
SELECT 'patientvisits.SchedOfficer → hcenterusers'       AS fk_target, COUNT(*) AS orphan_rows FROM patientvisits v LEFT JOIN hcenterusers x ON x.UserId=v.SchedulingOfficer WHERE v.SchedulingOfficer IS NOT NULL AND x.UserId IS NULL;
SELECT 'patientvisits.ParentVisit  → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM patientvisits v LEFT JOIN patientvisits x ON x.PatientVisitID=v.ParentVisitID WHERE v.ParentVisitID IS NOT NULL AND x.PatientVisitID IS NULL;

-- 1:1 extension tables → patients
SELECT 'patientarabicinfo          → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientarabicinfo t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientadditionalinfo      → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientadditionalinfo t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientsaddetails          → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientsaddetails t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patienteducationalhistory  → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patienteducationalhistory t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patienttestbehaviors       → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patienttestbehaviors t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientimmunizationhistory → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientimmunizationhistory t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientantenatalhx         → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientantenatalhx t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientnatalhx             → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientnatalhx t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientneonatalhx          → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientneonatalhx t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientgdhx                → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientgdhx t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientmalerelatedhistory  → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientmalerelatedhistory t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientfemalerelatedhistor → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientfemalerelatedhistory t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientgeneralappearance   → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientgeneralappearance t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientgeneralreviewq      → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientgeneralreviewquestionaire t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientdiagnosticstudies   → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientdiagnosticstudies t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientprimarydentaler     → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientprimarydentaleruptions t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientpermanentdentaler   → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientpermanentdentaleruptions t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'ppfghistorycheclistitems   → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM ppfghistorycheclistitems t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;

-- 1:N history → patients + reference
SELECT 'allergies                  → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM allergies t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'allergies                  → medicalconditions'  AS fk_target, COUNT(*) AS orphan_rows FROM allergies t LEFT JOIN medicalconditions x ON x.MedicalConditionID=t.MedicalConditionID WHERE x.MedicalConditionID IS NULL;
SELECT 'chronicdiseases            → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM chronicdiseases t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'chronicdiseases            → medicalconditions'  AS fk_target, COUNT(*) AS orphan_rows FROM chronicdiseases t LEFT JOIN medicalconditions x ON x.MedicalConditionID=t.MedicalConditionID WHERE x.MedicalConditionID IS NULL;
SELECT 'patientlongtermmedicines   → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientlongtermmedicines t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientlongtermmedicines   → medicines'          AS fk_target, COUNT(*) AS orphan_rows FROM patientlongtermmedicines t LEFT JOIN medicines x ON x.MedicineID=t.MedicineID WHERE x.MedicineID IS NULL;
SELECT 'patientproblems            → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientproblems t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'pfihereditarydiseases      → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM pfihereditarydiseases t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'pfihereditarydiseases      → medicalconditions'  AS fk_target, COUNT(*) AS orphan_rows FROM pfihereditarydiseases t LEFT JOIN medicalconditions x ON x.MedicalConditionID=t.MedicalConditionID WHERE x.MedicalConditionID IS NULL;
SELECT 'patientimmunizations       → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientimmunizations t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientimmunizations       → immunizationsvac.'  AS fk_target, COUNT(*) AS orphan_rows FROM patientimmunizations t LEFT JOIN immunizationsvaccines x ON x.ImmunizationsVaccineID=t.ImmunizationsVaccineID WHERE x.ImmunizationsVaccineID IS NULL;
SELECT 'patientlabrequests         → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientlabrequests t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientpreviouspregnancies → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientpreviouspregnancies t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientchecklist           → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientchecklist t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientchecklist           → checklistitems'     AS fk_target, COUNT(*) AS orphan_rows FROM patientchecklist t LEFT JOIN checklistitems x ON x.ChecklistItemID=t.ChecklistItemID WHERE x.ChecklistItemID IS NULL;
SELECT 'patientinsurancedetails    → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientinsurancedetails t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientjobs                → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientjobs t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientspecialnotes        → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientspecialnotes t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientechocardiogramtests → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientechocardiogramtests t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientbodysystemreview    → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientbodysystemreview t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientbodysystemphysical  → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientbodysystemphysicalexam t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'pbspexamchecklistitem      → patientbsr'         AS fk_target, COUNT(*) AS orphan_rows FROM pbspexamchecklistitem t LEFT JOIN patientbodysystemreview x ON x.PatientBodySystemReviewID=t.PatientBodySystemReviewID WHERE x.PatientBodySystemReviewID IS NULL;
SELECT 'patientdstitems            → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientdstitems t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'procedurehistory           → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM procedurehistory t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'procedurehistory           → medicalprocedures'  AS fk_target, COUNT(*) AS orphan_rows FROM procedurehistory t LEFT JOIN medicalprocedures x ON x.MedicalProcedureID=t.MedicalProcedureID WHERE x.MedicalProcedureID IS NULL;
SELECT 'patientnutritionalhx       → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM patientnutritionalhx t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'patienttests               → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patienttests t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;

-- Visit sub-records
SELECT 'pvassessmentconditions     → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvassessmentconditions t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvassessmentconditions     → medicalconditions'  AS fk_target, COUNT(*) AS orphan_rows FROM pvassessmentconditions t LEFT JOIN medicalconditions x ON x.MedicalConditionID=t.MedicalConditionID WHERE x.MedicalConditionID IS NULL;
SELECT 'pvpmhconditions            → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvpmhconditions t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvpmhmedications           → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvpmhmedications t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvplanmedications          → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvplanmedications t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvplanmedications          → medicines'          AS fk_target, COUNT(*) AS orphan_rows FROM pvplanmedications t LEFT JOIN medicines x ON x.MedicineID=t.MedicineID WHERE x.MedicineID IS NULL;
SELECT 'pvplanmedications          → pvAssessmentCond'   AS fk_target, COUNT(*) AS orphan_rows FROM pvplanmedications t LEFT JOIN pvassessmentconditions x ON x.PVAssessmentConditionID=t.PVAssessmentConditionID WHERE t.PVAssessmentConditionID IS NOT NULL AND x.PVAssessmentConditionID IS NULL;
SELECT 'pvgprescription            → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvgprescription t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvrevisits                 → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvrevisits t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'aftervisitrecommendations  → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM aftervisitrecommendations t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvpregnancydetails         → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvpregnancydetails t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvpriskstratificationchk   → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvpriskstratificationchecks t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvpinitialexam             → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvpinitialexam t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'prenatalflowsheetitems     → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM prenatalflowsheetitems t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvfertilitydetails         → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvfertilitydetails t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'pvfertilityflowsheetitems  → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM pvfertilityflowsheetitems t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;
SELECT 'patientpasiscore           → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM patientpasiscore t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE x.PatientVisitID IS NULL;

-- Billing & Finance
SELECT 'patientbillingrecords      → patientvisits'      AS fk_target, COUNT(*) AS orphan_rows FROM patientbillingrecords t LEFT JOIN patientvisits x ON x.PatientVisitID=t.PatientVisitID WHERE t.PatientVisitID IS NOT NULL AND x.PatientVisitID IS NULL;
SELECT 'patientbillingrecords      → transactioncats'    AS fk_target, COUNT(*) AS orphan_rows FROM patientbillingrecords t LEFT JOIN transactioncategories x ON x.TransactionCategoryID=t.TransactionCategoryID WHERE x.TransactionCategoryID IS NULL;
SELECT 'patientinvoices            → patients'           AS fk_target, COUNT(*) AS orphan_rows FROM patientinvoices t LEFT JOIN patients x ON x.PatientID=t.PatientID WHERE x.PatientID IS NULL;
SELECT 'patientinvoices            → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM patientinvoices t LEFT JOIN hcenters x ON x.HCenterID=t.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'hcenterfinancaltx          → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM hcenterfinancaltransactions t LEFT JOIN hcenters x ON x.HCenterID=t.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'hcenterfinancaltx          → wallets'            AS fk_target, COUNT(*) AS orphan_rows FROM hcenterfinancaltransactions t LEFT JOIN wallets x ON x.WalletID=t.WalletID WHERE t.WalletID IS NOT NULL AND x.WalletID IS NULL;
SELECT 'wallets                    → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM wallets t LEFT JOIN hcenters x ON x.HCenterID=t.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'transactioncategories      → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM transactioncategories t LEFT JOIN hcenters x ON x.HCenterID=t.HCenterID WHERE x.HCenterID IS NULL;

-- Scheduling
SELECT 'hcenterscheduleitems       → hcenters'           AS fk_target, COUNT(*) AS orphan_rows FROM hcenterscheduleitems t LEFT JOIN hcenters x ON x.HCenterID=t.HCenterID WHERE x.HCenterID IS NULL;
SELECT 'hcenterscheduleitems.AddSO → hcenterusers'       AS fk_target, COUNT(*) AS orphan_rows FROM hcenterscheduleitems t LEFT JOIN hcenterusers x ON x.UserId=t.AddSchedulingOfficer WHERE x.UserId IS NULL;
