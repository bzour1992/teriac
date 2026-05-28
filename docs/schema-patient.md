# Schema — Patient master & general history

> Part of the Teriac schema reference (originally §6 in the master doc). Sibling files:
> `schema-reference.md`, `schema-tenant-users.md`, `schema-patient.md`,
> `schema-pediatric-obgyn.md`, `schema-visits.md`, `schema-billing.md`.
>
> **This file covers:** patient master record and all 1:1 extension tables (Arabic info, additional info, SAD details, jobs, education, special notes, checklist, test behaviors, insurance) plus 1:N general history (allergies, chronic diseases, long-term meds, problems, hereditary diseases, immunizations, lab requests)
>
> **Legend** — **PK** = Primary Key · **FK** → = Foreign Key (inferred) · **NN** = NOT NULL · **AI** = AUTO_INCREMENT.
> All domain tables also have trailing `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext` — omitted from per-column tables.

### 6.6 Patient Master Data

#### `patients`
The patient master record.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK** | GUID |
| `NationalID` | varchar(50) | NN | National ID number (passport/ID card) |
| `Prefix` | varchar(10) | NULL | Mr./Mrs./Dr. |
| `FirstName` | varchar(50) | NULL | English first name |
| `SecondName` | varchar(50) | NULL | Father's name (MENA convention) |
| `ThirdName` | varchar(50) | NULL | Grandfather's name |
| `LastName` | varchar(50) | NULL | Family name |
| `Sex` | int(11) | NN | Enum (1=Male, 2=Female) |
| `Height` | double | NULL | Baseline height (cm or in) |
| `Weight` | double | NULL | Baseline weight (kg or lb) |
| `WHUnit` | varchar(50) | NULL | Unit system ("metric"/"imperial") |
| `DateOfBirth` | datetime(3) | NN | DOB |
| `MobileNumber` | varchar(50) | NULL | |
| `Email` | varchar(250) | NULL | |
| `Address` | longtext | NULL | Free-text address |
| `PhotoFilename` | varchar(250) | NULL | Patient photo |
| `OnlinePassword` | varchar(250) | NULL | Patient portal credential **(must be hashed)** |
| `ContactPersonName` | varchar(250) | NULL | Emergency contact |
| `ContactRelation` | varchar(250) | NULL | Relationship |
| `ContactPhoneNumber` | varchar(250) | NULL | |
| `Religion` | varchar(50) | NULL | |
| `Nationality` | char(36) | NULL, **FK** → countries | |
| `HCenterID` | char(36) | NN, **FK** → hcenters | Tenant scope |
| `HumanRaceID` | char(36) | NULL, **FK** → humanraces | |
| `MaritalStatusID` | char(36) | NULL, **FK** → maritalstatuses | |
| `SchoolPerformance` | int(11) | NN | Pediatric enum |
| `FatherEducation` | varchar(500) | NULL | Pediatric |
| `FatherOccupation` | varchar(500) | NULL | Pediatric |
| `MotherEducation` | varchar(500) | NULL | |
| `MotherOccupation` | varchar(500) | NULL | |
| `ChildOrder` | int(11) | NULL | Birth order |
| `ChildrenCount` | int(11) | NULL | Total siblings |
| `DateAdded` | datetime(3) | NULL | Record creation date |
| `PassportNumber` | varchar(50) | NULL | |
| `PatientCreationMethod` | int(11) | NN | Enum (manual/imported/portal) |
| `IsDeleted` | tinyint(1) | NN | Soft delete |

#### `patientarabicinfo`
Arabic-script name extension (1:1 with patients).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | Shared PK |
| `FirstNameAr` | varchar(50) | NULL | Arabic first name |
| `SecondNameAr` | varchar(50) | NULL | |
| `ThirdNameAr` | varchar(50) | NULL | |
| `LastNameAr` | varchar(50) | NULL | |

