import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import {
  listAdminUsers,
  listPermissions,
  getUserPermissions,
  setUserPermissions,
  PERMISSION_TYPE_LABEL,
  type PermissionItem,
} from "./api";

// ── Group permissions by type ──────────────────────────────────────────────────

function groupPermissions(
  perms: PermissionItem[],
): Map<number, PermissionItem[]> {
  const map = new Map<number, PermissionItem[]>();
  for (const p of perms) {
    const bucket = map.get(p.permissionType) ?? [];
    bucket.push(p);
    map.set(p.permissionType, bucket);
  }
  return map;
}

// ── PermissionsTab ─────────────────────────────────────────────────────────────

export function PermissionsTab(): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [savedFlash, setSavedFlash] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load users list
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: ({ signal }) => listAdminUsers(signal),
    staleTime: 30_000,
  });
  const users = usersQuery.data ?? [];

  // Load all permissions catalog
  const permsQuery = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: ({ signal }) => listPermissions(signal),
    staleTime: 10 * 60_000,
  });

  // Load selected user's current permissions
  const userPermsQuery = useQuery({
    queryKey: ["admin", "user-permissions", selectedUserId],
    queryFn: ({ signal }) => getUserPermissions(selectedUserId, signal),
    enabled: selectedUserId.length > 0,
    staleTime: 30_000,
  });

  // Sync checked state when user permissions load
  useEffect(() => {
    if (userPermsQuery.data) {
      setChecked(new Set(userPermsQuery.data));
    } else {
      setChecked(new Set());
    }
  }, [userPermsQuery.data, selectedUserId]);

  const grouped = useMemo(
    () => groupPermissions(permsQuery.data ?? []),
    [permsQuery.data],
  );

  const typeOrder = [1, 2, 3, 4]; // Module, Feature, Report, Action

  const togglePerm = (id: number): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (perms: PermissionItem[], allChecked: boolean): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (allChecked) {
          next.delete(p.permissionId);
        } else {
          next.add(p.permissionId);
        }
      }
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: (): Promise<void> =>
      setUserPermissions(selectedUserId, Array.from(checked)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "user-permissions", selectedUserId],
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      setServerError(null);
    },
    onError: (err) => {
      setServerError(
        err instanceof ApiError ? err.message : (err as Error).message || "Failed to save",
      );
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!selectedUserId) return;
    setServerError(null);
    mutation.mutate();
  };

  const isLoading = permsQuery.isLoading || (selectedUserId.length > 0 && userPermsQuery.isLoading);

  return (
    <div className="rounded-lg border border-rule bg-card shadow-1">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-serif text-xl font-medium tracking-tight">User permissions</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          Select a user, then toggle the permissions assigned to them.
        </p>
      </div>

      <form onSubmit={onSubmit} className="p-5">
        {/* User picker */}
        <div className="mb-6 max-w-sm">
          <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
            User
          </label>
          <SearchableSelect
            value={selectedUserId}
            onChange={(v) => {
              setSelectedUserId(String(v));
              setServerError(null);
            }}
            emptyLabel="— Select a user —"
            options={users.map((u) => ({
              value: u.userId,
              label: `${u.fullName} (${u.userName})`,
            }))}
          />

        </div>

        {/* Permissions list */}
        {!selectedUserId ? (
          <p className="py-8 text-center text-[13px] text-ink-3">
            Select a user above to manage their permissions.
          </p>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 animate-pulse rounded bg-paper-3" />
            ))}
          </div>
        ) : permsQuery.error ? (
          <p className="text-[13px] text-alert-fg">
            {(permsQuery.error as Error).message}
          </p>
        ) : (
          <div className="space-y-5">
            {typeOrder.map((type) => {
              const perms = grouped.get(type);
              if (!perms || perms.length === 0) return null;
              const allChecked = perms.every((p) => checked.has(p.permissionId));
              const someChecked = !allChecked && perms.some((p) => checked.has(p.permissionId));
              return (
                <div key={type}>
                  {/* Group header with select-all */}
                  <div className="mb-2 flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={() => toggleGroup(perms, allChecked)}
                        className="size-4 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
                      />
                      <span className="text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
                        {PERMISSION_TYPE_LABEL[type] ?? `Type ${type}`}
                      </span>
                    </label>
                    <span className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-3">
                      {perms.filter((p) => checked.has(p.permissionId)).length}/{perms.length}
                    </span>
                  </div>

                  {/* Permission checkboxes */}
                  <div className="grid grid-cols-1 gap-0.5 rounded-[10px] border border-rule sm:grid-cols-2">
                    {perms.map((p, idx) => (
                      <label
                        key={p.permissionId}
                        className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[13px] transition-colors duration-2 hover:bg-paper-3 ${
                          idx % 2 === 0 && idx + 1 < perms.length
                            ? "sm:border-e sm:border-rule"
                            : ""
                        } ${idx >= 2 ? "border-t border-dashed border-rule" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(p.permissionId)}
                          onChange={() => togglePerm(p.permissionId)}
                          className="size-4 shrink-0 rounded border-rule text-primary focus:ring-2 focus:ring-primary-100"
                        />
                        <span className="text-ink-2">{p.permissionName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {serverError && (
          <p
            role="alert"
            className="mt-4 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
          >
            {serverError}
          </p>
        )}

        {selectedUserId && !isLoading && (
          <div className="mt-6 flex items-center gap-3 border-t border-rule pt-5">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
            >
              {mutation.isPending ? "Saving…" : "Save permissions"}
            </button>
            {savedFlash && (
              <span className="text-[12px] font-medium text-vital-fg">Saved ✓</span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
