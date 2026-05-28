import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../lib/api/client";
import { toDateInput } from "../../lib/form-primitives";
import {
  deleteLabRequest,
  listLabRequests,
  updateLabRequest,
  type LabRequestListItem,
} from "./history-api";
import { LabRequestFormModal } from "./LabRequestFormModal";
import { AttachmentsCard } from "../attachments/AttachmentsCard";
import { getAttachmentCounts } from "../attachments/attachments-api";

interface Props {
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PatientLabRequestsCard({ patientId, title, id }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<
    { mode: "add" } | { mode: "edit"; item: LabRequestListItem } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<LabRequestListItem | null>(null);
  /** Which row currently shows its inline attachments panel. Null = collapsed. */
  const [openAttachmentsId, setOpenAttachmentsId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["patients", "lab-requests", patientId],
    queryFn: ({ signal }) => listLabRequests(patientId, signal),
    staleTime: 30_000,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteLabRequest(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "lab-requests", patientId] });
      setConfirmDelete(null);
    },
  });

  const markDelivered = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      updateLabRequest(patientId, id, {
        isDelivered: true,
        deliveryDate: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", "lab-requests", patientId] });
    },
  });

  const items = query.data ?? [];
  const pendingCount = items.filter((i) => !i.isDelivered).length;

  const itemIds = items.map((i) => i.patientLabRequestId);
  const attCountsQ = useQuery({
    queryKey: ["attachments", "counts", "patientlabrequests", itemIds],
    queryFn: ({ signal }) => getAttachmentCounts("patientlabrequests", itemIds, signal),
    enabled: itemIds.length > 0,
    staleTime: 30_000,
  });
  const attCounts = attCountsQ.data ?? {};

  return (
    <section id={id} className="relative overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      {pendingCount > 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 w-[3px]"
          style={{ insetInlineStart: 0, background: "var(--warn-fg)" }}
        />
      )}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl">{title ?? "Lab requests"}</h2>
          {items.length > 0 && (
            <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-paper-3 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink-2">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: "add" })}
          className="rounded-[10px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-primary-600"
        >
          + Add
        </button>
      </header>

      {query.isLoading ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">Loading…</div>
      ) : query.error ? (
        <div className="px-5 py-6 text-[13px] text-alert-fg">
          {(query.error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-6 text-[13px] text-ink-3">No lab requests recorded.</div>
      ) : (
        <ul className="divide-y divide-dashed divide-rule">
          {items.map((item) => (
            <li key={item.patientLabRequestId}>
              <div className="flex items-start gap-3 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setForm({ mode: "edit", item })}
                  className="flex-1 text-start"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14px] font-medium">{item.labRequest}</span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                      style={
                        item.isDelivered
                          ? { background: "var(--vital-bg)", color: "var(--vital-fg)" }
                          : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
                      }
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={
                          item.isDelivered
                            ? { background: "var(--vital-fg)" }
                            : { background: "var(--warn-fg)" }
                        }
                      />
                      {item.isDelivered ? "Delivered" : "Pending"}
                    </span>
                  </div>
                  {item.lab && (
                    <div className="mt-0.5 text-[12.5px] text-ink-3">{item.lab}</div>
                  )}
                  <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4 tnum">
                    requested · {toDateInput(item.requestDate)}
                    {item.isDelivered && item.deliveryDate
                      ? ` · delivered · ${toDateInput(item.deliveryDate)}`
                      : ` · expected · ${toDateInput(item.expectedDeliveryDate)}`}
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenAttachmentsId((cur) =>
                        cur === item.patientLabRequestId ? null : item.patientLabRequestId,
                      )
                    }
                    aria-expanded={openAttachmentsId === item.patientLabRequestId}
                    title={
                      attCounts[item.patientLabRequestId]
                        ? `${attCounts[item.patientLabRequestId]} file(s) attached`
                        : "Attach result PDF or image"
                    }
                    className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11.5px] font-medium transition-colors duration-2 ${
                      openAttachmentsId === item.patientLabRequestId
                        ? "border-primary bg-primary-50 text-primary-700"
                        : attCounts[item.patientLabRequestId]
                          ? "border-rule bg-card text-ink-2 hover:border-primary hover:text-primary-700"
                          : "border-rule bg-card text-ink-3 hover:border-primary hover:text-primary-700"
                    }`}
                  >
                    <span>📎 Files</span>
                    {attCounts[item.patientLabRequestId] > 0 && (
                      <span
                        className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold tnum ${
                          openAttachmentsId === item.patientLabRequestId
                            ? "bg-primary text-white"
                            : "bg-primary-100 text-primary-700"
                        }`}
                      >
                        {attCounts[item.patientLabRequestId]}
                      </span>
                    )}
                  </button>
                  {!item.isDelivered && (
                    <button
                      type="button"
                      onClick={() => markDelivered.mutate({ id: item.patientLabRequestId })}
                      disabled={markDelivered.isPending}
                      aria-label={`Mark ${item.labRequest} as delivered`}
                      className="rounded-[10px] border border-rule bg-card px-2 py-1 text-[11.5px] font-medium text-ink-3 transition-colors duration-2 hover:border-vital-fg/40 hover:bg-vital-bg hover:text-vital-fg disabled:opacity-50"
                    >
                      ✓ Done
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(item)}
                    aria-label={`Delete ${item.labRequest}`}
                    className="rounded p-1 text-ink-4 transition-colors duration-2 hover:bg-paper-3 hover:text-alert-fg"
                  >
                    <span aria-hidden className="text-base">×</span>
                  </button>
                </div>
              </div>

              {/* Inline attachments panel — one row at a time. Scoped to this
                  lab request via entityId, so the same component will work
                  for every other consumer (echo, visits, …) without changes. */}
              {openAttachmentsId === item.patientLabRequestId && (
                <div className="border-t border-dashed border-rule bg-paper-2/40 px-5 py-3">
                  <AttachmentsCard
                    entityType="patientlabrequests"
                    entityId={item.patientLabRequestId}
                    category="lab-result"
                    title="Result documents"
                    accept="application/pdf,image/*"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <LabRequestFormModal
        open={!!form}
        patientId={patientId}
        item={form?.mode === "edit" ? form.item : null}
        onClose={() => setForm(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        destructive
        title="Remove lab request?"
        body={
          confirmDelete && (
            <>
              Remove <strong>{confirmDelete.labRequest}</strong> from lab requests.
              {(remove.error as ApiError | undefined) && (
                <div className="mt-3 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
                  {(remove.error as Error).message}
                </div>
              )}
            </>
          )
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => {
          if (confirmDelete) remove.mutate({ id: confirmDelete.patientLabRequestId });
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