#### `patientadditionalinfo`
Extended demographics & administrative info (1:1).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `Occupation` | varchar(250) | NULL | |
| `DailyRoutine` | longtext | NULL | Lifestyle notes |
| `DietaryPatterns` | longtext | NULL | |
| `SleepPatterns` | longtext | NULL | |
| `ExercisePatterns` | longtext | NULL | |
| `POBox` | varchar(15) | NULL | |
| `ZipCode` | varchar(10) | NULL | |
| `Organization` | varchar(250) | NULL | Employer |
| `LegalAuthenticator` | varchar(50) | NULL | Document signoff name |
| `AuthenticationDate` | datetime(3) | NULL | |
| `Transcriptionist` | varchar(50) | NULL | |
| `TranscriptionDate` | datetime(3) | NULL | |
| `HomeEnvironment` | varchar(400) | NULL | Housing conditions |

#### `patientsaddetails`
Substance use details (smoking, alcohol, drugs) — 1:1 with patient.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `LiveWithSmokers` | tinyint(1) | NN | Secondhand smoke exposure |
| `ParentsWereSmokers` | tinyint(1) | NN | |
| `SmokedBofore` | tinyint(1) | NN | (typo: "Before") |
| `StillSmoking` | tinyint(1) | NN | |
| `CigarettesNumber` | int(11) | NULL | Per day |
| `CigarettesStartYear` | int(11) | NULL | |
| `CigarettesStopYear` | int(11) | NULL | |
| `CigarettesPackYear` | double | NULL | Pack-years (computed) |
| `CigarsNumber` | int(11) | NULL | |
| `CigarsStartYear` | int(11) | NULL | |
| `CigarsStopYear` | int(11) | NULL | |
| `CigarsPackYear` | double | NULL | |
| `PipeFullsNumber` | int(11) | NULL | Pipe count |
| `PipefullsStartYear` | int(11) | NULL | |
| `PipefullsStopYear` | int(11) | NULL | |
| `PipefullPackYear` | double | NULL | |
| `SmoklessNumber` | int(11) | NULL | Smokeless tobacco |
| `SmokelessStartYear` | int(11) | NULL | |
| `SmokelessStopYear` | int(11) | NULL | |
| `SmokelessPackYear` | double | NULL | |
| `SheeshaHeadNumber` | int(11) | NULL | Hookah/shisha use |
| `SheeshaStartYear` | int(11) | NULL | |
| `SheeshaStopYear` | int(11) | NULL | |
| `SheehaPackYear` | double | NULL | |
| `Alcoholic` | tinyint(1) | NN | Currently drinks alcohol |
| `BeerNumber` | int(11) | NULL | Beers per week |
| `WineNumber` | int(11) | NULL | |
| `LiquorNumber` | int(11) | NULL | |
| `PastAlcoholic` | tinyint(1) | NN | History of alcoholism |
| `ExcessiveAlcoholUse` | tinyint(1) | NN | |
| `DrugUser` | tinyint(1) | NN | Recreational/illicit |
| `DrugComments` | varchar(500) | NULL | |
| `TotalPackYear` | double | NULL | Sum across all tobacco |
| `DrinkingComments` | varchar(500) | NULL | |
| `SmokingComments` | varchar(500) | NULL | |

