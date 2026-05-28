# Teriac EHR & Clinic Management System

> Multi-tenant EHR + Clinic Management for MENA outpatient centers.
> **Schema:** MariaDB 10.5+ / InnoDB / `utf8mb4_unicode_ci` · 93 tables · ~1,400 columns
> **Schema date:** 18 May 2026

This is the **root knowledge file**. Keep it lean. Detailed references are imported on demand:

**Schema reference (load only the file that matches the domain you're working on):**
- @docs/schema-reference.md       — System, geo, medical coding catalog (ICD/CPT/HCPCS, body systems, medicines)
- @docs/schema-tenant-users.md    — HCenter tenant tables, users, permissions, schedule items
- @docs/schema-patient.md         — Patient master + extensions + general history (allergies, chronic dz, immunizations…)
- @docs/schema-pediatric-obgyn.md — Pediatric history + OB/GYN history
- @docs/schema-visits.md          — Visits + all visit sub-records + specialty visit records (PASI, fertility, prenatal)
- @docs/schema-billing.md         — Invoices, billing records, wallets, financial transactions

**Other references:**
- @docs/schema-fks-indexes.md     — Sections 7 & 8: recommended FK + index SQL
- @docs/api-and-dtos.md           — Sections 10 & 11: REST endpoints and TypeScript DTOs
- @docs/security-and-ops.md       — Sections 12, 13, 15: HIPAA, performance, DevOps
- @docs/roadmap-and-open-questions.md — Sections 14 & 16: migration plan + unresolved items
- @docs/appendices.md             — Appendix A (full table inventory) + B (medical glossary)
- @docs/design-system.md          — Color (`#155dfc`), type, components, RTL — read before any UI work

**When to load which file:**
- Working on patient demographics/history → `schema-patient.md`
- Working on visits, encounters, prescriptions, SOAP → `schema-visits.md`
- Working on pediatric or OB/GYN screens → `schema-pediatric-obgyn.md`
- Working on auth, tenant config, scheduling, RBAC → `schema-tenant-users.md`
- Working on invoices, payments, ledger → `schema-billing.md`
- Looking up ICD/CPT/medicine/specialty tables → `schema-reference.md`
- Adding FKs, indexes, or new migrations → `schema-fks-indexes.md`
- Building/changing endpoints → `api-and-dtos.md`
- Auth, audit, caching, deployment → `security-and-ops.md`
- Planning work, resolving ambiguity → `roadmap-and-open-questions.md`
- Decoding medical acronyms → `appendices.md`
- Building or restyling any UI → `design-system.md`

---

## What Teriac is

| Capability | Implementation |
|---|---|
| Multi-tenancy | `HCenterID` scoping on patient, user, visit, billing tables |
| Bilingual (EN/AR) | `patientarabicinfo` table + `hcenterusers.Report*Ar` fields |
| Medical coding | ICD-10-CM (~65k codes), CPT, HCPCS Level II |
| Specialties | General, Pediatrics, OB/GYN, Dermatology, Cardiology, Dentistry, Fertility, Optometry |
| Offline sync | Devart-style change tracking (`__sys*` columns) |
| Clinical scoring | PASI (dermatology), Denver Developmental Screening, Apgar |
| Growth charts | BMI/Height/Weight/HC percentiles by age & gender |
| Insurance | per-patient insurance details |

### Source stack (inferred from schema)
- **Backend:** Node.js (GUID PKs as `char(36)`, EF naming conventions)
- **ORM/Sync:** Devart dotConnect for MySQL with Offline Mode (`__sys*` tables)
- **DB:** MariaDB 10.5+ (`Source Server Version: 110502`)
- **Client:** Likely Windows desktop (WPF/WinForms) with offline sync

### Modern rebuild stack

| Layer | Recommended | Alternative |
|---|---|---|
| API | Node.js + NestJS (TypeScript) | Node.js + Fastify |
| ORM | Entity Framework Core 8 | Prisma / Dapper |
| DB | MariaDB 11+ or MySQL 8.4 | PostgreSQL 16 (recommended for clinical workloads) |
| Frontend | React 18 + TanStack Query + Tailwind | Angular 17 / Blazor |
| Auth | Keycloak / Auth0 / Azure AD B2C | Identity Server with refresh tokens |
| File storage | MinIO (self-hosted) | S3 |
| Reports | QuestPDF / Stimulsoft Cloud | Crystal / FastReport |
| Cache | Redis | Memcached |
| Search | Meilisearch / OpenSearch (ICD/CPT typeahead) | Elasticsearch |
| Background jobs | Hangfire | Quartz.NET |
| Observability | Serilog + Seq + OpenTelemetry | ELK + Jaeger |

---

## Internationalization (AR/EN) — non-negotiable rules

| Layer | Mechanism |
|---|---|
| UI labels, menus, errors | `react-i18next` + `apps/web/src/locales/{en,ar}.json` |
| API error messages & enums | `nestjs-i18n`, `Accept-Language` header (`en` \| `ar`, default `en`) |
| Patient/clinical data | Stored bilingually (`patientarabicinfo`, `*NameAr`, `Report*Ar`) — **never auto-translate** |
| Reference data (ICD/CPT/allergies/specialties) | `*_translations` table keyed by `(entity_id, lang)` |
| PDF reports | Per-language template; RTL when `lang=ar` (QuestPDF `TextDirection.RightToLeft` or Puppeteer `dir="rtl"`) |
| Dates/numbers | ISO 8601 in storage, format client-side per locale; Arabic-Indic numerals optional |

**RTL:** React app sets `<html dir="rtl" lang="ar">` when Arabic active. Use Tailwind logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`) and the `rtl:` variant — never `pl/pr/ml/mr`.

**Per-user preference:** `hcenterusers.PreferredLanguage char(2)` (`en`/`ar`), carried in JWT as `lang` claim.

---

## System architecture

### Multi-tenant strategy
Shared database, shared schema, discriminator column (`HCenterID`). Every tenant-scoped table must include `HCenterID` directly or reach it through a single join (e.g., `patientvisits` → `patients.HCenterID`).

**Four lines of defense for tenant isolation:**
1. JWT — `hcenter_id` claim, signed
2. API middleware — extracts claim into `ITenantContext`
3. EF Core global filter — `HasQueryFilter(p => p.HCenterID == _tenant.Id)` on every entity
4. `SaveChanges()` sanity check — assert no `HCenterID` mismatch on any modified entity

### Layered architecture
```
CLIENT (Web SPA · Mobile · Reports · eClaim)
  │ HTTPS / JWT / REST + WebSocket
API GATEWAY (rate limit, auth, CORS, tenant resolution)
  │
APPLICATION SERVICES (Patients · Visits · Billing · Schedule · Reports
                      Pediatric · OB/GYN · Derm · Coding · Audit)
  │
DATA (MariaDB primary+replicas · Redis · S3/MinIO · Meilisearch)
```

### Offline sync (`__sys*` tables)
The original system used Devart dotConnect Offline Mode. **For a web-first rebuild, drop offline sync and remove these columns.** If mobile offline is needed, use Watermelon DB, Couchbase Lite, or PowerSync instead — not the legacy framework.

---

## Database conventions (read before writing any SQL/EF code)

### Primary keys
| Pattern | Used By |
|---|---|
| `char(36)` GUID | ~95% of tables |
| `bigint AUTO_INCREMENT` | High-volume reference: `icd10-cm2012.ICD10ID`, `bodysystemschecklistitems.*`, `permissions.PermissionID` |
| Composite PK | Junction tables: `patientchecklist (ChecklistItemID, PatientID)`, `hcuserspermissions (UserID, PermissionID)` |
| Shared PK (1:1 extension) | `patientarabicinfo.PatientID = patients.PatientID` |

GUIDs stored as 36-char strings (not `BINARY(16)`) — ~2.25× space, slower seeks. **In the rebuild switch to `BINARY(16)` or sequential GUIDs.**

### Sync/change-tracking columns (every domain table)
Trailing columns: `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext`.
**Treat as opaque.** Ignore in queries, omit from DTOs.

System tables: `__sysocsdeletedrows` (tombstones), `__sysocstrackedobjects` (registry), `__systxcommitsequence` (commit order).

### Soft delete (inconsistent)
Present on: `patients`, `patientvisits`, `pvrevisits`, `pvassessmentconditions` (column `IsDeleted tinyint(1)`).
Missing on: `allergies`, `chronicdiseases`, `pvplanmedications`, many others.
**Standardize in the rebuild:** add `IsDeleted` to every clinically meaningful table, or move to a single audit/version table.

### Foreign keys: none declared
The dump disables FKs (`SET FOREIGN_KEY_CHECKS = 0`). Referential integrity is currently app-enforced. **See `docs/schema-fks-indexes.md` for the FK migration script — apply it.**

### Indexes: only PKs exist
Apart from PKs, the only secondary index is `__sysTxCommitSequence_Index`. Production performance requires the indexes in `docs/schema-fks-indexes.md`.

### Charset & datetime
- Charset: `utf8mb4 COLLATE utf8mb4_unicode_ci` (supports Arabic, emoji, 4-byte codepoints).
- For better Arabic sorting consider `utf8mb4_0900_as_cs` (MySQL 8) or `utf8mb4_uca1400_ai_ci` (MariaDB 10.10+).
- All datetimes: `datetime(3)` (ms precision). **Store UTC, convert to local only at display.**

### Naming inconsistencies & typos — DO NOT correct in DB
Alias them in the ORM/DTO layer to preserve compatibility with the legacy app:

| DB Name | Correct | Location |
|---|---|---|
| `Intesity` | Intensity | `patientvisits` |
| `Fifteeth` | Fiftieth | All `age*percentiles` |
| `Nineteeth` | Ninetieth | All `age*percentiles` |
| `Ninty*` | Ninety* | All `age*percentiles` |
| `Hemogobinopathies` | Hemoglobinopathies | `pvpriskstratificationchecks` |
| `Bofore` | Before | `patientsaddetails.SmokedBofore` |
| `PActaul` | Actual | `pvpregnancydetails.PActaulDeliveryDate` |
| `Refferral` | Referral | `patientvisits`, multiple |
| `Cliam` | Claim | `hcenterusers.eCliamProfessionalName` |
| `Financal` | Financial | `hcenterfinancaltransactions` (table name) |
| `Cache` | Cash | `wallets.IsCacheBox` |
| `Perentage` | Percentage | `patientdstitems.ItemPerentage` |
| `LaborLenght` | LaborLength | `patientpreviouspregnancies` |
| `Vomting` | Vomiting | `patientfemalerelatedhistory` |
| `UrinarySymtoms` | UrinarySymptoms | `patientfemalerelatedhistory` |
| `checlistitems` | checklistitems | `ppfghistorycheclistitems` (table name) |
| `Breats` | Breasts | `pvpinitialexam` |
| `Ulterus` | Uterus | `pvpinitialexam` |
| `Ovary`/`Overy` | Ovary | `pvfertilityflowsheetitems.Rt/LtOvery` |
| `ChnageInAppetite` | ChangeInAppetite | `patientgeneralreviewquestionaire` |
| `Paintful` | Painful | `patientmalerelatedhistory.UlcersPaintful` |
| `lie` (lowercase) | Lie | `patientnatalhx` |
| `location` (lowercase) | Location | `procedurehistory` |
| `scientificName` (camelCase) | ScientificName | `medicines` |

---

## Enum reference (verify against legacy app before deploy)

The schema has no CHECK constraints; integer enums are implicit. **Use compile-time constants, not magic numbers, throughout the codebase.**

### Patient & demographics
| Column | Likely values |
|---|---|
| `patients.Sex` | 0=Unknown, 1=Male, 2=Female (possibly 3=Other) |
| `patients.SchoolPerformance` | 0=N/A, 1=Poor, 2=Average, 3=Good, 4=Excellent |
| `patients.PatientCreationMethod` | 1=Manual, 2=Imported, 3=Online registration, 4=Migration |

### Visits
| Column | Likely values |
|---|---|
| `patientvisits.Outcome` | 0=Open, 1=Resolved, 2=Referred, 3=Failed, 4=Cancelled, 5=NoShow |
| `patientvisits.Intesity` | 0=N/A, 1=Low, 2=Moderate, 3=High |
| `patientvisits.VisitType` | 1=New, 2=Follow-up, 3=Emergency, 4=Routine, 5=Walk-in |
| `patientvisits.PainLevel` | 0–10 numeric scale |
| `patientvisits.VisitCreationMethod` | 1=Manual, 2=From appointment, 3=Imported |

### Scheduling
| Column | Likely values |
|---|---|
| `hcenterscheduleitems.LabelID` | Calendar color label |
| `hcenterscheduleitems.StatusID` | 1=Scheduled, 2=Confirmed, 3=Arrived, 4=InProgress, 5=Completed, 6=NoShow, 7=Cancelled |

### Pediatric (Apgar-style)
| Column | Likely values |
|---|---|
| `patientneonatalhx.HeartRate` | 0=Absent, 1=<100, 2=≥100 |
| `patientneonatalhx.RespiratoryRate` | 0=Absent, 1=Slow/Irregular, 2=Good Cry |
| `patientneonatalhx.MuscleTone` | 0=Limp, 1=Some Flexion, 2=Active Motion |
| `patientneonatalhx.ReflexOfIrritability` | 0=No Response, 1=Grimace, 2=Cry |
| `patientneonatalhx.Color` | 0=Blue/Pale, 1=Body Pink/Extremities Blue, 2=Completely Pink |

### Pregnancy
| Column | Likely values |
|---|---|
| `pvpregnancydetails.DeliveryType`, `patientpreviouspregnancies.DeliveryType` | 1=Vaginal, 2=C-Section, 3=Vacuum, 4=Forceps, 5=VBAC |
| `*.InfantSex` | 1=Male, 2=Female |
| `patientnatalhx.KindOfLabor` | 1=Spontaneous, 2=Induced, 3=Augmented |
| `patientnatalhx.Presentation` | 1=Cephalic, 2=Breech, 3=Transverse, 4=Other |
| `patientnatalhx.SedationAnesthesiaType` | 1=None, 2=Local, 3=Epidural, 4=Spinal, 5=General |
| `patientnatalhx.lie` | 1=Longitudinal, 2=Transverse, 3=Oblique |
| `*.ABOBloodGroup*` | 1=A, 2=B, 3=AB, 4=O |
| `*.RHTyping*` | 1=Positive, 2=Negative |

### Nutrition
| Column | Likely values |
|---|---|
| `patientnutritionalhx.Appetite` | 1=Poor, 2=Fair, 3=Good, 4=Excellent |
| `patientnutritionalhx.FoodVariation` | 1=Limited, 2=Moderate, 3=Varied |
| `patientnutritionalhx.BowelHabit` | 1=Constipated, 2=Normal, 3=Diarrhea, 4=Alternating |

### Dental eruptions
`patient*dentaleruptions.<tooth>` = age in months at eruption (NULL = not yet erupted/unknown).

### PASI (Psoriasis Area Severity Index)
| Column | Values |
|---|---|
| `patientpasiscore.<region> Erythema/Thickness/Scaling` | 0=None, 1=Slight, 2=Moderate, 3=Marked, 4=Very Marked |
| `patientpasiscore.A1–A4` | Area scores per body region (0–6) |
| `patientpasiscore.B1–B4` | Area % factor (calculated) |
| `patientpasiscore.C1–C4` | Regional PASI component (calculated) |
| `patientpasiscore.PASI` | Final total (0–72) |

### Finance
| Column | Likely values |
|---|---|
| `hcenterfinancaltransactions.TransactionType` | 1=Income, 2=Expense, 3=Refund, 4=Transfer, 5=Salary, 6=Adjustment |
| `hcenters.SubscriptionType` | 1=Trial, 2=Basic, 3=Standard, 4=Premium, 5=Enterprise |
| `transactioncategories.IsIncome` | 0=Expense, 1=Income |
| `hcensystemsettings.DefaultPayment` | 1=Cash, 2=Card, 3=Insurance |

### Users
| Column | Likely values |
|---|---|
| `hcenterusers.UserType` | 1=Doctor, 2=Nurse, 3=Receptionist, 4=Admin, 5=Lab Tech, 6=Optometrist |
| `permissions.PermissionType` | 1=Module, 2=Feature, 3=Report, 4=Action |

### Misc
| Column | Likely values |
|---|---|
| `diagnostictests.DiagnosticTestType` | 1=Lab, 2=Imaging, 3=Functional, 4=Pathology |
| `modalities.ModalityType` | 1=X-Ray, 2=CT, 3=MRI, 4=Ultrasound, 5=Nuclear, 6=Mammography |
| `icd10-cm2012.Type` | 1=Header (non-billable), 2=Billable |
| `patientproblems.ProblemCategory` | 1=Active, 2=Resolved, 3=Inactive, 4=History |
| `denverscreeningtestitems.ItemCategory` | 1=Personal-Social, 2=Fine Motor-Adaptive, 3=Language, 4=Gross Motor |
| `prenatalflowsheetitems.FetalMovement` | 0=Absent, 1=Decreased, 2=Normal, 3=Increased |
| `prenatalflowsheetitems.UrineProtein`, `UrineGluccose` | 0=Negative, 1=Trace, 2=+1, 3=+2, 4=+3, 5=+4 |

---

## Entity relationship at a glance

```
countries → cities                humanraces      maritalstatuses
                ↓
            hcenters  (tenant root — everything below scoped here)
              │
              ├─ hcenterpage (1:1)              hcentersystemsettings (1:1)
              ├─ hcenterspecialities (1:N)      hcenterscheduleitems (1:N)
              ├─ hcenterusers (1:N)             wallets (1:N)
              └─ transactioncategories (1:N)    hcenterfinancaltransactions (1:N)
              │  HCenterID
              ▼
            patients
              │   1:1 extensions: patientarabicinfo, patientadditionalinfo,
              │                   patientsaddetails, patientantenatalhx,
              │                   patientnatalhx, patientneonatalhx, patientgdhx,
              │                   patientimmunizationhistory, patientmalerelatedhistory,
              │                   patientfemalerelatedhistory, patientgeneralappearance,
              │                   patientgeneralreviewquestionaire,
              │                   patientdiagnosticstudies, patienttestbehaviors,
              │                   patienteducationalhistory,
              │                   patient{primary,permanent}dentaleruptions,
              │                   ppfghistorycheclistitems
              │
              │   1:N history: allergies, chronicdiseases, patientjobs,
              │                patientimmunizations, patientlongtermmedicines,
              │                patientpreviouspregnancies, patientproblems,
              │                pfihereditarydiseases, patientspecialnotes,
              │                patientinsurancedetails, patientlabrequests,
              │                patientbodysystemreview, patientbodysystemphysicalexam,
              │                patientchecklist (M:N w/ checklistitems),
              │                patientechocardiogramtests
              │   PatientID
              ▼
            patientvisits  (clinical encounter root)
              │   1:1 (PatientVisitID is PK):
              │     pvpregnancydetails, pvpriskstratificationchecks,
              │     pvpinitialexam, pvfertilitydetails,
              │     patientpasiscore, patientnutritionalhx
              │
              │   1:N (PatientVisitID is FK):
              │     pvassessmentconditions, pvpmhconditions, pvpmhmedications,
              │     pvplanmedications, pvgprescription, pvrevisits,
              │     aftervisitrecommendations, prenatalflowsheetitems,
              │     pvfertilityflowsheetitems, patienttests
              │
              │   Self-ref: ParentVisitID (linked follow-up visits)
```

### Visit state machine
```
Scheduled (StatusID=1) → Confirmed (=2) → Arrived (=3)
   → InProgress (=4)  →  creates patientvisits row (Outcome=0)
                          ├─ pvassessmentconditions
                          ├─ pvplanmedications
                          ├─ pvgprescription
                          └─ patientinvoices
   → Completed  (=5)   →  patientvisits.Outcome=1 (Resolved)
   → NoShow     (=6)   →  patientvisits.Outcome=5
   → Cancelled  (=7)   →  patientvisits.IsDeleted=1
```

### Billing subgraph
```
patient → patientinvoices (1:N) → patientbillingrecords  (via PatientVisitID, TransactionCategoryID)
hcenter → transactioncategories → links to CPT/HCPC/MedicalProcedure/DiagnosticTest
hcenter → wallets (cash boxes per center)
hcenter → hcenterfinancaltransactions  (polymorphic ledger)
            ├─ PatientBillingRecordID    (optional)
            ├─ PatientInvoiceID          (optional)
            ├─ PatientInsuranceDetailID  (optional)
            ├─ WalletID + SourceWallet   (transfers)
            ├─ EmployeeUserID            (payroll)
            └─ InventoryItemID           (inventory expenses)
```

---

## Module breakdown (14 modules)

1. **Auth & Tenant** — JWT, tenant resolution, RBAC
2. **Patient Management** — CRUD, search, demographics, photos
3. **Medical History** — Allergies, chronic dz, family hx, meds
4. **Scheduling** — Calendar, appointments, status flow
5. **Visit Workflow** — Encounter, SOAP, vitals, ROS, exam
6. **Clinical Coding** — ICD-10, CPT, HCPCS typeahead
7. **Prescriptions** — Medication plan, e-Rx, drug interactions
8. **Diagnostics & Labs** — Test orders, results, attachments
9. **Specialty Modules** — Pediatrics (growth/Denver/dental/immune), OB/GYN (pregnancy/risk/prenatal), Fertility (FSH/IUI/ICSI/TESA), Dermatology (PASI), Cardiology (echo), Optometry, Dentistry
10. **Billing** — Invoices, charges, insurance split
11. **Finance** — Ledger, wallets, P&L, transfers
12. **Admin** — HCenter settings, users, permissions
13. **Reports** — Bilingual PDF (En/Ar), templates
14. **Patient Portal** — Self-service via `OnlinePassword`

### Per-tenant module toggle
- Table `hcentermodules (HCenterID, ModuleKey, IsEnabled, EnabledAt, EnabledBy, Notes)`. Only **superadmins** (new `hcenterusers.IsSuperAdmin` flag) can write it.
- `ModuleEnabledGuard` runs on every controller decorated `@RequiresModule('pediatrics')` — returns `403 MODULE_DISABLED` if `IsEnabled = 0`. Specialty modules are togglable; core modules (auth, patient, scheduling, visit) are not.
- API: `GET/PUT /superadmin/tenants/{hcenterId}/modules/{moduleKey}`.

### Per-tenant field rules
- Table `hcenterfieldrules (HCenterID, EntityName, FieldName, Visibility, Requirement, ConditionJson, DefaultValue, LabelEn, LabelAr, UpdatedBy, UpdatedAt)`. Replaces hardcoded `Is*Required` columns going forward (keep old columns for back-compat).
- `Visibility ∈ {hidden, visible, readonly}`. `Requirement ∈ {optional, required, conditional}`.
- Edited by users with `Admin.FieldRules.Manage` permission.
- **API:** `FieldRuleInterceptor` reads rules at request time (cached 15min, invalidated on write), validates payload, strips hidden fields from responses.
- **UI:** `/admin/field-rules` loads rules into a Zustand/Redux slice; forms consume them via `useFieldRule('patient.phone')`.
- API: `GET /admin/field-rules?entity=patient`, `PUT /admin/field-rules/{entity}/{field}`, `POST /admin/field-rules/bulk`.

---

## Project layout (NestJS monorepo)

```
teriac/
├── apps/
│   ├── api/                       # NestJS application
│   │   ├── src/
│   │   │   ├── main.ts            # Bootstrap (helmet, CORS, Swagger)
│   │   │   ├── app.module.ts
│   │   │   ├── modules/<feature>/ # controller, service, module, dto/, entities/
│   │   │   ├── domain/            # Pure domain logic, value objects
│   │   │   ├── infrastructure/    # Prisma client, Redis, MinIO, eClaim adapter
│   │   │   ├── jobs/              # BullMQ queues, workers, schedulers
│   │   │   ├── reports/           # PDF templates (Puppeteer / PDFKit)
│   │   │   └── common/            # Filters, guards, interceptors, pipes
│   │   ├── prisma/                # schema.prisma, migrations, seeds
│   │   └── test/                  # e2e tests (Jest + Supertest)
│   ├── web/                       # React + Vite + TS
│   └── mobile/                    # React Native (Expo)
├── packages/
│   ├── shared/                    # DTO contracts, zod schemas, types
│   ├── ui/                        # Shared React components, Tailwind preset
│   └── config/                    # ESLint, tsconfig, Prettier base
├── tests/{unit,integration,contract}/
├── docs/, scripts/, .github/
├── package.json                   # pnpm workspaces / Turborepo
├── pnpm-workspace.yaml
└── turbo.json
```

### Phased delivery (6 months)
| Phase | Weeks | Deliverable |
|---|---|---|
| 0 — Foundation | 1–3 | DB cleanup (FKs, indexes), EF Core scaffold, Keycloak, CI/CD, dev env |
| 1 — Patient & Visit Core | 4–8 | Patient CRUD, demographics, search, basic visit (SOAP), prescriptions |
| 2 — Scheduling & Billing | 9–12 | Calendar UI, invoice generation, insurance, payment recording |
| 3 — Coding & Clinical | 13–16 | ICD/CPT search, ROS, physical exam, body system review |
| 4 — Specialty: Pediatrics & OB | 17–20 | Growth charts, prenatal flowsheet, risk strat |
| 5 — Reports & Portal | 21–24 | Bilingual PDFs, patient portal, eClaim integration |
| 6 — Hardening | 25–26 | Perf tuning, security audit, UAT, go-live |

---

## Hard rules for Claude when editing this project

1. **Tenant safety:** every query/mutation against a tenant-scoped table must enforce `HCenterID` via the EF global filter — never bypass it. If you write raw SQL, include `HCenterID = @tenant` explicitly.
2. **Never auto-translate clinical/patient data.** EN and AR are stored separately and authored by clinicians. UI labels and enum strings can be translated; patient notes/diagnoses cannot.
3. **Never silently fix typo'd column names** (see the typo table above). Alias in the ORM/DTO; the DB column keeps its legacy name for back-compat with the existing app.
4. **No magic numbers for enums** — reference `Enums.*` constants. Verify against the legacy app if introducing a new value (§16 lists the columns still needing confirmation).
5. **PHI access is logged.** Every read/write of patient data hits `audit_log` (HIPAA-style). See `docs/security-and-ops.md` for the schema.
6. **UTC everywhere in storage.** Convert at the display layer only.
7. **RTL via logical Tailwind classes only** — `ps-*` / `pe-*` / `ms-*` / `me-*`, never `pl/pr/ml/mr`.
8. **`__sys*` columns are opaque** — don't read, write, or expose them in DTOs.
9. **Don't add columns/tables without a migration file** under `apps/api/prisma/migrations/`.
10. **Open questions before adding business logic:** check `docs/roadmap-and-open-questions.md` §16 — several enums, the password storage mechanism, and the inventory module are unresolved.

---

## Quick file index by task

| If you're doing… | Open |
|---|---|
| Editing/extending a patient entity (master, history, allergies) | `docs/schema-patient.md` |
| Editing/extending a visit/encounter or specialty sub-record | `docs/schema-visits.md` |
| Editing pediatric or OB/GYN history tables | `docs/schema-pediatric-obgyn.md` |
| Editing tenant config, users, permissions, or schedule | `docs/schema-tenant-users.md` |
| Editing billing, invoices, wallets, or ledger | `docs/schema-billing.md` |
| Looking up reference data (ICD/CPT/medicine/body system) | `docs/schema-reference.md` |
| Writing a new migration (FKs, indexes, partitions) | `docs/schema-fks-indexes.md` |
| Adding a REST endpoint | `docs/api-and-dtos.md` |
| Touching auth, audit, caching, deployment | `docs/security-and-ops.md` |
| Planning the next phase or resolving a typed-enum question | `docs/roadmap-and-open-questions.md` |
| Decoding a medical acronym you saw in a column name | `docs/appendices.md` (Appendix B) |
| Looking up which table is in which domain | `docs/appendices.md` (Appendix A) |
| Building or restyling a screen, component, or theme | `docs/design-system.md` |
| Picking a color, font size, spacing value, or radius | `docs/design-system.md` (§2–§4) |
| Adding an RTL-ready component | `docs/design-system.md` (§9) |