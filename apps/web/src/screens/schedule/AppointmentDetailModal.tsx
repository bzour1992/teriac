import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import {
  deleteSchedule,
  SCHEDULE_STATUSES,
  startVisitFromAppointment,
  updateScheduleStatus,
  type ScheduleListItem,
} from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  item: ScheduleListItem | null;
  onEdit: (item: ScheduleListItem) => void;
}

const STATUS_STYLE: Record<number, { background: string; color: string }> = {
  1: { background: "var(--rule)", color: "var(--ink-3)" },
  2: { background: "var(--primary-100)", color: "var(--primary-700)" },
  3: { background: "var(--vital-bg)", color: "var(--vital-fg)" },
  4: { background: "var(--warn-bg)", color: "var(--warn-fg)" },
  5: { background: "var(--vital-bg)", color: "var(--vital-fg)" },
  6: { background: "var(--alert-bg)", color: "var(--alert-fg)" },
  7: { background: "var(--rule)", color: "var(--ink-4)" },
};

// Stored as local clinic time (no timezone). Do NOT append "Z".
const parseStored = (iso: string): Date =>
  new Date(iso.includes(" ") ? iso.replace(" ", "T") : iso);

const fmtDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "2-digit" });
const fmtTime = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export function AppointmentDetailModal({ open, onClose, item, onEdit }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const rules = useFieldRules("appointment");
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startVisitFromAppointment(item!.scheduleItemId),
    onSuccess: ({ patientVisitId }) => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onClose();
      navigate(`/visits/${patientVisitId}`);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to start visit");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchedule(item!.scheduleItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setConfirmDelete(false);
      onClose();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatusId: number) => updateScheduleStatus(item!.scheduleItemId, nextStatusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to update status");
    },
  });

  if (!item) {
    return (
      <Modal open={open} onClose={onClose} size="md" title="">
        <div />
      </Modal>
    );
  }

  const start = parseStored(item.scheduledInDate);
  const end = parseStored(item.scheduledToDate);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const status = SCHEDULE_STATUSES.find((s) => s.id === item.statusId);
  const linkedVisit = item.patientVisitId;
  const canStartVisit = !linkedVisit && !item.notForPatient && !!item.patient;
  const isPending = startMutation.isPending || deleteMutation.isPending || statusMutation.isPending;

  // The next logical status transition button (null for terminal statuses).
  const statusAdvance: { to: number; label: string } | null =
    item.statusId === 1 ? { to: 2, label: "Confirm →" }
    : item.statusId === 2 ? { to: 3, label: "Mark Arrived →" }
    : item.statusId === 3 && !canStartVisit && !linkedVisit ? { to: 4, label: "In Progress →" }
    : item.statusId === 4 ? { to: 5, label: "Complete →" }
    : null;

  const title = item.notForPatient
    ? item.name || "Blocked slot"
    : item.patient?.fullName || item.name || "Appointment";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tnum">{fmtDate(start)}</span>
          <span aria-hidden className="size-1 rounded-full bg-ink-4" />
          <span className="font-mono tnum">
            {fmtTime(start)}–{fmtTime(end)}
          </span>
          <span className="text-ink-4">· {durationMin}m</span>
          {status && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider"
              style={STATUS_STYLE[item.statusId]}
            >
              {status.label}
            </span>
          )}
        </span>
      }
      size="md"
      dismissOnOverlay={!isPending}
      footer={
        <>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="me-auto rounded-[10px] border border-alert-fg/30 bg-alert-bg/40 px-3.5 py-2 text-[13px] font-medium text-alert-fg hover:bg-alert-bg disabled:opacity-50"
          >
            Delete
          </button>
          {[1, 2, 3].includes(item.statusId) && (
            <button
              type="button"
              onClick={() => statusMutation.mutate(6)}
              disabled={isPending}
              className="rounded-[10px] border border-warn-fg/30 bg-warn-bg/40 px-3.5 py-2 text-[13px] font-medium text-warn-fg hover:bg-warn-bg disabled:opacity-50"
            >
              {statusMutation.isPending && statusMutation.variables === 6 ? "Saving…" : "No-Show"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={isPending}
            title="Change date, time, doctor, or any other detail"
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
          >
            Reschedule
          </button>
          {linkedVisit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/visits/${linkedVisit}`);
              }}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
            >
              Open visit →
            </button>
          )}
          {canStartVisit ? (
            <button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={isPending}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
            >
              {startMutation.isPending ? "Starting…" : "Start visit"}
            </button>
          ) : statusAdvance ? (
            <button
              type="button"
              onClick={() => statusMutation.mutate(statusAdvance.to)}
              disabled={isPending}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
            >
              {statusMutation.isPending && statusMutation.variables === statusAdvance.to
                ? "Saving…"
                : statusAdvance.label}
            </button>
          ) : null}
        </>
      }
    >
      {serverError && (
        <div role="alert" className="mb-4 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
          {serverError}
        </div>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {item.patient && (
          <>
            <Field
              label="Patient"
              value={
                <a
                  href={`/patients/${item.patient.patientId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-ink no-underline underline-offset-4 hover:text-primary hover:underline"
                  dir="auto"
                  title="Open patient chart in a new tab"
                >
                  <span>{item.patient.fullName || "—"}</span>
                  {item.patient.fullNameAr && item.patient.fullNameAr !== item.patient.fullName && (
                    <span className="text-[12px] text-ink-3" dir="rtl">
                      ({item.patient.fullNameAr})
                    </span>
                  )}
                  <ExternalLinkIcon />
                </a>
              }
            />
            <Field label="National ID" value={item.patient.nationalId || "—"} mono />
            {item.patient.mobileNumber && (
              <Field label="Phone" value={item.patient.mobileNumber} mono />
            )}
          </>
        )}
        {item.doctor && <Field label={rules.label("doctorId", "Doctor")} value={item.doctor.fullName} />}
        {item.location && !rules.isHidden("location") && (
          <Field label={rules.label("location", "Location")} value={item.location} />
        )}
        {item.contactPhone && !rules.isHidden("contactPhone") && (
          <Field label={rules.label("contactPhone", "Contact phone")} value={item.contactPhone} mono />
        )}
        {item.contactEmail && !rules.isHidden("contactEmail") && (
          <Field label={rules.label("contactEmail", "Contact email")} value={item.contactEmail} />
        )}
        {item.isSurgery && !rules.isHidden("isSurgery") && (
          <Field
            label="Type"
            value={
              <span className="rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-warn-fg">
                Surgery
              </span>
            }
          />
        )}
        {item.notForPatient && (
          <Field
            label="Type"
            value={
              <span className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                Blocked
              </span>
            }
          />
        )}
      </dl>

      {item.notes && !rules.isHidden("notes") && (
        <>
          <div className="eyebrow mt-4 mb-1">{rules.label("notes", "Notes")}</div>
          <div className="whitespace-pre-line text-[13.5px] leading-6 text-ink-2" dir="auto">
            {item.notes}
          </div>
        </>
      )}

      {!canStartVisit && !linkedVisit && !item.notForPatient && (
        <div className="mt-4 rounded-[10px] bg-paper-3 px-3 py-2 text-[12.5px] text-ink-3">
          {item.patient
            ? "This appointment can be started once you're ready — the Start visit button creates a clinical visit linked to this slot."
            : "Attach a patient to enable Start visit."}
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        destructive
        title="Delete appointment?"
        body={
          <>
            This permanently removes the appointment for <strong>{title}</strong>. The audit log
            keeps a record.
          </>
        }
        confirmLabel="Delete"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className={`mt-0.5 text-[13.5px] text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function ExternalLinkIcon(): JSX.Element {
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
      className="shrink-0 opacity-60"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
