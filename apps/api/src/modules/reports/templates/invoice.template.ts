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

export interface InvoiceReportData {
  hcenter: HCenterHeader;
  patient: PatientBlock;
  invoice: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    paidByPatient: number;
    discount: number;
    coveredByHealthInsurance: number | null;
    coveredByHospital: number | null;
    finalBalance: number;
    totalCharged: number;
  };
  records: Array<{ details: string; categoryName: string; expense: number }>;
}

const fmt = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function renderInvoice(data: InvoiceReportData, lang: Lang): string {
  const isAr = lang === "ar";
  const title = isAr ? "فاتورة" : "Invoice";
  const inv = data.invoice;

  const chargesTable = section(
    isAr ? "تفاصيل الرسوم" : "Charges",
    `<table>
      <thead><tr>
        <th>${isAr ? "الخدمة" : "Service"}</th>
        <th style="text-align:${isAr ? "left" : "right"}">${isAr ? "المبلغ" : "Amount"}</th>
      </tr></thead>
      <tbody>
        ${data.records.map((r) => `
          <tr>
            <td>${escHtml(r.details || r.categoryName)}</td>
            <td style="text-align:${isAr ? "left" : "right"};font-variant-numeric:tabular-nums">${fmt(r.expense)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`,
  );

  const summaryRows = [
    { label: isAr ? "الإجمالي" : "Subtotal", value: fmt(inv.totalCharged), bold: false },
    ...(inv.discount > 0 ? [{ label: isAr ? "الخصم" : "Discount", value: `(${fmt(inv.discount)})`, bold: false }] : []),
    ...(inv.coveredByHealthInsurance ? [{ label: isAr ? "تغطية التأمين" : "Insurance coverage", value: `(${fmt(inv.coveredByHealthInsurance)})`, bold: false }] : []),
    ...(inv.coveredByHospital ? [{ label: isAr ? "تغطية المستشفى" : "Hospital coverage", value: `(${fmt(inv.coveredByHospital)})`, bold: false }] : []),
    { label: isAr ? "المدفوع من المريض" : "Paid by patient", value: fmt(inv.paidByPatient), bold: false },
    { label: isAr ? "الرصيد المتبقي" : "Balance due", value: fmt(inv.finalBalance), bold: true },
  ];

  const summaryTable = `
    <div style="display:flex;justify-content:flex-end;margin-top:12px">
      <table style="width:auto;min-width:280px;font-size:0.875rem">
        ${summaryRows.map((r) => `
          <tr style="${r.bold ? "border-top:1px solid #0b1220;font-weight:600;font-size:0.95rem" : ""}">
            <td style="padding:5px 16px 5px 0;color:${r.bold ? "#0b1220" : "#5b6679"}">${r.label}</td>
            <td style="text-align:${isAr ? "left" : "right"};font-variant-numeric:tabular-nums;color:${r.bold && inv.finalBalance > 0 ? "#a76a0c" : "#0b1220"}">${r.value}</td>
          </tr>
        `).join("")}
      </table>
    </div>`;

  const body = `
    ${renderHeader(data.hcenter, title, lang, fmtDateTime(inv.invoiceDate))}
    <div style="margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap">
      <div>
        <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#5b6679">${isAr ? "رقم الفاتورة" : "Invoice No."}</div>
        <div style="font-size:1rem;font-weight:700;color:#155dfc;font-family:monospace">${escHtml(inv.invoiceNumber)}</div>
      </div>
      <div>
        <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#5b6679">${isAr ? "التاريخ" : "Date"}</div>
        <div style="font-size:0.875rem;font-weight:500">${fmtDate(inv.invoiceDate)}</div>
      </div>
    </div>
    ${renderPatient(data.patient, lang)}
    ${chargesTable}
    ${summaryTable}
    ${renderFooter(lang)}
  `;

  return wrapHtml(`${title} ${inv.invoiceNumber} — ${data.patient.fullName}`, lang, body);
}
