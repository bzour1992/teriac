import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ApiError } from "../../lib/api/client";
import { FieldLabel, TextInput } from "../../lib/form-primitives";
import {
  createUser,
  updateUser,
  USER_TYPE_LABEL,
  type AdminUserItem,
  type CreateUserPayload,
  type UpdateUserPayload,
} from "./api";

interface Props {
  open: boolean;
  user: AdminUserItem | null;
  onClose: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  secondName: string;
  userName: string;
  password: string;
  userType: number;
  position: string;
  isAdmin: boolean;
  isFinancialAdmin: boolean;
  isActive: boolean;
}

function blankForm(user: AdminUserItem | null): FormState {
  if (!user) {
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
      isActive: true,
    };
  }
  const nameParts = user.fullName.split(" ");
  return {
    firstName: nameParts[0] ?? "",
    lastName: nameParts[nameParts.length - 1] ?? "",
    secondName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "",
    userName: user.userName,
    password: "",
    userType: user.userType,
    position: user.position ?? "",
    isAdmin: user.isAdmin,
    isFinancialAdmin: user.isFinancialAdmin,
    isActive: user.isActive,
  };
}

export function UserFormModal({ open, user, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const isEdit = user !== null;
  const [form, setForm] = useState<FormState>(() => blankForm(user));
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(blankForm(user));
      setServerError(null);
    }
  }, [open, user]);

  const f =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    (!isEdit ? form.userName.trim().length > 0 && form.password.length >= 8 : true);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!isEdit) {
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
        await createUser(payload);
        return;
      }
      const payload: UpdateUserPayload = {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        secondName: form.secondName.trim() || null,
        userType: form.userType,
        position: form.position.trim() || null,
        isAdmin: form.isAdmin,
        isFinancialAdmin: form.isFinancialAdmin,
        isActive: form.isActive,
        password: form.password.trim().length > 0 ? form.password : null,
      };
      await updateUser(user.userId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
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
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={isEdit ? `Edit user — ${user?.userName ?? ""}` : "New user"}
      size="md"
      initialFocusId="user-firstName"
      dismissOnOverlay={!mutation.isPending}
      footer={
        <>
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
            form="user-form"
            disabled={!canSubmit || mutation.isPending}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            id="user-firstName"
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

        {isEdit ? (
          <div>
            <FieldLabel>Username</FieldLabel>
            <input
              type="text"
              value={form.userName}
              readOnly
              className="w-full cursor-not-allowed rounded-[10px] border border-rule bg-paper-2 px-3 py-2 font-mono text-[13.5px] text-ink-3"
            />
          </div>
        ) : (
          <TextInput
            label="Username"
            required
            mono
            value={form.userName}
            onChange={f("userName")}
            placeholder="dr.smith"
          />
        )}

        <div>
          <FieldLabel htmlFor="user-password" required={!isEdit}>
            Password{isEdit ? " (leave blank to keep current)" : ""}
          </FieldLabel>
          <input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(e) => f("password")(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep current" : "Minimum 8 characters"}
            autoComplete={isEdit ? "new-password" : "new-password"}
            className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
          {!isEdit && form.password.length > 0 && form.password.length < 8 && (
            <p className="mt-1 text-[11.5px] text-alert-fg">At least 8 characters required</p>
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
          {isEdit && (
            <label className="flex cursor-pointer items-center gap-3 text-[13.5px] text-ink-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => f("isActive")(e.target.checked)}
                className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
              />
              Account active
            </label>
          )}
        </div>
      </form>
    </Modal>
  );
}
