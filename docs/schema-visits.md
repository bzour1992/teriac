# Schema — Visits and specialty sub-records

> Part of the Teriac schema reference (originally §6 in the master doc). Sibling files:
> `schema-reference.md`, `schema-tenant-users.md`, `schema-patient.md`,
> `schema-pediatric-obgyn.md`, `schema-visits.md`, `schema-billing.md`.
>
> **This file covers:** patientvisits (clinical encounter root) + visit sub-records (assessment conditions, PMH conditions/meds, plan meds, prescriptions, revisits, after-visit recommendations) and specialty sub-records (pregnancy, risk strat, fertility, PASI, prenatal/fertility flowsheets); §6.13 scheduling lives in schema-tenant-users.md (hcenterscheduleitems)
>
> **Legend** — **PK** = Primary Key · **FK** → = Foreign Key (inferred) · **NN** = NOT NULL · **AI** = AUTO_INCREMENT.
> All domain tables also have trailing `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext` — omitted from per-column tables.

### 6.11 Patient Visit & Encounter

#### `patientvisits`
The clinical encounter root. Most other "pv*" tables hang off this.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK** | GUID |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `Doctor` | char(36) | NN, **FK** → hcenterusers | Attending physician |
| `SchedulingOfficer` | char(36) | NULL, **FK** → hcenterusers | Who scheduled |
| `VisitDate` | datetime(3) | NN | When the visit occurred |
| `Notes` | longtext | NULL | Visit notes (SOAP narrative) |
| `Recommendations` | longtext | NULL | Recommendations to patient |
| `Outcome` | int(11) | NN | Enum (open/resolved/referred/etc.) |
| `Intesity` | int(11) | NN | (typo: Intensity) — visit acuity |
| `ChiefComplaint` | longtext | NULL | CC |
| `HistoryOfPresentIllness` | longtext | NULL | HPI |
| `PastMedicalHistory` | longtext | NULL | PMH |
| `Disposition` | longtext | NULL | What happens next |
| `SourceOfRefferral` | varchar(250) | NULL | Where patient came from |
| `TransfereTo` | varchar(250) | NULL | Where transferred to |
| `DestinationOfRefferal` | varchar(50) | NULL | Referral destination |
| `ParentVisitID` | char(36) | NULL, **FK** → patientvisits (self) | Linked visit (e.g., follow-up) |
| `IsHospitalCase` | tinyint(1) | NN | Inpatient flag |
| `HospitalName` | varchar(250) | NULL | If hospital |
| `DateAdded` | datetime(3) | NULL | Record created date |
| `VisitType` | int(11) | NN | Enum (new/follow-up/emergency) |
| `PainLevel` | int(11) | NN | 0–10 |
| `VisitCreationMethod` | int(11) | NN | Manual / from appt / imported |
| `IsDeleted` | tinyint(1) | NN | Soft delete |

