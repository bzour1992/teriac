import { useState, type ReactNode } from "react";
import { useModuleEnabled } from "../../lib/auth/store";
import { PatientEchoCard } from "../patients/PatientEchoCard";
import { OutcomeMenu } from "./OutcomeMenu";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useAuth } from "../../lib/auth/store";
import { useFieldRules, type FieldRuleMap } from "../../lib/field-rules";
import {
  deleteDiagnosis,
  deletePrescription,
  getVisit,
  updateVisit,
  type VisitDetail,
  type VisitDiagnosis,
  type VisitPrescription,
} from "./api";
import { formatDateLong, sexLabel } from "../../lib/format";
import { toDisplayText } from "../../lib/rtf";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { EditVisitModal } from "./EditVisitModal";
import { EditSubjectiveModal } from "./EditSubjectiveModal";
import { PrescriptionFormModal } from "./PrescriptionFormModal";
import { DiagnosisFormModal } from "./DiagnosisFormModal";
import { ApiError } from "../../lib/api/client";
import { BillingCard } from "./BillingCard";
import { VitalsCard } from "./VitalsCard";
import { RevisitsCard } from "./RevisitsCard";
import { RecommendationsCard } from "./RecommendationsCard";
import { BodySystemReviewCard } from "./BodySystemReviewCard";
import { PhysicalExamCard } from "./PhysicalExamCard";

const VISIT_TYPE: Record<number, string> = {
  0: "Visit",
  1: "New",
  2: "Follow-up",
  3: "Emergency",
  4: "Routine",
  5: "Walk-in",
};

const INTENSITY: Record<number, string> = {
  0: "—",
  1: "Low",
  2: "Moderate",
  3: "High",
};

