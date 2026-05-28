import {
  escHtml,
  fieldRow,
  fmtDate,
  fmtDateTime,
  prose,
  renderFooter,
  renderHeader,
  renderPatient,
  section,
  type HCenterHeader,
  type Lang,
  type PatientBlock,
  wrapHtml,
} from "./base.template";

const VISIT_TYPE: Record<number, Record<Lang, string>> = {
  1: { en: "New", ar: "جديد" },
  2: { en: "Follow-up", ar: "متابعة" },
  3: { en: "Emergency", ar: "طارئ" },
  4: { en: "Routine", ar: "روتيني" },
  5: { en: "Walk-in", ar: "بدون موعد" },
};

const OUTCOME: Record<number, Record<Lang, string>> = {
  0: { en: "Open", ar: "مفتوح" },
  1: { en: "Resolved", ar: "محلول" },
  2: { en: "Referred", ar: "محال" },
  3: { en: "Failed", ar: "فشل" },
  4: { en: "Cancelled", ar: "ملغى" },
  5: { en: "No-show", ar: "لم يحضر" },
};

export interface VisitReportData {
  hcenter: HCenterHeader;
  patient: PatientBlock;
  visit: {
    visitDate: string;
    visitType: number;
    outcome: number;
    painLevel: number;
    doctorName: string;
    chiefComplaint: string | null;
    historyOfPresentIllness: string | null;
    pastMedicalHistory: string | null;
    notes: string | null;
    recommendations: string | null;
    disposition: string | null;
    diagnoses: Array<{ conditionName: string; conditionStatus: string | null; comments: string | null }>;
    prescriptions: Array<{
      medicineName: string;
      scientificName: string | null;
      dose: string | null;
      period: string | null;
      frequency: number | null;
      frequencyUnit: string | null;
      route: string | null;
      indication: string | null;
    }>;
    afterVisitRecommendations: Array<{ recommended: string; isDone: boolean }>;
  };
}

