# Schema — Billing, invoicing & finance

> Part of the Teriac schema reference (originally §6 in the master doc). Sibling files:
> `schema-reference.md`, `schema-tenant-users.md`, `schema-patient.md`,
> `schema-pediatric-obgyn.md`, `schema-visits.md`, `schema-billing.md`.
>
> **This file covers:** patient billing records, invoices, transaction categories, wallets (cash boxes), and the polymorphic hcenterfinancaltransactions ledger
>
> **Legend** — **PK** = Primary Key · **FK** → = Foreign Key (inferred) · **NN** = NOT NULL · **AI** = AUTO_INCREMENT.
> All domain tables also have trailing `__sysChangeTxBsn`, `__sysInsertTxBsn`, `__sysTrackingContext` — omitted from per-column tables.

### 6.14 Billing, Invoicing & Finance

#### `patientbillingrecords`
Billable charges (1:N per patient/visit).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientBillingRecordID` | char(36) | NN, **PK** | |
| `PatientVisitID` | char(36) | NULL, **FK** → patientvisits | |
| `TransactionCategoryID` | char(36) | NN, **FK** → transactioncategories | What was charged |
| `RecordDate` | datetime(3) | NN | |
| `Details` | varchar(500) | NN | Charge description |
| `Expense` | double | NN | Amount |
| `DoctorID` | char(36) | NULL, **FK** → hcenterusers | Treating doctor |
| `UserID` | char(36) | NN, **FK** → hcenterusers | Who created the record |
| `IsLocked` | tinyint(1) | NN | Locked (already invoiced/paid) |
| `IFNumber` | varchar(100) | NULL | Insurance form/claim reference |

#### `patientinvoices`
Aggregated invoices (1:N per patient).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `PatientInvoiceID` | char(36) | NN, **PK** | |
| `PatientID` | char(36) | NN, **FK** → patients | |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `AddedByUserID` | char(36) | NN, **FK** → hcenterusers | |
| `InvoiceNumber` | varchar(50) | NN | Invoice number (likely sequential per tenant) |
| `InvoiceDate` | datetime(3) | NN | |
| `CreationDate` | datetime(3) | NN | When entered |
| `PaidByPatient` | double | NN | Cash from patient |
| `OldBalance` | double | NN | Carried-over balance |
| `FinalBalance` | double | NN | Outstanding after payment |
| `CoveredByHealthInsurance` | double | NULL | Insurance portion |
| `CoveredByHospital` | double | NULL | Hospital absorption |
| `Discount` | double | NN | Discount applied |
| `PatientInsuranceDetailID` | char(36) | NULL, **FK** → patientinsurancedetails | Which insurance |
| `HospitalName` | varchar(250) | NULL | If hospital case |
| `Migrated` | tinyint(1) | NN | Imported from old system flag |

#### `transactioncategories`
Catalog of revenue/expense categories (per HCenter).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `TransactionCategoryID` | char(36) | NN, **PK** | |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `TransactionCategoryName` | varchar(250) | NN | |
| `IsIncome` | tinyint(1) | NN | True = income, false = expense |
| `IsCheckup` | tinyint(1) | NN | Marks "consult" categories |
| `DefaultPrice` | double | NN | |
| `Price2` | double | NULL | Second price tier (e.g., insurance) |
| `Price3` | double | NULL | Third tier |
| `IsSystem` | tinyint(1) | NN | Built-in (uneditable) |
| `MedicalProcedureID` | char(36) | NULL, **FK** → medicalprocedures | Links to procedure |
| `DiagnosticTestID` | char(36) | NULL, **FK** → diagnostictests | Or to a test |
| `CPTCodeID` | char(36) | NULL, **FK** → cptcodes | Or CPT |
| `HCPCID` | char(36) | NULL, **FK** → hcpcs | Or HCPCS |

#### `wallets`
Cash boxes / financial accounts per HCenter.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `WalletID` | char(36) | NN, **PK** | |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `WalletName` | varchar(250) | NN | E.g., "Main Cash", "Bank A" |
| `IsDefault` | tinyint(1) | NN | Default wallet |
| `IsSystem` | tinyint(1) | NN | System-created |
| `IsCacheBox` | tinyint(1) | NN | (typo: "Cash") — physical cash box |

#### `hcenterfinancaltransactions`
**Polymorphic financial ledger** — every income, expense, refund, transfer, salary lives here.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `HCenterFinancalTransactionID` | char(36) | NN, **PK** | |
| `HCenterID` | char(36) | NN, **FK** → hcenters | |
| `Details` | varchar(500) | NN | Transaction description |
| `Amount` | double | NN | Amount (with sign per TransactionType) |
| `OriginalAmount` | double | NULL | Before discount/adjustment |
| `Discount` | double | NN | |
| `TransactionType` | int(11) | NN | Income/Expense/Transfer/Refund/Salary |
| `Notes` | longtext | NULL | |
| `AddDate` | datetime(3) | NN | Posted date |
| `AddUserID` | char(36) | NN, **FK** → hcenterusers | Who posted |
| `UpdateDate` | datetime(3) | NULL | |
| `UpdateUserID` | char(36) | NULL, **FK** → hcenterusers | |
| `CreationDate` | datetime(3) | NULL | |
| `OwnerUserID` | char(36) | NULL, **FK** → hcenterusers | Owner doctor (for revenue split) |
| `IFNumber` | varchar(100) | NULL | Reference number |
| **Polymorphic source links:** | | | |
| `PatientBillingRecordID` | char(36) | NULL, **FK** | If from a billing record |
| `PatientInvoiceID` | char(36) | NULL, **FK** | If invoice payment |
| `PatientInsuranceDetailID` | char(36) | NULL, **FK** | If insurance payment |
| `PatientID` | char(36) | NULL, **FK** | Patient reference |
| `TransactionCategoryID` | char(36) | NULL, **FK** | Category |
| **Wallet movement:** | | | |
| `WalletID` | char(36) | NULL, **FK** → wallets | Destination wallet |
| `SourceWallet` | char(36) | NULL, **FK** → wallets | For transfers |
| **Payroll:** | | | |
| `EmployeeName` | varchar(250) | NULL | Free text |
| `EmployeeNumber` | varchar(50) | NULL | |
| `EmployeeUserID` | char(36) | NULL, **FK** → hcenterusers | |
| `HCenterEmployeeID` | char(36) | NULL | External employee ID |
| **Inventory:** | | | |
| `InventoryItemID` | char(36) | NULL | If inventory purchase/sale |


---

