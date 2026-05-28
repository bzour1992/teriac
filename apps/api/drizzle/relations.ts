import { relations } from "drizzle-orm/relations";
import { hcenterusers, aftervisitrecommendations, patientvisits, medicalconditions, allergies, patients, bodysystems, bodysystemannotationimages, bodysystemschecklistitems, chronicdiseases, countries, cities, specialities, cptcodes, hcenters, hcenterfieldrules, hcenterfinancaltransactions, transactioncategories, patientinsurancedetails, patientinvoices, patientbillingrecords, wallets, hcentermodules, hcenterpage, hcenterscheduleitems, procedurehistory, pvrevisits, hcenterspecialities, hcentersystemsettings, hcenteruserfavcptcodes, hcupvqsections, permissions, hcuserspermissions, medicines, patientadditionalinfo, patientantenatalhx, patientarabicinfo, patientbodysystemphysicalexam, patientbodysystemreview, checklistitems, patientchecklist, patientdiagnosticstudies, denverscreeningtestitems, patientdstitems, patientechocardiogramtests, patienteducationalhistory, patientfemalerelatedhistory, patientgdhx, patientgeneralappearance, patientgeneralreviewquestionaire, patientimmunizationhistory, patientimmunizations, immunizationsvaccines, patientjobs, patientlongtermmedicines, patientmalerelatedhistory, patientnatalhx, patientneonatalhx, patientnutritionalhx, patientpasiscore, patientpermanentdentaleruptions, patientprimarydentaleruptions, patientproblems, maritalstatuses, humanraces, patientsaddetails, patientspecialnotes, patienttestbehaviors, patienttests, diagnostictests, pbspexamchecklistitem, pfihereditarydiseases, medicalprocedures, pvassessmentconditions, pvgprescription, pvplanmedications, pvpmhconditions, pvpmhmedications, hcpcs } from "./schema";

export const aftervisitrecommendationsRelations = relations(aftervisitrecommendations, ({one}) => ({
	hcenteruser_processedByUserId: one(hcenterusers, {
		fields: [aftervisitrecommendations.processedByUserId],
		references: [hcenterusers.userId],
		relationName: "aftervisitrecommendations_processedByUserId_hcenterusers_userId"
	}),
	hcenteruser_requestedByUserId: one(hcenterusers, {
		fields: [aftervisitrecommendations.requestedByUserId],
		references: [hcenterusers.userId],
		relationName: "aftervisitrecommendations_requestedByUserId_hcenterusers_userId"
	}),
	patientvisit: one(patientvisits, {
		fields: [aftervisitrecommendations.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const hcenterusersRelations = relations(hcenterusers, ({one, many}) => ({
	aftervisitrecommendations_processedByUserId: many(aftervisitrecommendations, {
		relationName: "aftervisitrecommendations_processedByUserId_hcenterusers_userId"
	}),
	aftervisitrecommendations_requestedByUserId: many(aftervisitrecommendations, {
		relationName: "aftervisitrecommendations_requestedByUserId_hcenterusers_userId"
	}),
	hcenterfieldrules: many(hcenterfieldrules),
	hcenterfinancaltransactions_addUserId: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_addUserId_hcenterusers_userId"
	}),
	hcenterfinancaltransactions_employeeUserId: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_employeeUserId_hcenterusers_userId"
	}),
	hcenterfinancaltransactions_ownerUserId: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_ownerUserId_hcenterusers_userId"
	}),
	hcenterfinancaltransactions_updateUserId: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_updateUserId_hcenterusers_userId"
	}),
	hcentermodules_disabledBy: many(hcentermodules, {
		relationName: "hcentermodules_disabledBy_hcenterusers_userId"
	}),
	hcentermodules_enabledBy: many(hcentermodules, {
		relationName: "hcentermodules_enabledBy_hcenterusers_userId"
	}),
	hcenterscheduleitems_addSchedulingOfficer: many(hcenterscheduleitems, {
		relationName: "hcenterscheduleitems_addSchedulingOfficer_hcenterusers_userId"
	}),
	hcenterscheduleitems_doctor: many(hcenterscheduleitems, {
		relationName: "hcenterscheduleitems_doctor_hcenterusers_userId"
	}),
	hcenterscheduleitems_updateSchedulingOfficer: many(hcenterscheduleitems, {
		relationName: "hcenterscheduleitems_updateSchedulingOfficer_hcenterusers_userId"
	}),
	hcenteruserfavcptcodes: many(hcenteruserfavcptcodes),
	hcenter: one(hcenters, {
		fields: [hcenterusers.hcenterId],
		references: [hcenters.hcenterId]
	}),
	hcenterspeciality: one(hcenterspecialities, {
		fields: [hcenterusers.hcenterSpecialityId],
		references: [hcenterspecialities.hcenterSpecialityId]
	}),
	hcupvqsections: many(hcupvqsections),
	hcuserspermissions: many(hcuserspermissions),
	patientbillingrecords_doctorId: many(patientbillingrecords, {
		relationName: "patientbillingrecords_doctorId_hcenterusers_userId"
	}),
	patientbillingrecords_userId: many(patientbillingrecords, {
		relationName: "patientbillingrecords_userId_hcenterusers_userId"
	}),
	patientinvoices: many(patientinvoices),
	patientvisits_doctor: many(patientvisits, {
		relationName: "patientvisits_doctor_hcenterusers_userId"
	}),
	patientvisits_schedulingOfficer: many(patientvisits, {
		relationName: "patientvisits_schedulingOfficer_hcenterusers_userId"
	}),
	pvplanmedications_prescribedBy: many(pvplanmedications, {
		relationName: "pvplanmedications_prescribedBy_hcenterusers_userId"
	}),
	pvplanmedications_suggestedBy: many(pvplanmedications, {
		relationName: "pvplanmedications_suggestedBy_hcenterusers_userId"
	}),
}));

