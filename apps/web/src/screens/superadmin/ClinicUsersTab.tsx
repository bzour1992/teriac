import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput } from "../../lib/form-primitives";
import {
  USER_TYPE_LABEL,
  type AdminUserItem,
  type CreateUserPayload,
} from "../admin/api";
import { createClinicUser, listClinicUsers } from "./api";

const ALL_TYPE = 0;

function StatusPill({ active }: { active: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${
        active ? "bg-vital-bg text-vital-fg" : "bg-paper-3 text-ink-3"
      }`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AdminBadge(): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">
      Admin
    </span>
  );
}

interface CreateFormState {
  firstName: string;
  lastName: string;
  secondName: string;
  userName: string;
  password: string;
  userType: number;
  position: string;
  isAdmin: boolean;
  isFinancialAdmin: boolean;
}

function blankCreateForm(): CreateFormState {
  return {
    firstName: "",
    lastName: "",
    secondName: "",
    userName: "",
    password: "",
    userType: 1,
    position: "",
    isAdmin: false,
    isFinancialAdmin: false,
  };
}

function CreateUserModal({
  open,
  clinicId,
  onClose,
}: {
  open: boolean;
  clinicId: string;
  onClose: () => void;
}): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateFormState>(() => blankCreateForm());
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(blankCreateForm());
      setServerError(null);
    }
  }, [open]);

  const f =
    <K extends keyof CreateFormState>(key: K) =>
    (value: CreateFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.userName.trim().length > 0 &&
    form.password.length >= 8;

  const mut = useMutation({
    mutationFn: (): Promise<{ userId: string }> => {
      const payload: CreateUserPayload = {
        userName: form.userName.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        secondName: form.secondName.trim() || null,
        userType: form.userType,
        position: form.position.trim() || null,
        isAdmin: form.isAdmin,
        isFinancialAdmin: form.isFinancialAdmin,
      };
      return createClinicUser(clinicId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["superadmin", "clinic", clinicId, "users"],
      });
      onClose();
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
    },
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
      title="New user"
      size="md"
      initialFocusId="sauser-first"
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
            form="sauser-form"
            disabled={!canSubmit || mut.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mut.isPending ? "Saving…" : "Create user"}
          </button>
        </>
      }
    >
      <form id="sauser-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            id="sauser-first"
            label="First name"
            required
            value={form.firstName}
            onChange={f("firstName")}
          />
          <TextInput
            label="Last name"
            required
            value={form.lastName}
            onChange={f("lastName")}
          />
        </div>

        <TextInput
          label="Middle name"
          value={form.secondName}
          onChange={f("secondName")}
          placeholder="Optional"
        />

        <TextInput
          label="Username"
          required
          mono
          value={form.userName}
          onChange={f("userName")}
          placeholder="dr.smith"
        />

        <div>
          <FieldLabel htmlFor="sauser-password" required>
            Password
          </FieldLabel>
          <input
            id="sauser-password"
            type="password"
            value={form.password}
            onChange={(e) => f("password")(e.target.value)}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
          {form.password.length > 0 && form.password.length < 8 && (
            <p className="mt-1 text-[11.5px] text-alert-fg">
              At least 8 characters required
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>User type</FieldLabel>
            <SearchableSelect
              value={form.userType}
              onChange={(v) => f("userType")(Number(v))}
              options={Object.entries(USER_TYPE_LABEL).map(([v, label]) => ({
                value: Number(v),
                label,
              }))}
            />
          </div>
          <TextInput
            label="Position / title"
            value={form.position}
            onChange={f("position")}
            placeholder="Senior Physician"
          />
        </div>

        <div className="space-y-2 rounded-[10px] border border-rule px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={(e) => f("isAdmin")(e.target.checked)}
              className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
            />
            Center administrator
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={form.isFinancialAdmin}
              onChange={(e) => f("isFinancialAdmin")(e.target.checked)}
              className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
            />
            Financial admin
          </label>
        </div>
      </form>
    </Modal>
  );
}

export function ClinicUsersTab({ clinicId }: { clinicId: string }): JSX.Element {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<number>(ALL_TYPE);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["superadmin", "clinic", clinicId, "users"],
    queryFn: ({ signal }) => listClinicUsers(clinicId, signal),
    staleTime: 30_000,
  });

  const users = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u: AdminUserItem) => {
      const matchesSearch =
        q.length === 0 ||
        u.fullName.toLowerCase().includes(q) ||
        u.userName.toLowerCase().includes(q);
      const matchesType = typeFilter === ALL_TYPE || u.userType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [users, search, typeFilter]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          dir="auto"
          className="w-full max-w-[380px] rounded-[10px] border border-rule bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
        />
        <div className="min-w-[180px]">
          <SearchableSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(Number(v))}
            ariaLabel="Filter by user type"
            options={[
              { value: ALL_TYPE, label: "All types" },
              ...Object.entries(USER_TYPE_LABEL).map(([v, label]) => ({
                value: Number(v),
                label,
              })),
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="ms-auto rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
        >
          + New user
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-card-2">
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Name
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Username
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Type
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Position
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[13px] text-ink-3"
                >
                  Loading…
                </td>
              </tr>
            ) : query.error ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[13px] text-alert-fg"
                >
                  {(query.error as Error).message}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[13px] text-ink-3"
                >
                  No users matched.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.userId}
                  className="border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium">{u.fullName}</span>
                      {u.isAdmin && <AdminBadge />}
                    </div>
                    {u.specialityName && (
                      <div className="text-[11.5px] text-ink-3">
                        {u.specialityName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">
                    {u.userName}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-2">
                    {USER_TYPE_LABEL[u.userType] ?? `Type ${u.userType}`}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-3">
                    {u.position ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={u.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateUserModal
        open={createOpen}
        clinicId={clinicId}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
