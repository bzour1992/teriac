# Schema — Reference data (system, geo, medical coding)

> Part of the Teriac schema reference (originally §6 in the master doc). Sibling files:
> `schema-reference.md`, `schema-tenant-users.md`, `schema-patient.md`,
> `schema-pediatric-obgyn.md`, `schema-visits.md`, `schema-billing.md`.
>
> **This file covers:** system sync tables, geographic & demographic lookups, and the medical coding catalog (specialties, body systems, conditions, procedures, medicines, immunizations, symptoms, diagnostic tests, modalities, CPT, HCPCS, ICD-10, Denver screening)
>
> **Legend** — **PK** = Primary Key · **FK** → = Foreign Key (inferred) · **NN** = NOT NULL · **AI** = AUTO_INCREMENT.
> All domain tables also have trailing `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext` — omitted from per-column tables.

### 6.1 System Tables

#### `__sysocsdeletedrows`
Tombstone log used by the offline sync engine. Stores keys of physically deleted rows so other clients can sync the deletion.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `__sysTName` | varchar(129) | NN | Table name where the row was deleted |
| `__sysRK` | blob | NN | Serialized primary-key value of the deleted row |
| `__sysDeleteTxBsn` | bigint(20) | NN | Transaction BSN at deletion |
| `__sysInsertTxCsn` | bigint(20) | NULL | CSN of insert (for conflict detection) |
| `__sysDeletedTime` | datetime(3) | NULL | When the deletion occurred |
| `__sysTrackingContext` | char(36) | NULL | Device/session that deleted |

#### `__sysocstrackedobjects`
Registry of tables and columns being tracked for sync.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `__sysTName` | varchar(129) | NN | Tracked table name |
| `__sysTrackOpt` | int(11) | NULL | Tracking options bitflag |
| `__sysTrackType` | int(11) | NULL | Type of tracking |
| `__sysTrackColOrd` | int(11) | NULL | Column ordinal in tracking metadata |

#### `__systxcommitsequence`
Commit order log for sync framework.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `__sysTxBsn` | bigint(20) | NN, INDEXED | Transaction batch sequence number |
| `__sysTxCsn` | bigint(20) | NN, **PK** | Commit sequence number |
| `__sysCommitTime` | datetime(3) | NULL | Commit timestamp |

---

### 6.2 Geographic & Demographic Lookups

#### `countries`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `CountryID` | char(36) | NN, **PK** | GUID |
| `CountryName` | varchar(50) | NN | English name |
| `CountryCodeISO3` | varchar(6) | NULL | ISO 3166-1 alpha-3 (e.g., USA, JOR) |
| `CountryCodeISO2` | varchar(6) | NULL | ISO 3166-1 alpha-2 (e.g., US, JO) |
| `PhoneCode` | varchar(8) | NULL | Dialing code (e.g., +962) |
| `NationalityText` | varchar(250) | NULL | Nationality adjective (e.g., Jordanian) |

#### `cities`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `CityID` | char(36) | NN, **PK** | GUID |
| `CityName` | varchar(50) | NN | City name |
| `CountryID` | char(36) | NN, **FK** → countries | Parent country |

#### `humanraces`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `HumanRaceID` | char(36) | NN, **PK** | GUID |
| `RaceName` | varchar(50) | NN | E.g., Caucasian, Arab, African |

#### `maritalstatuses`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `MaritalStatusID` | char(36) | NN, **PK** | GUID |
| `MaritalStatus` | varchar(50) | NN | E.g., Single, Married, Divorced |

---

### 6.3 Medical Coding & Reference

#### `specialities`
Medical specialties.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `SpecialityID` | char(36) | NN, **PK** | GUID |
| `SpecialityName` | varchar(150) | NN | E.g., Cardiology, Pediatrics |
| `Description` | longtext | NULL | |
| `SpecialtyGroup` | varchar(2) | NN | Group code (e.g., "01") |
| `SpecialtyID` | varchar(50) | NULL | External specialty ID (e.g., eClaim Link code) |

