-- =============================================================================
-- Data integrity audit (docs/roadmap-and-open-questions.md §14.2)
--
-- READ-ONLY. Run before any structural migration (FK adds, index adds).
-- Any non-zero result needs a remediation plan before we proceed.
-- =============================================================================

-- 1. Orphan visits — visit references a patient that does not exist.
SELECT '01_orphan_visits' AS check_name, COUNT(*) AS bad_rows
FROM patientvisits v
LEFT JOIN patients p ON p.PatientID = v.PatientID
WHERE p.PatientID IS NULL;

-- 2. Live visits on soft-deleted patients.
SELECT '02_live_visits_on_deleted_patients' AS check_name, COUNT(*) AS bad_rows
FROM patientvisits v
JOIN patients p ON p.PatientID = v.PatientID
WHERE p.IsDeleted = 1 AND v.IsDeleted = 0;

-- 3. Duplicate NationalID within an HCenter (live patients only).
SELECT '03_duplicate_national_ids' AS check_name, COUNT(*) AS bad_groups
FROM (
  SELECT HCenterID, NationalID
  FROM patients
  WHERE IsDeleted = 0 AND NationalID IS NOT NULL AND NationalID <> ''
  GROUP BY HCenterID, NationalID
  HAVING COUNT(*) > 1
) dup;

-- 4. Future-dated visits (clock-skew or data-entry errors).
SELECT '04_future_dated_visits' AS check_name, COUNT(*) AS bad_rows
FROM patientvisits
WHERE VisitDate > NOW();

-- 5. Negative income amounts (TransactionType=1 means Income; amount should be positive).
SELECT '05_negative_income_tx' AS check_name, COUNT(*) AS bad_rows
FROM hcenterfinancaltransactions
WHERE TransactionType = 1 AND Amount < 0;

-- 6. Patients tied to an unknown HCenter.
SELECT '06_orphan_patients_no_hcenter' AS check_name, COUNT(*) AS bad_rows
FROM patients pt
LEFT JOIN hcenters h ON h.HCenterID = pt.HCenterID
WHERE h.HCenterID IS NULL;

-- 7. Visits whose Doctor does not exist in hcenterusers.
SELECT '07_visits_unknown_doctor' AS check_name, COUNT(*) AS bad_rows
FROM patientvisits v
LEFT JOIN hcenterusers u ON u.UserId = v.Doctor
WHERE u.UserId IS NULL AND v.Doctor IS NOT NULL;

-- 8. Invoices whose Patient does not exist.
SELECT '08_invoices_orphan_patient' AS check_name, COUNT(*) AS bad_rows
FROM patientinvoices i
LEFT JOIN patients p ON p.PatientID = i.PatientID
WHERE p.PatientID IS NULL;

-- 9. Invoices whose HCenter does not exist.
SELECT '09_invoices_orphan_hcenter' AS check_name, COUNT(*) AS bad_rows
FROM patientinvoices i
LEFT JOIN hcenters h ON h.HCenterID = i.HCenterID
WHERE h.HCenterID IS NULL;

-- 10. Billing records pointing at a missing TransactionCategory.
SELECT '10_billing_orphan_category' AS check_name, COUNT(*) AS bad_rows
FROM patientbillingrecords br
LEFT JOIN transactioncategories tc ON tc.TransactionCategoryID = br.TransactionCategoryID
WHERE tc.TransactionCategoryID IS NULL;

-- 11. Financial transactions with an invalid wallet.
SELECT '11_finance_tx_orphan_wallet' AS check_name, COUNT(*) AS bad_rows
FROM hcenterfinancaltransactions ft
LEFT JOIN wallets w ON w.WalletID = ft.WalletID
WHERE ft.WalletID IS NOT NULL AND w.WalletID IS NULL;

-- 12. Diagnoses pointing at a missing visit.
SELECT '12_diagnoses_orphan_visit' AS check_name, COUNT(*) AS bad_rows
FROM pvassessmentconditions d
LEFT JOIN patientvisits v ON v.PatientVisitID = d.PatientVisitID
WHERE v.PatientVisitID IS NULL;

-- 13. Prescriptions pointing at a missing visit or medicine.
SELECT '13_plan_meds_orphan_visit_or_med' AS check_name, COUNT(*) AS bad_rows
FROM pvplanmedications m
LEFT JOIN patientvisits v ON v.PatientVisitID = m.PatientVisitID
LEFT JOIN medicines med ON med.MedicineID = m.MedicineID
WHERE v.PatientVisitID IS NULL OR med.MedicineID IS NULL;

-- 14. Allergies referencing a missing medical condition.
SELECT '14_allergies_orphan_condition' AS check_name, COUNT(*) AS bad_rows
FROM allergies a
LEFT JOIN medicalconditions mc ON mc.MedicalConditionID = a.MedicalConditionID
WHERE mc.MedicalConditionID IS NULL;

-- 15. Schedule items with a missing patient (when PatientID is present).
SELECT '15_schedule_orphan_patient' AS check_name, COUNT(*) AS bad_rows
FROM hcenterscheduleitems s
LEFT JOIN patients p ON p.PatientID = s.PatientID
WHERE s.PatientID IS NOT NULL AND p.PatientID IS NULL;

-- 16. Schedule items where ScheduledInDate is after ScheduledToDate.
SELECT '16_schedule_inverted_dates' AS check_name, COUNT(*) AS bad_rows
FROM hcenterscheduleitems
WHERE ScheduledInDate > ScheduledToDate;

-- 17. patientvisits.ParentVisitID self-references that don't exist.
SELECT '17_visit_parent_missing' AS check_name, COUNT(*) AS bad_rows
FROM patientvisits v
LEFT JOIN patientvisits pv ON pv.PatientVisitID = v.ParentVisitID
WHERE v.ParentVisitID IS NOT NULL AND pv.PatientVisitID IS NULL;
