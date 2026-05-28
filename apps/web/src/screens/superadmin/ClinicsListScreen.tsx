import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  listClinics,
  SUBSCRIPTION_LABEL,
  type ClinicListItem,
} from "./api";
import { formatDateLong } from "../../lib/format";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ClinicFormModal } from "./ClinicFormModal";

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

function Th({
  children,
  align = "start",
}: {
  children: React.ReactNode;
  align?: "start" | "end" | "center";
}): JSX.Element {
  const cls =
    align === "end"
      ? "text-end"
      : align === "center"
        ? "text-center"
        : "text-start";
  return (
    <th
      className={`border-b border-rule bg-card-2 px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-3 ${cls}`}
    >
      {children}
    </th>
  );
}

function SkeletonRows({ cols }: { cols: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
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

const PAGE_SIZE = 20;

type ActiveFilter = "all" | "active" | "inactive";

export function ClinicsListScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["superadmin", "clinics", { search, activeFilter, page }],
    queryFn: ({ signal }) =>
      listClinics(
        {
          q: search,
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

  const data = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2 text-alert-fg">
            {t("superadmin.eyebrow", { defaultValue: "Overview" })}
          </div>
          <h2 className="font-serif text-[28px] font-medium leading-[34px] tracking-tight">
            {t("superadmin.clinics.title", { defaultValue: "Clinics" })}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
        >
          {t("superadmin.clinics.new_clinic", { defaultValue: "+ New clinic" })}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("superadmin.clinics.search_placeholder", {
            defaultValue: "Search clinics by name, email…",
          })}
          dir="auto"
          className="w-full max-w-[420px] rounded-[10px] border border-rule bg-card px-3.5 py-2.5 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
        />
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

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full min-w-[840px]">
          <thead>
            <tr>
              <Th>Clinic</Th>
              <Th>Subscription</Th>
              <Th align="end">Users</Th>
              <Th align="end">Patients</Th>
              <Th align="end">Specialties</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && !query.data ? (
              <SkeletonRows cols={7} />
            ) : query.error ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[13px] text-alert-fg"
                >
                  {(query.error as Error).message}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-[13px] text-ink-3"
                >
                  {t("common.nothing_matched", {
                    defaultValue: "Nothing matched.",
                  })}
                </td>
              </tr>
            ) : (
              data.map((c: ClinicListItem) => (
                <tr
                  key={c.hcenterId}
                  onClick={() => navigate(`/superadmin/clinics/${c.hcenterId}`)}
                  className="cursor-pointer border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      <Link
                        to={`/superadmin/clinics/${c.hcenterId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-primary"
                      >
                        {c.name}
                      </Link>
                    </div>
                    {c.nameRep && (
                      <div
                        className="text-[12px] text-ink-3"
                        dir="rtl"
                        lang="ar"
                      >
                        {c.nameRep}
                      </div>
                    )}
                    {c.email && (
                      <div className="font-mono text-[11.5px] text-ink-4">
                        {c.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-2">
                    {SUBSCRIPTION_LABEL[c.subscriptionType] ?? `Type ${c.subscriptionType}`}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-[13px] tnum text-ink-2">
                    {c.userCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-[13px] tnum text-ink-2">
                    {c.patientCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-[13px] tnum text-ink-2">
                    {c.specialtyCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={c.isActive} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] tnum text-ink-3">
                    {formatDateLong(c.supportStartDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <div className="tnum text-ink-3">
            {t("common.page", { defaultValue: "Page" })} {page} /{" "}
            {pageCount} · {total.toLocaleString()} clinics
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("common.prev", { defaultValue: "Prev" })}
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-[10px] border border-rule bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("common.next", { defaultValue: "Next" })}
            </button>
          </div>
        </div>
      )}

      <ClinicFormModal
        open={createOpen}
        clinic={null}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/superadmin/clinics/${id}`)}
      />
    </div>
  );
}