export const patientvisitsRelations = relations(patientvisits, ({one, many}) => ({
	aftervisitrecommendations: many(aftervisitrecommendations),
	hcenterscheduleitems: many(hcenterscheduleitems),
	patientbillingrecords: many(patientbillingrecords),
	patientbodysystemphysicalexams: many(patientbodysystemphysicalexam),
	patientbodysystemreviews: many(patientbodysystemreview),
	patientechocardiogramtests: many(patientechocardiogramtests),
	patientnutritionalhxes: many(patientnutritionalhx),
	patientpasiscores: many(patientpasiscore),
	patienttests: many(patienttests),
	hcenteruser_doctor: one(hcenterusers, {
		fields: [patientvisits.doctor],
		references: [hcenterusers.userId],
		relationName: "patientvisits_doctor_hcenterusers_userId"
	}),
	patientvisit: one(patientvisits, {
		fields: [patientvisits.parentVisitId],
		references: [patientvisits.patientVisitId],
		relationName: "patientvisits_parentVisitId_patientvisits_patientVisitId"
	}),
	patientvisits: many(patientvisits, {
		relationName: "patientvisits_parentVisitId_patientvisits_patientVisitId"
	}),
	patient: one(patients, {
		fields: [patientvisits.patientId],
		references: [patients.patientId]
	}),
	hcenteruser_schedulingOfficer: one(hcenterusers, {
		fields: [patientvisits.schedulingOfficer],
		references: [hcenterusers.userId],
		relationName: "patientvisits_schedulingOfficer_hcenterusers_userId"
	}),
	pvassessmentconditions: many(pvassessmentconditions),
	pvgprescriptions: many(pvgprescription),
	pvplanmedications: many(pvplanmedications),
	pvpmhconditions: many(pvpmhconditions),
	pvpmhmedications: many(pvpmhmedications),
	pvrevisits: many(pvrevisits),
}));

export const allergiesRelations = relations(allergies, ({one}) => ({
	medicalcondition: one(medicalconditions, {
		fields: [allergies.medicalConditionId],
		references: [medicalconditions.medicalConditionId]
	}),
	patient: one(patients, {
		fields: [allergies.patientId],
		references: [patients.patientId]
	}),
}));

export const medicalconditionsRelations = relations(medicalconditions, ({many}) => ({
	allergies: many(allergies),
	chronicdiseases: many(chronicdiseases),
	pfihereditarydiseases: many(pfihereditarydiseases),
	pvassessmentconditions: many(pvassessmentconditions),
	pvpmhconditions: many(pvpmhconditions),
}));

