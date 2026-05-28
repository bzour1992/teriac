import type { Intensity, VisitCreationMethod, VisitOutcome, VisitType } from "../enums/index";

export interface PatientVisit {
  patientVisitId: string;
  patientId: string;
  doctorId: string;
  schedulingOfficerId?: string | null;
  visitDate: string;
  notes?: string | null;
  recommendations?: string | null;
  outcome: VisitOutcome;
  /** DB column is misspelled `Intesity` — aliased in Drizzle, exposed clean here. */
  intensity: Intensity;
  chiefComplaint?: string | null;
  historyOfPresentIllness?: string | null;
  pastMedicalHistory?: string | null;
  disposition?: string | null;
  /** DB column is `SourceOfRefferral` — aliased in Drizzle. */
  sourceOfReferral?: string | null;
  /** DB column is `TransfereTo`. */
  transferTo?: string | null;
  /** DB column is `DestinationOfRefferal`. */
  destinationOfReferral?: string | null;
  parentVisitId?: string | null;
  isHospitalCase: boolean;
  hospitalName?: string | null;
  visitType: VisitType;
  painLevel: number;
  visitCreationMethod: VisitCreationMethod;
  isDeleted: boolean;
  dateAdded?: string | null;
}
