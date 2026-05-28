import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../lib/api/client";
import { Modal } from "../../components/Modal";
import { FieldLabel, TextInput, Textarea } from "../../lib/form-primitives";
import {
  createMasterSpecialty,
  listMasterSpecialties,
  updateMasterSpecialty,
  type MasterSpecialty,
} from "./api";

const SELECT_CLS =
  "w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

interface FormState {
  specialityName: string;
  description: string;
  specialtyGroup: string;
}

function blankForm(s: MasterSpecialty | null): FormState {
  if (!s) {
    return { specialityName: "", description: "", specialtyGroup: "" };
  }
  return {
    specialityName: s.specialityName,
    description: s.description ?? "",
    specialtyGroup: s.specialtyGroup,
  };
}

function nn(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function SpecialtyFormModal({
  open,
  specialty,
  onClose,
}: {
  open: boolean;
  specialty: MasterSpecialty | null;
  onClose: () => void;
}): JSX.Element {
  const qc = useQueryClient();
  const isEdit = specialty !== null;
  const [form, setForm] = useState<FormState>(() => blankForm(specialty));
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(blankForm(specialty));
      setServerError(null);
    }
  }, [open, specialty]);

  const f =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.specialityName.trim().length > 0 &&
    form.specialtyGroup.trim().length > 0 &&
    form.specialtyGroup.trim().length <= 2;

  const mut = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!isEdit) {
        await createMasterSpecialty({
          specialityName: form.specialityName.trim(),
          description: nn(form.description),
          specialtyGroup: form.specialtyGroup.trim(),
        });
        return;
      }
      await updateMasterSpecialty(specialty.specialityId, {
        specialityName: form.specialityName.trim() || undefined,
        description: nn(form.description),
        specialtyGroup: form.specialtyGroup.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "master-specialties"] });
      onClose();
    },
    onError: (e) =>
      setServerError(
        e instanceof ApiError ? e.message : (e as Error).message || "Failed to save",
      ),
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setServerError(null);
    mut.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => !mut.isPending && onClose()}
      title={isEdit ? `Edit specialty — ${specialty.specialityName}` : "New specialty"}
      size="md"
      initialFocusId="spec-name"
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
            form="master-spec-form"
            disabled={!canSubmit || mut.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mut.isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </>
      }
    >
      <form id="master-spec-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </div>
        )}

        <TextInput
          id="spec-name"
          label="Specialty name"
          required
          value={form.specialityName}
          onChange={f("specialityName")}
          placeholder="Cardiology"
        />

        <div>
          <FieldLabel required>Group code</FieldLabel>
          <input
            type="text"
            value={form.specialtyGroup}
            onChange={(e) => f("specialtyGroup")(e.target.value)}
            maxLength={2}
            placeholder="01"
            className={`${SELECT_CLS} w-24 font-mono tnum uppercase`}
          />
        </div>

        <Textarea
          label="Description"
          value={form.description}
          onChange={f("description")}
          rows={3}
        />
      </form>
    </Modal>
  );
}

export function MasterSpecialtiesScreen(): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MasterSpecialty | null | undefined>(
    undefined,
  );

  const query = useQuery({
    queryKey: ["superadmin", "master-specialties"],
    queryFn: ({ signal }) => listMasterSpecialties(signal),
    staleTime: 5 * 60_000,
  });

  const all = query.data ?? [];
  const filtered = all.filter((s) => {
    const q = search.toLowerCase();
    if (q.length === 0) return true;
    return (
      s.specialityName.toLowerCase().includes(q) ||
      s.specialtyGroup.toLowerCase().includes(q)
    );
  });

  const modalOpen = editing !== undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2 text-alert-fg">
            {t("superadmin.eyebrow", { defaultValue: "Overview" })}
          </div>
          <h2 className="font-serif text-[28px] font-medium leading-[34px] tracking-tight">
            {t("superadmin.specialties.title", {
              defaultValue: "Master specialties",
            })}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            Shared specialty catalog available to all clinics.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
        >
          + New specialty
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or group…"
        dir="auto"
        className="w-full max-w-[380px] rounded-[10px] border border-rule bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
      />

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full">
          <thead>
            <tr className="bg-card-2">
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Name
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Group
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Description
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
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-[13px] text-ink-3"
                >
                  No specialties found.
                </td>
              </tr>
            ) : (
              filtered.map((sp) => (
                <tr
                  key={sp.specialityId}
                  className="border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2"
                >
                  <td className="px-4 py-3 text-[13.5px] font-medium text-ink">
                    {sp.specialityName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] tnum text-ink-2">
                    {sp.specialtyGroup}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-3">
                    {sp.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(sp)}
                      className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-2 hover:border-rule-2 hover:text-ink"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SpecialtyFormModal
        open={modalOpen}
        specialty={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}