export const patientsRelations = relations(patients, ({one, many}) => ({
	allergies: many(allergies),
	chronicdiseases: many(chronicdiseases),
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	hcenterscheduleitems: many(hcenterscheduleitems),
	patientadditionalinfos: many(patientadditionalinfo),
	patientantenatalhxes: many(patientantenatalhx),
	patientarabicinfos: many(patientarabicinfo),
	patientbodysystemphysicalexams: many(patientbodysystemphysicalexam),
	patientbodysystemreviews: many(patientbodysystemreview),
	patientchecklists: many(patientchecklist),
	patientdiagnosticstudies: many(patientdiagnosticstudies),
	patientdstitems: many(patientdstitems),
	patientechocardiogramtests: many(patientechocardiogramtests),
	patienteducationalhistories: many(patienteducationalhistory),
	patientfemalerelatedhistories: many(patientfemalerelatedhistory),
	patientgdhxes: many(patientgdhx),
	patientgeneralappearances: many(patientgeneralappearance),
	patientgeneralreviewquestionaires: many(patientgeneralreviewquestionaire),
	patientimmunizationhistories: many(patientimmunizationhistory),
	patientimmunizations: many(patientimmunizations),
	patientinsurancedetails: many(patientinsurancedetails),
	patientinvoices: many(patientinvoices),
	patientjobs: many(patientjobs),
	patientlongtermmedicines: many(patientlongtermmedicines),
	patientmalerelatedhistories: many(patientmalerelatedhistory),
	patientnatalhxes: many(patientnatalhx),
	patientneonatalhxes: many(patientneonatalhx),
	patientpermanentdentaleruptions: many(patientpermanentdentaleruptions),
	patientprimarydentaleruptions: many(patientprimarydentaleruptions),
	patientproblems: many(patientproblems),
	country: one(countries, {
		fields: [patients.nationality],
		references: [countries.countryId]
	}),
	hcenter: one(hcenters, {
		fields: [patients.hcenterId],
		references: [hcenters.hcenterId]
	}),
	maritalstatus: one(maritalstatuses, {
		fields: [patients.maritalStatusId],
		references: [maritalstatuses.maritalStatusId]
	}),
	humanrace: one(humanraces, {
		fields: [patients.humanRaceId],
		references: [humanraces.humanRaceId]
	}),
	patientsaddetails: many(patientsaddetails),
	patientspecialnotes: many(patientspecialnotes),
	patienttestbehaviors: many(patienttestbehaviors),
	patienttests: many(patienttests),
	patientvisits: many(patientvisits),
	pfihereditarydiseases: many(pfihereditarydiseases),
	procedurehistories: many(procedurehistory),
}));

export const bodysystemannotationimagesRelations = relations(bodysystemannotationimages, ({one}) => ({
	bodysystem: one(bodysystems, {
		fields: [bodysystemannotationimages.bodySystemId],
		references: [bodysystems.bodySystemId]
	}),
}));

export const bodysystemsRelations = relations(bodysystems, ({many}) => ({
	bodysystemannotationimages: many(bodysystemannotationimages),
	bodysystemschecklistitems: many(bodysystemschecklistitems),
	patientbodysystemphysicalexams: many(patientbodysystemphysicalexam),
	patientbodysystemreviews: many(patientbodysystemreview),
}));

export const bodysystemschecklistitemsRelations = relations(bodysystemschecklistitems, ({one, many}) => ({
	bodysystem: one(bodysystems, {
		fields: [bodysystemschecklistitems.bodySystemId],
		references: [bodysystems.bodySystemId]
	}),
	pbspexamchecklistitems: many(pbspexamchecklistitem),
}));

export const chronicdiseasesRelations = relations(chronicdiseases, ({one}) => ({
	medicalcondition: one(medicalconditions, {
		fields: [chronicdiseases.medicalConditionId],
		references: [medicalconditions.medicalConditionId]
	}),
	patient: one(patients, {
		fields: [chronicdiseases.patientId],
		references: [patients.patientId]
	}),
}));

export const citiesRelations = relations(cities, ({one, many}) => ({
	country: one(countries, {
		fields: [cities.countryId],
		references: [countries.countryId]
	}),
	hcenters: many(hcenters),
	medicines: many(medicines),
}));

export const countriesRelations = relations(countries, ({many}) => ({
	cities: many(cities),
	hcenters: many(hcenters),
	medicines: many(medicines),
	patients: many(patients),
}));

export const cptcodesRelations = relations(cptcodes, ({one, many}) => ({
	speciality: one(specialities, {
		fields: [cptcodes.specialtyId],
		references: [specialities.specialityId]
	}),
	hcenteruserfavcptcodes: many(hcenteruserfavcptcodes),
	transactioncategories: many(transactioncategories),
}));

export const specialitiesRelations = relations(specialities, ({many}) => ({
	cptcodes: many(cptcodes),
	hcenterspecialities: many(hcenterspecialities),
}));

export const hcenterfieldrulesRelations = relations(hcenterfieldrules, ({one}) => ({
	hcenter: one(hcenters, {
		fields: [hcenterfieldrules.hcenterId],
		references: [hcenters.hcenterId]
	}),
	hcenteruser: one(hcenterusers, {
		fields: [hcenterfieldrules.updatedBy],
		references: [hcenterusers.userId]
	}),
}));

export const hcentersRelations = relations(hcenters, ({one, many}) => ({
	hcenterfieldrules: many(hcenterfieldrules),
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	hcentermodules: many(hcentermodules),
	hcenterpages: many(hcenterpage),
	city: one(cities, {
		fields: [hcenters.cityId],
		references: [cities.cityId]
	}),
	country: one(countries, {
		fields: [hcenters.countryId],
		references: [countries.countryId]
	}),
	hcenterscheduleitems: many(hcenterscheduleitems),
	hcenterspecialities: many(hcenterspecialities),
	hcentersystemsettings: many(hcentersystemsettings),
	hcenterusers: many(hcenterusers),
	patientinvoices: many(patientinvoices),
	patients: many(patients),
	transactioncategories: many(transactioncategories),
	wallets: many(wallets),
}));

