# Schema — Tenant (HCenter) and users

> Part of the Teriac schema reference (originally §6 in the master doc). Sibling files:
> `schema-reference.md`, `schema-tenant-users.md`, `schema-patient.md`,
> `schema-pediatric-obgyn.md`, `schema-visits.md`, `schema-billing.md`.
>
> **This file covers:** the Healthcare Center tenant root and its 1:1 / 1:N children (page, system settings, specialities, schedule items), plus user accounts, permissions, and per-user fav CPT codes
>
> **Legend** — **PK** = Primary Key · **FK** → = Foreign Key (inferred) · **NN** = NOT NULL · **AI** = AUTO_INCREMENT.
> All domain tables also have trailing `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext` — omitted from per-column tables.

### 6.4 Healthcare Center (Tenant)

#### `hcenters`
The tenant root. Every patient, user, and financial record is scoped to one healthcare center.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterID` | char(36) | NN, **PK** | GUID |
| `HCenterName` | varchar(500) | NN | Center's display name |
| `HCenterNameRep` | varchar(500) | NULL | Name used in reports (often Arabic) |
| `IsOneDoctor` | tinyint(1) | NN | Single-doctor practice flag |
| `Email` | varchar(250) | NULL | |
| `Phone` | varchar(250) | NULL | |
| `IsActive` | tinyint(1) | NN | Soft inactive flag |
| `SubscriptionType` | int(11) | NN | Enum (trial/basic/premium/etc.) |
| `CityID` | char(36) | NULL, **FK** → cities | |
| `CountryID` | char(36) | NN, **FK** → countries | |
| `ReportsLogo` | varchar(255) | NULL | Logo filename for printed reports |
| `ReportsWorkingTimes` | varchar(500) | NULL | Hours of operation (free text) |
| `ReportAddress` | varchar(500) | NULL | Address line for reports |
| `SupportStartDate` | datetime(3) | NN | When subscription began |
| `LastRenewalDate` | datetime(3) | NULL | |
| `HCenterInitials` | varchar(2) | NULL | E.g., "AH" for Al-Hayat |
| `eClaimLinkID` | varchar(25) | NULL | UAE eClaim Link facility ID |
| `ClinicManager` | varchar(400) | NULL | Manager's name |
| `ClinicManagerEmail` | varchar(400) | NULL | |
| `ClinicManagerMob` | varchar(50) | NULL | Mobile |
| `ClinicManagerOfficePhone` | varchar(50) | NULL | |

#### `hcenterpage`
Public-facing landing page configuration (one per center).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterID` | char(36) | NN, **PK**, **FK** → hcenters | Shared PK |
| `FriendlyUrl` | varchar(50) | NN | URL slug |
| `HCenterDisplayNameEn` | varchar(250) | NN | English display name |
| `HCenterDisplayNameOther` | varchar(250) | NULL | Arabic / other |
| `Description` | longtext | NULL | About text |
| `HomePagePhotoUrl` | varchar(250) | NULL | Hero image |
| `Address` | longtext | NULL | |
| `FeedbackEmail` | varchar(250) | NULL | |
| `HomePageCoverPhotoUrl` | varchar(250) | NULL | Cover photo |

