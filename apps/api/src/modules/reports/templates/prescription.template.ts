import {
  escHtml,
  fmtDate,
  fmtDateTime,
  renderFooter,
  renderHeader,
  renderPatient,
  section,
  wrapHtml,
  type HCenterHeader,
  type Lang,
  type PatientBlock,
} from "./base.template";
import { toDisplayText } from "../../../common/rtf";

export interface PrescriptionReportData {
  hcenter: HCenterHeader;
  patient: PatientBlock;
  visitDate: string;
  doctorName: string;
  prescriptions: Array<{
    medicineName: string;
    scientificName: string | null;
    dose: string | null;
    period: string | null;
    frequency: number | null;
    frequencyUnit: string | null;
    quantityNumber: string | null;
    quantityForm: string | null;
    route: string | null;
    indication: string | null;
    notes: string | null;
  }>;
}

export function renderPrescription(data: PrescriptionReportData, lang: Lang): string {
  const isAr = lang === "ar";
  const title = isAr ? "وصفة طبية" : "Prescription";

  if (data.prescriptions.length === 0) {
    return wrapHtml(title, lang, `
      ${renderHeader(data.hcenter, title, lang, fmtDateTime(data.visitDate))}
      ${renderPatient(data.patient, lang)}
      <p style="color:#8b95a8;text-align:center;padding:40px 0">
        ${isAr ? "لا توجد أدوية مسجلة لهذه الزيارة." : "No medications recorded for this visit."}
      </p>
      ${renderFooter(lang)}
    `);
  }

  const rows = data.prescriptions.map((rx, i) => `
    <div style="border:1px solid #dfe5ee;border-radius:8px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px">
        <span style="font-size:0.7rem;font-weight:600;color:#155dfc;background:#e2ebfe;border-radius:999px;padding:2px 8px">${i + 1}</span>
        <strong style="font-size:0.95rem">${escHtml(rx.medicineName)}</strong>
        ${rx.scientificName ? `<span style="font-size:0.8rem;color:#5b6679;font-style:italic">(${escHtml(rx.scientificName)})</span>` : ""}
      </div>
      <table style="width:auto;font-size:0.82rem">
        ${rx.dose || rx.frequency ? `
          <tr>
            <td style="padding:2px 12px 2px 0;color:#5b6679;font-weight:500">${isAr ? "الجرعة" : "Dose"}</td>
            <td style="padding:2px 0">${rx.dose ? escHtml(rx.dose) : ""}${rx.frequency ? ` · ${rx.frequency} ${escHtml(rx.frequencyUnit ?? "")}` : ""}</td>
          </tr>` : ""}
        ${rx.period ? `
          <tr>
            <td style="padding:2px 12px 2px 0;color:#5b6679;font-weight:500">${isAr ? "المدة" : "Duration"}</td>
            <td style="padding:2px 0">${escHtml(rx.period)}</td>
          </tr>` : ""}
        ${rx.quantityNumber ? `
          <tr>
            <td style="padding:2px 12px 2px 0;color:#5b6679;font-weight:500">${isAr ? "الكمية" : "Quantity"}</td>
            <td style="padding:2px 0">${escHtml(rx.quantityNumber)} ${rx.quantityForm ? escHtml(rx.quantityForm) : ""}</td>
          </tr>` : ""}
        ${rx.route ? `
          <tr>
            <td style="padding:2px 12px 2px 0;color:#5b6679;font-weight:500">${isAr ? "طريقة الإعطاء" : "Route"}</td>
            <td style="padding:2px 0">${escHtml(rx.route)}</td>
          </tr>` : ""}
        ${rx.indication ? `
          <tr>
            <td style="padding:2px 12px 2px 0;color:#5b6679;font-weight:500">${isAr ? "لعلاج" : "For"}</td>
            <td style="padding:2px 0">${escHtml(rx.indication)}</td>
          </tr>` : ""}
      </table>
      ${(() => {
        const n = toDisplayText(rx.notes);
        return n ? `<p style="font-size:0.8rem;color:#283344;margin-top:6px;font-style:italic">${escHtml(n)}</p>` : "";
      })()}
    </div>
  `).join("");

  const body = `
    ${renderHeader(data.hcenter, title, lang, fmtDateTime(data.visitDate))}
    ${renderPatient(data.patient, lang)}
    ${section(isAr ? "الأدوية الموصوفة" : "Prescribed medications", rows)}
    <div style="margin-top:32px;display:flex;justify-content:flex-end">
      <div style="text-align:center;min-width:160px">
        <div style="border-top:1px solid #0b1220;padding-top:6px;font-size:0.78rem;color:#5b6679">
          ${isAr ? "توقيع الطبيب" : "Doctor signature"}
          <div style="margin-top:2px;font-weight:500;color:#0b1220">${escHtml(data.doctorName)}</div>
          <div style="font-size:0.72rem">${fmtDate(data.visitDate)}</div>
        </div>
      </div>
    </div>
    ${renderFooter(lang)}
  `;

  return wrapHtml(`${title} — ${data.patient.fullName}`, lang, body);
}
