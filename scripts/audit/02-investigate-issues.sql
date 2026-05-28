-- =============================================================================
-- Drill-down audit for the two non-zero results from 01-data-integrity.sql:
--   #02 — 69 live visits on soft-deleted patients
--   #03 — 115 NationalID duplicate groups
-- =============================================================================

-- ---- Issue 02: Live visits whose patient is soft-deleted ----

-- 02a. How many patients are involved?
SELECT '02a_affected_deleted_patients' AS check_name,
       COUNT(DISTINCT v.PatientID) AS distinct_patients
FROM patientvisits v
JOIN patients p ON p.PatientID = v.PatientID
WHERE p.IsDeleted = 1 AND v.IsDeleted = 0;

-- 02b. Date distribution — were these abandoned visits or recent activity?
SELECT '02b_visits_by_year' AS check_name,
       YEAR(v.VisitDate) AS visit_year,
       COUNT(*) AS visits
FROM patientvisits v
JOIN patients p ON p.PatientID = v.PatientID
WHERE p.IsDeleted = 1 AND v.IsDeleted = 0
GROUP BY YEAR(v.VisitDate)
ORDER BY visit_year;

-- ---- Issue 03: Duplicate NationalIDs within an HCenter ----

-- 03a. Total affected live patients (not just groups).
SELECT '03a_affected_patients' AS check_name,
       SUM(group_size) AS total_patients
FROM (
  SELECT COUNT(*) AS group_size
  FROM patients
  WHERE IsDeleted = 0 AND NationalID IS NOT NULL AND NationalID <> ''
  GROUP BY HCenterID, NationalID
  HAVING COUNT(*) > 1
) g;

-- 03b. Are these mostly placeholder values? Show the most-duplicated IDs.
SELECT '03b_top_duplicate_values' AS check_name, NationalID, COUNT(*) AS occurrences
FROM patients
WHERE IsDeleted = 0 AND NationalID IS NOT NULL AND NationalID <> ''
GROUP BY HCenterID, NationalID
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- 03c. Distribution of group sizes — is it mostly pairs or wider?
SELECT '03c_group_size_distribution' AS check_name,
       group_size,
       COUNT(*) AS number_of_groups
FROM (
  SELECT COUNT(*) AS group_size
  FROM patients
  WHERE IsDeleted = 0 AND NationalID IS NOT NULL AND NationalID <> ''
  GROUP BY HCenterID, NationalID
  HAVING COUNT(*) > 1
) g
GROUP BY group_size
ORDER BY group_size;

-- 03d. Are these all "default" looking values? Show patterns.
SELECT '03d_suspicious_short_or_repeated' AS check_name,
       NationalID,
       LENGTH(NationalID) AS id_length,
       COUNT(*) AS occurrences
FROM patients
WHERE IsDeleted = 0 AND NationalID IS NOT NULL AND NationalID <> ''
  AND (LENGTH(NationalID) < 5 OR NationalID REGEXP '^([0-9])\\1+$' OR NationalID IN ('0', '00', '000', '0000', '00000', '1', '11', '111', '1111', '11111'))
GROUP BY NationalID
ORDER BY occurrences DESC
LIMIT 20;
