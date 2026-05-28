-- 0008_billing_categories_admin.sql
--
-- Supports the admin-managed billing categories tab (Tier 1 bundle):
--   * `IsArchived` on transactioncategories so admins can soft-archive
--     categories that have prior usage (we can't hard-delete due to FK
--     references from patientbillingrecords / hcenterfinancaltransactions).
--   * `Price2Label` / `Price3Label` on hcentersystemsettings so each clinic
--     can name its tier prices (e.g. "Insurance A", "VIP") instead of the
--     opaque Price2/Price3 columns.

ALTER TABLE transactioncategories
  ADD COLUMN IsArchived TINYINT(1) NOT NULL DEFAULT 0;

-- Idx for the common "active categories" filter used by the picker.
CREATE INDEX idx_txcat_hcenter_active
  ON transactioncategories (HCenterID, IsArchived);
