import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { USER_TYPE_LABEL } from "../admin/api";
import { SearchableSelect } from "../../components/SearchableSelect";
import {
  listClinics,
  listCrossClinicUsers,
  type CrossClinicUser,
} from "./api";

const PAGE_SIZE = 20;

type ActiveFilter = "all" | "active" | "inactive";

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

export function CrossClinicUsersScreen(): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [clinicId, setClinicId] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);

  // Load all clinics for the filter dropdown.
  const clinicsQuery = useQuery({
    queryKey: ["superadmin", "clinics", "for-filter"],
    queryFn: ({ signal }) =>
      listClinics({ page: 1, pageSize: 200 }, signal),
    staleTime: 5 * 60_000,
  });
  const clinics = clinicsQuery.data?.data ?? [];

  const usersQuery = useQuery({
    queryKey: [
      "superadmin",
      "cross-users",
      { search, clinicId, activeFilter, page },
    ],
    queryFn: ({ signal }) =>
      listCrossClinicUsers(
        {
          q: search,
          clinicId: clinicId || undefined,
          active:
            activeFilter === "active"
              ? true
              : activeFilter === "inactive"
                ? false
                : undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.total ?? 0;
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow mb-2 text-alert-fg">
          {t("superadmin.eyebrow", { defaultValue: "Overview" })}
        </div>
        <h2 className="font-serif text-[28px] font-medium leading-[34px] tracking-tight">
          {t("superadmin.users.title", { defaultValue: "All users" })}
        </h2>
        <p className="mt-1 text-[13px] text-ink-3">
          Search and audit users across every clinic on the platform.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or username…"
          dir="auto"
          className="w-full max-w-[380px] rounded-[10px] border border-rule bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
        />
        <div className="min-w-[200px]">
          <SearchableSelect
            value={clinicId}
            onChange={(v) => {
              setClinicId(String(v));
              setPage(1);
            }}
            ariaLabel="Filter by clinic"
            emptyLabel="All clinics"
            options={clinics.map((c) => ({ value: c.hcenterId, label: c.name }))}
          />
        </div>
        <div className="min-w-[180px]">
          <SearchableSelect
            value={activeFilter}
            onChange={(v) => {
              setActiveFilter(v as ActiveFilter);
              setPage(1);
            }}
            ariaLabel="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active only" },
              { value: "inactive", label: "Inactive only" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-card-2">
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Name
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Username
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Clinic
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Type
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Admin
              </th>
              <th className="border-b border-rule px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading && !usersQuery.data ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[13px] text-ink-3"
                >
                  Loading…
                </td>
              </tr>
            ) : usersQuery.error ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[13px] text-alert-fg"
                >
                  {(usersQuery.error as Error).message}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[13px] text-ink-3"
                >
                  No users matched.
                </td>
              </tr>
            ) : (
              users.map((u: CrossClinicUser) => (
                <tr
                  key={u.userId}
                  className="border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2"
                >
                  <td className="px-4 py-3 text-[13.5px] font-medium text-ink">
                    {u.fullName}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">
                    {u.userName}
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    <Link
                      to={`/superadmin/clinics/${u.hcenterId}`}
                      className="text-primary-700 hover:text-primary-600"
                    >
                      {u.clinicName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-2">
                    {USER_TYPE_LABEL[u.userType] ?? `Type ${u.userType}`}
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    {u.isSuperAdmin ? (
                      <span className="inline-flex items-center rounded-full bg-alert-fg/10 px-2 py-0.5 text-[11px] font-medium text-alert-fg">
                        Super
                      </span>
                    ) : u.isAdmin ? (
                      <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                        Admin
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
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

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <div className="tnum text-ink-3">
            Page {page} / {pageCount} · {total.toLocaleString()} users
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
