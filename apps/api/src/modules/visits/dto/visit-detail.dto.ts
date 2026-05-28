export interface VisitDetail {
  patientVisitId: string;
  visitDate: string;
  outcome: number;
  intensity: number;
  visitType: number;
  painLevel: number;
  isHospitalCase: boolean;
  hospitalName: string | null;
  parentVisitId: string | null;
  dateAdded: string | null;

  // SOAP narrative
  chiefComplaint: string | null;
  historyOfPresentIllness: string | null;
  pastMedicalHistory: string | null;
  notes: string | null;
  recommendations: string | null;
  disposition: string | null;

  // Referral
  sourceOfReferral: string | null;
  transferTo: string | null;
  destinationOfReferral: string | null;

  patient: {
    patientId: string;
    nationalId: string;
    fullName: string;
    fullNameAr: string | null;
    sex: number;
    dateOfBirth: string | null;
  };

  doctor: {
    userId: string;
    fullName: string;
    speciality: string | null;
  } | null;

  diagnoses: Array<{
    pvAssessmentConditionId: string;
    medicalConditionId: string;
    conditionName: string;
    dateDiagnosed: string | null;
    ageOfOnset: string | null;
    conditionStatus: string | null;
    comments: string | null;
  }>;

  prescriptions: Array<{
    pvPlanMedicationId: string;
    medicineId: string;
    medicineName: string;
    scientificName: string | null;
    indication: string | null;
    dose: string | null;
    period: string | null;
    frequency: number | null;
    frequencyUnit: string | null;
    quantityNumber: string | null;
    quantityForm: string | null;
    route: string | null;
    prescriptionDate: string | null;
    notes: string | null;
    isPrescribed: boolean;
    /** If the Rx is linked to a specific assessment condition, the friendly name. */
    diagnosisName: string | null;
  }>;

  pmhConditions: Array<{
    pvPmhConditionId: string;
    conditionName: string;
    dateDiagnosed: string | null;
    ageOfOnset: string | null;
    conditionStatus: string | null;
  }>;

  pmhMedications: Array<{
    pvPmhMedicationId: string;
    medicineName: string;
    scientificName: string | null;
    dose: string | null;
    period: string | null;
    indication: string | null;
  }>;

  afterVisitRecommendations: Array<{
    afterVisitRecommendationId: string;
    recommended: string;
    isDone: boolean;
    requestDate: string;
    processedDate: string | null;
  }>;
}
