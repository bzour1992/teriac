import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect } from "../../components/SearchableSelect";
import { listAdminUsers, USER_TYPE_LABEL, type AdminUserItem } from "./api";
import { UserFormModal } from "./UserFormModal";

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${
        active
          ? "bg-vital-bg text-vital-fg"
          : "bg-paper-3 text-ink-3"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ── Admin badge ───────────────────────────────────────────────────────────────

function AdminBadge(): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">
      Admin
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
      {children}
    </th>
  );
}

function SkeletonRows({ cols }: { cols: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t border-dashed border-rule">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-paper-3" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ALL_TYPE = 0;

// ── UsersTab ──────────────────────────────────────────────────────────────────

export function UsersTab(): JSX.Element {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<number>(ALL_TYPE);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null | undefined>(undefined);

  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: ({ signal }) => listAdminUsers(signal),
    staleTime: 30_000,
  });

  const users = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        q.length === 0 ||
        u.fullName.toLowerCase().includes(q) ||
        u.userName.toLowerCase().includes(q);
      const matchesType = typeFilter === ALL_TYPE || u.userType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [users, search, typeFilter]);

  // editingUser === undefined  → modal closed
  // editingUser === null       → add mode
  // editingUser = AdminUserItem → edit mode
  const modalOpen = editingUser !== undefined;

  return (
    <>
      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username…"
            className="w-full max-w-[380px] rounded-[10px] border border-rule bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
          />
        </div>
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

        <button
          type="button"
          onClick={() => setEditingUser(null)}
          className="ms-auto rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
        >
          + New user
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-card-2">
              <Th>Name</Th>
              <Th>Username</Th>
              <Th>Type</Th>
              <Th>Position</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows cols={6} />
            ) : query.error ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[13px] text-alert-fg"
                >
                  {(query.error as Error).message}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
                      <div className="text-[11.5px] text-ink-3">{u.specialityName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">
                    {u.userName}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-2">
                    {USER_TYPE_LABEL[u.userType] ?? `Type ${u.userType}`}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-3">{u.position ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={u.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingUser(u)}
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

      <UserFormModal
        open={modalOpen}
        user={editingUser ?? null}
        onClose={() => setEditingUser(undefined)}
      />
    </>
  );
}
