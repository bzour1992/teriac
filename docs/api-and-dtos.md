## 10. REST API Specification

### 10.1 Conventions

- Base URL: `https://api.teriac.example.com/v1`
- Auth: `Authorization: Bearer <JWT>` (JWT carries `hcenter_id`, `user_id`, `permissions[]`)
- Content-Type: `application/json; charset=utf-8`
- Pagination: `?page=1&pageSize=20` → response `{ data: [...], total, page, pageSize }`
- Errors: RFC 7807 Problem Details (`{ type, title, status, detail, errors }`)
- Timestamps: ISO 8601 UTC (`2026-05-18T09:30:00Z`)

### 10.2 Endpoint Catalog

```
═══════════════ AUTH ═══════════════
POST   /auth/login                       → { token, refreshToken, user, hcenter }
POST   /auth/refresh                     → { token, refreshToken }
POST   /auth/logout
GET    /auth/me                          → current user + permissions

═══════════════ PATIENTS ═══════════════
GET    /patients?q=&page=&pageSize=      → list (filtered by HCenterID)
POST   /patients
GET    /patients/{id}
PUT    /patients/{id}
DELETE /patients/{id}                    → soft delete

GET    /patients/{id}/arabic-info
PUT    /patients/{id}/arabic-info
GET    /patients/{id}/additional-info
PUT    /patients/{id}/additional-info
GET    /patients/{id}/substance-use      → patientsaddetails
PUT    /patients/{id}/substance-use
GET    /patients/{id}/insurance          → list
POST   /patients/{id}/insurance
PUT    /patients/{id}/insurance/{insId}
GET    /patients/{id}/notes              → patientspecialnotes
POST   /patients/{id}/notes

═══════════════ MEDICAL HISTORY ═══════════════
GET    /patients/{id}/allergies
POST   /patients/{id}/allergies
GET    /patients/{id}/chronic-diseases
POST   /patients/{id}/chronic-diseases
GET    /patients/{id}/long-term-medications
POST   /patients/{id}/long-term-medications
GET    /patients/{id}/problems
POST   /patients/{id}/problems
GET    /patients/{id}/family-history
POST   /patients/{id}/family-history
GET    /patients/{id}/immunizations
POST   /patients/{id}/immunizations
GET    /patients/{id}/lab-requests
POST   /patients/{id}/lab-requests

═══════════════ PEDIATRIC ═══════════════
GET    /patients/{id}/antenatal-history
PUT    /patients/{id}/antenatal-history
GET    /patients/{id}/natal-history
PUT    /patients/{id}/natal-history
GET    /patients/{id}/neonatal-history
PUT    /patients/{id}/neonatal-history
GET    /patients/{id}/growth-development
PUT    /patients/{id}/growth-development
GET    /patients/{id}/dental/primary
PUT    /patients/{id}/dental/primary
GET    /patients/{id}/dental/permanent
PUT    /patients/{id}/dental/permanent
GET    /patients/{id}/denver-screening
POST   /patients/{id}/denver-screening
GET    /patients/{id}/growth-chart?type=bmi|height|weight|hc  → chart data

═══════════════ OB/GYN ═══════════════
GET    /patients/{id}/female-history
PUT    /patients/{id}/female-history
GET    /patients/{id}/male-history
PUT    /patients/{id}/male-history
GET    /patients/{id}/previous-pregnancies
POST   /patients/{id}/previous-pregnancies

═══════════════ VISITS ═══════════════
GET    /patients/{id}/visits?from=&to=
POST   /visits
GET    /visits/{id}
PUT    /visits/{id}
DELETE /visits/{id}                      → soft delete

GET    /visits/{id}/diagnoses            → pvassessmentconditions
POST   /visits/{id}/diagnoses
PUT    /visits/{id}/diagnoses/{dxId}
DELETE /visits/{id}/diagnoses/{dxId}

GET    /visits/{id}/prescriptions        → pvplanmedications
POST   /visits/{id}/prescriptions
PUT    /visits/{id}/prescriptions/{rxId}
DELETE /visits/{id}/prescriptions/{rxId}

GET    /visits/{id}/glasses-prescription → pvgprescription
PUT    /visits/{id}/glasses-prescription

GET    /visits/{id}/recommendations
POST   /visits/{id}/recommendations
PUT    /visits/{id}/recommendations/{recId}/process

GET    /visits/{id}/revisits
POST   /visits/{id}/revisits

GET    /visits/{id}/body-system-review
POST   /visits/{id}/body-system-review
GET    /visits/{id}/physical-exam
POST   /visits/{id}/physical-exam

GET    /visits/{id}/tests
POST   /visits/{id}/tests
GET    /visits/{id}/echocardiogram
POST   /visits/{id}/echocardiogram
GET    /visits/{id}/procedures
POST   /visits/{id}/procedures

═══════════════ SPECIALTY VISIT RECORDS ═══════════════
GET    /visits/{id}/pregnancy-details
PUT    /visits/{id}/pregnancy-details
GET    /visits/{id}/risk-stratification
PUT    /visits/{id}/risk-stratification
GET    /visits/{id}/initial-exam
PUT    /visits/{id}/initial-exam
GET    /visits/{id}/prenatal-flowsheet
POST   /visits/{id}/prenatal-flowsheet
GET    /visits/{id}/fertility
PUT    /visits/{id}/fertility
GET    /visits/{id}/fertility-flowsheet
POST   /visits/{id}/fertility-flowsheet
GET    /visits/{id}/pasi-score
PUT    /visits/{id}/pasi-score
GET    /visits/{id}/nutrition
PUT    /visits/{id}/nutrition

═══════════════ SCHEDULING ═══════════════
GET    /schedule?from=&to=&doctorId=&status=
POST   /schedule
GET    /schedule/{id}
PUT    /schedule/{id}
PUT    /schedule/{id}/status             → { status: "Confirmed" | "Arrived" | ... }
DELETE /schedule/{id}

═══════════════ CODING (typeahead) ═══════════════
GET    /coding/icd10?q=&limit=20         → fast search
GET    /coding/cpt?q=&specialtyId=
GET    /coding/hcpcs?q=
GET    /coding/medicines?q=
GET    /coding/medical-conditions?q=
GET    /coding/symptoms?q=
GET    /coding/diagnostic-tests?q=

═══════════════ BILLING ═══════════════
GET    /patients/{id}/billing-records
POST   /patients/{id}/billing-records
GET    /patients/{id}/invoices
POST   /invoices                          → generate from billing records
GET    /invoices/{id}
PUT    /invoices/{id}
GET    /invoices/{id}/pdf                 → PDF stream

═══════════════ FINANCE ═══════════════
GET    /finance/transactions?from=&to=&walletId=&type=
POST   /finance/transactions
GET    /finance/transactions/{id}
PUT    /finance/transactions/{id}

GET    /finance/wallets
POST   /finance/wallets
GET    /finance/wallets/{id}/balance
POST   /finance/wallets/transfer          → { from, to, amount, notes }

GET    /finance/categories
POST   /finance/categories

GET    /finance/reports/pnl?from=&to=    → P&L report
GET    /finance/reports/daily?date=
GET    /finance/reports/by-doctor?from=&to=

═══════════════ ADMIN ═══════════════
GET    /admin/hcenter                    → current center
PUT    /admin/hcenter
GET    /admin/settings
PUT    /admin/settings
GET    /admin/specialties
POST   /admin/specialties
GET    /admin/users
POST   /admin/users
PUT    /admin/users/{id}
GET    /admin/users/{id}/permissions
PUT    /admin/users/{id}/permissions
GET    /admin/permissions

═══════════════ REPORTS ═══════════════
GET    /reports/patient-summary/{patientId}?lang=en|ar
GET    /reports/visit/{visitId}?lang=en|ar
GET    /reports/prescription/{visitId}?lang=en|ar
GET    /reports/invoice/{invoiceId}?lang=en|ar
GET    /reports/growth-chart/{patientId}?type=bmi&lang=en|ar
```