const OUTCOME: Record<number, { label: string; fg: string; bg: string }> = {
  0: { label: "Open", fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
  1: { label: "Resolved", fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
  2: { label: "Referred", fg: "var(--info-fg)", bg: "var(--info-bg)" },
  3: { label: "Failed", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
  4: { label: "Cancelled", fg: "var(--ink-3)", bg: "var(--rule)" },
  5: { label: "No show", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
};

export function VisitDetailScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openRx, setOpenRx] = useState<VisitPrescription | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingSubjective, setEditingSubjective] = useState(false);
  const [outcomeMenuOpen, setOutcomeMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs — Overview (default) + Clinical tests (gated by cardiology module).
  // URL-synced so refreshes / back-nav land on the same tab.
  const cardiologyOn = useModuleEnabled("cardiology");
  type TabId = "overview" | "tests";
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = tabParam === "tests" && cardiologyOn ? "tests" : "overview";
  const setActiveTab = (next: TabId): void => {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const [rxForm, setRxForm] = useState<{ mode: "add" } | { mode: "edit"; rx: VisitPrescription } | null>(null);
  const [confirmDeleteRx, setConfirmDeleteRx] = useState<VisitPrescription | null>(null);
  const [dxForm, setDxForm] = useState<{ mode: "add" } | { mode: "edit"; dx: VisitDiagnosis } | null>(null);
  const [confirmDeleteDx, setConfirmDeleteDx] = useState<VisitDiagnosis | null>(null);
  const queryClient = useQueryClient();
  const deleteRx = useMutation({
    mutationFn: ({ visitId, rxId }: { visitId: string; rxId: string }) =>
      deletePrescription(visitId, rxId),
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ["visits", "detail", id] });
      setConfirmDeleteRx(null);
      setOpenRx(null);
    },
  });
  const deleteDx = useMutation({
    mutationFn: ({ visitId, dxId }: { visitId: string; dxId: string }) =>
      deleteDiagnosis(visitId, dxId),
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ["visits", "detail", id] });
      setConfirmDeleteDx(null);
    },
  });
  const updateOutcome = useMutation({
    mutationFn: (next: number) => updateVisit(id!, { outcome: next }),
    onSuccess: (fresh) => {
      // Write the fresh visit straight into cache so the header re-renders
      // immediately without a network round-trip. Also nudge the patient
      // detail cache since its recent-visits list shows outcome.
      queryClient.setQueryData(["visits", "detail", id], fresh);
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", fresh.patient.patientId] });
      queryClient.invalidateQueries({ queryKey: ["visits", "list"] });
      setOutcomeMenuOpen(false);
    },
  });

  const query = useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: ({ signal }) => getVisit(id!, signal),
    enabled: !!id,
    staleTime: 30_000,
  });

  // Browser tab title: "Visit - Patient Name - Date - Clinic"
  const { hcenter } = useAuth();
  const clinicSuffix = hcenter?.hcenterName?.trim() || "Teriac";
  const visitLabel = t("visits.title_detail", { defaultValue: "Visit" });
  useDocumentTitle(
    query.data
      ? `${visitLabel} - ${
          query.data.patient.fullName?.trim() ||
          query.data.patient.fullNameAr?.trim() ||
          "—"
        } - ${formatDateLong(query.data.visitDate)} - ${clinicSuffix}`
      : `${visitLabel} - ${clinicSuffix}`,
  );

  const rules = useFieldRules("visit");
  const cardRules = useFieldRules("visit_card");

  if (query.isLoading) return <Skeleton />;
  if (query.error)
    return (
      <ErrorState
        message={(query.error as Error).message}
        onBack={() => navigate(-1)}
      />
    );

  const v = query.data;
  if (!v) return <Skeleton />;

  const outcome = OUTCOME[v.outcome] ?? {
    label: `Outcome ${v.outcome}`,
    fg: "var(--ink-3)",
    bg: "var(--rule)",
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
        <Link to="/patients" className="hover:text-ink underline-offset-4 hover:underline">
          {t("patients.title", { defaultValue: "Patients" })}
        </Link>
        <span>›</span>
        <Link
          to={`/patients/${v.patient.patientId}`}
          className="hover:text-ink underline-offset-4 hover:underline"
        >
          {v.patient.fullName || "—"}
        </Link>
        <span>›</span>
        <span className="text-ink tnum">{formatDateLong(v.visitDate)}</span>
      </div>

      {/* Header card */}
      <div className="relative overflow-hidden rounded-xl border border-rule bg-card px-7 py-6 shadow-1">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 size-72 rounded-full"
          style={{
            background: "radial-gradient(circle, var(--primary-100) 0%, transparent 60%)",
            insetInlineEnd: "-8rem",
          }}
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="eyebrow mb-1">
              {VISIT_TYPE[v.visitType] ?? "Visit"} · {INTENSITY[v.intensity]}
            </div>
            <h1 className="font-serif text-[32px] font-medium leading-[38px] tracking-tight">
              <a
                href={`/patients/${v.patient.patientId}`}
                target="_blank"
                rel="noreferrer"
                title="Open patient chart in a new tab"
                className="inline-flex items-baseline gap-2 text-ink no-underline underline-offset-4 hover:text-primary hover:underline"
                dir="auto"
              >
                <span className="truncate">{v.patient.fullName || "—"}</span>
                <ExternalLinkIcon />
              </a>
            </h1>
            {v.patient.fullNameAr && v.patient.fullNameAr !== v.patient.fullName && (
              <div className="mt-0.5 text-[15px] text-ink-3" style={{ fontSize: "0.65em" }} dir="rtl">
                {v.patient.fullNameAr}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
              <span className="font-mono text-[12px] uppercase tracking-wider">{v.patient.nationalId || "—"}</span>
              <Dot />
              <span>{sexLabel(v.patient.sex)}</span>
              <Dot />
              <span className="tnum">{formatDateLong(v.visitDate)}</span>
              {v.doctor && (
                <>
                  <Dot />
                  <span>
                    {v.doctor.fullName}
                    {v.doctor.speciality && <span className="text-ink-4"> · {v.doctor.speciality}</span>}
                  </span>
                </>
              )}
              {v.painLevel > 0 && (
                <>
                  <Dot />
                  <span className="tnum">Pain {v.painLevel}/10</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OutcomeMenu
              currentOutcome={v.outcome}
              open={outcomeMenuOpen}
              onToggle={() => setOutcomeMenuOpen((s) => !s)}
              onClose={() => setOutcomeMenuOpen(false)}
              onSelect={(next) => {
                if (next !== v.outcome) updateOutcome.mutate(next);
                else setOutcomeMenuOpen(false);
              }}
              pending={updateOutcome.isPending}
            />
            <a
              href={`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1"}/reports/visit/${v.patientVisitId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 no-underline"
            >
              Print visit
            </a>
            <a
              href={`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1"}/reports/prescription/${v.patientVisitId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 no-underline"
            >
              Prescription
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar — hidden when there's only one tab (cardiology module off). */}
      {cardiologyOn && (
        <div
          role="tablist"
          aria-label="Visit sections"
          className="-mx-1 flex gap-1 border-b border-rule"
        >
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "tests", label: "Clinical tests" },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
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
      )}

      {activeTab === "tests" ? (
        <ClinicalTestsTab patientId={v.patient.patientId} />
      ) : (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Main column — clinical narrative + observations */}
        <div className="space-y-5">
          {!cardRules.isHidden("vitals") && (
            <VitalsCard
              id="vitals"
              visitId={v.patientVisitId}
              title={cardRules.label("vitals", "Vitals")}
            />
          )}
          {!cardRules.isHidden("subjective") &&
            (["chiefComplaint", "historyOfPresentIllness", "pastMedicalHistory"] as const).some(
              (n) => !rules.isHidden(n),
            ) && (
            <SoapSection
              id="subjective"
              letter="S"
              title={cardRules.label("subjective", "Subjective")}
              eyebrow="Chief complaint & HPI"
              action={
                <button
                  type="button"
                  onClick={() => setEditingSubjective(true)}
                  title="Quick-edit chief complaint, HPI and PMH"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600 active:translate-y-px"
                >
                  <PencilIcon /> Edit
                </button>
              }
            >
              {!rules.isHidden("chiefComplaint") && (
                <FormattedText
                  text={v.chiefComplaint}
                  placeholder="No chief complaint recorded."
                />
              )}
              {!rules.isHidden("historyOfPresentIllness") && v.historyOfPresentIllness && (
                <>
                  <div className="mt-4 eyebrow">
                    {rules.label("historyOfPresentIllness", "History of present illness")}
                  </div>
                  <FormattedText text={v.historyOfPresentIllness} />
                </>
              )}
              {!rules.isHidden("pastMedicalHistory") && v.pastMedicalHistory && (
                <>
                  <div className="mt-4 eyebrow">
                    {rules.label("pastMedicalHistory", "Past medical history")}
                  </div>
                  <FormattedText text={v.pastMedicalHistory} />
                </>
              )}
            </SoapSection>
          )}

          {!cardRules.isHidden("assessment") && (
          <SoapSection
            id="assessment"
            letter="A"
            title={cardRules.label("assessment", "Assessment")}
            eyebrow={`${v.diagnoses.length} diagnoses`}
            action={
              <button
                type="button"
                onClick={() => setDxForm({ mode: "add" })}
                className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
              >
                + Add diagnosis
              </button>
            }
          >
            {v.diagnoses.length === 0 ? (
              <Empty text="No diagnoses recorded." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {v.diagnoses.map((d) => (
                  <li key={d.pvAssessmentConditionId}>
                    <div className="group inline-flex items-stretch overflow-hidden rounded-full bg-primary-50 text-primary-700">
                      <button
                        type="button"
                        onClick={() => setDxForm({ mode: "edit", dx: d })}
                        title={d.comments ?? "Edit diagnosis"}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors duration-2 hover:bg-primary-100"
                      >
                        <span className="font-medium">{d.conditionName}</span>
                        {d.conditionStatus && (
                          <span className="font-mono text-[11px] uppercase tracking-wider text-primary-600/80">
                            {d.conditionStatus}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDx(d)}
                        aria-label={`Delete ${d.conditionName}`}
                        className="border-s border-primary-200 px-2 text-[14px] leading-[1.7] text-primary-700/70 transition-colors duration-2 hover:bg-primary-100 hover:text-alert-fg"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SoapSection>
          )}

          {!cardRules.isHidden("plan") && (
          <SoapSection
            id="plan"
            letter="P"
            title={cardRules.label("plan", "Plan")}
            eyebrow={`${v.prescriptions.length} prescriptions`}
            action={
              <button
                type="button"
                onClick={() => setRxForm({ mode: "add" })}
                className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
              >
                + Add prescription
              </button>
            }
          >
            {v.prescriptions.length === 0 ? (
              <Empty text="No prescriptions recorded." />
            ) : (
              <ul className="divide-y divide-dashed divide-rule">
                {v.prescriptions.map((rx) => (
                  <li key={rx.pvPlanMedicationId}>
                    <button
                      type="button"
                      onClick={() => setOpenRx(rx)}
                      className="-mx-1 flex w-full items-start justify-between gap-3 rounded-[10px] px-1 py-2.5 text-start transition-colors duration-2 hover:bg-card-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium">{rx.medicineName}</div>
                        {rx.scientificName && rx.scientificName !== rx.medicineName && (
                          <div className="text-[12px] text-ink-3">{rx.scientificName}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-3">
                          {rx.dose && <span className="font-mono">{rx.dose}</span>}
                          {rx.route && <span>{rx.route}</span>}
                          {rx.period && <span>{rx.period}</span>}
                          {rx.indication && <span className="italic">for {rx.indication}</span>}
                        </div>
                      </div>
                      {!rx.isPrescribed && (
                        <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-warn-fg">
                          suggested
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SoapSection>
          )}


          {/* Clinical observations — moved up from the standalone bottom band
              so the grid rhythm stays consistent on long visits. */}
          {!cardRules.isHidden("body_system_review") && (
            <BodySystemReviewCard
              id="body_system_review"
              visitId={v.patientVisitId}
              patientId={v.patient.patientId}
              title={cardRules.label("body_system_review", "Review of Systems")}
            />
          )}
          {!cardRules.isHidden("physical_exam") && (
            <PhysicalExamCard
              id="physical_exam"
              visitId={v.patientVisitId}
              patientId={v.patient.patientId}
              title={cardRules.label("physical_exam", "Physical Examination")}
            />
          )}
        </div>

        {/* Side column — quick reference (metadata), context (PMH), and
            administrative follow-up (recommendations, revisits, billing). */}
        <div className="space-y-5">
          {!cardRules.isHidden("visit_metadata") && (
            <VisitMetadataCard
              id="visit_metadata"
              title={cardRules.label("visit_metadata", "Visit summary")}
              visit={v}
              rules={rules}
            />
          )}

          {!cardRules.isHidden("pmh") && v.pmhConditions.length + v.pmhMedications.length > 0 && (
            <Card id="pmh" title={cardRules.label("pmh", "Past medical history")}>
              {v.pmhConditions.length > 0 && (
                <div className="px-5 py-4">
                  <div className="eyebrow mb-2">Conditions</div>
                  <ul className="space-y-1.5 text-[13.5px]">
                    {v.pmhConditions.map((c) => (
                      <li key={c.pvPmhConditionId}>{c.conditionName}</li>
                    ))}
                  </ul>
                </div>
              )}
              {v.pmhMedications.length > 0 && (
                <div className="border-t border-dashed border-rule px-5 py-4">
                  <div className="eyebrow mb-2">Medications</div>
                  <ul className="space-y-1.5 text-[13.5px]">
                    {v.pmhMedications.map((m) => (
                      <li key={m.pvPmhMedicationId}>
                        {m.medicineName}
                        {m.dose && <span className="ms-1 font-mono text-[12px] text-ink-3">{m.dose}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {!cardRules.isHidden("recommendations") && (
            <RecommendationsCard
              id="recommendations"
              visitId={v.patientVisitId}
              initialRecs={v.afterVisitRecommendations}
              title={cardRules.label("recommendations", "Follow-up actions")}
            />
          )}

          {!cardRules.isHidden("revisits") && (
            <RevisitsCard
              id="revisits"
              visitId={v.patientVisitId}
              title={cardRules.label("revisits", "Follow-up visits")}
            />
          )}

          {!cardRules.isHidden("billing") && (
            <BillingCard
              id="billing"
              visitId={v.patientVisitId}
              patientId={v.patient.patientId}
              title={cardRules.label("billing", "Billing")}
            />
          )}
        </div>
      </div>
      )}

      {/* Edit visit modal */}
      <EditVisitModal visit={v} open={editing} onClose={() => setEditing(false)} />
      <EditSubjectiveModal
        visit={v}
        open={editingSubjective}
        onClose={() => setEditingSubjective(false)}
      />

      {/* Prescription detail modal — view + entry points to edit/delete */}
      <Modal
        open={!!openRx}
        onClose={() => setOpenRx(null)}
        title={openRx?.medicineName ?? ""}
        description={openRx?.scientificName ?? undefined}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => openRx && setConfirmDeleteRx(openRx)}
              className="me-auto rounded-[10px] border border-alert-fg/30 bg-alert-bg/40 px-3.5 py-2 text-[13px] font-medium text-alert-fg hover:bg-alert-bg"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setOpenRx(null)}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (openRx) {
                  setRxForm({ mode: "edit", rx: openRx });
                  setOpenRx(null);
                }
              }}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
            >
              Edit prescription
            </button>
          </>
        }
      >
        {openRx && <RxDetail rx={openRx} />}
      </Modal>

      {/* Prescription form (add + edit) */}
      <PrescriptionFormModal
        visit={v}
        rx={rxForm?.mode === "edit" ? rxForm.rx : null}
        open={!!rxForm}
        onClose={() => setRxForm(null)}
      />

      {/* Diagnosis form (add + edit) */}
      <DiagnosisFormModal
        visit={v}
        dx={dxForm?.mode === "edit" ? dxForm.dx : null}
        open={!!dxForm}
        onClose={() => setDxForm(null)}
      />

      {/* Delete diagnosis confirmation */}
      <ConfirmModal
        open={!!confirmDeleteDx}
        destructive
        title="Remove diagnosis?"
        body={
          confirmDeleteDx && (
            <>
              Remove <strong>{confirmDeleteDx.conditionName}</strong> from this visit's
              assessment. The record is kept (soft-deleted) for audit; any prescriptions
              linked to it will be unlinked.
              {(deleteDx.error as ApiError | undefined) && (
                <div className="mt-3 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                  {(deleteDx.error as Error).message}
                </div>
              )}
            </>
          )
        }
        confirmLabel="Remove"
        pending={deleteDx.isPending}
        onConfirm={() => {
          if (confirmDeleteDx)
            deleteDx.mutate({ visitId: v.patientVisitId, dxId: confirmDeleteDx.pvAssessmentConditionId });
        }}
        onCancel={() => setConfirmDeleteDx(null)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!confirmDeleteRx}
        destructive
        title="Delete prescription?"
        body={
          confirmDeleteRx && (
            <>
              This will permanently remove <strong>{confirmDeleteRx.medicineName}</strong>
              {confirmDeleteRx.dose && (
                <>
                  {" "}
                  ({confirmDeleteRx.dose}
                  {confirmDeleteRx.route ? `, ${confirmDeleteRx.route}` : ""})
                </>
              )}
              {" "}from this visit. This action is logged but cannot be undone from the UI.
              {(deleteRx.error as ApiError | undefined) && (
                <div className="mt-3 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                  {(deleteRx.error as Error).message}
                </div>
              )}
            </>
          )
        }
        confirmLabel="Delete"
        pending={deleteRx.isPending}
        onConfirm={() => {
          if (confirmDeleteRx)
            deleteRx.mutate({ visitId: v.patientVisitId, rxId: confirmDeleteRx.pvPlanMedicationId });
        }}
        onCancel={() => setConfirmDeleteRx(null)}
      />

    </div>
  );
}

function RxDetail({ rx }: { rx: VisitPrescription }): JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">
      <Field label="Dose" value={rx.dose} mono />
      <Field label="Route" value={rx.route} />
      <Field
        label="Frequency"
        value={
          rx.frequency != null
            ? `${rx.frequency} ${rx.frequencyUnit ?? ""}`.trim()
            : null
        }
      />
      <Field label="Period" value={rx.period} />
      <Field
        label="Quantity"
        value={
          rx.quantityNumber
            ? `${rx.quantityNumber} ${rx.quantityForm ?? ""}`.trim()
            : null
        }
      />
      <Field
        label="Prescribed"
        value={
          rx.isPrescribed ? "Yes" : "Suggested only"
        }
      />
      <Field label="Indication" value={rx.indication} />
      <Field label="Linked diagnosis" value={rx.diagnosisName} />
      <div className="col-span-2">
        <Field label="Notes" value={rx.notes} />
      </div>
    </dl>
  );
}

function SoapSection({
  letter,
  title,
  eyebrow,
  action,
  children,
  id,
}: {
  letter: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}): JSX.Element {
  return (
    <section id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card px-6 py-5 shadow-1">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-3 select-none font-serif text-[84px] font-medium leading-none text-paper-3"
        style={{ insetInlineEnd: "1rem" }}
      >
        {letter}
      </div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow !== undefined && <div className="eyebrow mb-1 text-primary-500">{eyebrow}</div>}
            <h2 className="mb-3 font-serif text-xl">{title}</h2>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

function FormattedText({ text, placeholder }: { text: string | null; placeholder?: string }): JSX.Element {
  const display = toDisplayText(text);
  if (!display.trim()) {
    return <div className="text-[13px] text-ink-3">{placeholder ?? "—"}</div>;
  }
  return (
    <div className="whitespace-pre-line text-[14px] leading-6 text-ink-2" dir="auto">
      {display}
    </div>
  );
}

function Card({
  title,
  children,
  id,
}: {
  title: ReactNode;
  children: ReactNode;
  id?: string;
}): JSX.Element {
  return (
    <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <header className="border-b border-rule px-5 py-3.5">
        <h2 className="font-serif text-xl">{title}</h2>
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
      <dd className={`mt-0.5 text-[13.5px] text-ink ${mono ? "font-mono" : ""}`} dir="auto">
        {value && value.trim() !== "" ? value : "—"}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }): JSX.Element {
  return <div className="text-[13px] text-ink-3">{text}</div>;
}

function Dot(): JSX.Element {
  return <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-4" />;
}

// ── Compact metadata card ───────────────────────────────────────────────────

function VisitMetadataCard({
  id,
  title,
  visit,
  rules,
}: {
  id: string;
  title: ReactNode;
  visit: VisitDetail;
  rules: FieldRuleMap;
}): JSX.Element {
  // Convert the labelled rows into chips that scan at a glance. Free-text
  // referral fields keep their full labels since their values can be long.
  const chips: Array<{ label: string; value: string; tone?: "warn" | "alert" }> = [
    { label: "Type", value: VISIT_TYPE[visit.visitType] ?? "Visit" },
    { label: "Intensity", value: INTENSITY[visit.intensity] ?? String(visit.intensity) },
    {
      label: "Pain",
      value: `${visit.painLevel}/10`,
      tone: visit.painLevel >= 7 ? "alert" : visit.painLevel >= 4 ? "warn" : undefined,
    },
  ];
  if (visit.isHospitalCase) {
    chips.push({ label: "Hospital", value: visit.hospitalName || "Yes", tone: "warn" });
  }

  const referrals: Array<{ label: string; value: string }> = [];
  if (visit.sourceOfReferral) referrals.push({ label: "Referred from", value: visit.sourceOfReferral });
  if (visit.transferTo) referrals.push({ label: "Transferred to", value: visit.transferTo });

  // Merged in from the old standalone "Notes" SoapSection — narrative fields
  // live inside the summary card now so the side column tells the whole story.
  const showNotes = !rules.isHidden("notes") && !!visit.notes;
  const showRecs = !rules.isHidden("recommendations") && !!visit.recommendations;
  const showDisp = !rules.isHidden("disposition") && !!visit.disposition;
  const hasNarrative = showNotes || showRecs || showDisp;

  return (
    <section
      id={id}
      className="overflow-hidden rounded-lg border border-rule bg-card shadow-1"
    >
      <header className="border-b border-rule px-5 py-3.5">
        <h2 className="font-serif text-xl leading-7">{title}</h2>
      </header>
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const tone =
              c.tone === "alert"
                ? "bg-alert-bg text-alert-fg"
                : c.tone === "warn"
                  ? "bg-warn-bg text-warn-fg"
                  : "bg-paper-3 text-ink-2";
            return (
              <span
                key={c.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${tone}`}
              >
                <span className="opacity-60">{c.label}</span>
                <span>{c.value}</span>
              </span>
            );
          })}
        </div>
        {referrals.length > 0 && (
          <dl className="space-y-1.5 border-t border-dashed border-rule pt-3 text-[13px]">
            {referrals.map((r) => (
              <div key={r.label} className="flex flex-wrap items-baseline gap-x-2">
                <dt className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
                  {r.label}
                </dt>
                <dd className="text-ink-2">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {hasNarrative && (
          <div className="space-y-3 border-t border-dashed border-rule pt-3">
            {showNotes && (
              <div>
                <div className="eyebrow mb-1">{rules.label("notes", "Visit notes")}</div>
                <FormattedText text={visit.notes} />
              </div>
            )}
            {showRecs && (
              <div>
                <div className="eyebrow mb-1">
                  {rules.label("recommendations", "Recommendations")}
                </div>
                <FormattedText text={visit.recommendations} />
              </div>
            )}
            {showDisp && (
              <div>
                <div className="eyebrow mb-1">{rules.label("disposition", "Disposition")}</div>
                <FormattedText text={visit.disposition} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Clinical tests tab ─────────────────────────────────────────────────────

function ClinicalTestsTab({ patientId }: { patientId: string }): JSX.Element {
  // Tests are patient-scoped (not visit-scoped) so the doctor sees the
  // patient's complete cardiology history while editing this visit.
  // Reuses the same field-rule key as the patient-detail Tests tab.
  const cardRules = useFieldRules("patient_card");
  return (
    <div className="space-y-5">
      {!cardRules.isHidden("echo") && (
        <PatientEchoCard
          id="echo"
          patientId={patientId}
          title={cardRules.label("echo", "Echocardiogram")}
        />
      )}
    </div>
  );
}

function PencilIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function ExternalLinkIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 self-center opacity-60"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function Skeleton(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="h-[160px] animate-pulse rounded-xl border border-rule bg-card shadow-1" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <div className="h-48 animate-pulse rounded-lg border border-rule bg-card" />
          <div className="h-32 animate-pulse rounded-lg border border-rule bg-card" />
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-rule bg-card" />
      </div>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }): JSX.Element {
  return (
    <div className="rounded-lg border border-rule bg-card p-12 text-center shadow-1">
      <div className="eyebrow mb-2">Error</div>
      <h2 className="font-serif text-2xl">{message}</h2>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
      >
        Back
      </button>
    </div>
  );
}
