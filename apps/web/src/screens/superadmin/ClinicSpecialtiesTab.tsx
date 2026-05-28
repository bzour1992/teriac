import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FieldLabel } from "../../lib/form-primitives";
import {
  addClinicSpecialty,
  listClinicSpecialties,
  listMasterSpecialties,
  removeClinicSpecialty,
  type ClinicSpecialty,
  type MasterSpecialty,
} from "./api";

const INPUT_CLS =
  "w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

function AddSpecialtyModal({
  open,
  clinicId,
  existingSpecialtyIds,
  onClose,
}: {
  open: boolean;
  clinicId: string;
  existingSpecialtyIds: Set<string>;
  onClose: () => void;
}): JSX.Element {
  const qc = useQueryClient();
  const [specialtyId, setSpecialtyId] = useState("");
  const [defaultPayment, setDefaultPayment] = useState("");
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const mastersQuery = useQuery({
    queryKey: ["superadmin", "master-specialties"],
    queryFn: ({ signal }) => listMasterSpecialties(signal),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const masters = mastersQuery.data ?? [];
  const available = useMemo(
    () => masters.filter((m) => !existingSpecialtyIds.has(m.specialityId)),
    [masters, existingSpecialtyIds],
  );

  const mut = useMutation({
    mutationFn: () =>
      addClinicSpecialty(clinicId, {
        specialityId: specialtyId,
        defaultPayment:
          defaultPayment.trim().length > 0 ? Number(defaultPayment) : null,
        showOnProfile,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["superadmin", "clinic", clinicId, "specialties"],
      });
      setSpecialtyId("");
      setDefaultPayment("");
      setShowOnProfile(true);
      setErr(null);
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const canSubmit = specialtyId.length > 0;

  return (
    <Modal
      open={open}
      onClose={() => !mut.isPending && onClose()}
      title="Add specialty"
      size="md"
      dismissOnOverlay={!mut.isPending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={mut.isPending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="spec-form"
            disabled={!canSubmit || mut.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mut.isPending ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <form
        id="spec-form"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          mut.mutate();
        }}
        className="space-y-4"
      >
        {err && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {err}
          </div>
        )}

        <div>
          <FieldLabel required>Specialty</FieldLabel>
          <SearchableSelect
            value={specialtyId}
            onChange={(v) => setSpecialtyId(String(v))}
            disabled={mastersQuery.isLoading}
            required
            emptyLabel="— Select a specialty —"
            options={available.map((m: MasterSpecialty) => ({
              value: m.specialityId,
              label: m.specialityName,
            }))}
          />
          {!mastersQuery.isLoading && available.length === 0 && (
            <p className="mt-1 text-[12px] text-ink-3">
              All master specialties are already added.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Default consult fee</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={defaultPayment}
            onChange={(e) => setDefaultPayment(e.target.value)}
            placeholder="0.00"
            className={`${INPUT_CLS} font-mono tnum`}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-rule px-4 py-3 text-[13.5px] text-ink-2">
          <input
            type="checkbox"
            checked={showOnProfile}
            onChange={(e) => setShowOnProfile(e.target.checked)}
            className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
          />
          Show on public profile
        </label>
      </form>
    </Modal>
  );
}

export function ClinicSpecialtiesTab({
  clinicId,
}: {
  clinicId: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ClinicSpecialty | null>(null);

  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId, "specialties"],
    queryFn: ({ signal }) => listClinicSpecialties(clinicId, signal),
    staleTime: 30_000,
  });

  const specialties = query.data ?? [];
  const existingIds = useMemo(
    () => new Set(specialties.map((s) => s.specialityId)),
    [specialties],
  );

  const removeMut = useMutation({
    mutationFn: (sp: ClinicSpecialty) =>
      removeClinicSpecialty(clinicId, sp.hcenterSpecialityId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["superadmin", "clinic", clinicId, "specialties"],
      });
      setConfirmRemove(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-medium tracking-tight">
          Specialties offered
        </h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
        >
          + Add specialty
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full">
          <thead>
            <tr className="bg-card-2">
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Specialty
              </th>
              <th className="border-b border-rule px-4 py-3 text-end text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Default fee
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Profile
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-ink-3"
                >
                  Loading…
                </td>
              </tr>
            ) : query.error ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-alert-fg"
                >
                  {(query.error as Error).message}
                </td>
              </tr>
            ) : specialties.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-[13px] text-ink-3"
                >
                  No specialties added yet.
                </td>
              </tr>
            ) : (
              specialties.map((sp) => (
                <tr
                  key={sp.hcenterSpecialityId}
                  className="border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2"
                >
                  <td className="px-4 py-3 text-[13.5px] font-medium text-ink">
                    {sp.specialityName}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-[13px] tnum text-ink-2">
                    {sp.defaultPayment === null
                      ? "—"
                      : sp.defaultPayment.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    {sp.showOnProfile ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-vital-bg px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-vital-fg">
                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-3">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(sp)}
                      className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-alert-fg transition-colors duration-2 hover:border-alert-fg/40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddSpecialtyModal
        open={addOpen}
        clinicId={clinicId}
        existingSpecialtyIds={existingIds}
        onClose={() => setAddOpen(false)}
      />

      <ConfirmModal
        open={confirmRemove !== null}
        title="Remove specialty?"
        body={
          confirmRemove
            ? `Remove "${confirmRemove.specialityName}" from this clinic? Users assigned to this specialty will lose the assignment.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        pending={removeMut.isPending}
        onCancel={() => !removeMut.isPending && setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeMut.mutate(confirmRemove);
        }}
      />
    </div>
  );
}
