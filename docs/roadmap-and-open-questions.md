## 14. Migration & Modernization Roadmap

### 14.1 Priority Cleanups (Pre-Production)

| # | Action | Reason | Effort |
|---|---|---|---|
| 1 | Add all FKs from Section 7 | Prevents orphan rows | M |
| 2 | Add all indexes from Section 8 | 10-100× query speedup | S |
| 3 | Standardize `int(11)` vs `tinyint(1)` for boolean-like fields | Type safety | M |
| 4 | Document & enforce enums in code | Avoid magic numbers | M |
| 5 | Add `HCenterID` to `patientvisits` (denormalize) | Faster tenant filtering | S |
| 6 | Normalize `pvpriskstratificationchecks` | 30 cols → row-per-check | L |
| 7 | Move `__sys*` to `audit_*` shadow tables | Reduce row width | L |
| 8 | Add `created_at`, `updated_at` columns everywhere | Standard audit | M |
| 9 | Migrate `char(36)` → `BINARY(16)` GUIDs | 60% smaller, faster index | XL |
| 10 | Split `hcenterfinancaltransactions` into typed tables (income, expense, transfer) | Cleaner queries, smaller indexes | XL |

### 14.2 Data Quality

Run these as part of migration:

```sql
-- Orphaned visits
SELECT v.* FROM patientvisits v
LEFT JOIN patients p ON p.PatientID = v.PatientID
WHERE p.PatientID IS NULL;

-- Visits with deleted patients
SELECT v.* FROM patientvisits v
JOIN patients p ON p.PatientID = v.PatientID
WHERE p.IsDeleted = 1 AND v.IsDeleted = 0;

-- Duplicate national IDs within an HCenter
SELECT HCenterID, NationalID, COUNT(*)
FROM patients
WHERE IsDeleted = 0
GROUP BY HCenterID, NationalID
HAVING COUNT(*) > 1;

-- Future-dated visits
SELECT * FROM patientvisits WHERE VisitDate > NOW();

-- Negative financial amounts where TransactionType=Income
SELECT * FROM hcenterfinancaltransactions
WHERE TransactionType = 1 AND Amount < 0;
```

### 14.3 Live Migration Strategy

1. **Snapshot:** Take a logical dump of the production DB
2. **Restore to staging:** Test the FK/index additions, fix any orphans
3. **Build new app against staging schema**
4. **Set up dual-write:** Old app writes to old DB; new app writes to both (use change data capture: Debezium / MariaDB MaxScale CDC)
5. **Cutover:** Drain old app, switch traffic, validate
6. **Decommission:** Old app retired after 90-day reconciliation window

---


## 16. Open Questions & Assumptions

These need clarification from the existing system's product owner/development team before final implementation:

| # | Question | Why It Matters |
|---|---|---|
| 1 | Exact enum values for `Sex`, `VisitType`, `Outcome`, `Intensity`, `TransactionType`, `SubscriptionType`, `UserType`, `DeliveryType` | Hard-coded in client app; must match to preserve data integrity |
| 2 | Is offline sync (Devart `__sys*`) still in use? | Determines if columns can be dropped |
| 3 | Existing app's password storage / auth mechanism | `hcenterusers` has no password column |
| 4 | Where are uploaded files stored? (`PhotoFilename`, `ReportsLogo`, `HomePagePhotoUrl`) | Filesystem path? S3? Database BLOB? |
| 5 | Are there triggers, stored procedures, or views not in the structure dump? | Could contain business logic |
| 6 | Is `HCenterID` on `patientvisits` intentionally absent? | Currently only via `patients` join — performance impact |
| 7 | What are the exact eClaim Link integration endpoints / formats? | Insurance claim flow |
| 8 | Currency handling — single tenant or multi-currency? | `wallets` has no currency col |
| 9 | Inventory module — `InventoryItemID` referenced but no inventory tables visible | Confirm if separate module |
| 10 | Patient portal scope — is `OnlinePassword` actively used? | Determines portal priority |
| 11 | Reporting tool used today — Crystal? Stimulsoft? | Migration of `Report*Ar` templates |
| 12 | Retention policy — how long are visits/invoices kept? | Drives partitioning strategy |
| 13 | SMS / email gateway provider? | For appointment reminders |
| 14 | Compliance requirements (HIPAA? DHA? local regs) per deployment region | Sets encryption + audit baseline |
| 15 | Disaster recovery RTO / RPO targets | Drives backup architecture |

### Key Assumptions Made in This Document

1. Tenant = HCenter (one DB, shared schema, `HCenterID` discriminator).
2. Soft delete is intended on `patients` / `patientvisits` and orphans should be preserved.
3. Bilingual support is English + Arabic (no other RTL languages assumed).

---

