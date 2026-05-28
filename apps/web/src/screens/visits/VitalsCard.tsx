import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { ApiError } from "../../lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VitalsRecord {
  pvVitalsId: string;
  recordedAt: string;
  recordedBy: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  sbp: number | null;
  dbp: number | null;
  pulseRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  notes: string | null;
}

interface VitalsForm {
  sbp: string;
  dbp: string;
  pulseRate: string;
  temperatureC: string;
  spo2: string;
  respiratoryRate: string;
  heightCm: string;
  weightKg: string;
  notes: string;
}

const blank = (): VitalsForm => ({
  sbp: "", dbp: "", pulseRate: "", temperatureC: "",
  spo2: "", respiratoryRate: "", heightCm: "", weightKg: "", notes: "",
});

function listVitals(visitId: string, signal?: AbortSignal): Promise<VitalsRecord[]> {
  return api(`/visits/${encodeURIComponent(visitId)}/vitals`, { signal });
}

function recordVitals(visitId: string, body: Record<string, unknown>): Promise<{ pvVitalsId: string }> {
  return api(`/visits/${encodeURIComponent(visitId)}/vitals`, { method: "POST", body });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const n = (s: string): number | null => {
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
};

const fmtNum = (v: number | null, decimals = 0): string =>
  v == null ? "—" : v.toFixed(decimals);

const fmtTime = (s: string): string => {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const computeBmi = (h: string, w: string): number | null => {
  const hM = parseFloat(h) / 100;
  const wKg = parseFloat(w);
  if (!hM || !wKg || isNaN(hM) || isNaN(wKg)) return null;
  return Math.round((wKg / (hM * hM)) * 10) / 10;
};

// ── Vital item display ────────────────────────────────────────────────────────

function VitalItem({ label, value, unit, alert }: {
  label: string; value: string; unit?: string; alert?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-4">{label}</span>
      <span className={`font-mono text-[15px] font-semibold tnum ${alert ? "text-alert-fg" : "text-ink"}`}>
        {value}
        {unit && value !== "—" && (
          <span className="ms-0.5 text-[11px] font-normal text-ink-3">{unit}</span>
        )}
      </span>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, id, value, onChange, unit, placeholder }: {
  label: string; id: string; value: string;
  onChange: (v: string) => void; unit?: string; placeholder?: string;
}): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-3">
        {label}
        {unit && <span className="ms-1 normal-case text-ink-4">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        step="any"
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VitalsCard({
  visitId,
  title,
  id,
}: {
  visitId: string;
  title?: ReactNode;
  id?: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VitalsForm>(blank);
  const [serverError, setServerError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["vitals", visitId],
    queryFn: ({ signal }) => listVitals(visitId, signal),
    staleTime: 30_000,
  });

  const latest = query.data?.[0] ?? null;
  const bmiPreview = computeBmi(form.heightCm, form.weightKg);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      if (n(form.sbp) !== null) payload.sbp = n(form.sbp);
      if (n(form.dbp) !== null) payload.dbp = n(form.dbp);
      if (n(form.pulseRate) !== null) payload.pulseRate = n(form.pulseRate);
      if (n(form.temperatureC) !== null) payload.temperatureC = n(form.temperatureC);
      if (n(form.spo2) !== null) payload.spo2 = n(form.spo2);
      if (n(form.respiratoryRate) !== null) payload.respiratoryRate = n(form.respiratoryRate);
      if (n(form.heightCm) !== null) payload.heightCm = n(form.heightCm);
      if (n(form.weightKg) !== null) payload.weightKg = n(form.weightKg);
      if (form.notes.trim()) payload.notes = form.notes.trim();
      return recordVitals(visitId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals", visitId] });
      setShowForm(false);
      setForm(blank());
      setServerError(null);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to save");
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mutation.mutate();
  };

  const set = (k: keyof VitalsForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Flags for abnormal values
  const bpAlert = latest && latest.sbp != null && (latest.sbp > 140 || (latest.dbp ?? 0) > 90);
  const spo2Alert = latest && latest.spo2 != null && latest.spo2 < 95;
  const tempAlert = latest && latest.temperatureC != null && latest.temperatureC > 37.5;

  return (
    <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule px-5 py-4">
        <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">{title ?? "Vitals"}</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setForm(blank()); }}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
          >
            + Record
          </button>
        )}
      </div>

      {/* Latest reading */}
      {!showForm && (
        <div className="px-5 py-4">
          {query.isLoading ? (
            <div className="text-center text-[13px] text-ink-3 py-4">Loading…</div>
          ) : !latest ? (
            <div className="py-4 text-center text-[13px] text-ink-4">No vitals recorded yet.</div>
          ) : (
            <>
              <div className="mb-3 text-[11.5px] text-ink-3">
                Last recorded at <span className="font-mono font-medium">{fmtTime(latest.recordedAt)}</span>
                {latest.recordedBy && <> by {latest.recordedBy}</>}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                {(latest.sbp != null || latest.dbp != null) && (
                  <VitalItem
                    label="Blood pressure"
                    value={`${fmtNum(latest.sbp)}/${fmtNum(latest.dbp)}`}
                    unit="mmHg"
                    alert={!!bpAlert}
                  />
                )}
                {latest.pulseRate != null && (
                  <VitalItem label="Pulse" value={fmtNum(latest.pulseRate)} unit="bpm" />
                )}
                {latest.temperatureC != null && (
                  <VitalItem
                    label="Temperature"
                    value={fmtNum(latest.temperatureC, 1)}
                    unit="°C"
                    alert={!!tempAlert}
                  />
                )}
                {latest.spo2 != null && (
                  <VitalItem
                    label="SpO₂"
                    value={fmtNum(latest.spo2, 1)}
                    unit="%"
                    alert={!!spo2Alert}
                  />
                )}
                {latest.respiratoryRate != null && (
                  <VitalItem label="Resp. rate" value={fmtNum(latest.respiratoryRate)} unit="/min" />
                )}
                {latest.heightCm != null && (
                  <VitalItem label="Height" value={fmtNum(latest.heightCm, 1)} unit="cm" />
                )}
                {latest.weightKg != null && (
                  <VitalItem label="Weight" value={fmtNum(latest.weightKg, 1)} unit="kg" />
                )}
                {latest.bmi != null && (
                  <VitalItem
                    label="BMI"
                    value={fmtNum(latest.bmi, 1)}
                    alert={latest.bmi > 30 || latest.bmi < 18.5}
                  />
                )}
              </div>
              {latest.notes && (
                <p className="mt-3 text-[12.5px] text-ink-3 italic">{latest.notes}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Recording form */}
      {showForm && (
        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
          {serverError && (
            <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="v-sbp"  label="Systolic BP"  unit="mmHg" value={form.sbp}  onChange={set("sbp")}  placeholder="120" />
            <Field id="v-dbp"  label="Diastolic BP" unit="mmHg" value={form.dbp}  onChange={set("dbp")}  placeholder="80" />
            <Field id="v-pr"   label="Pulse"        unit="bpm"  value={form.pulseRate} onChange={set("pulseRate")} placeholder="72" />
            <Field id="v-temp" label="Temperature"  unit="°C"   value={form.temperatureC} onChange={set("temperatureC")} placeholder="37.0" />
            <Field id="v-spo2" label="SpO₂"         unit="%"    value={form.spo2}  onChange={set("spo2")}  placeholder="98" />
            <Field id="v-rr"   label="Resp. rate"   unit="/min" value={form.respiratoryRate} onChange={set("respiratoryRate")} placeholder="16" />
            <Field id="v-ht"   label="Height"       unit="cm"   value={form.heightCm} onChange={set("heightCm")} placeholder="170" />
            <div>
              <Field id="v-wt" label="Weight"       unit="kg"   value={form.weightKg} onChange={set("weightKg")} placeholder="70" />
              {bmiPreview !== null && (
                <div className="mt-1 text-[11.5px] text-ink-3 font-mono">
                  BMI: <span className={`font-medium ${bmiPreview > 30 || bmiPreview < 18.5 ? "text-warn-fg" : "text-vital-fg"}`}>{bmiPreview.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="v-notes" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-3">
              Notes
            </label>
            <input
              id="v-notes"
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13px] outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setServerError(null); }}
              disabled={mutation.isPending}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
            >
              {mutation.isPending ? "Saving…" : "Save vitals"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
