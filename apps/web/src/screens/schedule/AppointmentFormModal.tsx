import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { PatientCombobox } from "../../components/PatientCombobox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { useFieldRules } from "../../lib/field-rules";
import {
  FieldLabel,
  Section,
  TextInput,
  Textarea,
  nonEmpty,
} from "../../lib/form-primitives";
import {
  createSchedule,
  deleteSchedule,
  listSchedule,
  listUsers,
  updateSchedule,
  SCHEDULE_STATUSES,
  type CreateSchedulePayload,
  type ScheduleListItem,
  type UpdateSchedulePayload,
} from "./api";
import type { PatientListItem } from "../patients/api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided, edit mode. When null + open, add mode. */
  item: ScheduleListItem | null;
  /** Optional initial start time for new appointments. */
  defaultDateTimeLocal?: string;
  /** Optional patient to pre-load when opening in add mode (e.g. from the patient detail "Schedule" button). */
  defaultPatient?: PatientListItem | null;
}

interface FormState {
  patient: PatientListItem | null;
  doctorId: string;
  scheduledInLocal: string;
  durationMin: string;
  statusId: number;
  notes: string;
  location: string;
  contactPhone: string;
  isSurgery: boolean;
  notForPatient: boolean;
  blockerLabel: string;
}

const DEFAULT_DURATION = "30";

