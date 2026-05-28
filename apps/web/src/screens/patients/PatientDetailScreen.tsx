import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useAuth, useModuleEnabled } from "../../lib/auth/store";
import { useFieldRules } from "../../lib/field-rules";
import { api } from "../../lib/api/client";
import { getPatient, createNote, deleteNote, listInsurance, type PatientDetail } from "./api";
import { listPatientInvoices } from "../visits/billing-api";
import { listAllergies, type AllergyListItem } from "./history-api";
import { formatDateLong, sexLabel } from "../../lib/format";
import { toDisplayText } from "../../lib/rtf";
import { PatientAllergiesCard } from "./PatientAllergiesCard";
import { PatientChronicDiseasesCard } from "./PatientChronicDiseasesCard";
import { PatientLongTermMedicationsCard } from "./PatientLongTermMedicationsCard";
import { PatientProblemsCard } from "./PatientProblemsCard";
import { PatientFamilyHistoryCard } from "./PatientFamilyHistoryCard";
import { PatientImmunizationsCard } from "./PatientImmunizationsCard";
import { PatientLabRequestsCard } from "./PatientLabRequestsCard";
import { PatientInsuranceCard } from "./PatientInsuranceCard";
import { PatientSubstanceUseCard } from "./PatientSubstanceUseCard";
import { PatientEchoCard } from "./PatientEchoCard";
import { PatientBillingCard } from "./PatientBillingCard";
import { PatientFilesTab } from "./PatientFilesTab";
import { VitalsTrendsCard } from "./VitalsTrendsCard";
import { EditPatientModal } from "./EditPatientModal";
import { NewVisitModal } from "../visits/NewVisitModal";
import { ConfirmModal } from "../../components/ConfirmModal";

type TabId = "overview" | "history" | "personal" | "tests" | "files";

const TAB_IDS: ReadonlyArray<TabId> = ["overview", "history", "personal", "tests", "files"];
const isTabId = (v: string | null): v is TabId =>
  v !== null && (TAB_IDS as ReadonlyArray<string>).includes(v);