### 10.3 Sample Request/Response

**Create a visit:**
```json
POST /visits
{
  "patientId": "9c4f...e2a1",
  "doctorId": "abc1...3def",
  "visitDate": "2026-05-18T10:00:00Z",
  "visitType": 1,
  "chiefComplaint": "Persistent cough for 2 weeks",
  "historyOfPresentIllness": "...",
  "pastMedicalHistory": "Hypertension since 2018",
  "painLevel": 3
}

201 Created
{
  "patientVisitId": "f1e2...8d4c",
  "patientId": "9c4f...e2a1",
  "doctorId": "abc1...3def",
  "visitDate": "2026-05-18T10:00:00Z",
  "outcome": 0,
  "intensity": 0,
  "links": {
    "diagnoses": "/visits/f1e2.../diagnoses",
    "prescriptions": "/visits/f1e2.../prescriptions"
  }
}
```

---

## 11. Domain Models / DTOs

### 11.1 C# Entities (EF Core)

```csharp
// Domain/Patients/Patient.cs
public class Patient
{
    public Guid PatientID { get; set; }
    public string NationalID { get; set; } = null!;
    public string? FirstName { get; set; }
    public string? SecondName { get; set; }
    public string? ThirdName { get; set; }
    public string? LastName { get; set; }
    public Sex Sex { get; set; }
    public DateTime DateOfBirth { get; set; }
    public double? Height { get; set; }
    public double? Weight { get; set; }
    public string? MobileNumber { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? PhotoFilename { get; set; }
    public bool IsDeleted { get; set; }

    // Tenant
    public Guid HCenterID { get; set; }
    public HCenter HCenter { get; set; } = null!;

    // Optional FKs
    public Guid? Nationality { get; set; }     // → Country
    public Guid? HumanRaceID { get; set; }
    public Guid? MaritalStatusID { get; set; }

    // Pediatric
    public SchoolPerformance SchoolPerformance { get; set; }
    public string? FatherEducation { get; set; }
    public string? MotherEducation { get; set; }
    public int? ChildOrder { get; set; }
    public int? ChildrenCount { get; set; }

    // Navigation
    public PatientArabicInfo? ArabicInfo { get; set; }
    public PatientAdditionalInfo? AdditionalInfo { get; set; }
    public ICollection<Allergy> Allergies { get; set; } = new List<Allergy>();
    public ICollection<ChronicDisease> ChronicDiseases { get; set; } = new List<ChronicDisease>();
    public ICollection<PatientVisit> Visits { get; set; } = new List<PatientVisit>();
    public ICollection<PatientInvoice> Invoices { get; set; } = new List<PatientInvoice>();
}

public enum Sex { Unknown = 0, Male = 1, Female = 2 }

public enum SchoolPerformance { NA = 0, Poor = 1, Average = 2, Good = 3, Excellent = 4 }

// Domain/Visits/PatientVisit.cs
public class PatientVisit
{
    public Guid PatientVisitID { get; set; }
    public Guid PatientID { get; set; }
    public Patient Patient { get; set; } = null!;
    public Guid Doctor { get; set; }
    public HCenterUser DoctorUser { get; set; } = null!;
    public Guid? SchedulingOfficer { get; set; }
    public DateTime VisitDate { get; set; }
    public string? Notes { get; set; }
    public string? Recommendations { get; set; }
    public VisitOutcome Outcome { get; set; }
    public Intensity Intensity { get; set; }   // mapped from "Intesity"
    public string? ChiefComplaint { get; set; }
    public string? HistoryOfPresentIllness { get; set; }
    public string? PastMedicalHistory { get; set; }
    public string? Disposition { get; set; }
    public string? SourceOfReferral { get; set; }  // mapped from "Refferral"
    public Guid? ParentVisitID { get; set; }
    public PatientVisit? ParentVisit { get; set; }
    public bool IsHospitalCase { get; set; }
    public string? HospitalName { get; set; }
    public VisitType VisitType { get; set; }
    public int PainLevel { get; set; }
    public bool IsDeleted { get; set; }

    public ICollection<PVAssessmentCondition> Diagnoses { get; set; } = new List<PVAssessmentCondition>();
    public ICollection<PVPlanMedication> Prescriptions { get; set; } = new List<PVPlanMedication>();
    public ICollection<PVRevisit> Revisits { get; set; } = new List<PVRevisit>();
}

public enum VisitOutcome { Open = 0, Resolved = 1, Referred = 2, Failed = 3, Cancelled = 4, NoShow = 5 }
public enum Intensity   { NA = 0, Low = 1, Moderate = 2, High = 3 }
public enum VisitType   { New = 1, FollowUp = 2, Emergency = 3, Routine = 4, WalkIn = 5 }
```