const toLocalInput = (iso: string): string => {
  // Storage format is 'YYYY-MM-DD HH:MM:SS.fff' representing LOCAL clinic time
  // (no timezone). Parse without "Z" so JS doesn't shift by the browser offset.
  const d = new Date(iso.includes(" ") ? iso.replace(" ", "T") : iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const diffMinutes = (a: string, b: string): number => {
  const da = new Date(a.includes(" ") ? a.replace(" ", "T") : a);
  const db = new Date(b.includes(" ") ? b.replace(" ", "T") : b);
  return Math.max(15, Math.round((db.getTime() - da.getTime()) / 60000));
};

/**
 * Convert a local-time Date to an ISO string whose UTC components equal the
 * Date's local components. The backend pulls the time via `getUTCHours()` and
 * stores it as-is — so this guarantees the DB row's wall-clock time matches the
 * clinic's local clock, not the user's UTC offset.
 */
const toBackendDateTime = (d: Date): string => {
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString();
};

const blankForm = (
  item: ScheduleListItem | null,
  defaultDateTimeLocal?: string,
): FormState => {
  if (!item) {
    return {
      patient: null,
      doctorId: "",
      scheduledInLocal: defaultDateTimeLocal ?? "",
      durationMin: DEFAULT_DURATION,
      statusId: 1,
      notes: "",
      location: "",
      contactPhone: "",
      isSurgery: false,
      notForPatient: false,
      blockerLabel: "",
    };
  }
  return {
    patient: item.patient
      ? {
          patientId: item.patient.patientId,
          fullName: item.patient.fullName,
          fullNameAr: item.patient.fullNameAr,
          nationalId: item.patient.nationalId,
          sex: 0,
          dateOfBirth: null,
          mobileNumber: item.patient.mobileNumber,
          email: null,
          photoUrl: null,
        }
      : null,
    doctorId: item.doctor?.userId ?? "",
    scheduledInLocal: toLocalInput(item.scheduledInDate),
    durationMin: String(diffMinutes(item.scheduledInDate, item.scheduledToDate)),
    statusId: item.statusId,
    notes: item.notes ?? "",
    location: item.location ?? "",
    contactPhone: item.contactPhone ?? "",
    isSurgery: item.isSurgery,
    notForPatient: item.notForPatient,
    blockerLabel: item.name ?? "",
  };
};

export function AppointmentFormModal({
  open,
  onClose,
  item,
  defaultDateTimeLocal,
  defaultPatient,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const mode: "add" | "edit" = item ? "edit" : "add";
  const [form, setForm] = useState<FormState>(() => {
    const b = blankForm(item, defaultDateTimeLocal);
    if (!item && defaultPatient) b.patient = defaultPatient;
    return b;
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rules = useFieldRules("appointment");

  // Seed the form on open. In add mode the rule editor's defaults pre-fill
  // string fields (location, blockerLabel, contactPhone, notes) and numeric
  // statusId. In edit mode the existing record wins.
  useEffect(() => {
    if (!open) return;
    const next = blankForm(item, defaultDateTimeLocal);
    if (!item) {
      // Pre-fill from caller (e.g. patient detail's Schedule button).
      if (defaultPatient) next.patient = defaultPatient;
      for (const [key, value] of Object.entries(rules.defaults)) {
        if (key === "statusId") {
          const n = Number(value);
          if (!Number.isNaN(n)) next.statusId = n;
          continue;
        }
        if (key === "isSurgery") {
          next.isSurgery = value === "true" || value === "1";
          continue;
        }
        if (key === "notForPatient") {
          next.notForPatient = value === "true" || value === "1";
          continue;
        }
        if (key in next) {
          (next as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }
    setForm(next);
    setServerError(null);
  }, [open, item, defaultDateTimeLocal, defaultPatient, rules.defaults]);

  const doctorsQ = useQuery({
    queryKey: ["users", "active"],
    queryFn: ({ signal }) => listUsers(signal),
    staleTime: 5 * 60_000,
  });
  const doctors = doctorsQ.data ?? [];

  // Default the doctor when the list loads (add mode only).
  useEffect(() => {
    if (mode === "add" && !form.doctorId && doctors.length > 0) {
      setForm((f) => ({ ...f, doctorId: doctors[0].userId }));
    }
  }, [doctors, form.doctorId, mode]);

  // ── Conflict detection ──────────────────────────────────────────────────
  // Look for other appointments for the same doctor that overlap the chosen
  // window. Non-blocking: surfaces a warn banner; user can still save.
  const proposedRange = useMemo(() => {
    if (!form.doctorId || !form.scheduledInLocal) return null;
    const start = new Date(form.scheduledInLocal);
    if (Number.isNaN(start.getTime())) return null;
    const dur = Math.max(15, Math.min(720, Number(form.durationMin) || Number(DEFAULT_DURATION)));
    const end = new Date(start.getTime() + dur * 60_000);
    // Search the whole day for the doctor — small payload, cache-friendly.
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);
    return { start, end, from: toBackendDateTime(day), to: toBackendDateTime(dayEnd) };
  }, [form.doctorId, form.scheduledInLocal, form.durationMin]);

  const conflictsQ = useQuery({
    queryKey: [
      "schedule",
      "conflicts",
      form.doctorId,
      proposedRange?.from,
      proposedRange?.to,
    ],
    queryFn: ({ signal }) =>
      listSchedule(
        {
          doctorId: form.doctorId,
          from: proposedRange!.from,
          to: proposedRange!.to,
        },
        signal,
      ),
    enabled: open && !!proposedRange && !form.notForPatient,
    staleTime: 30_000,
  });

  const conflicts = useMemo(() => {
    if (!proposedRange || !conflictsQ.data) return [];
    const startMs = proposedRange.start.getTime();
    const endMs = proposedRange.end.getTime();
    const editingId = item?.scheduleItemId;
    return conflictsQ.data.filter((s) => {
      if (editingId && s.scheduleItemId === editingId) return false;
      if (s.statusId === 7) return false; // Cancelled
      const sStart = new Date(s.scheduledInDate.replace(" ", "T")).getTime();
      const sEnd = new Date(s.scheduledToDate.replace(" ", "T")).getTime();
      return sStart < endMs && sEnd > startMs;
    });
  }, [proposedRange, conflictsQ.data, item]);

  // A field counts toward submit-blocking only when (a) visible AND (b) marked
  // required by the rule editor. Hidden fields can't be required.
  const ruleEnforces = (field: string, value: string): boolean =>
    rules.isHidden(field) || !rules.isRequired(field) || value.trim().length > 0;

  const canSubmit =
    form.doctorId.length > 0 &&
    form.scheduledInLocal.length > 0 &&
    (form.notForPatient || form.patient != null) &&
    ruleEnforces("location", form.location) &&
    ruleEnforces("contactPhone", form.contactPhone) &&
    ruleEnforces("notes", form.notes) &&
    ruleEnforces("durationMin", form.durationMin) &&
    (!form.notForPatient || ruleEnforces("blockerLabel", form.blockerLabel));

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const start = new Date(form.scheduledInLocal);
      if (Number.isNaN(start.getTime())) throw new Error("Invalid start time");
      const dur = Math.max(15, Math.min(720, Number(form.durationMin) || Number(DEFAULT_DURATION)));
      const end = new Date(start.getTime() + dur * 60_000);

      if (mode === "add") {
        const payload: CreateSchedulePayload = {
          doctorId: form.doctorId,
          scheduledInDate: toBackendDateTime(start),
          scheduledToDate: toBackendDateTime(end),
          patientId: form.notForPatient ? null : form.patient?.patientId ?? null,
          name: form.notForPatient ? nonEmpty(form.blockerLabel) : null,
          notes: nonEmpty(form.notes),
          location: nonEmpty(form.location),
          contactPhone: nonEmpty(form.contactPhone),
          statusId: form.statusId,
          isSurgery: form.isSurgery,
          notForPatient: form.notForPatient,
        };
        await createSchedule(payload);
        return;
      }
      if (!item) return;
      const patch: UpdateSchedulePayload = {};
      const initial = blankForm(item, defaultDateTimeLocal);
      if (form.doctorId !== initial.doctorId) patch.doctorId = form.doctorId;
      // Stored as local clinic time; both sides of the comparison must use the
      // SAME local-as-UTC representation so we don't write unnecessary patches.
      const initialStart = toBackendDateTime(
        new Date(item.scheduledInDate.replace(" ", "T")),
      );
      const initialEnd = toBackendDateTime(
        new Date(item.scheduledToDate.replace(" ", "T")),
      );
      const nextStart = toBackendDateTime(start);
      const nextEnd = toBackendDateTime(end);
      if (nextStart !== initialStart) patch.scheduledInDate = nextStart;
      if (nextEnd !== initialEnd) patch.scheduledToDate = nextEnd;
      const nextPatient = form.notForPatient ? null : form.patient?.patientId ?? null;
      if (nextPatient !== (item.patient?.patientId ?? null)) patch.patientId = nextPatient;
      if (form.statusId !== item.statusId) patch.statusId = form.statusId;
      if (form.isSurgery !== item.isSurgery) patch.isSurgery = form.isSurgery;
      if (form.notForPatient !== item.notForPatient) patch.notForPatient = form.notForPatient;
      const dString = (s: string): string | null => nonEmpty(s);
      if (dString(form.notes) !== (item.notes ?? null)) patch.notes = dString(form.notes);
      if (dString(form.location) !== (item.location ?? null)) patch.location = dString(form.location);
      if (dString(form.contactPhone) !== (item.contactPhone ?? null)) {
        patch.contactPhone = dString(form.contactPhone);
      }
      if (form.notForPatient && dString(form.blockerLabel) !== (item.name ?? null)) {
        patch.name = dString(form.blockerLabel);
      }
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      await updateSchedule(item.scheduleItemId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to save");
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

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending && !deleteMutation.isPending) onClose();
      }}
      title={mode === "add" ? "New appointment" : "Edit appointment"}
      size="lg"
      initialFocusId="doctorId"
      dismissOnOverlay={!mutation.isPending && !deleteMutation.isPending}
      footer={
        <>
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={mutation.isPending || deleteMutation.isPending}
              className="me-auto rounded-[10px] border border-alert-fg/30 bg-alert-bg/40 px-3.5 py-2 text-[13px] font-medium text-alert-fg hover:bg-alert-bg disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="appt-form"
            disabled={!canSubmit || mutation.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Create" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="appt-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        {conflicts.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[10px] border border-warn-fg/30 bg-warn-bg px-3 py-2 text-[13px] text-warn-fg"
          >
            <span aria-hidden className="mt-0.5">⚠</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {conflicts.length === 1
                  ? "Doctor already has 1 appointment in this window"
                  : `Doctor already has ${conflicts.length} appointments in this window`}
              </div>
              <ul className="mt-1 space-y-0.5 text-[12px] opacity-90">
                {conflicts.slice(0, 3).map((c) => {
                  const s = new Date(c.scheduledInDate.replace(" ", "T"));
                  const e = new Date(c.scheduledToDate.replace(" ", "T"));
                  const t = (d: Date): string =>
                    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  return (
                    <li key={c.scheduleItemId}>
                      <span className="font-mono">{t(s)}–{t(e)}</span>
                      {" · "}
                      {c.patient?.fullName ?? c.name ?? "—"}
                    </li>
                  );
                })}
                {conflicts.length > 3 && (
                  <li className="opacity-70">+{conflicts.length - 3} more…</li>
                )}
              </ul>
              <div className="mt-1 text-[11.5px] opacity-70">
                You can still save if this is intentional (e.g. a follow-up overlap).
              </div>
            </div>
          </div>
        )}

        <Section title="When & who">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="doctorId" required>
                {rules.label("doctorId", "Doctor")}
              </FieldLabel>
              <SearchableSelect
                id="doctorId"
                value={form.doctorId}
                onChange={(v) => setForm((f) => ({ ...f, doctorId: String(v) }))}
                placeholder={doctorsQ.isLoading ? "Loading…" : "Select a doctor…"}
                required
                disabled={rules.isReadonly("doctorId")}
                options={doctors.map((u) => ({ value: u.userId, label: u.fullName }))}
              />
            </div>
            <TextInput
              id="scheduledInDate"
              label={rules.label("scheduledInDate", "Start")}
              type="datetime-local"
              required
              readOnly={rules.isReadonly("scheduledInDate")}
              mono
              value={form.scheduledInLocal}
              onChange={(v) => setForm((f) => ({ ...f, scheduledInLocal: v }))}
            />
            {(() => {
              const f = rules.field("durationMin", "Duration (min)");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  type="number"
                  required={f.required}
                  readOnly={f.readOnly}
                  mono
                  value={form.durationMin}
                  onChange={(v) => setForm((s) => ({ ...s, durationMin: v }))}
                />
              );
            })()}
          </div>
        </Section>

        <Section title={form.notForPatient ? "Blocker" : "Patient"}>
          {!rules.isHidden("notForPatient") && (
            <label className="mb-3 inline-flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={form.notForPatient}
                disabled={rules.isReadonly("notForPatient")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    notForPatient: e.target.checked,
                    patient: e.target.checked ? null : f.patient,
                  }))
                }
                className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
              />
              <span>{rules.label("notForPatient", "This is a blocked slot (lunch, meeting) — no patient")}</span>
            </label>
          )}
          {form.notForPatient ? (
            (() => {
              const f = rules.field("blockerLabel", "Label");
              return f.hidden ? null : (
                <TextInput
                  id={f.id}
                  label={f.label}
                  required={f.required}
                  readOnly={f.readOnly}
                  value={form.blockerLabel}
                  placeholder="e.g. Lunch break"
                  onChange={(v) => setForm((s) => ({ ...s, blockerLabel: v }))}
                />
              );
            })()
          ) : (
            <>
              <PatientCombobox
                id="patientId"
                label={rules.label("patientId", "Patient")}
                required
                value={form.patient}
                onChange={(p) => setForm((f) => ({ ...f, patient: p }))}
              />
              {(() => {
                const f = rules.field("contactPhone", "Contact phone (override)");
                return f.hidden ? null : (
                  <div className="mt-3">
                    <TextInput
                      id={f.id}
                      label={f.label}
                      required={f.required}
                      readOnly={f.readOnly}
                      mono
                      value={form.contactPhone}
                      onChange={(v) => setForm((s) => ({ ...s, contactPhone: v }))}
                    />
                  </div>
                );
              })()}
            </>
          )}
        </Section>

        {(["statusId", "location", "isSurgery", "notes"] as const).some(
          (n) => !rules.isHidden(n),
        ) && (
          <Section title="Details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(() => {
                const f = rules.field("statusId", "Status");
                return f.hidden ? null : (
                  <div>
                    <FieldLabel htmlFor={f.id} required={f.required}>
                      {f.label}
                    </FieldLabel>
                    <SearchableSelect
                      id={f.id}
                      value={form.statusId}
                      onChange={(v) => setForm((s) => ({ ...s, statusId: Number(v) }))}
                      disabled={f.readOnly}
                      showValue
                      options={SCHEDULE_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                    />
                  </div>
                );
              })()}
              {(() => {
                const f = rules.field("location", "Location / room");
                return f.hidden ? null : (
                  <TextInput
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.location}
                    onChange={(v) => setForm((s) => ({ ...s, location: v }))}
                  />
                );
              })()}
            </div>
            {(() => {
              const f = rules.field("isSurgery", "Surgery (not a clinic visit)");
              return f.hidden ? null : (
                <label className="mt-3 inline-flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={form.isSurgery}
                    disabled={f.readOnly}
                    onChange={(e) => setForm((s) => ({ ...s, isSurgery: e.target.checked }))}
                    className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
                  />
                  <span>{f.label}</span>
                </label>
              );
            })()}
            {(() => {
              const f = rules.field("notes", "Notes");
              return f.hidden ? null : (
                <div className="mt-3">
                  <Textarea
                    id={f.id}
                    label={f.label}
                    required={f.required}
                    readOnly={f.readOnly}
                    value={form.notes}
                    rows={2}
                    onChange={(v) => setForm((s) => ({ ...s, notes: v }))}
                  />
                </div>
              );
            })()}
          </Section>
        )}
      </form>

      {item && (
        <ConfirmModal
          open={confirmDelete}
          destructive
          title="Delete appointment?"
          body={
            <>
              This permanently removes the appointment for{" "}
              <strong>{item.patient?.fullName ?? item.name ?? "this slot"}</strong> on{" "}
              <span className="font-mono tnum">{toLocalInput(item.scheduledInDate)}</span>.
              The audit log keeps a record.
            </>
          }
          confirmLabel="Delete"
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