export function PatientDetailScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [creatingVisit, setCreatingVisit] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "overview";
  const setActiveTab = (next: TabId): void => {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  // Jump from a header pill (or anywhere else) straight to a card on the
  // right tab. Queues the scroll so it fires *after* the tab content has
  // mounted into the DOM. Briefly highlights the target card so the user's
  // eye can re-orient.
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const jumpToCard = (tab: TabId, anchor: string): void => {
    if (activeTab !== tab) setActiveTab(tab);
    setPendingScroll(anchor);
  };
  useEffect(() => {
    if (!pendingScroll) return;
    // Defer to the next frame so the new tab's cards are in the DOM.
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(pendingScroll);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 1500);
      }
      setPendingScroll(null);
    });
    return () => cancelAnimationFrame(id);
  }, [pendingScroll, activeTab]);

  const query = useQuery({
    queryKey: ["patients", "detail", id],
    queryFn: ({ signal }) => getPatient(id!, signal),
    enabled: !!id,
    staleTime: 30_000,
  });

  // Browser tab title: patient's name + clinic suffix.
  const { hcenter } = useAuth();
  const clinicSuffix = hcenter?.hcenterName?.trim() || "Teriac";
  const patientName =
    query.data?.fullName?.trim() ||
    query.data?.fullNameAr?.trim() ||
    t("patients.title_detail", { defaultValue: "Patient" });
  useDocumentTitle(`${patientName} - ${clinicSuffix}`);

  const cardiologyOn = useModuleEnabled("cardiology");

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error)
    return (
      <DetailError
        message={(query.error as Error).message}
        onBack={() => navigate("/patients")}
      />
    );

  const p = query.data;
  if (!p) return <DetailSkeleton />;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: t("patients.tab_overview", { defaultValue: "Overview" }) },
    { id: "history", label: t("patients.tab_medical_history", { defaultValue: "Medical history" }) },
    { id: "personal", label: t("patients.tab_personal", { defaultValue: "Personal" }) },
    // Clinical tests tab currently contains only Echocardiogram (cardiology).
    // Hide when the module is disabled — re-add other tests here and update
    // this guard as more specialty endpoints land.
    ...(cardiologyOn
      ? ([{ id: "tests", label: t("patients.tab_tests", { defaultValue: "Clinical tests" }) }] as Array<{ id: TabId; label: string }>)
      : []),
    { id: "files", label: t("patients.tab_files", { defaultValue: "Files" }) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[13px] text-ink-3">
        <Link to="/patients" className="hover:text-ink underline-offset-4 hover:underline">
          {t("patients.title", { defaultValue: "Patients" })}
        </Link>
        <span>›</span>
        <span className="text-ink">{p.fullName || "—"}</span>
      </div>

      <PatientHeader
        p={p}
        onEdit={() => setEditing(true)}
        onNewVisit={() => setCreatingVisit(true)}
        onSchedule={() => navigate(`/schedule?patientId=${p.patientId}`)}
        onJumpTo={jumpToCard}
      />

      <ClinicalAlertsBanner patientId={p.patientId} summary={p.summary} />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("patients.title", { defaultValue: "Patients" })}
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-rule"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`patient-tab-${tab.id}`}
              id={`patient-tab-trigger-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 px-4 py-2.5 text-[13.5px] font-medium transition-colors duration-2",
                isActive
                  ? "border-b-[3px] border-primary text-ink"
                  : "border-b-[3px] border-transparent text-ink-3 hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id={`patient-tab-${activeTab}`}
        aria-labelledby={`patient-tab-trigger-${activeTab}`}
      >
        {activeTab === "overview" && <OverviewTab p={p} navigate={navigate} t={t} />}
        {activeTab === "history" && <HistoryTab patientId={p.patientId} />}
        {activeTab === "personal" && <PersonalTab p={p} t={t} />}
        {activeTab === "tests" && cardiologyOn && <TestsTab patientId={p.patientId} />}
        {activeTab === "files" && <PatientFilesTab patientId={p.patientId} />}
      </div>

      {/* Edit patient modal */}
      <EditPatientModal patient={p} open={editing} onClose={() => setEditing(false)} />

      {/* New visit modal */}
      <NewVisitModal
        open={creatingVisit}
        onClose={() => setCreatingVisit(false)}
        patient={{ patientId: p.patientId, fullName: p.fullName }}
      />
    </div>
  );
}

// ── Tab panels ───────────────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslation>["t"];
type Nav = ReturnType<typeof useNavigate>;

function OverviewTab({
  p,
  navigate,
  t,
}: {
  p: PatientDetail;
  navigate: Nav;
  t: TFn;
}): JSX.Element {
  const rules = useFieldRules("patient");
  const cardRules = useFieldRules("patient_card");
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
      {/* Main column — Recent visits, then Problems */}
      <div className="space-y-5">
        {!cardRules.isHidden("recent_visits") && (
          <section
            id="recent_visits"
            className="overflow-hidden rounded-lg border border-rule bg-card shadow-1"
          >
            <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-xl leading-7">
                  {cardRules.label(
                    "recent_visits",
                    t("patients.recent_visits", { defaultValue: "Recent visits" }),
                  )}
                </h2>
                {p.summary.visitCount > 0 && (
                  <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
                    {p.summary.visitCount}
                  </span>
                )}
              </div>
              <Link
                to={`/visits?patientId=${encodeURIComponent(p.patientId)}`}
                className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 no-underline hover:border-rule-2"
              >
                {t("patients.view_all_visits", { defaultValue: "View all" })}
              </Link>
            </header>
            {p.recentVisits.length === 0 ? (
              <EmptyCardBody text={t("patients.no_visits", { defaultValue: "No visits recorded." })} />
            ) : (
              <ul className="divide-y divide-dashed divide-rule">
                {p.recentVisits.map((v) => (
                  <li key={v.patientVisitId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/visits/${v.patientVisitId}`)}
                      className="block w-full px-5 py-3.5 text-start transition-colors duration-2 hover:bg-card-2 focus-visible:bg-primary-50 focus-visible:outline-none"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-[12px] tracking-wider text-ink-3 uppercase tnum">
                          {formatDateLong(v.visitDate)}
                        </div>
                        <OutcomeChip outcome={v.outcome} />
                      </div>
                      {v.chiefComplaint && (
                        <div className="mt-1.5 line-clamp-3 whitespace-pre-line text-[13.5px] leading-6 text-ink-2">
                          {toDisplayText(v.chiefComplaint)}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!cardRules.isHidden("problems") && (
          <PatientProblemsCard
            id="problems"
            patientId={p.patientId}
            title={cardRules.label("problems", "Problems")}
          />
        )}

        {!cardRules.isHidden("vitals_trends") && (
          <VitalsTrendsCard
            id="vitals_trends"
            patientId={p.patientId}
            title={cardRules.label("vitals_trends", "Vitals trends")}
          />
        )}
      </div>

      {/* Side column — Allergies > Billing > Substance use > Contact > Notes */}
      <div className="space-y-5">
        {!cardRules.isHidden("allergies") && (
          <PatientAllergiesCard
            id="allergies"
            patientId={p.patientId}
            title={cardRules.label("allergies", "Allergies")}
          />
        )}
        {!cardRules.isHidden("billing") && (
          <PatientBillingCard
            id="billing"
            patientId={p.patientId}
            title={cardRules.label("billing", "Billing")}
          />
        )}
        {!cardRules.isHidden("substance_use") && (
          <PatientSubstanceUseCard
            id="substance_use"
            patientId={p.patientId}
            title={cardRules.label("substance_use", "Substance use")}
          />
        )}
        {!cardRules.isHidden("contact") &&
          (!rules.isHidden("mobileNumber") || !rules.isHidden("email")) && (
            <Card
              id="contact"
              title={cardRules.label(
                "contact",
                t("patients.contact", { defaultValue: "Contact" }),
              )}
            >
              <dl className="grid grid-cols-1 gap-3 px-5 py-4">
                {!rules.isHidden("mobileNumber") && (
                  <Field
                    label={t("patients.phone", { defaultValue: "Phone" })}
                    value={p.mobileNumber}
                    mono
                  />
                )}
                {!rules.isHidden("email") && (
                  <Field label={t("patients.email", { defaultValue: "Email" })} value={p.email} />
                )}
              </dl>
            </Card>
          )}
        {!cardRules.isHidden("notes") && (
          <NotesCard
            id="notes"
            patientId={p.patientId}
            notes={p.specialNotes}
            title={cardRules.label("notes", "Notes")}
          />
        )}
      </div>
    </div>
  );
}