#### `hcentersystemsettings`
Per-tenant configuration flags (one per center).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterID` | char(36) | NN, **PK** | Shared PK |
| `IsHeightWeightRequired` | tinyint(1) | NN | Required at patient registration |
| `IsPatientAddressRequired` | int(11) | NN | (0/1/2 for none/optional/required) |
| `IsOrganizationOccupationRequired` | tinyint(1) | NN | |
| `IsGeneralAppearanceRequired` | int(11) | NN | |
| `IsHumanRaceRequired` | tinyint(1) | NN | |
| `IsMaritalStatusRequired` | tinyint(1) | NN | |
| `IsPatientEnglishNameRequired` | tinyint(1) | NN | |
| `IsPatientArabicNameRequired` | tinyint(1) | NN | |
| `IsPatientChecklistRequired` | tinyint(1) | NN | |
| `IsPatientFamilyHistoryRequired` | int(11) | NN | |
| `IsSystemsReviewRequired` | tinyint(1) | NN | |
| `IsSystemsPhysicalExamRequired` | tinyint(1) | NN | |
| `AreRoutinesPatternsRequired` | int(11) | NN | |
| `AreHereditaryDiseasesRequired` | tinyint(1) | NN | |
| `AreAllergiesRequired` | tinyint(1) | NN | |
| `AreChronicDiseasesRequired` | tinyint(1) | NN | |
| `DefaultPayment` | int(11) | NN | Default payment method enum |
| `PreferredCurrency` | varchar(50) | NULL | E.g., "JOD", "USD", "AED" |
| `CanDoctorsEditPatientDemographicInformation` | tinyint(1) | NN | |
| `OnlyVisitDoctorCanEditVisitRecords` | tinyint(1) | NN | |
| `PreventEditingPatientVisitWhenStatusIsResolvedOrFailed` | tinyint(1) | NN | |
| `OnlyCenterAdminIsAllowedToDeleteAttachments` | tinyint(1) | NN | |
| `NumberOfOperationRooms` | int(11) | NN | OR count for scheduling |
| `UseAdminInsuranceCompanies` | tinyint(1) | NN | Use master insurance list vs. own |
| `IsLockedData` | tinyint(1) | NN | Read-only mode |

#### `hcenterspecialities`
Specialties offered by an HCenter (M:N hcenters ↔ specialities).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterSpecialityID` | char(36) | NN, **PK** | GUID |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `SpecialityID` | char(36) | NN, **FK** → specialities | |
| `DefaultPayment` | double | NULL | Default consult fee for this specialty |
| `ShowOnProfile` | tinyint(1) | NN | Public-facing flag |

#### `hcenterscheduleitems`
The **appointment calendar** for all centers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterScheduleItemID` | char(36) | NN, **PK** | GUID |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `Name` | longtext | NULL | Appointment label / patient name |
| `ContactPhone` | varchar(50) | NULL | |
| `ContactEmail` | varchar(250) | NULL | |
| `ScheduledInDate` | datetime(3) | NN | Start time |
| `ScheduledToDate` | datetime(3) | NN | End time |
| `Doctor` | char(36) | NULL, **FK** → hcenterusers | Doctor handling the appointment |
| `Notes` | longtext | NULL | |
| `IsVerified` | tinyint(1) | NN | Confirmation flag |
| `IsDone` | tinyint(1) | NN | Completed flag |
| `AddSchedulingOfficer` | char(36) | NN, **FK** → hcenterusers | Who created it |
| `AddedDate` | datetime(3) | NN | |
| `UpdatedDate` | datetime(3) | NULL | |
| `UpdateSchedulingOfficer` | char(36) | NULL, **FK** → hcenterusers | |
| `LabelID` | int(11) | NN | Color label enum |
| `StatusID` | int(11) | NN | Workflow state enum |
| `PatientID` | char(36) | NULL, **FK** → patients | Optional patient link |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | Visit created from this appointment |
| `PVRevisitID` | char(36) | NULL, **FK** → pvrevisits | If this is a revisit |
| `Location` | varchar(250) | NULL | Room or location |
| `ByDoctor` | tinyint(1) | NN | Whether doctor scheduled it directly |
| `IsSurgery` | tinyint(1) | NN | Surgery vs. clinic appointment |
| `NotForPatient` | tinyint(1) | NN | Internal blocker (lunch, meeting) |
| `ProcedureHistoryID` | char(36) | NULL, **FK** → procedurehistory | |
| `PVPlanProceduresCPTID` | char(36) | NULL | Planned procedure CPT reference |

---

### 6.5 User Management & Permissions

#### `hcenterusers`
All staff accounts (doctors, nurses, receptionists, admins).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserId` | char(36) | NN, **PK** | GUID |
| `UserName` | varchar(256) | NULL | Login name |
| `ConfirmationCode` | varchar(50) | NULL | Email confirmation code |
| `UserType` | int(11) | NN | Enum (doctor/nurse/etc.) |
| `IsAdmin` | tinyint(1) | NN | Tenant admin flag |
| `FirstName` | varchar(50) | NN | |
| `SecondName` | varchar(50) | NULL | |
| `ThirdName` | varchar(50) | NULL | |
| `LastName` | varchar(50) | NULL | |
| `Position` | varchar(50) | NULL | Job title |
| `Description` | longtext | NULL | Bio |
| `PhotoFilename` | varchar(250) | NULL | Avatar file |
| `DefaultPayment` | double | NULL | Default consult fee |
| `SchedulingOfficer` | char(36) | NULL, **FK** → hcenterusers | Assigned scheduler |
| `IsPublic` | tinyint(1) | NN | Show on public profile |
| `IsActive` | tinyint(1) | NN | Account active |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `HCenterSpecialityID` | char(36) | NULL, **FK** → hcenterspecialities | Primary specialty |
| `ReportUsername` | varchar(50) | NULL | Display name on reports (English) |
| `ReportSpeciality` | varchar(250) | NULL | Specialty on reports |
| `ReportOther1` | varchar(250) | NULL | Free line on reports (e.g., credentials) |
| `ReportOthers2` | varchar(250) | NULL | Second free line |
| `ReportUsernameAr` | varchar(50) | NULL | Same fields, Arabic |
| `ReportSpecialityAr` | varchar(250) | NULL | |
| `ReportOther1Ar` | varchar(250) | NULL | |
| `ReportOthers2Ar` | varchar(250) | NULL | |
| `eClaimLinkID` | varchar(25) | NULL | UAE eClaim Link clinician ID |
| `eCliamProfessionalName` | varchar(250) | NULL | (typo: "Cliam") |
| `IsFinancialAdmin` | tinyint(1) | NN | Can access financial module |
| `IsOptometrist` | tinyint(1) | NN | Special role flag |
| `IsOperationsRoomAppointmentsManager` | tinyint(1) | NN | OR scheduling admin |

