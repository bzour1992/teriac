-- =============================================================================
-- Investigate the FK-orphan tables — are these real records with broken refs,
-- or stale test/template data?
-- =============================================================================

-- Total row counts side-by-side with orphan counts.
SELECT 'pvpregnancydetails'      AS tbl, COUNT(*) AS total FROM pvpregnancydetails;
SELECT 'pvpriskstratificationchk' AS tbl, COUNT(*) AS total FROM pvpriskstratificationchecks;
SELECT 'pvpinitialexam'          AS tbl, COUNT(*) AS total FROM pvpinitialexam;
SELECT 'prenatalflowsheetitems'  AS tbl, COUNT(*) AS total FROM prenatalflowsheetitems;
SELECT 'patientpreviouspregnancies' AS tbl, COUNT(*) AS total FROM patientpreviouspregnancies;
SELECT 'patientlabrequests'      AS tbl, COUNT(*) AS total FROM patientlabrequests;
SELECT 'ppfghistorycheclistitems' AS tbl, COUNT(*) AS total FROM ppfghistorycheclistitems;
SELECT 'pvfertilitydetails'      AS tbl, COUNT(*) AS total FROM pvfertilitydetails;
SELECT 'pvfertilityflowsheetitems' AS tbl, COUNT(*) AS total FROM pvfertilityflowsheetitems;

-- Do the orphan PatientVisitIDs match patientvisits.PatientID instead (mis-mapped column)?
SELECT 'pvpregnancydetails.PatientVisitID looks like a PatientID?' AS hypothesis,
       COUNT(*) AS rows_matching_patient_id
FROM pvpregnancydetails t
JOIN patients p ON p.PatientID = t.PatientVisitID;

-- Sample a few orphan PatientVisitIDs from pvpregnancydetails for manual inspection.
SELECT 'sample_pvpregnancydetails_visit_ids' AS check_name, PatientVisitID
FROM pvpregnancydetails
LIMIT 5;

-- For prenatalflowsheetitems — show the 10 visits that DO match, vs the 1493 that don't.
SELECT 'prenatal_match_breakdown' AS check_name,
       CASE WHEN v.PatientVisitID IS NULL THEN 'orphan' ELSE 'linked' END AS state,
       COUNT(*) AS row_count
FROM prenatalflowsheetitems t
LEFT JOIN patientvisits v ON v.PatientVisitID = t.PatientVisitID
GROUP BY state;

-- Date range of orphan rows — old or new?
SELECT 'pvpregnancydetails_dates' AS check_name,
       MIN(t.LMPDate) AS earliest_lmp, MAX(t.LMPDate) AS latest_lmp
FROM pvpregnancydetails t;

SELECT 'prenatal_dates' AS check_name,
       MIN(t.ReadingDate) AS earliest, MAX(t.ReadingDate) AS latest
FROM prenatalflowsheetitems t;