#### `patientjobs`
Employment history (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientJobID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `JobTitle` | varchar(250) | NULL | |
| `Organization` | varchar(250) | NULL | Employer |
| `Duration` | varchar(250) | NULL | Length of employment (free text) |
| `IsCurrent` | tinyint(1) | NN | Current job flag |
| `HazardExposure` | tinyint(1) | NN | Workplace hazard exposure |
| `UseOfProtectiveMethods` | tinyint(1) | NN | PPE used |
| `Comments` | longtext | NULL | |

#### `patienteducationalhistory`
1:1 with patient.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `EducationLevelInYears` | int(11) | NULL | Total years of education |
| `BachelorField` | varchar(150) | NULL | |
| `BachelorCollege` | varchar(150) | NULL | |
| `MastersField` | varchar(150) | NULL | |
| `MastersCollege` | varchar(150) | NULL | |
| `DoctorateField` | varchar(150) | NULL | |
| `DoctorateCollege` | varchar(150) | NULL | |

#### `patientspecialnotes`
Free-form alerts/notes on the patient (1:N). Typically shown prominently in UI.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientSpecialNoteID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `Note` | longtext | NN | The note |

#### `patientchecklist`
M:N between patients and checklist items, with metadata about frequency.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ChecklistItemID` | char(36) | NN, **PK**, **FK** → checklistitems | |
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | Composite PK |
| `Level` | varchar(50) | NN | Compliance level |
| `Frequency` | double | NN | How often |
| `FrequencyUnit` | varchar(50) | NN | E.g., "days", "weeks" |

#### `patienttestbehaviors`
Pediatric/psych behavior observations across 3 test sessions (1:1).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `Typical1` / `Typical2` / `Typical3` | tinyint(1) | NN | Behavior typical of patient |
| `Compliance1` / `2` / `3` | int(11) | NN | Score 1–5 |
| `Interest1` / `2` / `3` | int(11) | NN | Score 1–5 |
| `Fearfulness1` / `2` / `3` | int(11) | NN | Score 1–5 |
| `Attention1` / `2` / `3` | int(11) | NN | Score 1–5 |

#### `patientinsurancedetails`
Insurance policies (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientInsuranceDetailID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `InsuranceCompany` | longtext | NN | Company name (free text) |
| `InsuranceLevel` | varchar(250) | NULL | Plan tier |
| `Notes` | longtext | NULL | |
| `CoveragePercentage` | double | NULL | E.g., 80.0 |
| `InsuranceCardNumber` | varchar(50) | NULL | |
| `IsActive` | tinyint(1) | NN | Currently active |
| `ParticipantName` | varchar(400) | NULL | If patient is dependent |
| `FormNumber` | varchar(250) | NULL | |
| `ParticipantCompany` | varchar(250) | NULL | |
| `RelationToParticipant` | varchar(250) | NULL | E.g., spouse, child |
| `HealthInsuranceEntityID` | char(36) | NULL | External entity ID (eClaim) |
| `BenefitPackageID` | char(36) | NULL | External benefit package ID |

---

### 6.7 Patient History — General

#### `allergies`
Patient allergies (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `AllergyID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `MedicalConditionID` | char(36) | NN, **FK** → medicalconditions | The allergen (a "condition") |
| `Severity` | int(11) | NULL | Enum (mild/mod/severe) |
| `LastOccurenceDate` | datetime(3) | NULL | Last reaction date |
| `Treatment` | longtext | NULL | Past treatment |
| `Reaction` | varchar(500) | NULL | Type of reaction |

#### `chronicdiseases`
Patient chronic conditions (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ChronicDiseaseID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `MedicalConditionID` | char(36) | NN, **FK** → medicalconditions | |
| `YearDiagnosed` | int(11) | NULL | |
| `MonthDiagnosed` | int(11) | NULL | |
| `Notes` | varchar(500) | NULL | |

#### `patientlongtermmedicines`
Chronic medications the patient takes long-term (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientLongTermMedicineID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `MedicineID` | char(36) | NN, **FK** → medicines | |
| `Dose` | varchar(250) | NULL | E.g., "10mg" |
| `Frequency` | double | NULL | |
| `FrequencyUnit` | varchar(50) | NULL | E.g., "per day" |
| `Period` | varchar(250) | NULL | E.g., "for 3 months" |
| `Notes` | longtext | NULL | |
| `QuantityNumber` | varchar(50) | NULL | |
| `QuantityForm` | varchar(50) | NULL | E.g., "tablet" |
| `Route` | varchar(50) | NULL | E.g., PO, IM |
| `PrescribedBy` | varchar(50) | NULL | Doctor name (free text) |
| `PrescriptionDate` | datetime(3) | NULL | |
| `Indication` | longtext | NULL | Why prescribed |

#### `patientproblems`
Active problem list (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientProblemID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `ProblemText` | longtext | NN | Description |
| `ProblemCategory` | int(11) | NN | Enum (active/resolved/history) |
| `OnsetDate` | datetime(3) | NULL | |
| `LastOccurenceDate` | datetime(3) | NULL | |
| `IsActive` | tinyint(1) | NN | |
| `IsUserModified` | tinyint(1) | NN | Differentiates auto-generated from manual |

#### `pfihereditarydiseases`
Family hereditary diseases (1:N). "PFI" = Patient Family Information.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PFIHereditaryDiseases` | char(36) | NN, **PK** | (column name is also PK name — unusual) |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `MedicalConditionID` | char(36) | NN, **FK** → medicalconditions | |
| `Description` | varchar(250) | NULL | Family member affected (free text) |

#### `patientimmunizationhistory`
Summary immunization flags (1:1 with patient).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `LastTetanusShotDate` | datetime(3) | NULL | |
| `AnnualFluVaccine` | tinyint(1) | NN | Gets flu shot annually |
| `PneumococcalVaccine` | tinyint(1) | NN | |
| `TuberculosisSkinTest` | tinyint(1) | NN | |
| `TuberculosisSkinTestNegative` | tinyint(1) | NN | Result |
| `TuberculosisSkinTestDate` | datetime(3) | NULL | |

#### `patientimmunizations`
Individual vaccine doses (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientImmunizationID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `ImmunizationsVaccineID` | char(36) | NN, **FK** → immunizationsvaccines | |
| `VaccineType` | varchar(50) | NULL | Subtype |
| `Dose` | varchar(50) | NULL | Dose info |
| `AgeAdministered` | varchar(50) | NULL | E.g., "6 months" |
| `DateAdministered` | datetime(3) | NULL | |
| `LotNumber` | varchar(50) | NULL | |
| `Physician` | varchar(50) | NULL | Who administered |

#### `patientlabrequests`
External lab orders (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientLabRequestID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `LabRequest` | varchar(500) | NN | What was ordered |
| `Lab` | varchar(500) | NULL | Which lab |
| `RequestDate` | datetime(3) | NN | |
| `ExpectedDeliveryDate` | datetime(3) | NN | |
| `IsDelivered` | tinyint(1) | NN | |
| `DeliveryDate` | datetime(3) | NULL | |

#### `patientgeneralappearance`
General exam observations (1:1).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientID` | char(36) | NN, **PK**, **FK** → patients | |
| `Appearance` | varchar(500) | NULL | Overall appearance |
| `BodyBuild` | varchar(500) | NULL | E.g., athletic, obese |
| `Demeanor` | varchar(500) | NULL | E.g., anxious, calm |
| `Hygiene` | varchar(500) | NULL | |

#### `patientgeneralreviewquestionaire`
Review of Systems (ROS) questionnaire — 1:1 with patient. Each symptom has a current-flag, onset year, ongoing flag, and comments.

| Column Group | Pattern |
|---|---|
| For each symptom (Weight Loss, Weight Gain, Chronic Fatigue, Change in Appetite, Night Sweats, Fever, Cancer, Chronic Pain, Sleeping Problems, Rash, Itching, Recent Trauma) | `<symptom>` varchar(10), `<symptom>OnsetYear` int(11) NULL, `<symptom>StillProblem` tinyint(1) NN, `<symptom>Comments` varchar(500) NULL |
| `WeightLossMagnitude` / `WeightGainMagnitude` | int(11) NULL — amount lost/gained |
| `WeightUnit` | varchar(10) NULL — unit for above |
| `ChronicPainSite` / `Nature` / `Radiation` / `Duration` / `Frequency` | varchar(250) NULL — details if pain present |
| `RashSite` / `Nature` | varchar(250) NULL |
| `ItchingSite` | varchar(250) NULL |
| `SleepingPatterns` | varchar(100) NULL |
| `RecentTraumaMechanism` | varchar(250) NULL |
| `RecentTraumaDate` | datetime(3) NULL |
| `PatientID` | char(36) NN, **PK** |

> **⚠ Schema smell:** `ChnageInAppetite*` is a typo for "Change in Appetite".

#### `patientbodysystemreview`
Per-system Review of Systems narrative (1:N per body system per visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientBodySystemReviewID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | Visit context |
| `BodySystemID` | char(36) | NN, **FK** → bodysystems | |
| `IsNormal` | tinyint(1) | NN | Normal exam findings |
| `Notes` | longtext | NULL | Findings narrative |
| `RecordDate` | datetime(3) | NN | |
| `LotGUID` | char(36) | NN | Batch ID for related items |
| `Username` | varchar(250) | NULL | Recorder |

#### `patientbodysystemphysicalexam`
Per-system Physical Exam findings (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientBodySystemPhysicalExamID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | |
| `BodySystemID` | char(36) | NN, **FK** → bodysystems | |
| `IsNormal` | tinyint(1) | NN | |
| `Notes` | longtext | NULL | |
| `RecordDate` | datetime(3) | NN | |
| `LotGUID` | char(36) | NN | |
| `SystemAnnotationFile` | longtext | NULL | Annotated anatomy image data |
| `FreeAnnotationFile` | longtext | NULL | Freeform annotation |
| `Username` | varchar(250) | NULL | |

#### `pbspexamchecklistitem`
Individual checklist responses tied to a body-system review.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PBSPExamChecklistItemID` | char(36) | NN, **PK** | |
| `PatientBodySystemReviewID` | char(36) | NN, **FK** → patientbodysystemreview | |
| `BodySystemChecklistItemID` | bigint(20) | NN, **FK** → bodysystemschecklistitems | The question |
| `Value` | varchar(10) | NULL | Y/N/? response |
| `Comments` | longtext | NULL | |
| `YearOfOnset` | varchar(10) | NULL | If positive |
| `StillAProblem` | tinyint(1) | NN | |

#### `patientdiagnosticstudies`
Summary screening/diagnostic study flags (1:1 with patient).

A wide repeating pattern: for each of {EKGECG, ExerciseStressTest, ChestXRay, BoneDensitometry, Sigmoidoscopy, Colonoscopy, Mammogram, PelvicExam, PapSmear, DigitalRectalExam, ProstateSpecificAntigenTest, DDHScreening}:
- `<study>` tinyint(1) NN — done?
- `<study>Date` datetime(3) NULL (EKG, Stress, ChestXRay) **OR** `<study>Year` int NULL + `<study>Month` int NULL (others)
- `<study>Comments` varchar(500) NULL

Plus `PatientID` char(36) NN **PK**.

#### `patientdstitems`
Items inside a Diagnostic Screening Test (Denver test results).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientDSTItemID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `ItemID` | char(36) | NN, **FK** → denverscreeningtestitems | |
| `ItemValue` | double | NULL | Value observed |
| `ItemPerentage` | varchar(50) | NULL | (typo: "Percentage") |

#### `patientechocardiogramtests`
Echocardiogram results (cardiology — 1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientEchoCardiogramTestID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | |
| `RequestedBy` | varchar(250) | NULL | Referring doc |
| `PPD` | varchar(550) | NULL | |
| `LVEDD` | double | NULL | LV End-Diastolic Diameter |
| `LVESD` | double | NULL | LV End-Systolic Diameter |
| `IVS` | double | NULL | Interventricular Septum |
| `PLVW` | double | NULL | Posterior LV Wall |
| `AorticRoot` | double | NULL | |
| `LA` | double | NULL | Left Atrium |
| `RV` | double | NULL | Right Ventricle |
| `DMModeFindings` | longtext | NULL | M-Mode findings |
| `DopplerFindings` | longtext | NULL | |
| `Conclusion` | longtext | NULL | |
| `TestDate` | datetime(3) | NN | |

#### `patienttests`
Generic test results (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientTestID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | |
| `DiagnosticTestID` | char(36) | NN, **FK** → diagnostictests | |
| `Notes` | longtext | NULL | Test result narrative |
| `RecordDate` | datetime(3) | NN | |
| `LotGUID` | char(36) | NN | Batch ID |
| `Username` | varchar(250) | NULL | |

#### `procedurehistory`
Procedures the patient has had (1:N).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ProcedureHistoryID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `MedicalProcedureID` | char(36) | NN, **FK** → medicalprocedures | |
| `Procedure` | varchar(250) | NULL | Free-text override |
| `ProcedureDate` | datetime(3) | NULL | |
| `Physician` | varchar(250) | NULL | |
| `location` | varchar(250) | NULL | (lowercase — typo) |
| `Result` | longtext | NULL | |
| `Tooth` | varchar(50) | NULL | Dental: which tooth (FDI/Universal #) |
| `ToothSurface` | varchar(50) | NULL | Dental: M/D/B/L/O |
| `ImplantDesign` | varchar(50) | NULL | Dental implant details |
| `ImplantMechanism` | varchar(50) | NULL | |
| `ImplantBodyDesign` | varchar(50) | NULL | |
| `ImplantSurface` | varchar(50) | NULL | |
| `ImplantMaterial` | varchar(50) | NULL | |
| `ToothLeftRight` | varchar(50) | NULL | L/R |
| `ToothUpperLower` | varchar(50) | NULL | U/L |
| `ToothType` | varchar(50) | NULL | Type |


---