function HistoryTab({ patientId }: { patientId: string }): JSX.Element {
  const cardRules = useFieldRules("patient_card");
  return (
    <div className="space-y-5">
      {!cardRules.isHidden("chronic_diseases") && (
        <PatientChronicDiseasesCard
          id="chronic_diseases"
          patientId={patientId}
          title={cardRules.label("chronic_diseases", "Chronic diseases")}
        />
      )}
      {!cardRules.isHidden("long_term_medications") && (
        <PatientLongTermMedicationsCard
          id="long_term_medications"
          patientId={patientId}
          title={cardRules.label("long_term_medications", "Long-term medications")}
        />
      )}
      {!cardRules.isHidden("family_history") && (
        <PatientFamilyHistoryCard
          id="family_history"
          patientId={patientId}
          title={cardRules.label("family_history", "Family history")}
        />
      )}
      {!cardRules.isHidden("immunizations") && (
        <PatientImmunizationsCard
          id="immunizations"
          patientId={patientId}
          title={cardRules.label("immunizations", "Immunizations")}
        />
      )}
      {!cardRules.isHidden("lab_requests") && (
        <PatientLabRequestsCard
          id="lab_requests"
          patientId={patientId}
          title={cardRules.label("lab_requests", "Lab requests")}
        />
      )}
    </div>
  );
}