export function renderVisitReport(data: VisitReportData, lang: Lang): string {
  const isAr = lang === "ar";
  const L = {
    title: isAr ? "تقرير الزيارة" : "Visit Report",
    date: isAr ? "التاريخ" : "Date",
    doctor: isAr ? "الطبيب" : "Doctor",
    type: isAr ? "نوع الزيارة" : "Visit type",
    outcome: isAr ? "النتيجة" : "Outcome",
    pain: isAr ? "مستوى الألم" : "Pain level",
    cc: isAr ? "الشكوى الرئيسية" : "Chief complaint",
    hpi: isAr ? "تاريخ المرض الحالي" : "History of present illness",
    pmh: isAr ? "التاريخ المرضي السابق" : "Past medical history",
    soap_a: isAr ? "التقييم والتشخيص" : "Assessment / Diagnoses",
    soap_p: isAr ? "الخطة والتوصيات" : "Plan & Recommendations",
    prescriptions: isAr ? "الوصفة الطبية" : "Prescriptions",
    followups: isAr ? "متابعات ما بعد الزيارة" : "After-visit follow-ups",
    notes: isAr ? "ملاحظات" : "Clinical notes",
    drug: isAr ? "الدواء" : "Medication",
    dose: isAr ? "الجرعة" : "Dose",
    period: isAr ? "المدة" : "Duration",
    route: isAr ? "طريقة الإعطاء" : "Route",
    indication: isAr ? "الاستطباب" : "Indication",
    status: isAr ? "الحالة" : "Status",
  };

  const v = data.visit;
  const visitTypeLabel = VISIT_TYPE[v.visitType]?.[lang] ?? String(v.visitType);
  const outcomeLabel = OUTCOME[v.outcome]?.[lang] ?? String(v.outcome);

  const metaSection = section(
    isAr ? "تفاصيل الزيارة" : "Visit details",
    `
    ${fieldRow(L.date, fmtDateTime(v.visitDate))}
    ${fieldRow(L.doctor, v.doctorName)}
    ${fieldRow(L.type, visitTypeLabel)}
    ${fieldRow(L.outcome, outcomeLabel)}
    ${v.painLevel > 0 ? fieldRow(L.pain, `${v.painLevel} / 10`) : ""}
    `,
  );

  const subjectiveSection = (v.chiefComplaint || v.historyOfPresentIllness || v.pastMedicalHistory)
    ? section(
        isAr ? "الشخصي (S)" : "Subjective (S)",
        `
        ${v.chiefComplaint ? `<div style="margin-bottom:8px"><div class="field-label">${escHtml(L.cc)}</div>${prose(v.chiefComplaint)}</div>` : ""}
        ${v.historyOfPresentIllness ? `<div style="margin-bottom:8px"><div class="field-label">${escHtml(L.hpi)}</div>${prose(v.historyOfPresentIllness)}</div>` : ""}
        ${v.pastMedicalHistory ? `<div style="margin-bottom:8px"><div class="field-label">${escHtml(L.pmh)}</div>${prose(v.pastMedicalHistory)}</div>` : ""}
        `,
      )
    : "";

  const assessmentSection = v.diagnoses.length > 0
    ? section(
        L.soap_a,
        `<table>
          <thead><tr><th>${isAr ? "التشخيص" : "Diagnosis"}</th><th>${L.status}</th></tr></thead>
          <tbody>
            ${v.diagnoses.map((d) => `
              <tr>
                <td>${escHtml(d.conditionName)}${d.comments ? `<br><small style="color:#5b6679">${escHtml(d.comments)}</small>` : ""}</td>
                <td>${d.conditionStatus ? `<span class="pill pill-active">${escHtml(d.conditionStatus)}</span>` : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const prescriptionSection = v.prescriptions.length > 0
    ? section(
        L.prescriptions,
        `<table>
          <thead>
            <tr>
              <th>${L.drug}</th>
              <th>${L.dose}</th>
              <th>${L.period}</th>
              <th>${L.route}</th>
            </tr>
          </thead>
          <tbody>
            ${v.prescriptions.map((rx) => `
              <tr>
                <td>
                  <strong>${escHtml(rx.medicineName)}</strong>
                  ${rx.scientificName ? `<br><small style="color:#5b6679;font-style:italic">${escHtml(rx.scientificName)}</small>` : ""}
                  ${rx.indication ? `<br><small style="color:#5b6679">${escHtml(rx.indication)}</small>` : ""}
                </td>
                <td>
                  ${rx.dose ? escHtml(rx.dose) : "—"}
                  ${rx.frequency ? `<br><small>${rx.frequency} ${escHtml(rx.frequencyUnit ?? "")}</small>` : ""}
                </td>
                <td>${rx.period ? escHtml(rx.period) : "—"}</td>
                <td>${rx.route ? escHtml(rx.route) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const planSection = (v.notes || v.recommendations || v.disposition)
    ? section(
        L.soap_p,
        `
        ${v.notes ? `<div style="margin-bottom:8px"><div class="field-label">${escHtml(L.notes)}</div>${prose(v.notes)}</div>` : ""}
        ${v.recommendations ? `<div style="margin-bottom:8px"><div class="field-label">${isAr ? "التوصيات" : "Recommendations"}</div>${prose(v.recommendations)}</div>` : ""}
        ${v.disposition ? `<div><div class="field-label">${isAr ? "التصرف" : "Disposition"}</div>${prose(v.disposition)}</div>` : ""}
        `,
      )
    : "";

  const followupSection = v.afterVisitRecommendations.length > 0
    ? section(
        L.followups,
        `<ul style="padding-inline-start:1.2em;margin:0">
          ${v.afterVisitRecommendations.map((r) => `
            <li style="margin-bottom:4px;${r.isDone ? "text-decoration:line-through;color:#8b95a8" : ""}">
              ${escHtml(r.recommended)}
            </li>
          `).join("")}
        </ul>`,
      )
    : "";

  const body = `
    ${renderHeader(data.hcenter, L.title, lang, fmtDateTime(v.visitDate))}
    ${renderPatient(data.patient, lang)}
    ${metaSection}
    ${subjectiveSection}
    ${assessmentSection}
    ${prescriptionSection}
    ${planSection}
    ${followupSection}
    ${renderFooter(lang)}
  `;

  return wrapHtml(`${L.title} — ${data.patient.fullName}`, lang, body);
}
