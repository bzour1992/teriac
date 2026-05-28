// Enum constants for the Teriac domain.
//
// Per CLAUDE.md hard rule #4 — no magic numbers — every integer-coded field in
// the legacy schema MUST be read/written through one of these constants. The
// schema has no CHECK constraints; these values are derived from CLAUDE.md and
// some still need legacy-app verification (see docs/roadmap-and-open-questions.md §16).
//
// Marked `@unverified` items should be confirmed before they ship into prod.

export const Sex = {
  Unknown: 0,
  Male: 1,
  Female: 2,
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const SchoolPerformance = {
  NA: 0,
  Poor: 1,
  Average: 2,
  Good: 3,
  Excellent: 4,
} as const;
export type SchoolPerformance = (typeof SchoolPerformance)[keyof typeof SchoolPerformance];

export const PatientCreationMethod = {
  Manual: 1,
  Imported: 2,
  OnlineRegistration: 3,
  Migration: 4,
} as const;
export type PatientCreationMethod =
  (typeof PatientCreationMethod)[keyof typeof PatientCreationMethod];

export const VisitOutcome = {
  Open: 0,
  Resolved: 1,
  Referred: 2,
  Failed: 3,
  Cancelled: 4,
  NoShow: 5,
} as const;
export type VisitOutcome = (typeof VisitOutcome)[keyof typeof VisitOutcome];

export const Intensity = {
  NA: 0,
  Low: 1,
  Moderate: 2,
  High: 3,
} as const;
export type Intensity = (typeof Intensity)[keyof typeof Intensity];

export const VisitType = {
  New: 1,
  FollowUp: 2,
  Emergency: 3,
  Routine: 4,
  WalkIn: 5,
} as const;
export type VisitType = (typeof VisitType)[keyof typeof VisitType];

export const VisitCreationMethod = {
  Manual: 1,
  FromAppointment: 2,
  Imported: 3,
} as const;
export type VisitCreationMethod = (typeof VisitCreationMethod)[keyof typeof VisitCreationMethod];

export const ScheduleStatus = {
  Scheduled: 1,
  Confirmed: 2,
  Arrived: 3,
  InProgress: 4,
  Completed: 5,
  NoShow: 6,
  Cancelled: 7,
} as const;
export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];

// Apgar-style pediatric assessment values (0/1/2 per dimension)
export const ApgarScore = {
  Absent: 0,
  Partial: 1,
  Full: 2,
} as const;
export type ApgarScore = (typeof ApgarScore)[keyof typeof ApgarScore];

export const DeliveryType = {
  Vaginal: 1,
  CSection: 2,
  Vacuum: 3,
  Forceps: 4,
  VBAC: 5,
} as const;
export type DeliveryType = (typeof DeliveryType)[keyof typeof DeliveryType];

export const InfantSex = {
  Male: 1,
  Female: 2,
} as const;
export type InfantSex = (typeof InfantSex)[keyof typeof InfantSex];

export const KindOfLabor = {
  Spontaneous: 1,
  Induced: 2,
  Augmented: 3,
} as const;
export type KindOfLabor = (typeof KindOfLabor)[keyof typeof KindOfLabor];

export const Presentation = {
  Cephalic: 1,
  Breech: 2,
  Transverse: 3,
  Other: 4,
} as const;
export type Presentation = (typeof Presentation)[keyof typeof Presentation];

export const AnesthesiaType = {
  None: 1,
  Local: 2,
  Epidural: 3,
  Spinal: 4,
  General: 5,
} as const;
export type AnesthesiaType = (typeof AnesthesiaType)[keyof typeof AnesthesiaType];

export const FetalLie = {
  Longitudinal: 1,
  Transverse: 2,
  Oblique: 3,
} as const;
export type FetalLie = (typeof FetalLie)[keyof typeof FetalLie];

export const ABOBloodGroup = {
  A: 1,
  B: 2,
  AB: 3,
  O: 4,
} as const;
export type ABOBloodGroup = (typeof ABOBloodGroup)[keyof typeof ABOBloodGroup];

export const RHType = {
  Positive: 1,
  Negative: 2,
} as const;
export type RHType = (typeof RHType)[keyof typeof RHType];

export const Appetite = {
  Poor: 1,
  Fair: 2,
  Good: 3,
  Excellent: 4,
} as const;
export type Appetite = (typeof Appetite)[keyof typeof Appetite];

export const FoodVariation = {
  Limited: 1,
  Moderate: 2,
  Varied: 3,
} as const;
export type FoodVariation = (typeof FoodVariation)[keyof typeof FoodVariation];