### 11.2 EF Core Configuration (Snake-typo aliasing)

```csharp
// Infrastructure/Configurations/PatientVisitConfiguration.cs
public class PatientVisitConfiguration : IEntityTypeConfiguration<PatientVisit>
{
    public void Configure(EntityTypeBuilder<PatientVisit> b)
    {
        b.ToTable("patientvisits");
        b.HasKey(x => x.PatientVisitID);

        // Map typo'd column name to clean property
        b.Property(x => x.Intensity).HasColumnName("Intesity");
        b.Property(x => x.SourceOfReferral).HasColumnName("SourceOfRefferral");

        b.Property(x => x.Outcome).HasConversion<int>();
        b.Property(x => x.Intensity).HasConversion<int>();
        b.Property(x => x.VisitType).HasConversion<int>();

        b.HasOne(x => x.Patient).WithMany(p => p.Visits).HasForeignKey(x => x.PatientID);
        b.HasOne(x => x.DoctorUser).WithMany().HasForeignKey(x => x.Doctor);

        // Global query filter: exclude soft-deleted + enforce tenant
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}
```

### 11.3 TypeScript DTOs (Frontend)

```typescript
// src/types/patient.ts
export interface Patient {
  patientId: string;
  nationalId: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  sex: Sex;
  dateOfBirth: string;     // ISO
  height?: number;
  weight?: number;
  mobileNumber?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  isDeleted: boolean;
  hcenterId: string;
  nationality?: string;
  humanRaceId?: string;
  maritalStatusId?: string;
  schoolPerformance: SchoolPerformance;
  fatherEducation?: string;
  fatherOccupation?: string;
  motherEducation?: string;
  motherOccupation?: string;
  childOrder?: number;
  childrenCount?: number;
  dateAdded?: string;
  passportNumber?: string;
}

export enum Sex { Unknown = 0, Male = 1, Female = 2 }
export enum SchoolPerformance { NA = 0, Poor = 1, Average = 2, Good = 3, Excellent = 4 }

// src/types/visit.ts
export interface PatientVisit {
  patientVisitId: string;
  patientId: string;
  doctorId: string;
  schedulingOfficerId?: string;
  visitDate: string;
  notes?: string;
  recommendations?: string;
  outcome: VisitOutcome;
  intensity: Intensity;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  disposition?: string;
  sourceOfReferral?: string;
  parentVisitId?: string;
  isHospitalCase: boolean;
  hospitalName?: string;
  visitType: VisitType;
  painLevel: number;
  isDeleted: boolean;
}

export enum VisitOutcome { Open = 0, Resolved = 1, Referred = 2, Failed = 3, Cancelled = 4, NoShow = 5 }
export enum Intensity { NA = 0, Low = 1, Moderate = 2, High = 3 }
export enum VisitType { New = 1, FollowUp = 2, Emergency = 3, Routine = 4, WalkIn = 5 }

// src/types/billing.ts
export interface PatientInvoice {
  patientInvoiceId: string;
  patientId: string;
  hcenterId: string;
  invoiceNumber: string;
  invoiceDate: string;
  paidByPatient: number;
  oldBalance: number;
  finalBalance: number;
  coveredByHealthInsurance?: number;
  coveredByHospital?: number;
  discount: number;
  patientInsuranceDetailId?: string;
}

export interface FinancialTransaction {
  hcenterFinancalTransactionId: string;
  hcenterId: string;
  details: string;
  amount: number;
  originalAmount?: number;
  discount: number;
  transactionType: TransactionType;
  notes?: string;
  addDate: string;
  addUserId: string;
  walletId?: string;
  sourceWallet?: string;
  patientId?: string;
  patientInvoiceId?: string;
  transactionCategoryId?: string;
}

export enum TransactionType {
  Income = 1, Expense = 2, Refund = 3, Transfer = 4, Salary = 5, Adjustment = 6
}
```

### 11.4 Tenant Middleware Pattern

```csharp
// Api/Middleware/TenantResolverMiddleware.cs
public class TenantResolverMiddleware
{
    private readonly RequestDelegate _next;
    public TenantResolverMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, ITenantContext tenant)
    {
        var hcenterClaim = ctx.User.FindFirst("hcenter_id")?.Value;
        if (Guid.TryParse(hcenterClaim, out var hcenterId))
        {
            tenant.SetTenant(hcenterId);
        }
        await _next(ctx);
    }
}

// EF DbContext applies tenant filter globally
protected override void OnModelCreating(ModelBuilder b)
{
    b.Entity<Patient>().HasQueryFilter(p => p.HCenterID == _tenant.Id && !p.IsDeleted);
    b.Entity<PatientVisit>().HasQueryFilter(v => v.Patient.HCenterID == _tenant.Id && !v.IsDeleted);
    b.Entity<PatientInvoice>().HasQueryFilter(i => i.HCenterID == _tenant.Id);
    b.Entity<HCenterFinancalTransaction>().HasQueryFilter(t => t.HCenterID == _tenant.Id);
}
```


---