export const hcenterfinancaltransactionsRelations = relations(hcenterfinancaltransactions, ({one}) => ({
	hcenteruser_addUserId: one(hcenterusers, {
		fields: [hcenterfinancaltransactions.addUserId],
		references: [hcenterusers.userId],
		relationName: "hcenterfinancaltransactions_addUserId_hcenterusers_userId"
	}),
	transactioncategory: one(transactioncategories, {
		fields: [hcenterfinancaltransactions.transactionCategoryId],
		references: [transactioncategories.transactionCategoryId]
	}),
	hcenteruser_employeeUserId: one(hcenterusers, {
		fields: [hcenterfinancaltransactions.employeeUserId],
		references: [hcenterusers.userId],
		relationName: "hcenterfinancaltransactions_employeeUserId_hcenterusers_userId"
	}),
	hcenter: one(hcenters, {
		fields: [hcenterfinancaltransactions.hcenterId],
		references: [hcenters.hcenterId]
	}),
	patientinsurancedetail: one(patientinsurancedetails, {
		fields: [hcenterfinancaltransactions.patientInsuranceDetailId],
		references: [patientinsurancedetails.patientInsuranceDetailId]
	}),
	patientinvoice: one(patientinvoices, {
		fields: [hcenterfinancaltransactions.patientInvoiceId],
		references: [patientinvoices.patientInvoiceId]
	}),
	hcenteruser_ownerUserId: one(hcenterusers, {
		fields: [hcenterfinancaltransactions.ownerUserId],
		references: [hcenterusers.userId],
		relationName: "hcenterfinancaltransactions_ownerUserId_hcenterusers_userId"
	}),
	patientbillingrecord: one(patientbillingrecords, {
		fields: [hcenterfinancaltransactions.patientBillingRecordId],
		references: [patientbillingrecords.patientBillingRecordId]
	}),
	patient: one(patients, {
		fields: [hcenterfinancaltransactions.patientId],
		references: [patients.patientId]
	}),
	wallet_sourceWallet: one(wallets, {
		fields: [hcenterfinancaltransactions.sourceWallet],
		references: [wallets.walletId],
		relationName: "hcenterfinancaltransactions_sourceWallet_wallets_walletId"
	}),
	hcenteruser_updateUserId: one(hcenterusers, {
		fields: [hcenterfinancaltransactions.updateUserId],
		references: [hcenterusers.userId],
		relationName: "hcenterfinancaltransactions_updateUserId_hcenterusers_userId"
	}),
	wallet_walletId: one(wallets, {
		fields: [hcenterfinancaltransactions.walletId],
		references: [wallets.walletId],
		relationName: "hcenterfinancaltransactions_walletId_wallets_walletId"
	}),
}));

export const transactioncategoriesRelations = relations(transactioncategories, ({one, many}) => ({
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	patientbillingrecords: many(patientbillingrecords),
	cptcode: one(cptcodes, {
		fields: [transactioncategories.cptCodeId],
		references: [cptcodes.cptCodeId]
	}),
	diagnostictest: one(diagnostictests, {
		fields: [transactioncategories.diagnosticTestId],
		references: [diagnostictests.diagnosticTestId]
	}),
	hcenter: one(hcenters, {
		fields: [transactioncategories.hcenterId],
		references: [hcenters.hcenterId]
	}),
	hcpc: one(hcpcs, {
		fields: [transactioncategories.hcpcid],
		references: [hcpcs.hcpcid]
	}),
	medicalprocedure: one(medicalprocedures, {
		fields: [transactioncategories.medicalProcedureId],
		references: [medicalprocedures.medicalProcedureId]
	}),
}));

export const patientinsurancedetailsRelations = relations(patientinsurancedetails, ({one, many}) => ({
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	patient: one(patients, {
		fields: [patientinsurancedetails.patientId],
		references: [patients.patientId]
	}),
	patientinvoices: many(patientinvoices),
}));

export const patientinvoicesRelations = relations(patientinvoices, ({one, many}) => ({
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	hcenter: one(hcenters, {
		fields: [patientinvoices.hcenterId],
		references: [hcenters.hcenterId]
	}),
	patientinsurancedetail: one(patientinsurancedetails, {
		fields: [patientinvoices.patientInsuranceDetailId],
		references: [patientinsurancedetails.patientInsuranceDetailId]
	}),
	patient: one(patients, {
		fields: [patientinvoices.patientId],
		references: [patients.patientId]
	}),
	hcenteruser: one(hcenterusers, {
		fields: [patientinvoices.addedByUserId],
		references: [hcenterusers.userId]
	}),
}));

