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

export interface PatientSummaryData {
  hcenter: HCenterHeader;
  patient: PatientBlock & { address?: string | null; religion?: string | null };
  allergies: Array<{ conditionName: string; severity: number | null; reaction: string | null }>;
  chronicDiseases: Array<{ conditionName: string; yearDiagnosed: number | null }>;
  longTermMedications: Array<{ medicineName: string; dose: string | null; indication: string | null }>;
  problems: Array<{ problemText: string; problemCategory: number; isActive: boolean }>;
  recentVisits: Array<{
    visitDate: string;
    doctorName: string;
    visitType: number;
    outcome: number;
    chiefComplaint: string | null;
  }>;
}

const SEV_LABEL: Record<number, string> = { 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Anaphylactic" };
const SEV_LABEL_AR: Record<number, string> = { 1: "خفيف", 2: "متوسط", 3: "شديد", 4: "صدمة تحسسية" };
const VISIT_TYPE: Record<number, Record<Lang, string>> = {
  1: { en: "New", ar: "جديد" }, 2: { en: "Follow-up", ar: "متابعة" },
  3: { en: "Emergency", ar: "طارئ" }, 4: { en: "Routine", ar: "روتيني" }, 5: { en: "Walk-in", ar: "بدون موعد" },
};
const OUTCOME: Record<number, Record<Lang, string>> = {
  0: { en: "Open", ar: "مفتوح" }, 1: { en: "Resolved", ar: "محلول" },
  2: { en: "Referred", ar: "محال" }, 3: { en: "Failed", ar: "فشل" },
  4: { en: "Cancelled", ar: "ملغى" }, 5: { en: "No-show", ar: "لم يحضر" },
};

export function renderPatientSummary(data: PatientSummaryData, lang: Lang): string {
  const isAr = lang === "ar";
  const title = isAr ? "ملخص المريض" : "Patient Summary";

  const allergySection = data.allergies.length > 0
    ? section(
        isAr ? "الحساسية" : "Allergies",
        `<table>
          <thead><tr>
            <th>${isAr ? "المادة" : "Allergen"}</th>
            <th>${isAr ? "الشدة" : "Severity"}</th>
            <th>${isAr ? "التفاعل" : "Reaction"}</th>
          </tr></thead>
          <tbody>
            ${data.allergies.map((a) => `
              <tr>
                <td>${escHtml(a.conditionName)}</td>
                <td>
                  ${a.severity
                    ? `<span class="pill ${a.severity >= 3 ? "pill-alert" : "pill-info"}">${escHtml(isAr ? SEV_LABEL_AR[a.severity] ?? "" : SEV_LABEL[a.severity] ?? "")}</span>`
                    : "—"}
                </td>
                <td>${a.reaction ? escHtml(a.reaction) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const chronicSection = data.chronicDiseases.length > 0
    ? section(
        isAr ? "الأمراض المزمنة" : "Chronic diseases",
        `<table>
          <thead><tr>
            <th>${isAr ? "الحالة" : "Condition"}</th>
            <th>${isAr ? "سنة التشخيص" : "Year diagnosed"}</th>
          </tr></thead>
          <tbody>
            ${data.chronicDiseases.map((c) => `
              <tr>
                <td>${escHtml(c.conditionName)}</td>
                <td>${c.yearDiagnosed ?? "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const medicationsSection = data.longTermMedications.length > 0
    ? section(
        isAr ? "الأدوية طويلة الأمد" : "Long-term medications",
        `<table>
          <thead><tr>
            <th>${isAr ? "الدواء" : "Medication"}</th>
            <th>${isAr ? "الجرعة" : "Dose"}</th>
            <th>${isAr ? "السبب" : "Indication"}</th>
          </tr></thead>
          <tbody>
            ${data.longTermMedications.map((m) => `
              <tr>
                <td>${escHtml(m.medicineName)}</td>
                <td>${m.dose ? escHtml(m.dose) : "—"}</td>
                <td>${m.indication ? escHtml(m.indication) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const problemsSection = data.problems.length > 0
    ? section(
        isAr ? "قائمة المشاكل" : "Problem list",
        `<ul style="padding-inline-start:1.2em;margin:0;font-size:0.875rem">
          ${data.problems.map((p) => `
            <li style="margin-bottom:5px;${p.problemCategory === 2 ? "text-decoration:line-through;color:#8b95a8" : ""}">
              ${escHtml(p.problemText)}
              ${p.isActive ? `<span class="pill pill-active" style="margin-inline-start:6px">${isAr ? "نشط" : "Active"}</span>` : ""}
            </li>
          `).join("")}
        </ul>`,
      )
    : "";

  const visitsSection = data.recentVisits.length > 0
    ? section(
        isAr ? "الزيارات الأخيرة" : "Recent visits",
        `<table>
          <thead><tr>
            <th>${isAr ? "التاريخ" : "Date"}</th>
            <th>${isAr ? "الطبيب" : "Doctor"}</th>
            <th>${isAr ? "النوع" : "Type"}</th>
            <th>${isAr ? "الشكوى" : "Chief complaint"}</th>
            <th>${isAr ? "النتيجة" : "Outcome"}</th>
          </tr></thead>
          <tbody>
            ${data.recentVisits.map((v) => `
              <tr>
                <td style="white-space:nowrap">${escHtml(fmtDate(v.visitDate))}</td>
                <td>${escHtml(v.doctorName)}</td>
                <td>${escHtml(VISIT_TYPE[v.visitType]?.[lang] ?? "")}</td>
                <td>${(() => {
                  const cc = toDisplayText(v.chiefComplaint);
                  if (!cc) return "—";
                  return escHtml(cc.substring(0, 60)) + (cc.length > 60 ? "…" : "");
                })()}</td>
                <td><span class="pill ${v.outcome === 1 ? "pill-resolved" : "pill-info"}">${escHtml(OUTCOME[v.outcome]?.[lang] ?? "")}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>`,
      )
    : "";

  const noData = !allergySection && !chronicSection && !medicationsSection && !problemsSection && !visitsSection;

  const body = `
    ${renderHeader(data.hcenter, title, lang, fmtDateTime(new Date().toISOString()))}
    ${renderPatient(data.patient, lang)}
    ${allergySection || `<div style="background:#fadcd9;border:1px solid #b3261e33;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:0.82rem;color:#b3261e">
      ${isAr ? "⚠ لا توجد حساسية مسجلة" : "⚠ No allergies on record"}
    </div>`}
    ${chronicSection}
    ${medicationsSection}
    ${problemsSection}
    ${visitsSection}
    ${noData ? `<p style="color:#8b95a8;text-align:center;padding:32px 0">${isAr ? "لا توجد بيانات سريرية مسجلة." : "No clinical data on record."}</p>` : ""}
    ${renderFooter(lang)}
  `;

  return wrapHtml(`${title} — ${data.patient.fullName}`, lang, body);
}
