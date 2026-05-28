# Data audit summary

> Generated against `okkeh` on 2026-05-18. Read-only — no DDL performed.

## What's clean (15/17 integrity checks pass)

Every check that involves a freshly-introduced reference passed: visits know
their patient, doctor, parent visit; invoices know their patient + HCenter;
billing records know their category; allergies/chronic dz know their condition;
schedule items have valid date ranges, etc.

## What needs a decision before §7 FKs can be applied

### Issue A — clinical orphans (real records, broken parent link)

| Table | Orphan rows | Total rows | % orphan |
|---|---|---|---|
| `pvpregnancydetails` → `patientvisits` | 786 | 786 | **100%** |
| `pvpriskstratificationchecks` → `patientvisits` | 786 | 786 | **100%** |
| `pvpinitialexam` → `patientvisits` | 786 | 786 | **100%** |
| `prenatalflowsheetitems` → `patientvisits` | 1493 | 1503 | 99.3% |
| `pvfertilitydetails` → `patientvisits` | 16 | 16 | **100%** |
| `pvfertilityflowsheetitems` → `patientvisits` | 2 | 2 | **100%** |
| `patientpreviouspregnancies` → `patients` | 338 | 338 | **100%** |
| `patientlabrequests` → `patients` | 14 | 14 | **100%** |
| `ppfghistorycheclistitems` → `patients` | 728 | 728 | **100%** |

**Total: ~5,000 rows** of real clinical data (LMP dates 2016–2020) whose
parent patient or visit row no longer exists. Adding the corresponding §7 FKs
right now would error out on these tables.

Likely cause: legacy app hard-deleted parent visits without cascading. The data
was never re-linked.

**Three options for each table:**
1. **Hard-delete the orphans** before adding the FK. Lossy but clean.
2. **Drop the FK** (or change it to no enforcement) on these specific tables.
   Preserves data, accepts permanent floating records.
3. **Change the FK to `ON DELETE SET NULL`** and pre-null the orphan
   PatientVisitID values. Records survive but become unlinked-on-purpose.

### Issue B — `NationalID` field misused as year-of-birth

9,444 of 27,699 patients (~34%) have a non-unique `NationalID`. Inspection
shows the top values are 4-digit numbers in the 1960–1982 range — the field
was being used to store the patient's birth year, not a real national ID.

**Impact:** we cannot put a UNIQUE index on `(HCenterID, NationalID)` without
fixing the data. Does **not** block §7 FKs (none of them require uniqueness on
this column).

**Decision needed (later):** is the rebuild keeping the legacy field as-is, or
adding a real NationalID column and migrating?

### Issue C — 69 live visits on 29 soft-deleted patients

Mostly old (2001–2017) plus one 2026 entry. Not an FK blocker (the patient
row still exists), just inconsistent soft-delete state. Easy fix when we decide
on a soft-delete policy.

## Recommended next move

I want explicit sign-off before doing anything in `okkeh`. The conservative
default I'd propose:

- **Issue A:** option 2 — skip the 9 FKs above, apply the remaining ~70 FKs.
  Keep clinical data intact. Document the gap in `docs/roadmap-and-open-questions.md`.
- **Issue B:** defer. Tracked as a separate migration item.
- **Issue C:** defer. Tracked with the soft-delete consistency cleanup.

We'd still be in much better shape than today: ~70 FKs enforced, all indexes
applied, audit log added, `hcenterusers.password_hash` added.
