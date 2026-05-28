export interface PatientDetail {
  patientId: string;
  nationalId: string;
  prefix: string | null;
  firstName: string | null;
  secondName: string | null;
  thirdName: string | null;
  lastName: string | null;
  fullName: string;
  fullNameAr: string | null;
  sex: number;
  dateOfBirth: string | null;
  age: { years: number; months: number } | null;
  height: number | null;
  weight: number | null;
  whUnit: string | null;
  mobileNumber: string | null;
  email: string | null;
  address: string | null;
  photoUrl: string | null;
  passportNumber: string | null;
  nationality: string | null;
  humanRaceId: string | null;
  maritalStatusId: string | null;
  schoolPerformance: number;
  fatherEducation: string | null;
  fatherOccupation: string | null;
  motherEducation: string | null;
  motherOccupation: string | null;
  childOrder: number | null;
  childrenCount: number | null;
  dateAdded: string | null;
  patientCreationMethod: number;

  arabicInfo: {
    firstNameAr: string | null;
    secondNameAr: string | null;
    thirdNameAr: string | null;
    lastNameAr: string | null;
  } | null;

  additionalInfo: {
    occupation: string | null;
    organization: string | null;
    poBox: string | null;
    zipCode: string | null;
    homeEnvironment: string | null;
  } | null;

  emergencyContact: {
    name: string | null;
    relation: string | null;
    phoneNumber: string | null;
  };

  summary: {
    allergyCount: number;
    chronicDiseaseCount: number;
    longTermMedicationCount: number;
    activeProblemCount: number;
    activeInsuranceCount: number;
    visitCount: number;
    lastVisitDate: string | null;
  };

  recentVisits: Array<{
    patientVisitId: string;
    visitDate: string;
    chiefComplaint: string | null;
    outcome: number;
  }>;

  specialNotes: Array<{
    patientSpecialNoteId: string;
    note: string;
  }>;
}