function PersonalTab({ p, t }: { p: PatientDetail; t: TFn }): JSX.Element {
  const rules = useFieldRules("patient");
  const cardRules = useFieldRules("patient_card");
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
      <div className="space-y-5">
        {!cardRules.isHidden("personal_info") && (
          <Card
            id="personal_info"
            title={cardRules.label(
              "personal_info",
              t("patients.demographics", { defaultValue: "Personal Information" }),
            )}
          >
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
              {!rules.isHidden("address") && (
                <Field label={t("patients.address", { defaultValue: "Address" })} value={p.address} />
              )}
              {!rules.isHidden("passportNumber") && (
                <Field
                  label={t("patients.passport", { defaultValue: "Passport" })}
                  value={p.passportNumber}
                  mono
                />
              )}
              <Field
                label={t("patients.occupation", { defaultValue: "Occupation" })}
                value={p.additionalInfo?.occupation ?? null}
              />
              <Field
                label={t("patients.organization", { defaultValue: "Organization" })}
                value={p.additionalInfo?.organization ?? null}
              />
              {!rules.isHidden("height") && (
                <Field
                  label={t("patients.height", { defaultValue: "Height" })}
                  value={p.height ? `${p.height} ${unitSuffix(p.whUnit, "len")}` : null}
                />
              )}
              {!rules.isHidden("weight") && (
                <Field
                  label={t("patients.weight", { defaultValue: "Weight" })}
                  value={p.weight ? `${p.weight} ${unitSuffix(p.whUnit, "mass")}` : null}
                />
              )}
            </dl>
          </Card>
        )}

        {!cardRules.isHidden("emergency_contact") &&
          (p.emergencyContact.name || p.emergencyContact.phoneNumber) && (
            <Card
              id="emergency_contact"
              title={cardRules.label(
                "emergency_contact",
                t("patients.emergency_contact", { defaultValue: "Emergency contact" }),
              )}
            >
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
                <Field
                  label={t("patients.contact_name", { defaultValue: "Name" })}
                  value={p.emergencyContact.name}
                />
                <Field
                  label={t("patients.relation", { defaultValue: "Relation" })}
                  value={p.emergencyContact.relation}
                />
                <Field
                  label={t("patients.phone", { defaultValue: "Phone" })}
                  value={p.emergencyContact.phoneNumber}
                  mono
                />
              </dl>
            </Card>
          )}
      </div>

      <div className="space-y-5">
        {!cardRules.isHidden("insurance") && (
          <PatientInsuranceCard
            id="insurance"
            patientId={p.patientId}
            title={cardRules.label("insurance", "Insurance")}
          />
        )}
      </div>
    </div>
  );
}

function TestsTab({ patientId }: { patientId: string }): JSX.Element {
  const cardRules = useFieldRules("patient_card");
  const cardiologyOn = useModuleEnabled("cardiology");
  return (
    <div className="space-y-5">
      {cardiologyOn && !cardRules.isHidden("echo") && (
        <PatientEchoCard
          id="echo"
          patientId={patientId}
          title={cardRules.label("echo", "Echocardiogram")}
        />
      )}
    </div>
  );
}