export const BowelHabit = {
  Constipated: 1,
  Normal: 2,
  Diarrhea: 3,
  Alternating: 4,
} as const;
export type BowelHabit = (typeof BowelHabit)[keyof typeof BowelHabit];

// PASI severity scale (0–4 per region per dimension)
export const PasiSeverity = {
  None: 0,
  Slight: 1,
  Moderate: 2,
  Marked: 3,
  VeryMarked: 4,
} as const;
export type PasiSeverity = (typeof PasiSeverity)[keyof typeof PasiSeverity];

// Urine dipstick (prenatal flowsheet)
export const DipstickReading = {
  Negative: 0,
  Trace: 1,
  Plus1: 2,
  Plus2: 3,
  Plus3: 4,
  Plus4: 5,
} as const;
export type DipstickReading = (typeof DipstickReading)[keyof typeof DipstickReading];

export const FetalMovement = {
  Absent: 0,
  Decreased: 1,
  Normal: 2,
  Increased: 3,
} as const;
export type FetalMovement = (typeof FetalMovement)[keyof typeof FetalMovement];

export const TransactionType = {
  Income: 1,
  Expense: 2,
  Refund: 3,
  Transfer: 4,
  Salary: 5,
  Adjustment: 6,
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const SubscriptionType = {
  Trial: 1,
  Basic: 2,
  Standard: 3,
  Premium: 4,
  Enterprise: 5,
} as const;
export type SubscriptionType = (typeof SubscriptionType)[keyof typeof SubscriptionType];

export const DefaultPayment = {
  Cash: 1,
  Card: 2,
  Insurance: 3,
} as const;
export type DefaultPayment = (typeof DefaultPayment)[keyof typeof DefaultPayment];

export const UserType = {
  Doctor: 1,
  Nurse: 2,
  Receptionist: 3,
  Admin: 4,
  LabTech: 5,
  Optometrist: 6,
} as const;
export type UserType = (typeof UserType)[keyof typeof UserType];

export const PermissionType = {
  Module: 1,
  Feature: 2,
  Report: 3,
  Action: 4,
} as const;
export type PermissionType = (typeof PermissionType)[keyof typeof PermissionType];

export const DiagnosticTestType = {
  Lab: 1,
  Imaging: 2,
  Functional: 3,
  Pathology: 4,
} as const;
export type DiagnosticTestType = (typeof DiagnosticTestType)[keyof typeof DiagnosticTestType];

export const ModalityType = {
  XRay: 1,
  CT: 2,
  MRI: 3,
  Ultrasound: 4,
  Nuclear: 5,
  Mammography: 6,
} as const;
export type ModalityType = (typeof ModalityType)[keyof typeof ModalityType];

export const Icd10Type = {
  Header: 1,
  Billable: 2,
} as const;
export type Icd10Type = (typeof Icd10Type)[keyof typeof Icd10Type];

export const ProblemCategory = {
  Active: 1,
  Resolved: 2,
  Inactive: 3,
  History: 4,
} as const;
export type ProblemCategory = (typeof ProblemCategory)[keyof typeof ProblemCategory];

export const DenverCategory = {
  PersonalSocial: 1,
  FineMotorAdaptive: 2,
  Language: 3,
  GrossMotor: 4,
} as const;
export type DenverCategory = (typeof DenverCategory)[keyof typeof DenverCategory];

// Language code carried in JWT and stored on hcenterusers.PreferredLanguage
export const Language = {
  English: "en",
  Arabic: "ar",
} as const;
export type Language = (typeof Language)[keyof typeof Language];

// Module keys for the per-tenant module toggle (hcentermodules.ModuleKey)
export const ModuleKey = {
  Auth: "auth",
  Patient: "patient",
  Scheduling: "scheduling",
  Visit: "visit",
  Pediatrics: "pediatrics",
  ObGyn: "obgyn",
  Dermatology: "dermatology",
  Cardiology: "cardiology",
  Dentistry: "dentistry",
  Fertility: "fertility",
  Optometry: "optometry",
  Billing: "billing",
  Finance: "finance",
  Reports: "reports",
  Portal: "portal",
} as const;
export type ModuleKey = (typeof ModuleKey)[keyof typeof ModuleKey];

// Modules that cannot be disabled — they're foundational.
export const CORE_MODULES: readonly ModuleKey[] = [
  ModuleKey.Auth,
  ModuleKey.Patient,
  ModuleKey.Scheduling,
  ModuleKey.Visit,
] as const;
