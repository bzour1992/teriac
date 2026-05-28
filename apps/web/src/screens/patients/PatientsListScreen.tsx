import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listPatients, type PatientListItem } from "./api";
import { PageHead } from "../../layout/AppShell";
import { formatAge, formatDateLong, sexLabel } from "../../lib/format";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useAuth } from "../../lib/auth/store";
import { NewPatientModal } from "./NewPatientModal";

const PAGE_SIZE = 20;

export function PatientsListScreen(): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce the query input — wait 300ms after typing stops.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const query = useQuery({
    queryKey: ["patients", "list", debouncedSearch, page],
    queryFn: ({ signal }) =>
      listPatients({ q: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const totalPages = useMemo(
    () => (query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1),
    [query.data],
  );

  // Browser tab title: include active search + result count + clinic suffix.
  const { hcenter } = useAuth();
  const clinicSuffix = hcenter?.hcenterName?.trim() || "Teriac";
  const total = query.data?.total;
  const countLabel = total !== undefined ? ` (${total.toLocaleString()})` : "";
  const patientsLabel = t("nav.patients", { defaultValue: "Patients" });
  useDocumentTitle(
    debouncedSearch
      ? `${t("common.search", { defaultValue: "Search" })}: ${debouncedSearch}${countLabel} - ${patientsLabel} - ${clinicSuffix}`
      : `${patientsLabel}${countLabel} - ${clinicSuffix}`,
  );

  return (
    <>
      <PageHead
        eyebrow={t("patients.eyebrow", { defaultValue: new Date().toLocaleDateString() })}
        title={
          <>
            {t("patients.title", { defaultValue: "Patients" })}{" "}
            {query.data && (
              <em className="font-serif text-ink-3">
                <span className="tnum">{query.data.total.toLocaleString()}</span>
              </em>
            )}
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
          >
            + {t("patients.new_patient", { defaultValue: "New patient" })}
          </button>
        }
      />

      {/* Filters card */}
      <section className="relative mb-5 rounded-lg border border-rule bg-card shadow-1">
        <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="flex items-baseline gap-3">
            <h2 className="eyebrow text-ink-3">{t("common.filter")}</h2>
            {query.isFetching && !query.isPlaceholderData ? (
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                {t("common.loading")}
              </span>
            ) : query.data ? (
              <span className="font-mono text-[12px] text-ink-3 tnum">
                {query.data.total.toLocaleString()}{" "}
                {query.data.total === 1
                  ? t("patients.count_singular", { defaultValue: "patient" })
                  : t("patients.count_plural", { defaultValue: "patients" })}
              </span>
            ) : null}
          </div>
          {search ? (
            <Link
              to="/patients"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 no-underline transition-colors duration-2 hover:border-rule-2 hover:text-ink-2"
            >
              {t("common.reset_filters", { defaultValue: "Reset filters" })}
            </Link>
          ) : (
            <span className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 opacity-40">
              {t("common.reset_filters", { defaultValue: "Reset filters" })}
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-5 py-4">
          <div>
            <label
              htmlFor="patients-search"
              className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3"
            >
              {t("common.search")}
            </label>
            <input
              id="patients-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("patients.search_placeholder", {
                defaultValue: "Search by name, national ID, phone, or email…",
              })}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        <table className="w-full">
          <thead>
            <tr className="bg-card-2">
              <Th>{t("patients.col.name", { defaultValue: "Name" })}</Th>
              <Th>{t("patients.col.national_id", { defaultValue: "National ID" })}</Th>
              <Th align="center">{t("patients.col.sex", { defaultValue: "Sex" })}</Th>
              <Th>{t("patients.col.dob", { defaultValue: "Date of birth" })}</Th>
              <Th align="end">{t("patients.col.age", { defaultValue: "Age" })}</Th>
              <Th>{t("patients.col.phone", { defaultValue: "Phone" })}</Th>
              <Th>{t("patients.col.email", { defaultValue: "Email" })}</Th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows />
            ) : query.error ? (
              <ErrorRow message={(query.error as Error).message} />
            ) : query.data && query.data.data.length === 0 ? (
              <EmptyRow />
            ) : (
              query.data?.data.map((p) => <PatientRow key={p.patientId} p={p} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-[12px] text-ink-3">
          {query.data && (
            <>
              {t("patients.page_of", {
                defaultValue: "Page {{page}} of {{total}}",
                page,
                total: totalPages.toLocaleString(),
              })}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <PageButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || query.isFetching}
            label={t("common.previous", { defaultValue: "Previous" })}
          />
          <PageButton
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || query.isFetching}
            label={t("common.next", { defaultValue: "Next" })}
          />
        </div>
      </div>

      <NewPatientModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function Th({
  children,
  align = "start",
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}): JSX.Element {
  return (
    <th
      className="eyebrow border-b border-rule px-4 py-3 font-medium text-ink-3"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function PatientRow({ p }: { p: PatientListItem }): JSX.Element {
  const navigate = useNavigate();
  const displayName = p.fullName || p.fullNameAr || "—";
  const altName = p.fullName && p.fullNameAr && p.fullName !== p.fullNameAr ? p.fullNameAr : null;
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/patients/${p.patientId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/patients/${p.patientId}`);
        }
      }}
      className="cursor-pointer border-t border-dashed border-rule transition-colors duration-2 hover:bg-card-2 focus-visible:bg-primary-50 focus-visible:outline-none"
    >
      <td className="px-4 py-3">
        <div className="text-[14px] font-medium">{displayName}</div>
        {altName && (
          <div className="text-[12px] text-ink-3" dir="auto">
            {altName}
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">{p.nationalId || "—"}</td>
      <td className="px-4 py-3 text-center font-mono text-[12.5px] text-ink-2">
        {sexLabel(p.sex)}
      </td>
      <td className="px-4 py-3 text-[13px] text-ink-2 tnum">{formatDateLong(p.dateOfBirth)}</td>
      <td className="px-4 py-3 text-end text-[13px] text-ink-2 tnum">
        {formatAge(p.dateOfBirth)}
      </td>
      <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">{p.mobileNumber || "—"}</td>
      <td className="px-4 py-3 text-[13px] text-ink-3">{p.email || "—"}</td>
    </tr>
  );
}

function SkeletonRows(): JSX.Element {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t border-dashed border-rule">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-paper-3" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyRow(): JSX.Element {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-ink-3">
        Nothing matched.
      </td>
    </tr>
  );
}

function ErrorRow({ message }: { message: string }): JSX.Element {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-alert-fg">
        {message}
      </td>
    </tr>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors duration-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