export const patientbillingrecordsRelations = relations(patientbillingrecords, ({one, many}) => ({
	hcenterfinancaltransactions: many(hcenterfinancaltransactions),
	transactioncategory: one(transactioncategories, {
		fields: [patientbillingrecords.transactionCategoryId],
		references: [transactioncategories.transactionCategoryId]
	}),
	hcenteruser_doctorId: one(hcenterusers, {
		fields: [patientbillingrecords.doctorId],
		references: [hcenterusers.userId],
		relationName: "patientbillingrecords_doctorId_hcenterusers_userId"
	}),
	hcenteruser_userId: one(hcenterusers, {
		fields: [patientbillingrecords.userId],
		references: [hcenterusers.userId],
		relationName: "patientbillingrecords_userId_hcenterusers_userId"
	}),
	patientvisit: one(patientvisits, {
		fields: [patientbillingrecords.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const walletsRelations = relations(wallets, ({one, many}) => ({
	hcenterfinancaltransactions_sourceWallet: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_sourceWallet_wallets_walletId"
	}),
	hcenterfinancaltransactions_walletId: many(hcenterfinancaltransactions, {
		relationName: "hcenterfinancaltransactions_walletId_wallets_walletId"
	}),
	hcenter: one(hcenters, {
		fields: [wallets.hcenterId],
		references: [hcenters.hcenterId]
	}),
}));

export const hcentermodulesRelations = relations(hcentermodules, ({one}) => ({
	hcenteruser_disabledBy: one(hcenterusers, {
		fields: [hcentermodules.disabledBy],
		references: [hcenterusers.userId],
		relationName: "hcentermodules_disabledBy_hcenterusers_userId"
	}),
	hcenteruser_enabledBy: one(hcenterusers, {
		fields: [hcentermodules.enabledBy],
		references: [hcenterusers.userId],
		relationName: "hcentermodules_enabledBy_hcenterusers_userId"
	}),
	hcenter: one(hcenters, {
		fields: [hcentermodules.hcenterId],
		references: [hcenters.hcenterId]
	}),
}));

export const hcenterpageRelations = relations(hcenterpage, ({one}) => ({
	hcenter: one(hcenters, {
		fields: [hcenterpage.hcenterId],
		references: [hcenters.hcenterId]
	}),
}));

export const hcenterscheduleitemsRelations = relations(hcenterscheduleitems, ({one}) => ({
	hcenteruser_addSchedulingOfficer: one(hcenterusers, {
		fields: [hcenterscheduleitems.addSchedulingOfficer],
		references: [hcenterusers.userId],
		relationName: "hcenterscheduleitems_addSchedulingOfficer_hcenterusers_userId"
	}),
	hcenteruser_doctor: one(hcenterusers, {
		fields: [hcenterscheduleitems.doctor],
		references: [hcenterusers.userId],
		relationName: "hcenterscheduleitems_doctor_hcenterusers_userId"
	}),
	hcenter: one(hcenters, {
		fields: [hcenterscheduleitems.hcenterId],
		references: [hcenters.hcenterId]
	}),
	patient: one(patients, {
		fields: [hcenterscheduleitems.patientId],
		references: [patients.patientId]
	}),
	procedurehistory: one(procedurehistory, {
		fields: [hcenterscheduleitems.procedureHistoryId],
		references: [procedurehistory.procedureHistoryId]
	}),
	pvrevisit: one(pvrevisits, {
		fields: [hcenterscheduleitems.pvRevisitId],
		references: [pvrevisits.pvRevisitId]
	}),
	hcenteruser_updateSchedulingOfficer: one(hcenterusers, {
		fields: [hcenterscheduleitems.updateSchedulingOfficer],
		references: [hcenterusers.userId],
		relationName: "hcenterscheduleitems_updateSchedulingOfficer_hcenterusers_userId"
	}),
	patientvisit: one(patientvisits, {
		fields: [hcenterscheduleitems.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const procedurehistoryRelations = relations(procedurehistory, ({one, many}) => ({
	hcenterscheduleitems: many(hcenterscheduleitems),
	medicalprocedure: one(medicalprocedures, {
		fields: [procedurehistory.medicalProcedureId],
		references: [medicalprocedures.medicalProcedureId]
	}),
	patient: one(patients, {
		fields: [procedurehistory.patientId],
		references: [patients.patientId]
	}),
	pvrevisits: many(pvrevisits),
}));

export const pvrevisitsRelations = relations(pvrevisits, ({one, many}) => ({
	hcenterscheduleitems: many(hcenterscheduleitems),
	procedurehistory: one(procedurehistory, {
		fields: [pvrevisits.procedureHistoryId],
		references: [procedurehistory.procedureHistoryId]
	}),
	patientvisit: one(patientvisits, {
		fields: [pvrevisits.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const hcenterspecialitiesRelations = relations(hcenterspecialities, ({one, many}) => ({
	hcenter: one(hcenters, {
		fields: [hcenterspecialities.hcenterId],
		references: [hcenters.hcenterId]
	}),
	speciality: one(specialities, {
		fields: [hcenterspecialities.specialityId],
		references: [specialities.specialityId]
	}),
	hcenterusers: many(hcenterusers),
}));

export const hcentersystemsettingsRelations = relations(hcentersystemsettings, ({one}) => ({
	hcenter: one(hcenters, {
		fields: [hcentersystemsettings.hcenterId],
		references: [hcenters.hcenterId]
	}),
}));

export const hcenteruserfavcptcodesRelations = relations(hcenteruserfavcptcodes, ({one}) => ({
	cptcode: one(cptcodes, {
		fields: [hcenteruserfavcptcodes.cptCodeId],
		references: [cptcodes.cptCodeId]
	}),
	hcenteruser: one(hcenterusers, {
		fields: [hcenteruserfavcptcodes.hcenterUserId],
		references: [hcenterusers.userId]
	}),
}));

export const hcupvqsectionsRelations = relations(hcupvqsections, ({one}) => ({
	hcenteruser: one(hcenterusers, {
		fields: [hcupvqsections.userId],
		references: [hcenterusers.userId]
	}),
}));

export const hcuserspermissionsRelations = relations(hcuserspermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [hcuserspermissions.permissionId],
		references: [permissions.permissionId]
	}),
	hcenteruser: one(hcenterusers, {
		fields: [hcuserspermissions.userId],
		references: [hcenterusers.userId]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	hcuserspermissions: many(hcuserspermissions),
}));

export const medicinesRelations = relations(medicines, ({one, many}) => ({
	city: one(cities, {
		fields: [medicines.cityId],
		references: [cities.cityId]
	}),
	country: one(countries, {
		fields: [medicines.countryId],
		references: [countries.countryId]
	}),
	patientlongtermmedicines: many(patientlongtermmedicines),
	pvplanmedications: many(pvplanmedications),
	pvpmhmedications: many(pvpmhmedications),
}));

export const patientadditionalinfoRelations = relations(patientadditionalinfo, ({one}) => ({
	patient: one(patients, {
		fields: [patientadditionalinfo.patientId],
		references: [patients.patientId]
	}),
}));

export const patientantenatalhxRelations = relations(patientantenatalhx, ({one}) => ({
	patient: one(patients, {
		fields: [patientantenatalhx.patientId],
		references: [patients.patientId]
	}),
}));

export const patientarabicinfoRelations = relations(patientarabicinfo, ({one}) => ({
	patient: one(patients, {
		fields: [patientarabicinfo.patientId],
		references: [patients.patientId]
	}),
}));

export const patientbodysystemphysicalexamRelations = relations(patientbodysystemphysicalexam, ({one}) => ({
	bodysystem: one(bodysystems, {
		fields: [patientbodysystemphysicalexam.bodySystemId],
		references: [bodysystems.bodySystemId]
	}),
	patient: one(patients, {
		fields: [patientbodysystemphysicalexam.patientId],
		references: [patients.patientId]
	}),
	patientvisit: one(patientvisits, {
		fields: [patientbodysystemphysicalexam.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const patientbodysystemreviewRelations = relations(patientbodysystemreview, ({one, many}) => ({
	bodysystem: one(bodysystems, {
		fields: [patientbodysystemreview.bodySystemId],
		references: [bodysystems.bodySystemId]
	}),
	patient: one(patients, {
		fields: [patientbodysystemreview.patientId],
		references: [patients.patientId]
	}),
	patientvisit: one(patientvisits, {
		fields: [patientbodysystemreview.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
	pbspexamchecklistitems: many(pbspexamchecklistitem),
}));

export const patientchecklistRelations = relations(patientchecklist, ({one}) => ({
	checklistitem: one(checklistitems, {
		fields: [patientchecklist.checklistItemId],
		references: [checklistitems.checklistItemId]
	}),
	patient: one(patients, {
		fields: [patientchecklist.patientId],
		references: [patients.patientId]
	}),
}));

export const checklistitemsRelations = relations(checklistitems, ({many}) => ({
	patientchecklists: many(patientchecklist),
}));

export const patientdiagnosticstudiesRelations = relations(patientdiagnosticstudies, ({one}) => ({
	patient: one(patients, {
		fields: [patientdiagnosticstudies.patientId],
		references: [patients.patientId]
	}),
}));

export const patientdstitemsRelations = relations(patientdstitems, ({one}) => ({
	denverscreeningtestitem: one(denverscreeningtestitems, {
		fields: [patientdstitems.itemId],
		references: [denverscreeningtestitems.itemId]
	}),
	patient: one(patients, {
		fields: [patientdstitems.patientId],
		references: [patients.patientId]
	}),
}));

export const denverscreeningtestitemsRelations = relations(denverscreeningtestitems, ({many}) => ({
	patientdstitems: many(patientdstitems),
}));

export const patientechocardiogramtestsRelations = relations(patientechocardiogramtests, ({one}) => ({
	patient: one(patients, {
		fields: [patientechocardiogramtests.patientId],
		references: [patients.patientId]
	}),
	patientvisit: one(patientvisits, {
		fields: [patientechocardiogramtests.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const patienteducationalhistoryRelations = relations(patienteducationalhistory, ({one}) => ({
	patient: one(patients, {
		fields: [patienteducationalhistory.patientId],
		references: [patients.patientId]
	}),
}));

export const patientfemalerelatedhistoryRelations = relations(patientfemalerelatedhistory, ({one}) => ({
	patient: one(patients, {
		fields: [patientfemalerelatedhistory.patientId],
		references: [patients.patientId]
	}),
}));

export const patientgdhxRelations = relations(patientgdhx, ({one}) => ({
	patient: one(patients, {
		fields: [patientgdhx.patientId],
		references: [patients.patientId]
	}),
}));

export const patientgeneralappearanceRelations = relations(patientgeneralappearance, ({one}) => ({
	patient: one(patients, {
		fields: [patientgeneralappearance.patientId],
		references: [patients.patientId]
	}),
}));

export const patientgeneralreviewquestionaireRelations = relations(patientgeneralreviewquestionaire, ({one}) => ({
	patient: one(patients, {
		fields: [patientgeneralreviewquestionaire.patientId],
		references: [patients.patientId]
	}),
}));

export const patientimmunizationhistoryRelations = relations(patientimmunizationhistory, ({one}) => ({
	patient: one(patients, {
		fields: [patientimmunizationhistory.patientId],
		references: [patients.patientId]
	}),
}));

export const patientimmunizationsRelations = relations(patientimmunizations, ({one}) => ({
	patient: one(patients, {
		fields: [patientimmunizations.patientId],
		references: [patients.patientId]
	}),
	immunizationsvaccine: one(immunizationsvaccines, {
		fields: [patientimmunizations.immunizationsVaccineId],
		references: [immunizationsvaccines.immunizationsVaccineId]
	}),
}));

export const immunizationsvaccinesRelations = relations(immunizationsvaccines, ({many}) => ({
	patientimmunizations: many(patientimmunizations),
}));

export const patientjobsRelations = relations(patientjobs, ({one}) => ({
	patient: one(patients, {
		fields: [patientjobs.patientId],
		references: [patients.patientId]
	}),
}));

export const patientlongtermmedicinesRelations = relations(patientlongtermmedicines, ({one}) => ({
	medicine: one(medicines, {
		fields: [patientlongtermmedicines.medicineId],
		references: [medicines.medicineId]
	}),
	patient: one(patients, {
		fields: [patientlongtermmedicines.patientId],
		references: [patients.patientId]
	}),
}));

export const patientmalerelatedhistoryRelations = relations(patientmalerelatedhistory, ({one}) => ({
	patient: one(patients, {
		fields: [patientmalerelatedhistory.patientId],
		references: [patients.patientId]
	}),
}));

export const patientnatalhxRelations = relations(patientnatalhx, ({one}) => ({
	patient: one(patients, {
		fields: [patientnatalhx.patientId],
		references: [patients.patientId]
	}),
}));

export const patientneonatalhxRelations = relations(patientneonatalhx, ({one}) => ({
	patient: one(patients, {
		fields: [patientneonatalhx.patientId],
		references: [patients.patientId]
	}),
}));

export const patientnutritionalhxRelations = relations(patientnutritionalhx, ({one}) => ({
	patientvisit: one(patientvisits, {
		fields: [patientnutritionalhx.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const patientpasiscoreRelations = relations(patientpasiscore, ({one}) => ({
	patientvisit: one(patientvisits, {
		fields: [patientpasiscore.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const patientpermanentdentaleruptionsRelations = relations(patientpermanentdentaleruptions, ({one}) => ({
	patient: one(patients, {
		fields: [patientpermanentdentaleruptions.patientId],
		references: [patients.patientId]
	}),
}));

export const patientprimarydentaleruptionsRelations = relations(patientprimarydentaleruptions, ({one}) => ({
	patient: one(patients, {
		fields: [patientprimarydentaleruptions.patientId],
		references: [patients.patientId]
	}),
}));

export const patientproblemsRelations = relations(patientproblems, ({one}) => ({
	patient: one(patients, {
		fields: [patientproblems.patientId],
		references: [patients.patientId]
	}),
}));

export const maritalstatusesRelations = relations(maritalstatuses, ({many}) => ({
	patients: many(patients),
}));

export const humanracesRelations = relations(humanraces, ({many}) => ({
	patients: many(patients),
}));

export const patientsaddetailsRelations = relations(patientsaddetails, ({one}) => ({
	patient: one(patients, {
		fields: [patientsaddetails.patientId],
		references: [patients.patientId]
	}),
}));

export const patientspecialnotesRelations = relations(patientspecialnotes, ({one}) => ({
	patient: one(patients, {
		fields: [patientspecialnotes.patientId],
		references: [patients.patientId]
	}),
}));

export const patienttestbehaviorsRelations = relations(patienttestbehaviors, ({one}) => ({
	patient: one(patients, {
		fields: [patienttestbehaviors.patientId],
		references: [patients.patientId]
	}),
}));

export const patienttestsRelations = relations(patienttests, ({one}) => ({
	patient: one(patients, {
		fields: [patienttests.patientId],
		references: [patients.patientId]
	}),
	diagnostictest: one(diagnostictests, {
		fields: [patienttests.diagnosticTestId],
		references: [diagnostictests.diagnosticTestId]
	}),
	patientvisit: one(patientvisits, {
		fields: [patienttests.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const diagnostictestsRelations = relations(diagnostictests, ({many}) => ({
	patienttests: many(patienttests),
	transactioncategories: many(transactioncategories),
}));

export const pbspexamchecklistitemRelations = relations(pbspexamchecklistitem, ({one}) => ({
	bodysystemschecklistitem: one(bodysystemschecklistitems, {
		fields: [pbspexamchecklistitem.bodySystemChecklistItemId],
		references: [bodysystemschecklistitems.bodySystemChecklistItemId]
	}),
	patientbodysystemreview: one(patientbodysystemreview, {
		fields: [pbspexamchecklistitem.patientBodySystemReviewId],
		references: [patientbodysystemreview.patientBodySystemReviewId]
	}),
}));

export const pfihereditarydiseasesRelations = relations(pfihereditarydiseases, ({one}) => ({
	medicalcondition: one(medicalconditions, {
		fields: [pfihereditarydiseases.medicalConditionId],
		references: [medicalconditions.medicalConditionId]
	}),
	patient: one(patients, {
		fields: [pfihereditarydiseases.patientId],
		references: [patients.patientId]
	}),
}));

export const medicalproceduresRelations = relations(medicalprocedures, ({many}) => ({
	procedurehistories: many(procedurehistory),
	transactioncategories: many(transactioncategories),
}));

export const pvassessmentconditionsRelations = relations(pvassessmentconditions, ({one, many}) => ({
	medicalcondition: one(medicalconditions, {
		fields: [pvassessmentconditions.medicalConditionId],
		references: [medicalconditions.medicalConditionId]
	}),
	patientvisit: one(patientvisits, {
		fields: [pvassessmentconditions.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
	pvplanmedications: many(pvplanmedications),
}));

export const pvgprescriptionRelations = relations(pvgprescription, ({one}) => ({
	patientvisit: one(patientvisits, {
		fields: [pvgprescription.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const pvplanmedicationsRelations = relations(pvplanmedications, ({one}) => ({
	pvassessmentcondition: one(pvassessmentconditions, {
		fields: [pvplanmedications.pvAssessmentConditionId],
		references: [pvassessmentconditions.pvAssessmentConditionId]
	}),
	medicine: one(medicines, {
		fields: [pvplanmedications.medicineId],
		references: [medicines.medicineId]
	}),
	hcenteruser_prescribedBy: one(hcenterusers, {
		fields: [pvplanmedications.prescribedBy],
		references: [hcenterusers.userId],
		relationName: "pvplanmedications_prescribedBy_hcenterusers_userId"
	}),
	hcenteruser_suggestedBy: one(hcenterusers, {
		fields: [pvplanmedications.suggestedBy],
		references: [hcenterusers.userId],
		relationName: "pvplanmedications_suggestedBy_hcenterusers_userId"
	}),
	patientvisit: one(patientvisits, {
		fields: [pvplanmedications.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const pvpmhconditionsRelations = relations(pvpmhconditions, ({one}) => ({
	medicalcondition: one(medicalconditions, {
		fields: [pvpmhconditions.medicalConditionId],
		references: [medicalconditions.medicalConditionId]
	}),
	patientvisit: one(patientvisits, {
		fields: [pvpmhconditions.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const pvpmhmedicationsRelations = relations(pvpmhmedications, ({one}) => ({
	medicine: one(medicines, {
		fields: [pvpmhmedications.medicineId],
		references: [medicines.medicineId]
	}),
	patientvisit: one(patientvisits, {
		fields: [pvpmhmedications.patientVisitId],
		references: [patientvisits.patientVisitId]
	}),
}));

export const hcpcsRelations = relations(hcpcs, ({many}) => ({
	transactioncategories: many(transactioncategories),
}));