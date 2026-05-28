import type { PatientCreationMethod, SchoolPerformance, Sex } from "../enums/index";

export interface Patient {
  patientId: string;
  nationalId: string;
  prefix?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  thirdName?: string | null;
  lastName?: string | null;
  sex: Sex;
  dateOfBirth: string; // ISO 8601 UTC
  height?: number | null;
  weight?: number | null;
  whUnit?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
  address?: string | null;
  photoFilename?: string | null;
  contactPersonName?: string | null;
  contactRelation?: string | null;
  contactPhoneNumber?: string | null;
  religion?: string | null;
  nationality?: string | null;
  hcenterId: string;
  humanRaceId?: string | null;
  maritalStatusId?: string | null;
  schoolPerformance: SchoolPerformance;
  fatherEducation?: string | null;
  fatherOccupation?: string | null;
  motherEducation?: string | null;
  motherOccupation?: string | null;
  childOrder?: number | null;
  childrenCount?: number | null;
  passportNumber?: string | null;
  patientCreationMethod: PatientCreationMethod;
  isDeleted: boolean;
  dateAdded?: string | null;
}

export interface PatientArabicInfo {
  patientId: string;
  firstNameAr?: string | null;
  secondNameAr?: string | null;
  thirdNameAr?: string | null;
  lastNameAr?: string | null;
}

export interface PatientListItem {
  patientId: string;
  nationalId: string;
  fullName: string;
  fullNameAr?: string | null;
  sex: Sex;
  dateOfBirth: string;
  mobileNumber?: string | null;
  photoUrl?: string | null;
}