#### `aftervisitrecommendations`
Recommendations made during a visit that require follow-up tracking (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `AfterVisitRecommendationID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `Recommended` | longtext | NN | The recommendation |
| `RequestedByUserId` | char(36) | NN, **FK** → hcenterusers | Doctor who recommended |
| `RequestDate` | datetime(3) | NN | |
| `IsDone` | tinyint(1) | NN | Completion flag |
| `ProcessedDate` | datetime(3) | NULL | When done |
| `ProcessedByUserID` | char(36) | NULL, **FK** → hcenterusers | Who processed |

#### `pvassessmentconditions`
Diagnoses assigned during a visit (1:N) — usually linked to ICD-10 via `medicalconditions`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVAssessmentConditionID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `MedicalConditionID` | char(36) | NN, **FK** → medicalconditions | |
| `DateDiagnosed` | datetime(3) | NULL | |
| `AgeOfOnset` | varchar(50) | NULL | Free text |
| `ConditionStatus` | varchar(50) | NULL | Active/Resolved/Chronic |
| `Comments` | longtext | NULL | |
| `IsDeleted` | tinyint(1) | NN | Soft delete |

#### `pvpmhconditions`
Past Medical History conditions reviewed during this visit (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVPMHConditionID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `MedicalConditionID` | char(36) | NN, **FK** → medicalconditions | |
| `DateDiagnosed` | datetime(3) | NULL | |
| `AgeOfOnset` | varchar(50) | NULL | |
| `ConditionStatus` | varchar(50) | NULL | |

#### `pvpmhmedications`
PMH medications captured during this visit (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVPMHMedicationID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `MedicineID` | char(36) | NN, **FK** → medicines | |
| `Dose` | varchar(250) | NULL | |
| `Period` | varchar(250) | NULL | |
| `Frequency` | double | NULL | |
| `FrequencyUnit` | varchar(50) | NULL | |
| `QuantityNumber` | varchar(50) | NULL | |
| `QuantityForm` | varchar(50) | NULL | |
| `Route` | varchar(50) | NULL | |
| `PrescribedBy` | varchar(50) | NULL | Free text |
| `PrescriptionDate` | datetime(3) | NULL | |
| `Notes` | longtext | NULL | |
| `Indication` | longtext | NULL | |

#### `pvplanmedications`
Medications **planned/prescribed** during this visit (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVPlanMedicationID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `MedicineID` | char(36) | NN, **FK** → medicines | |
| `PVAssessmentConditionID` | char(36) | NULL, **FK** → pvassessmentconditions | Link to diagnosis |
| `Indication` | longtext | NULL | Why prescribed |
| `Dose` | varchar(250) | NULL | |
| `Period` | varchar(250) | NULL | |
| `Frequency` | double | NULL | |
| `FrequencyUnit` | varchar(50) | NULL | |
| `QuantityNumber` | varchar(50) | NULL | |
| `QuantityForm` | varchar(50) | NULL | |
| `Route` | varchar(50) | NULL | |
| `PrescribedBy` | char(36) | NULL, **FK** → hcenterusers | Doctor who prescribed |
| `PrescriptionDate` | datetime(3) | NULL | |
| `Notes` | longtext | NULL | |
| `SuggestedBy` | char(36) | NULL, **FK** → hcenterusers | Suggested by (e.g., AI/protocol) |
| `SuggestionDate` | datetime(3) | NULL | |
| `IsPrescribed` | tinyint(1) | NN | Confirmed vs just suggested |

#### `pvgprescription`
**Glasses (G)** prescription — optometry specialty visit data (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVGPrescriptionID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `DV*` columns | varchar(20) | NULL | **D**istance **V**ision metrics |
| `NV*` columns | varchar(20) | NULL | **N**ear **V**ision metrics |
| `*OD*` vs `*OS*` | | | OD = right eye (oculus dexter), OS = left (sinister) |
| `*S` | | | **S**phere |
| `*C` | | | **C**ylinder |
| `*A` | | | **A**xis |
| `*P` | | | **P**rism |
| `*B` | | | **B**ase |
| `PD` | varchar(20) | NULL | **P**upillary **D**istance |
| `BVD` | varchar(20) | NULL | **B**ack **V**ertex **D**istance |
| `Remarks` | longtext | NULL | Free notes |

> 22 vision-axis columns total. Names follow `{D|N}V{OD|OS}{S|C|A|P|B}` for 20 of them.

#### `pvrevisits`
Follow-up appointments planned from this visit (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVRevisitID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `RevisitDate` | datetime(3) | NN | When |
| `Comments` | longtext | NULL | |
| `Notes` | varchar(400) | NULL | |
| `IsDeleted` | tinyint(1) | NN | |
| `ProcedureHistoryID` | char(36) | NULL, **FK** → procedurehistory | If follow-up is for a procedure |
| `PVPlanProceduresCPTID` | char(36) | NULL | Procedure code |


---

### 6.12 Specialty Visit Sub-Records

#### `pvpregnancydetails`
Pregnancy details captured during an OB visit (1:1 with visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK**, **FK** → patientvisits | |
| `FatherOfBaby` | varchar(250) | NULL | Father's name |
| `LMPDate` | datetime(3) | NULL | Last Menstrual Period |
| `LMPGestAgeWeeks` | int(11) | NULL | Gestational age from LMP (weeks) |
| `LMPGestAgeDays` | int(11) | NULL | + days |
| `LMPEDC` | datetime(3) | NULL | Estimated Date of Confinement from LMP |
| `LMPIsSure` | tinyint(1) | NN | Patient sure of LMP |
| `FHRDDate` | datetime(3) | NULL | Fetal Heart Rate Detected date |
| `FHRDGestAgeWeeks` | int(11) | NULL | |
| `FHRDGestAgeDays` | int(11) | NULL | |
| `FHRDEDC` | datetime(3) | NULL | EDC from FHRD |
| `InitialExamDate` | datetime(3) | NULL | First antenatal exam |
| `InitialExamGestAgeWeeks` | int(11) | NULL | |
| `InitialExamGestDays` | int(11) | NULL | |
| `InitialExamEDC` | datetime(3) | NULL | |
| `UltraSoundDate` | datetime(3) | NULL | First US date |
| `UltraSoundGestAgeWeeks` | int(11) | NULL | |
| `UltraSoundGestAgeDays` | int(11) | NULL | |
| `UltraSoundEDC` | datetime(3) | NULL | |
| `UltraSound2Date` | datetime(3) | NULL | Second US |
| `UltraSound2GestAgeWeeks` | int(11) | NULL | |
| `UltraSound2GestAgeDays` | int(11) | NULL | |
| `UltraSound2EDC` | datetime(3) | NULL | |
| `ConsensusEDC` | datetime(3) | NULL | Final agreed EDC |
| `PStartDate` | datetime(3) | NULL | Pregnancy start |
| `PEDeliveryDate` | datetime(3) | NULL | Expected delivery |
| `PActaulDeliveryDate` | datetime(3) | NULL | (typo: "Actual") |
| `DeliveryGestAge` | double | NULL | Weeks at delivery |
| `LaborLength` | double | NULL | Hours |
| `DeliveryType` | int(11) | NN | Enum |
| `OC` | varchar(500) | NULL | Obstetric complications |
| `InfantSex` | int(11) | NN | |
| `InfantName` | varchar(250) | NULL | |
| `InfantWeight` | double | NULL | |
| `InfantWeightUnit` | varchar(50) | NULL | |
| `NC` | varchar(500) | NULL | Neonatal complications |
| `IsTwins` | tinyint(1) | NN | |

#### `pvpriskstratificationchecks`
OB risk stratification checklist (1:1 with visit). ~30 yes/no risk factor flags producing risk categorization.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK**, **FK** → patientvisits | |
| `Age1535` | tinyint(1) | NN | Age 15–35 (no risk modifier) |
| `Edu8` | tinyint(1) | NN | Education ≥ 8 years |
| `CardiacDisease12` | tinyint(1) | NN | NYHA Class I-II cardiac dz |
| `ActiveTuberculsis` | tinyint(1) | NN | (typo) |
| `CPD` | tinyint(1) | NN | Cephalopelvic disproportion |
| `Thrombophlebitis` | tinyint(1) | NN | |
| `Endocrinopathy` | tinyint(1) | NN | |
| `Epilepsy` | tinyint(1) | NN | |
| `Infertility` | tinyint(1) | NN | History of |
| `Abortions2` | tinyint(1) | NN | ≥2 abortions |
| `Deliveries6` | tinyint(1) | NN | ≥6 deliveries |
| `PretermSGA` | tinyint(1) | NN | Past preterm/SGA |
| `PBaby4000` | tinyint(1) | NN | Past baby >4000g |
| `IsoimmunizationABO` | tinyint(1) | NN | |
| `HemorrhagePD` | tinyint(1) | NN | Postpartum hemorrhage |
| `PPreeclampsia` | tinyint(1) | NN | Past preeclampsia |
| `NoFamilySupport` | tinyint(1) | NN | |
| `SecondWithin12Months` | tinyint(1) | NN | Pregnancy <12mo apart |
| `SAD` | tinyint(1) | NN | Substance Abuse Disorder |
| `Age39` | tinyint(1) | NN | Age <15 or >35 |
| `Diabetes` | tinyint(1) | NN | |
| `Hypertension` | tinyint(1) | NN | |
| `Age391` | tinyint(1) | NN | Age threshold variant |
| `CardiacDisease34` | tinyint(1) | NN | NYHA III-IV |
| `CRD` | tinyint(1) | NN | Chronic Renal Disease |
| `CCA` | tinyint(1) | NN | Cardiovascular Congenital Anomaly |
| `Hemogobinopathies` | tinyint(1) | NN | (typo: Hemoglobinopathies) |
| `IsoimmunizationRh` | tinyint(1) | NN | |
| `SADAbuse` | tinyint(1) | NN | Active substance abuse |
| `HabitualAbortions` | tinyint(1) | NN | |
| `IncompetentCervix` | tinyint(1) | NN | |
| `FetalNeonatalDeath` | tinyint(1) | NN | History of |
| `NeuroDamagedInfant` | tinyint(1) | NN | History of |
| `SocialProblems` | tinyint(1) | NN | |
| `NoRisk` | tinyint(1) | NN | Computed result: no risk |
| `AtRisk` | tinyint(1) | NN | Computed result: moderate risk |
| `AtHighRisk` | tinyint(1) | NN | Computed result: high risk |

#### `pvpinitialexam`
Initial OB physical exam (1:1 with visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK**, **FK** → patientvisits | |
| `PrePregWeight` | int(11) | NN | Pre-pregnancy weight |
| `CurrentWeight` | int(11) | NN | |
| `Height` | int(11) | NN | |
| `BP` | int(11) | NN | Blood pressure (stored as int — likely systolic) |
| `HEENT` | int(11) | NN | Head/Eyes/Ears/Nose/Throat — finding code |
| `NeckThyroid` | int(11) | NN | |
| `Lungs` | int(11) | NN | |
| `Heart` | int(11) | NN | |
| `Breats` | int(11) | NN | (typo: Breasts) |
| `Abdomen` | int(11) | NN | |
| `Extremities` | int(11) | NN | |
| `Neuro` | int(11) | NN | |
| `Skin` | int(11) | NN | |
| `ExtGenetalia` | int(11) | NN | External genitalia |
| `Vagina` | int(11) | NN | |
| `Cervix` | int(11) | NN | |
| `Ulterus` | int(11) | NN | (typo: Uterus) |
| `Adnexae` | int(11) | NN | |
| `DiagonalConj` | int(11) | NN | Diagonal conjugate (pelvimetry) |
| `MidPelvis` | int(11) | NN | |
| `PubicArch` | int(11) | NN | |
| `Bituberous` | int(11) | NN | Bituberous diameter |
| `PelvisType` | int(11) | NN | Gynecoid/Android/Anthropoid/Platypelloid |
| `VagDelivPrognosis` | int(11) | NN | Vaginal delivery prognosis enum |
| `Notes` | varchar(500) | NULL | |

#### `prenatalflowsheetitems`
Per-visit prenatal monitoring entries (1:N — multiple readings per visit possible).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `FlowSheetItemID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `ReadingDate` | datetime(3) | NN | |
| `Headache` | tinyint(1) | NN | |
| `Bleeding` | tinyint(1) | NN | |
| `CP` | tinyint(1) | NN | Chest Pain |
| `Nausea` | tinyint(1) | NN | |
| `Vomiting` | tinyint(1) | NN | |
| `Swelling` | tinyint(1) | NN | |
| `FetalMovement` | int(11) | NN | Enum |
| `Weight` | double | NULL | |
| `WeightUnit` | varchar(50) | NULL | |
| `SBP` | int(11) | NULL | Systolic BP |
| `DBP` | int(11) | NULL | Diastolic BP |
| `UrineProtein` | int(11) | NULL | Dipstick 0–4+ |
| `UrineGluccose` | int(11) | NULL | (typo) Dipstick 0–4+ |
| `FHcm` | double | NULL | Fundal Height (cm) |
| `Position` | int(11) | NULL | Fetal position enum |
| `Cervix` | varchar(150) | NULL | Cervical exam findings |
| `Edema` | tinyint(1) | NN | |
| `Notes` | varchar(500) | NULL | |

#### `pvfertilitydetails`
Fertility workup (1:1 with visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK**, **FK** → patientvisits | |
| `SOName` | varchar(250) | NULL | Significant Other (partner) name |
| `SOAge` | int(11) | NULL | |
| `LMPDate` | datetime(3) | NULL | |
| For each treatment (FSH, FSHLH, AgonistLong, Antagonist, IUI, ICSI, TESA): | | | |
| `<treatment>` | tinyint(1) | NN | Done? |
| `<treatment>Date` | datetime(3) | NULL | When |
| `<treatment>Note` | varchar(500) | NULL | |

Treatments:
- **FSH** — Follicle Stimulating Hormone protocol
- **FSHLH** — FSH+LH combo
- **AgonistLong** — GnRH agonist long protocol
- **Antagonist** — GnRH antagonist protocol
- **IUI** — Intrauterine insemination
- **ICSI** — Intracytoplasmic sperm injection
- **TESA** — Testicular sperm aspiration

#### `pvfertilityflowsheetitems`
Fertility cycle daily tracking (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PVFertilityFlowSheetItem` | char(36) | NN, **PK** | (note: missing "ID" suffix) |
| `PatientVisitID` | char(36) | NN, **FK** → patientvisits | |
| `ItemDate` | datetime(3) | NN | |
| `Day` | int(11) | NULL | Cycle day |
| `Gonad` | double | NULL | Gonadotropin dose |
| `AAnt` | double | NULL | Antagonist dose |
| `RtOvery` | int(11) | NULL | (typo: Ovary) Right ovary follicle count |
| `LtOvery` | int(11) | NULL | Left ovary |
| `EndNote` | varchar(500) | NULL | |

#### `patientpasiscore`
PASI (Psoriasis Area Severity Index) for dermatology visits (1:1 with visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientVisitID` | char(36) | NN, **PK**, **FK** → patientvisits | |
| For each region (Head, UppedLimbs(sic), Trunk, LowerLimbs): | | | |
| `<region>Erythema` | int(11) | NN | Redness severity 0–4 |
| `<region>Thickness` | int(11) | NN | Plaque thickness 0–4 |
| `<region>Scaling` | int(11) | NN | Desquamation 0–4 |
| `<region>DI` | int(11) | NN | Computed regional severity |
| `A1`/`A2`/`A3`/`A4` | int(11) | NN | Area scores per region (0–6) |
| `B1`/`B2`/`B3`/`B4` | double | NN | Area percentage multiplier |
| `C1`/`C2`/`C3`/`C4` | double | NN | Regional PASI component |
| `PASI` | double | NN | **Total PASI (0–72)** |
| `AnnotationXML` | longtext | NULL | Body-map annotation in XML |

> **Note:** "UppedLimbs" is consistently misspelled in 16 columns; it means "Upper Limbs".

---

### 6.13 Scheduling — covered in 6.4 (`hcenterscheduleitems`)

---