function PatientHeader({
  p,
  onEdit,
  onNewVisit,
  onSchedule,
  onJumpTo,
}: {
  p: PatientDetail;
  onEdit: () => void;
  onNewVisit: () => void;
  onSchedule: () => void;
  onJumpTo: (tab: TabId, anchor: string) => void;
}): JSX.Element {
  const rules = useFieldRules("patient");

  // Latest vitals — used for the BMI pill in the demographic strip. Shares the
  // queryKey with VitalsTrendsCard so they hit the cache, not the network.
  const vitalsQ = useQuery({
    queryKey: ["patients", "vitals-trend", p.patientId],
    queryFn: ({ signal }) =>
      api<Array<{ recordedAt: string; bmi: number | null }>>(
        `/patients/${encodeURIComponent(p.patientId)}/vitals`,
        { signal },
      ),
    staleTime: 60_000,
  });
  const latestBmi =
    [...(vitalsQ.data ?? [])]
      .reverse()
      .find((v) => v.bmi != null)?.bmi ?? null;

  // Active insurance — first active policy gets surfaced in the eyebrow.
  // Shares the queryKey with PatientInsuranceCard so we don't double-fetch.
  const insuranceQ = useQuery({
    queryKey: ["patients", "insurance", p.patientId],
    queryFn: ({ signal }) => listInsurance(p.patientId, signal),
    staleTime: 60_000,
    enabled: p.summary.activeInsuranceCount > 0,
  });
  const activeInsurance = (insuranceQ.data ?? []).find((i) => i.isActive) ?? null;

  // Outstanding balance across all invoices — drives the pill in the strip.
  // Shares the queryKey with PatientBillingCard so it loads at most once.
  const invoicesQ = useQuery({
    queryKey: ["patients", "invoices", p.patientId],
    queryFn: ({ signal }) => listPatientInvoices(p.patientId, signal),
    staleTime: 60_000,
  });
  const outstanding = (invoicesQ.data ?? []).reduce(
    (s, r) => s + (r.finalBalance > 0 ? r.finalBalance : 0),
    0,
  );

  const reportUrl = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1"}/reports/patient-summary/${p.patientId}`;
  const showId = !rules.isHidden("nationalId") && p.nationalId;
  const showPhone = !rules.isHidden("mobileNumber") && !!p.mobileNumber;

  return (
    <div className="relative overflow-hidden rounded-xl border border-rule bg-card shadow-1">
      {/* Inline-end radial wash — the signature decorative element per the
          design system. Stays even though the avatar is gone. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-[55%] opacity-70"
        style={{
          insetInlineEnd: 0,
          background:
            "radial-gradient(60% 80% at 100% 50%, var(--primary-100) 0%, transparent 70%)",
        }}
      />

      {/* Inline-start accent rail — quieter than an avatar, still anchors the
          card and reads as 'this is the patient identity panel'. */}
      <div
        aria-hidden
        className="absolute inset-y-0 w-[4px] bg-gradient-to-b from-primary to-primary-700"
        style={{ insetInlineStart: 0 }}
      />

      <div className="relative px-7 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Top identifier row: PATIENT · ID · phone · insurance */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
              <span>Patient</span>
              {showId && (
                <>
                  <span aria-hidden className="text-ink-4">·</span>
                  <span className="text-ink-2">{p.nationalId}</span>
                </>
              )}
              {showPhone && (
                <>
                  <span aria-hidden className="text-ink-4">·</span>
                  <a
                    href={`tel:${p.mobileNumber}`}
                    className="text-ink-2 normal-case tracking-normal no-underline hover:text-primary"
                  >
                    {p.mobileNumber}
                  </a>
                </>
              )}
              {activeInsurance && (
                <>
                  <span aria-hidden className="text-ink-4">·</span>
                  <button
                    type="button"
                    onClick={() => onJumpTo("personal", "insurance")}
                    title={
                      activeInsurance.insuranceLevel
                        ? `${activeInsurance.insuranceCompany} — ${activeInsurance.insuranceLevel}`
                        : activeInsurance.insuranceCompany
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-vital-bg px-2 py-0.5 text-vital-fg transition-colors hover:bg-vital-fg hover:text-white"
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    {activeInsurance.insuranceCompany}
                    {activeInsurance.coveragePercentage != null && (
                      <span className="tnum normal-case tracking-normal">
                        {activeInsurance.coveragePercentage}%
                      </span>
                    )}
                    {activeInsurance.insuranceCardNumber && (
                      <span className="opacity-70 normal-case tracking-normal">
                        · {activeInsurance.insuranceCardNumber}
                      </span>
                    )}
                    {p.summary.activeInsuranceCount > 1 && (
                      <span className="opacity-70 normal-case tracking-normal">
                        +{p.summary.activeInsuranceCount - 1}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Name */}
            <h1
              className="mt-1 break-words font-serif text-[34px] font-medium leading-tight tracking-tight text-ink"
              dir="auto"
            >
              {p.fullName || "—"}
            </h1>

            {/* Arabic name — italicised, smaller, RTL */}
            {p.fullNameAr && p.fullNameAr !== p.fullName && (
              <div className="mt-1 font-serif text-[16px] italic text-ink-3" dir="rtl">
                {p.fullNameAr}
              </div>
            )}
          </div>

          {/* Actions — right-aligned on desktop, wrap below on narrow screens. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onSchedule}
              title="Schedule an appointment for this patient"
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
            >
              Schedule
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 no-underline"
            >
              Print summary
            </a>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onNewVisit}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 active:translate-y-px"
            >
              + New visit
            </button>
          </div>
        </div>

        {/* Demographic strip — quick-glance clinical pills. */}
        <DemographicStrip
          p={p}
          latestBmi={latestBmi}
          outstanding={outstanding}
          onJumpTo={onJumpTo}
        />
      </div>
    </div>
  );
}

// ── Demographic strip ────────────────────────────────────────────────────────

function DemographicStrip({
  p,
  latestBmi,
  outstanding,
  onJumpTo,
}: {
  p: PatientDetail;
  latestBmi: number | null;
  outstanding: number;
  onJumpTo: (tab: TabId, anchor: string) => void;
}): JSX.Element {
  const age = p.age
    ? p.age.years >= 2
      ? `${p.age.years} yrs`
      : `${p.age.years * 12 + p.age.months} mo`
    : null;

  const bmiTone = (bmi: number): "ok" | "warn" | "alert" => {
    if (bmi < 18.5 || bmi >= 35) return "alert";
    if (bmi >= 25) return "warn";
    return "ok";
  };

  type Tone = "neutral" | "ok" | "warn" | "alert" | "info";
  type Item = {
    label: string;
    value: string | number;
    tone: Tone;
    /** When set, clicking the pill jumps to that card. */
    jump?: { tab: TabId; anchor: string };
  };

  const items: Item[] = [];
  if (age) items.push({ label: "Age", value: age, tone: "neutral" });
  if (p.sex) items.push({ label: "Sex", value: sexLabel(p.sex), tone: "neutral" });
  if (latestBmi != null)
    items.push({
      label: "BMI",
      value: latestBmi.toFixed(1),
      tone: bmiTone(latestBmi),
      jump: { tab: "overview", anchor: "vitals_trends" },
    });
  if (p.summary.allergyCount > 0)
    items.push({
      label: "Allergies",
      value: p.summary.allergyCount,
      tone: "alert",
      jump: { tab: "overview", anchor: "allergies" },
    });
  if (p.summary.chronicDiseaseCount > 0)
    items.push({
      label: "Chronic",
      value: p.summary.chronicDiseaseCount,
      tone: "warn",
      jump: { tab: "history", anchor: "chronic_diseases" },
    });
  if (p.summary.activeProblemCount > 0)
    items.push({
      label: "Active problems",
      value: p.summary.activeProblemCount,
      tone: "info",
      jump: { tab: "overview", anchor: "problems" },
    });
  if (p.summary.longTermMedicationCount > 0)
    items.push({
      label: "Long-term Rx",
      value: p.summary.longTermMedicationCount,
      tone: "info",
      jump: { tab: "history", anchor: "long_term_medications" },
    });
  if (outstanding > 0)
    items.push({
      label: "Outstanding",
      value: outstanding.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      tone: "warn",
      jump: { tab: "overview", anchor: "billing" },
    });

  if (items.length === 0) return <></>;

  const toneClass = (tone: Tone): string => {
    switch (tone) {
      case "alert":
        return "bg-alert-bg text-alert-fg";
      case "warn":
        return "bg-warn-bg text-warn-fg";
      case "ok":
        return "bg-vital-bg text-vital-fg";
      case "info":
        return "bg-primary-100 text-primary-700";
      default:
        return "bg-paper-3 text-ink-3";
    }
  };

  return (
    <div className="relative mt-4 flex flex-wrap gap-1.5">
      {items.map((it) => {
        const cls = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${toneClass(
          it.tone,
        )}`;
        const inner = (
          <>
            <span className="opacity-60">{it.label}</span>
            <span className="font-semibold">{it.value}</span>
          </>
        );
        if (!it.jump) {
          return (
            <span key={it.label} className={cls}>
              {inner}
            </span>
          );
        }
        return (
          <button
            key={it.label}
            type="button"
            onClick={() => onJumpTo(it.jump!.tab, it.jump!.anchor)}
            title={`Jump to ${it.label.toLowerCase()}`}
            className={`${cls} transition-opacity hover:opacity-80`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

// ── Clinical alerts banner ───────────────────────────────────────────────────

const ALERT_DISMISS_KEY = (patientId: string): string =>
  `teriac:patient-alert-dismissed:${patientId}`;

function ClinicalAlertsBanner({
  patientId,
  summary,
}: {
  patientId: string;
  summary: PatientDetail["summary"];
}): JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ALERT_DISMISS_KEY(patientId)) === "1";
    } catch {
      return false;
    }
  });

  // Pull severity from the allergy list — summary.allergyCount alone doesn't
  // tell us if any are severe/anaphylactic. Reuses the same queryKey as the
  // Allergies card to share the cache.
  const allergyQ = useQuery({
    queryKey: ["patients", "allergies", patientId],
    queryFn: ({ signal }) => listAllergies(patientId, signal),
    staleTime: 60_000,
    enabled: summary.allergyCount > 0,
  });

  const severeAllergies = (allergyQ.data ?? []).filter(
    (a: AllergyListItem) => (a.severity ?? 0) >= 3,
  );
  const hasCritical =
    severeAllergies.length > 0 ||
    summary.activeProblemCount > 0 ||
    summary.chronicDiseaseCount >= 3;

  if (!hasCritical || dismissed) return null;

  const allergyLabel = severeAllergies
    .slice(0, 3)
    .map((a: AllergyListItem) => a.conditionName)
    .join(", ");
  const extras = severeAllergies.length - 3;

  return (
    <div className="sticky top-0 z-20 -mx-px overflow-hidden rounded-lg border border-alert-fg/30 bg-alert-bg shadow-2">
      <div className="flex items-start gap-3 px-5 py-3 text-alert-fg">
        <span aria-hidden className="mt-0.5 font-mono text-[14px]">⚠</span>
        <div className="min-w-0 flex-1 text-[13.5px] leading-tight">
          <div className="font-medium">Clinical alerts</div>
          <ul className="mt-1 space-y-0.5 text-[12.5px] opacity-90">
            {severeAllergies.length > 0 && (
              <li>
                <span className="font-semibold">Severe allergies:</span>{" "}
                {allergyLabel}
                {extras > 0 && (
                  <span className="opacity-80"> +{extras} more</span>
                )}
              </li>
            )}
            {summary.chronicDiseaseCount >= 3 && (
              <li>
                <span className="font-semibold">
                  {summary.chronicDiseaseCount} chronic conditions
                </span>{" "}
                — review long-term meds before prescribing.
              </li>
            )}
            {summary.activeProblemCount > 0 && (
              <li>
                <a
                  href="#problems"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {summary.activeProblemCount} active problem
                  {summary.activeProblemCount === 1 ? "" : "s"}
                </a>{" "}
                — open the problem list.
              </li>
            )}
          </ul>
        </div>
        <button
          type="button"
          aria-label="Dismiss alerts for this session"
          onClick={() => {
            try {
              sessionStorage.setItem(ALERT_DISMISS_KEY(patientId), "1");
            } catch {
              /* sessionStorage may be unavailable in some embeds */
            }
            setDismissed(true);
          }}
          className="size-7 shrink-0 rounded-full text-alert-fg hover:bg-alert-fg/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  accent,
  id,
}: {
  title: ReactNode;
  children: ReactNode;
  accent?: "primary" | "warn" | "alert";
  id?: string;
}): JSX.Element {
  const railColor = accent === "warn" ? "bg-warn-fg" : accent === "alert" ? "bg-alert-fg" : null;
  return (
    <div id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {railColor && (
        <div className={`absolute inset-y-0 w-[3px] ${railColor}`} style={{ insetInlineStart: 0 }} />
      )}
      <header className="border-b border-rule px-5 py-3.5">
        <h2 className="font-serif text-xl leading-7">{title}</h2>
      </header>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: ReactNode;
  value: string | null | undefined;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-3">{label}</dt>
      <dd
        className={`mt-0.5 text-[13.5px] text-ink ${mono ? "font-mono" : ""}`}
        dir="auto"
      >
        {value && value.trim() !== "" ? value : "—"}
      </dd>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: number }): JSX.Element {
  const map: Record<number, { label: string; fg: string; bg: string }> = {
    0: { label: "Open", fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
    1: { label: "Resolved", fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
    2: { label: "Referred", fg: "var(--info-fg)", bg: "var(--info-bg)" },
    3: { label: "Failed", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
    4: { label: "Cancelled", fg: "var(--ink-3)", bg: "var(--rule)" },
    5: { label: "No show", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
  };
  const m = map[outcome] ?? { label: `Outcome ${outcome}`, fg: "var(--ink-3)", bg: "var(--rule)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider"
      style={{ background: m.bg, color: m.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: m.fg }} />
      {m.label}
    </span>
  );
}

function Dot(): JSX.Element {
  return (
    <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-4" />
  );
}

function EmptyCardBody({ text }: { text: string }): JSX.Element {
  return <div className="px-5 py-6 text-center text-[13px] text-ink-3">{text}</div>;
}

function DetailSkeleton(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="h-[160px] animate-pulse rounded-xl border border-rule bg-card shadow-1" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="h-64 animate-pulse rounded-lg border border-rule bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-rule bg-card" />
      </div>
    </div>
  );
}

function DetailError({ message, onBack }: { message: string; onBack: () => void }): JSX.Element {
  return (
    <div className="rounded-lg border border-rule bg-card p-12 text-center shadow-1">
      <div className="eyebrow mb-2">Error</div>
      <h2 className="font-serif text-2xl">{message}</h2>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
      >
        Back to patients
      </button>
    </div>
  );
}

function unitSuffix(whUnit: string | null, kind: "len" | "mass"): string {
  if (!whUnit) return kind === "len" ? "cm" : "kg";
  if (/inches?|feet|imperial|pounds?/i.test(whUnit)) return kind === "len" ? "in" : "lb";
  return kind === "len" ? "cm" : "kg";
}

// ---- Notes card with add + delete ----

function NotesCard({
  patientId,
  notes,
  title,
  id,
}: {
  patientId: string;
  notes: Array<{ patientSpecialNoteId: string; note: string }>;
  title?: ReactNode;
  id?: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    patientSpecialNoteId: string;
    note: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const addMutation = useMutation({
    mutationFn: () => createNote(patientId, noteText.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setNoteText("");
      setAdding(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNote(patientId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
      setDeleteTarget(null);
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addMutation.mutate();
  };

  const openAdding = () => {
    setAdding(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <>
      <div id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {notes.length > 0 && (
          <div
            aria-hidden
            className="absolute inset-y-0 w-[3px] bg-warn-fg"
            style={{ insetInlineStart: 0 }}
          />
        )}
        <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-xl leading-7">{title ?? "Notes"}</h2>
          {!adding && (
            <button
              type="button"
              onClick={openAdding}
              className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
            >
              + Add
            </button>
          )}
        </header>

        {notes.length === 0 && !adding ? (
          <div className="px-5 py-6 text-center text-[13px] text-ink-3">
            No notes recorded.
          </div>
        ) : (
          <ul className="px-5 py-3 space-y-2">
            {notes.map((n) => (
              <li
                key={n.patientSpecialNoteId}
                className="flex items-start gap-2 rounded-[10px] bg-warn-bg px-3 py-2"
              >
                <span className="flex-1 text-[13.5px] text-warn-fg" dir="auto">
                  {n.note}
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(n)}
                  aria-label="Delete note"
                  className="mt-0.5 shrink-0 rounded p-0.5 text-warn-fg/60 transition-colors duration-2 hover:bg-warn-fg/10 hover:text-alert-fg"
                >
                  <span aria-hidden className="text-base leading-none">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <form onSubmit={handleAdd} className="border-t border-rule px-5 py-4 space-y-2">
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter a note…"
              rows={3}
              dir="auto"
              className="w-full resize-y rounded-[10px] border border-rule bg-card-2 px-3 py-2 text-[13.5px] leading-6 outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
            {addMutation.error && (
              <div className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                {(addMutation.error as Error).message}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNoteText("");
                }}
                disabled={addMutation.isPending}
                className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMutation.isPending || !noteText.trim()}
                className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
              >
                {addMutation.isPending ? "Adding…" : "Add note"}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        destructive
        title="Delete note?"
        body={
          deleteTarget && (
            <>
              Permanently remove this note:{" "}
              <span className="block mt-1 rounded-[8px] bg-warn-bg px-2 py-1 text-[13px] text-warn-fg">
                {deleteTarget.note}
              </span>
              {deleteMutation.error && (
                <div className="mt-3 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                  {(deleteMutation.error as Error).message}
                </div>
              )}
            </>
          )
        }
        confirmLabel="Delete"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.patientSpecialNoteId);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