#### `bodysystems`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `BodySystemID` | char(36) | NN, **PK** | GUID |
| `BodySystemName` | varchar(50) | NN | E.g., Cardiovascular, Respiratory |
| `BodySystemDescription` | varchar(500) | NULL | |
| `SmallImageFileName` | varchar(255) | NULL | Thumbnail |
| `MediumImageFilename` | varchar(255) | NULL | |
| `LargeImageFilename` | varchar(255) | NULL | Full anatomical image |
| `BodySystemOrder` | int(11) | NN | Display order |

#### `bodysystemannotationimages`
Anatomical diagrams that can be annotated during exams.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `BodySystemAnnotationImageID` | char(36) | NN, **PK** | GUID |
| `BodySystemID` | char(36) | NN, **FK** → bodysystems | |
| `Filename` | varchar(255) | NULL | Image file |
| `ImageTitle` | varchar(250) | NN | |

#### `bodysystemschecklistitems`
Review-of-systems questions per body system.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `BodySystemChecklistItemID` | bigint(20) | NN, **PK**, AI | Auto-increment ID |
| `BodySystemChecklistItemName` | varchar(500) | NN | The question/item |
| `AdditionalQuestions` | longtext | NULL | Follow-up prompts |
| `BodySystemID` | char(36) | NN, **FK** → bodysystems | |
| `OrderWithinSystem` | int(11) | NN | Display order in that system |

#### `checklistitems`
Generic patient checklists (vaccinations, screenings, etc.).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ChecklistItemID` | char(36) | NN, **PK** | GUID |
| `ChecklistItemName` | varchar(150) | NN | |
| `Description` | longtext | NULL | |
| `ImageFile` | varchar(255) | NULL | Optional icon |

#### `medicalconditions`
Master list of medical conditions/diagnoses.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `MedicalConditionID` | char(36) | NN, **PK** | GUID |
| `MedicalConditionName` | varchar(250) | NN | Condition name |
| `Description` | longtext | NULL | |
| `IsAllergy` | tinyint(1) | NN | Whether condition is an allergy |
| `IsHereditary` | tinyint(1) | NN | |
| `IsChronic` | tinyint(1) | NN | |
| `CategoryText` | varchar(50) | NULL | Category label |
| `IsVerified` | tinyint(1) | NN | Admin-approved vs user-added |
| `AddedBy` | varchar(250) | NN | Username of creator |
| `SearchKeywords` | longtext | NULL | Comma-separated search aliases |
| `DateAdded` | datetime(3) | NULL | |

#### `medicalprocedures`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `MedicalProcedureID` | char(36) | NN, **PK** | GUID |
| `MedicalProcedureName` | varchar(250) | NN | |
| `MedicalProcedureDescription` | varchar(500) | NULL | |
| `IsVerified` | tinyint(1) | NN | |
| `AddedBy` | varchar(250) | NN | |
| `DateAdded` | datetime(3) | NULL | |

#### `medicines`
Drug master list.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `MedicineID` | char(36) | NN, **PK** | GUID |
| `TradeName` | varchar(500) | NULL | Brand name |
| `scientificName` | varchar(500) | NULL | Generic name (note casing) |
| `Description` | longtext | NULL | |
| `IsVerified` | tinyint(1) | NN | |
| `AddedBy` | varchar(250) | NN | |
| `DateAdded` | datetime(3) | NULL | |
| `CityID` | char(36) | NULL, **FK** → cities | Optional regional availability |
| `CountryID` | char(36) | NN, **FK** → countries | Country of registration |

#### `immunizationsvaccines`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `ImmunizationsVaccineID` | char(36) | NN, **PK** | GUID |
| `ImmunizationsVaccineName` | varchar(250) | NN | E.g., MMR, BCG, Hepatitis B |
| `IsVerified` | tinyint(1) | NN | |
| `AddedBy` | varchar(250) | NN | |
| `DateAdded` | datetime(3) | NULL | |

#### `symptoms`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `SymptomID` | char(36) | NN, **PK** | GUID |
| `SymptomName` | longtext | NN | |
| `Description` | longtext | NULL | |
| `IsVerified` | tinyint(1) | NN | |
| `AddedBy` | varchar(250) | NN | |
| `DateAdded` | datetime(3) | NULL | |

#### `diagnostictests`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `DiagnosticTestID` | char(36) | NN, **PK** | GUID |
| `DiagnosticTestName` | varchar(500) | NN | E.g., CBC, BMP, MRI Brain |
| `Description` | longtext | NULL | |
| `DiagnosticTestType` | int(11) | NN | Enum (lab/imaging/etc.) |
| `IsVerified` | tinyint(1) | NN | |
| `AddedBy` | varchar(250) | NN | |
| `DateAdded` | datetime(3) | NULL | |

#### `modalities`
Imaging modalities.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ModalityID` | char(36) | NN, **PK** | GUID |
| `ModalityName` | varchar(500) | NN | E.g., CT, MRI, X-Ray |
| `ModalityType` | int(11) | NN | Enum |
| `Description` | varchar(500) | NULL | |