> **⚠ No password column.** add field for password

#### `permissions`
Master permission list (not auto-increment despite bigint).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PermissionID` | bigint(20) | NN, **PK** | Permission ID |
| `PermissionName` | varchar(150) | NN | E.g., "Patients.Create" |
| `PermissionType` | int(11) | NN | Enum (module/feature/etc.) |

#### `hcuserspermissions`
M:N junction between users and permissions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserID` | char(36) | NN, **PK**, **FK** → hcenterusers | |
| `PermissionID` | bigint(20) | NN, **PK**, **FK** → permissions | |

#### `hcupvqsections`
Per-user toggle for which sections appear in the patient-visit questionnaire UI.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserId` | char(36) | NN, **PK**, **FK** → hcenterusers | |
| `VitalSigns` | tinyint(1) | NN | Show vital signs section |
| `StandardMeasurements` | tinyint(1) | NN | |
| `Immunization` | tinyint(1) | NN | |
| `HabitDetails` | tinyint(1) | NN | |
| `FDHistory` | tinyint(1) | NN | Family/dietary history |
| `PatientMedications` | tinyint(1) | NN | |
| `HistoryOfIllness` | tinyint(1) | NN | |
| `Allergies` | tinyint(1) | NN | |
| `GeneralAppearance` | tinyint(1) | NN | |
| `GeneralReview` | tinyint(1) | NN | |
| `PhysicalExamination` | tinyint(1) | NN | |
| `Diagnostics` | tinyint(1) | NN | |
| `ProceduresPlan` | tinyint(1) | NN | |
| `VisitAttachments` | tinyint(1) | NN | |
| `DefaultBodySystem` | varchar(250) | NULL | Default body system to focus on |
| `ChronicDiseases` | tinyint(1) | NN | |
| `ProceduresHistory` | tinyint(1) | NN | |
| `SystemReviews` | tinyint(1) | NN | |

#### `hcenteruserfavcptcodes`
User's favorite CPT codes for quick selection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterUserFavCPTCodeID` | char(36) | NN, **PK** | |
| `CPTCodeID` | char(36) | NN, **FK** → cptcodes | |
| `HCenterUserID` | char(36) | NN, **FK** → hcenterusers | |


---

