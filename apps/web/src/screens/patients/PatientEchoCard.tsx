import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api/client";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Modal } from "../../components/Modal";
import { FieldLabel, Section, TextInput, Textarea } from "../../lib/form-primitives";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EchoListItem {
  patientEchoCardiogramTestId: string;
  testDate: string;
  patientVisitId: string | null;
  requestedBy: string | null;
  ppd: string | null;
  lvedd: number | null; lvesd: number | null;
  ivs: number | null; plvw: number | null;
  aorticRoot: number | null; la: number | null; rv: number | null;
  dmModeFindings: string | null;
  dopplerFindings: string | null;
  conclusion: string | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

function listEcho(patientId: string, signal?: AbortSignal): Promise<EchoListItem[]> {
  return api(`/patients/${patientId}/echocardiogram`, { signal });
}
function createEcho(patientId: string, body: Record<string, unknown>): Promise<{ patientEchoCardiogramTestId: string }> {
  return api(`/patients/${patientId}/echocardiogram`, { method: "POST", body });
}
function updateEcho(patientId: string, echoId: string, body: Record<string, unknown>): Promise<void> {
  return api(`/patients/${patientId}/echocardiogram/${echoId}`, { method: "PATCH", body });
}
function deleteEcho(patientId: string, echoId: string): Promise<void> {
  return api(`/patients/${patientId}/echocardiogram/${echoId}`, { method: "DELETE" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};
const n = (v: string) => { const x = parseFloat(v); return isNaN(x) ? null : x; };
const fmtMm = (v: number | null) => v == null ? "—" : `${v} mm`;

// ── Measurement field row ─────────────────────────────────────────────────────

function MField({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between border-b border-dashed border-rule py-2 last:border-0">
      <span className="text-[12px] font-medium text-ink-3">{label}</span>
      <span className="font-mono text-[13px] font-semibold tnum text-ink">{fmtMm(value)}</span>
    </div>
  );
}

// ── Echo Form Modal ───────────────────────────────────────────────────────────

interface FormState {
  testDate: string; requestedBy: string;
  lvedd: string; lvesd: string; ivs: string; plvw: string;
  aorticRoot: string; la: string; rv: string; ppd: string;
  dmModeFindings: string; dopplerFindings: string; conclusion: string;
}

const blankForm = (item?: EchoListItem | null): FormState => ({
  testDate: item?.testDate?.slice(0, 10) ?? new Date().toISOString().split("T")[0],
  requestedBy: item?.requestedBy ?? "",
  lvedd: item?.lvedd?.toString() ?? "", lvesd: item?.lvesd?.toString() ?? "",
  ivs: item?.ivs?.toString() ?? "", plvw: item?.plvw?.toString() ?? "",
  aorticRoot: item?.aorticRoot?.toString() ?? "", la: item?.la?.toString() ?? "",
  rv: item?.rv?.toString() ?? "", ppd: item?.ppd ?? "",
  dmModeFindings: item?.dmModeFindings ?? "",
  dopplerFindings: item?.dopplerFindings ?? "",
  conclusion: item?.conclusion ?? "",
});

function EchoFormModal({ open, patientId, item, onClose }: {
  open: boolean; patientId: string;
  item: EchoListItem | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => blankForm(item));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation<{ patientEchoCardiogramTestId: string } | void, Error>({
    mutationFn: () => {
      const payload = {
        testDate: form.testDate,
        requestedBy: form.requestedBy.trim() || null,
        lvedd: n(form.lvedd), lvesd: n(form.lvesd), ivs: n(form.ivs),
        plvw: n(form.plvw), aorticRoot: n(form.aorticRoot),
        la: n(form.la), rv: n(form.rv),
        ppd: form.ppd.trim() || null,
        dmModeFindings: form.dmModeFindings.trim() || null,
        dopplerFindings: form.dopplerFindings.trim() || null,
        conclusion: form.conclusion.trim() || null,
      };
      return item
        ? updateEcho(patientId, item.patientEchoCardiogramTestId, payload)
        : createEcho(patientId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", "echo", patientId] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const onSubmit = (e: FormEvent) => { e.preventDefault(); setError(null); mutation.mutate(); };

  const numField = (label: string, key: keyof FormState, unit = "mm") => (
    <div>
      <FieldLabel htmlFor={`echo-${key}`}>{label} <span className="text-ink-4 normal-case">({unit})</span></FieldLabel>
      <input
        id={`echo-${key}`} type="number" min="0" step="0.1"
        value={form[key] as string}
        onChange={e => set(key)(e.target.value)}
        className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13.5px] tnum outline-none transition-colors hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
      />
    </div>
  );

  return (
    <Modal open={open} onClose={() => !mutation.isPending && onClose()}
      title={item ? "Edit echocardiogram" : "Record echocardiogram"}
      size="lg" dismissOnOverlay={!mutation.isPending}
      footer={<>
        <button type="button" onClick={onClose} disabled={mutation.isPending}
          className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" form="echo-form" disabled={mutation.isPending || !form.testDate}
          className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:bg-primary-200">
          {mutation.isPending ? "Saving…" : item ? "Save changes" : "Record"}
        </button>
      </>}
    >
      <form id="echo-form" onSubmit={onSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Test date" type="date" required mono value={form.testDate} onChange={set("testDate")} />
          <TextInput label="Requested by" value={form.requestedBy} onChange={set("requestedBy")} placeholder="Referring physician" />
        </div>

        <Section title="Measurements">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numField("LVEDD", "lvedd")}
            {numField("LVESD", "lvesd")}
            {numField("IVS", "ivs")}
            {numField("PLVW", "plvw")}
            {numField("Aortic root", "aorticRoot")}
            {numField("LA", "la")}
            {numField("RV", "rv")}
            <TextInput label="PPD" value={form.ppd} onChange={set("ppd")} />
          </div>
        </Section>

        <Section title="Findings">
          <Textarea label="M-Mode findings" value={form.dmModeFindings} rows={2} onChange={set("dmModeFindings")} />
          <div className="mt-3">
            <Textarea label="Doppler findings" value={form.dopplerFindings} rows={2} onChange={set("dopplerFindings")} />
          </div>
          <div className="mt-3">
            <Textarea label="Conclusion" value={form.conclusion} rows={3} onChange={set("conclusion")} />
          </div>
        </Section>
      </form>
    </Modal>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function PatientEchoCard({
  patientId,
  title,
  id,
}: {
  patientId: string;
  title?: ReactNode;
  id?: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EchoListItem | null>(null);
  const [deleting, setDeleting] = useState<EchoListItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["patients", "echo", patientId],
    queryFn: ({ signal }) => listEcho(patientId, signal),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (item: EchoListItem) => deleteEcho(patientId, item.patientEchoCardiogramTestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients", "echo", patientId] });
      setDeleting(null);
    },
  });

  const items = query.data ?? [];

  return (
    <>
      <div id={id} className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="font-serif text-[18px] font-medium tracking-tight text-ink">{title ?? "Echocardiogram"}</h2>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
            className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600">
            + Record
          </button>
        </div>

        <div className="divide-y divide-dashed divide-rule">
          {query.isLoading ? (
            <div className="px-5 py-6 text-center text-[13px] text-ink-3">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-ink-4">No echocardiogram records.</div>
          ) : (
            items.map((item) => {
              const isOpen = expanded === item.patientEchoCardiogramTestId;
              const hasMeasurements = [item.lvedd, item.lvesd, item.ivs, item.plvw, item.aorticRoot, item.la, item.rv].some(v => v != null);
              return (
                <div key={item.patientEchoCardiogramTestId}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : item.patientEchoCardiogramTestId)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-start transition-colors hover:bg-card-2 focus-visible:bg-primary-50 focus-visible:outline-none"
                  >
                    <div>
                      <div className="font-medium text-ink">{fmtDate(item.testDate)}</div>
                      {item.requestedBy && (
                        <div className="text-[12px] text-ink-3">Requested by {item.requestedBy}</div>
                      )}
                      {item.conclusion && (
                        <div className="mt-0.5 text-[12px] text-ink-3 italic line-clamp-1">{item.conclusion}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 ms-4">
                      <span className="font-mono text-[11px] text-ink-4">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-rule bg-paper px-5 py-4">
                      {hasMeasurements && (
                        <div className="mb-4 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                          <MField label="LVEDD" value={item.lvedd} />
                          <MField label="LVESD" value={item.lvesd} />
                          <MField label="IVS" value={item.ivs} />
                          <MField label="PLVW" value={item.plvw} />
                          <MField label="Aortic root" value={item.aorticRoot} />
                          <MField label="LA" value={item.la} />
                          <MField label="RV" value={item.rv} />
                        </div>
                      )}
                      {item.ppd && (
                        <div className="mb-3 text-[13px] text-ink-2"><span className="font-medium text-ink-3 me-2">PPD:</span>{item.ppd}</div>
                      )}
                      {item.dmModeFindings && (
                        <div className="mb-3">
                          <div className="eyebrow mb-1">M-Mode findings</div>
                          <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink-2">{item.dmModeFindings}</p>
                        </div>
                      )}
                      {item.dopplerFindings && (
                        <div className="mb-3">
                          <div className="eyebrow mb-1">Doppler findings</div>
                          <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink-2">{item.dopplerFindings}</p>
                        </div>
                      )}
                      {item.conclusion && (
                        <div className="mb-3 rounded-[10px] bg-primary-50 px-3 py-2">
                          <div className="eyebrow mb-1 text-primary-700">Conclusion</div>
                          <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink">{item.conclusion}</p>
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => { setEditing(item); setFormOpen(true); }}
                          className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2">
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleting(item)}
                          className="rounded-[10px] border border-alert-fg/30 bg-alert-bg/40 px-3 py-1.5 text-[12.5px] font-medium text-alert-fg hover:bg-alert-bg">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <EchoFormModal
        open={formOpen}
        patientId={patientId}
        item={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      />

      <ConfirmModal
        open={!!deleting}
        destructive
        title="Delete echocardiogram?"
        body={<>Remove the echo recorded on <strong>{deleting ? fmtDate(deleting.testDate) : ""}</strong>?</>}
        confirmLabel="Delete"
        pending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