#### `cptcodes`
Current Procedural Terminology codes (AMA).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `CPTCodeID` | char(36) | NN, **PK** | GUID |
| `CPT_CODE` | varchar(9) | NULL | 5-digit CPT code |
| `SHORT_DESCRIPTION` | varchar(500) | NULL | |
| `LONG_DESCRIPTION` | varchar(500) | NULL | |
| `FULL_DESCRIPTION` | varchar(500) | NULL | |
| `SGroup` | varchar(50) | NULL | Specialty grouping |
| `SpecialtyID` | char(36) | NULL, **FK** → specialities | |

#### `hcpcs`
Healthcare Common Procedure Coding System (Level II, US billing).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCPCID` | char(36) | NN, **PK** | GUID |
| `HCPCCode` | varchar(10) | NN | E.g., A0021 |
| `HCPCShortDescription` | varchar(500) | NN | |
| `HCPCLongDescription` | varchar(500) | NN | |

#### `icd10-cm2012`
ICD-10 Clinical Modification codes (2012 vintage; ~65k rows).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ICD10ID` | bigint(20) | NN, **PK**, AI | Surrogate key |
| `Code` | varchar(10) | NN | E.g., E11.9 |
| `ShortDesc` | varchar(500) | NULL | |
| `LongDesc` | longtext | NULL | |
| `Type` | int(11) | NN | 1 = Header, 2 = Billable |

#### `denverscreeningtestitems`
Items for the Denver Developmental Screening Test.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `ItemID` | char(36) | NN, **PK** | GUID |
| `ItemName` | varchar(250) | NN | Milestone (e.g., "Sits without support") |
| `ItemCategory` | int(11) | NN | 1=Personal-Social, 2=Fine Motor, 3=Language, 4=Gross Motor |
| `V25` | double | NN | Age (months) at 25th percentile |
| `V50` | double | NN | 50th percentile age |
| `V75` | double | NN | 75th percentile age |
| `V90` | double | NN | 90th percentile age |
| `ItemType` | varchar(50) | NULL | Display type |
| `ValueOrder` | int(11) | NN | Sort order |

#### `agebmipercentiles` / `ageheightpercentiles` / `ageweightpercentiles` / `agehcpercentiles`
Growth chart percentile data (CDC/WHO). All four tables share identical structure.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Age{Metric}PercentileID` | char(36) | NN, **PK** | GUID (one per table) |
| `AgeInMonths` | double | NN | Age at this data point |
| `Gender` | int(11) | NN | 1=Male, 2=Female |
| `ThirdPercentile` | double | NN | 3rd %ile value |
| `FifthPercentile` | double | NN | 5th |
| `TenthPercentile` | double | NN | 10th |
| `TwentyFifthPercentile` | double | NN | 25th |
| `FifteethPercentile` | double | NN | 50th (typo: "Fiftieth") |
| `SeventyFifthPercentile` | double | NN | 75th |
| `NineteethPercentile` | double | NN | 90th (typo: "Ninetieth") |
| `NintyFifthPercentile` | double | NN | 95th |
| `NintySeventhPercentile` | double | NN | 97th |


---

