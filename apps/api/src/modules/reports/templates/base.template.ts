import { toDisplayText } from "../../../common/rtf";

export interface HCenterHeader {
  name: string;
  nameRep: string | null;
  reportAddress: string | null;
  phone: string | null;
  reportsWorkingTimes: string | null;
}

export interface PatientBlock {
  fullName: string;
  fullNameAr: string | null;
  nationalId: string;
  dateOfBirth: string | null;
  sex: number;
  mobileNumber: string | null;
}

export type Lang = "en" | "ar";

export function baseStyles(lang: Lang): string {
  const isAr = lang === "ar";
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { font-size: 14px; }

    body {
      font-family: ${isAr ? "'IBM Plex Sans Arabic', 'Inter'" : "'Inter'"}, system-ui, sans-serif;
      direction: ${isAr ? "rtl" : "ltr"};
      color: #1a2332;
      background: #fff;
      line-height: 1.55;
      padding: 24px 32px;
      max-width: 860px;
      margin: 0 auto;
    }

    /* ── Typography ─────────────────────────────── */
    h1 { font-size: 1.45rem; font-weight: 600; color: #0b1220; }
    h2 { font-size: 1rem; font-weight: 600; color: #0b1220; margin-bottom: 8px; }
    h3 { font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #5b6679; margin-bottom: 6px; }

    /* ── Report header ──────────────────────────── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #155dfc;
      margin-bottom: 20px;
    }
    .report-header .clinic-name { font-size: 1.1rem; font-weight: 700; color: #155dfc; }
    .report-header .clinic-meta { font-size: 0.8rem; color: #5b6679; margin-top: 3px; line-height: 1.6; }
    .report-header .report-meta { text-align: ${isAr ? "left" : "right"}; font-size: 0.8rem; color: #5b6679; }
    .report-header .report-title { font-size: 1rem; font-weight: 600; color: #0b1220; }

    /* ── Patient block ──────────────────────────── */
    .patient-block {
      background: #f0f5fe;
      border: 1px solid #c4d6fe;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .patient-block .pt-name { font-size: 1.05rem; font-weight: 600; flex: 1 1 200px; }
    .patient-block .pt-name small { display: block; font-size: 0.8rem; font-weight: 400; color: #5b6679; margin-top: 1px; }
    .patient-field { font-size: 0.82rem; color: #283344; }
    .patient-field strong { font-weight: 500; color: #5b6679; font-size: 0.78rem; display: block; text-transform: uppercase; letter-spacing: .04em; }

    /* ── Sections ───────────────────────────────── */
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #155dfc;
      border-bottom: 1px solid #c4d6fe;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .field-row { display: flex; gap: 8px; margin-bottom: 5px; }
    .field-label { font-size: 0.78rem; font-weight: 500; color: #5b6679; min-width: 140px; flex-shrink: 0; }
    .field-value { font-size: 0.875rem; color: #0b1220; }
    .field-prose { font-size: 0.875rem; color: #0b1220; line-height: 1.65; white-space: pre-wrap; }

    /* ── Tables ─────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th {
      background: #eef2f8;
      font-weight: 600;
      text-align: ${isAr ? "right" : "left"};
      padding: 7px 10px;
      border-bottom: 1px solid #dfe5ee;
      color: #5b6679;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    td { padding: 7px 10px; border-bottom: 1px dashed #dfe5ee; vertical-align: top; }
    tr:last-child td { border-bottom: none; }

    /* ── Pills / badges ─────────────────────────── */
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .pill-active { background: #dcf2e4; color: #0f7a4d; }
    .pill-resolved { background: #e4eaf3; color: #5b6679; }
    .pill-alert { background: #fadcd9; color: #b3261e; }
    .pill-info { background: #e2ebfe; color: #155dfc; }

    /* ── Footer ─────────────────────────────────── */
    .report-footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #dfe5ee;
      font-size: 0.75rem;
      color: #8b95a8;
      display: flex;
      justify-content: space-between;
    }

    /* ── Print styles ───────────────────────────── */
    @media print {
      @page { margin: 16mm 20mm; size: A4; }
      body { padding: 0; }
      .no-print { display: none !important; }
      .section { page-break-inside: avoid; }
      a { text-decoration: none; color: inherit; }
    }

    /* ── Print button ───────────────────────────── */
    .print-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 20px;
    }
    .btn-print {
      background: #155dfc;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-print:hover { background: #1251dd; }
  `;
}

export function wrapHtml(
  title: string,
  lang: Lang,
  body: string,
  autoPrint = false,
): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)}</title>
  <style>${baseStyles(lang)}</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">
      ${lang === "ar" ? "طباعة" : "Print / Save as PDF"}
    </button>
  </div>
  ${body}
  ${autoPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),600))</script>` : ""}
</body>
</html>`;
}

export function renderHeader(
  hcenter: HCenterHeader,
  reportTitle: string,
  lang: Lang,
  generatedDate: string,
): string {
  const isAr = lang === "ar";
  const name = isAr && hcenter.nameRep ? hcenter.nameRep : hcenter.name;
  return `
  <header class="report-header">
    <div>
      <div class="clinic-name">${escHtml(name)}</div>
      <div class="clinic-meta">
        ${hcenter.reportAddress ? escHtml(hcenter.reportAddress) + "<br>" : ""}
        ${hcenter.phone ? escHtml(hcenter.phone) + "<br>" : ""}
        ${hcenter.reportsWorkingTimes ? escHtml(hcenter.reportsWorkingTimes) : ""}
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">${escHtml(reportTitle)}</div>
      <div>${generatedDate}</div>
    </div>
  </header>`;
}

export function renderPatient(p: PatientBlock, lang: Lang): string {
  const isAr = lang === "ar";
  const labels = isAr
    ? { id: "رقم الهوية", dob: "تاريخ الميلاد", sex: "الجنس", phone: "الهاتف" }
    : { id: "National ID", dob: "Date of birth", sex: "Sex", phone: "Phone" };

  const sexLabel = (s: number): string => {
    if (isAr) return s === 1 ? "ذكر" : s === 2 ? "أنثى" : "—";
    return s === 1 ? "Male" : s === 2 ? "Female" : "—";
  };

  const nameDisplay = isAr && p.fullNameAr ? p.fullNameAr : p.fullName;
  const altName = isAr ? p.fullName : p.fullNameAr;

  return `
  <div class="patient-block">
    <div class="pt-name">
      ${escHtml(nameDisplay)}
      ${altName ? `<small dir="${isAr ? "ltr" : "rtl"}">${escHtml(altName)}</small>` : ""}
    </div>
    <div class="patient-field">
      <strong>${labels.id}</strong>${escHtml(p.nationalId)}
    </div>
    ${p.dateOfBirth ? `<div class="patient-field"><strong>${labels.dob}</strong>${escHtml(fmtDate(p.dateOfBirth))}</div>` : ""}
    <div class="patient-field">
      <strong>${labels.sex}</strong>${sexLabel(p.sex)}
    </div>
    ${p.mobileNumber ? `<div class="patient-field"><strong>${labels.phone}</strong>${escHtml(p.mobileNumber)}</div>` : ""}
  </div>`;
}

export function renderFooter(lang: Lang): string {
  const isAr = lang === "ar";
  return `
  <footer class="report-footer">
    <span>${isAr ? "تم الإنشاء بواسطة Teriac" : "Generated by Teriac"}</span>
    <span class="no-print">${new Date().toLocaleString()}</span>
  </footer>`;
}

export function section(title: string, content: string): string {
  return `<div class="section"><div class="section-title">${escHtml(title)}</div>${content}</div>`;
}

export function prose(text: string | null | undefined): string {
  // Legacy fields may be RTF documents — strip them to plain text first.
  const plain = toDisplayText(text);
  if (!plain) return `<span style="color:#8b95a8">—</span>`;
  return `<p class="field-prose">${escHtml(plain)}</p>`;
}

export function fieldRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div class="field-row"><span class="field-label">${escHtml(label)}</span><span class="field-value">${escHtml(value)}</span></div>`;
}

export function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
