import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api/client";
import { PageHead } from "../../layout/AppShell";
import { formatAge, formatDateLong, sexLabel } from "../../lib/format";
import { toDisplayText } from "../../lib/rtf";
import { PatientCombobox } from "../../components/PatientCombobox";
import { SearchableSelect } from "../../components/SearchableSelect";
import { Modal } from "../../components/Modal";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useAuth } from "../../lib/auth/store";
import { getPatient, type PatientDetail, type PatientListItem } from "../patients/api";
import { listUsers } from "../schedule/api";
import { NewVisitModal } from "./NewVisitModal";
import { OutcomeMenu } from "./OutcomeMenu";
import { updateVisit } from "./api";

const PAGE_SIZE = 25;

interface VisitListItem {
  patientVisitId: string;
  visitDate: string;
  visitType: number;
  outcome: number;
  intensity: number;
  chiefComplaint: string | null;
  patient: { patientId: string; fullName: string; fullNameAr: string | null; nationalId: string };
  doctor: { userId: string; fullName: string } | null;
  topDiagnosis: string | null;
  diagnosisCount: number;
  prescriptionCount: number;
}

interface VisitListResponse {
  data: VisitListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface VisitStats {
  total: number;
  open: number;
  resolved: number;
  noShow: number;
  today: number;
  byOutcome: Record<number, number>;
}

type SortBy = "visitDate" | "patient" | "doctor";
type SortDir = "asc" | "desc";

interface ListVisitsParams {
  from?: string;
  to?: string;
  patientId?: string;
  doctorId?: string;
  visitType?: number;
  outcome?: number;
  page: number;
  pageSize: number;
  sortBy?: SortBy;
  sortDir?: SortDir;
}

function listVisitsQuery(params: ListVisitsParams): Record<string, string> {
  const q: Record<string, string> = {
    page: String(params.page),
    pageSize: String(params.pageSize),
  };
  if (params.from) q.from = params.from;
  if (params.to) q.to = params.to;
  if (params.patientId) q.patientId = params.patientId;
  if (params.doctorId) q.doctorId = params.doctorId;
  if (params.visitType !== undefined) q.visitType = String(params.visitType);
  if (params.outcome !== undefined) q.outcome = String(params.outcome);
  if (params.sortBy) q.sortBy = params.sortBy;
  if (params.sortDir) q.sortDir = params.sortDir;
  return q;
}

function listVisits(params: ListVisitsParams, signal?: AbortSignal): Promise<VisitListResponse> {
  return api("/visits", { query: listVisitsQuery(params), signal });
}

function getVisitStats(
  params: Omit<ListVisitsParams, "page" | "pageSize" | "sortBy" | "sortDir">,
  signal?: AbortSignal,
): Promise<VisitStats> {
  const q: Record<string, string> = {};
  if (params.from) q.from = params.from;
  if (params.to) q.to = params.to;
  if (params.patientId) q.patientId = params.patientId;
  if (params.doctorId) q.doctorId = params.doctorId;
  if (params.visitType !== undefined) q.visitType = String(params.visitType);
  if (params.outcome !== undefined) q.outcome = String(params.outcome);
  return api("/visits/stats", { query: q, signal });
}

// Labels resolved at render time via t() — see usage below
const VISIT_TYPE_KEYS: Record<number, string> = {
  0: "visits.type_visit", 1: "visits.type_new", 2: "visits.type_follow_up",
  3: "visits.type_emergency", 4: "visits.type_routine", 5: "visits.type_walk_in",
};
const VISIT_TYPE_ICON: Record<number, string> = {
  0: "📋", 1: "📋", 2: "🔁", 3: "🚨", 4: "⏱", 5: "🚶",
};

const OUTCOME: Record<number, { label: string; fg: string; bg: string }> = {
  0: { label: "Open",      fg: "var(--warn-fg)",  bg: "var(--warn-bg)"  },
  1: { label: "Resolved",  fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
  2: { label: "Referred",  fg: "var(--info-fg)",  bg: "var(--info-bg)"  },
  3: { label: "Failed",    fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
  4: { label: "Cancelled", fg: "var(--ink-3)",    bg: "var(--rule)"     },
  5: { label: "No-show",   fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
};

const todayLocal = () => new Date().toISOString().split("T")[0];
const monthAgoLocal = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
};

export function VisitsListScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, hcenter } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPatientId = searchParams.get("patientId");

  // When arriving with ?patientId= (e.g. from "View all visits"), show all dates by default —
  // a patient's history is usually older than 1 month and we don't want to hide their visits.
  const [from, setFrom] = useState(() => (urlPatientId ? "" : monthAgoLocal()));
  const [to, setTo] = useState(() => (urlPatientId ? "" : todayLocal()));
  const [debouncedFrom, setDebouncedFrom] = useState(from);
  const [debouncedTo, setDebouncedTo] = useState(to);
  const [page, setPage] = useState(1);
  const [patientFilter, setPatientFilter] = useState<PatientListItem | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [visitType, setVisitType] = useState<number | "">("");
  const [outcome, setOutcome] = useState<number | "">("");
  const [addingVisit, setAddingVisit] = useState(false);
  const [previewPatientId, setPreviewPatientId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("visitDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState(false);
  /** Which row's outcome menu is currently open (visit id), if any. */
  const [outcomeMenuId, setOutcomeMenuId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();

  /** Inline outcome update — same mutation as the visit detail screen but
   *  keyed by visit id so multiple rows can mutate independently. */
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const outcomeMutation = useMutation({
    mutationFn: ({ visitId, outcome }: { visitId: string; outcome: number }) =>
      updateVisit(visitId, { outcome }),
    onSuccess: async (fresh, vars) => {
      // Iterate the live query cache and patch every list page that contains
      // this visit. Using getQueriesData / setQueryData with the full key for
      // each match avoids React Query v5's partial-match quirks with
      // setQueriesData.
      const entries = queryClient.getQueriesData<VisitListResponse>({
        queryKey: ["visits", "list"],
      });
      for (const [key, prev] of entries) {
        if (!prev?.data) continue;
        const hit = prev.data.some((row) => row.patientVisitId === vars.visitId);
        if (!hit) continue;
        queryClient.setQueryData<VisitListResponse>(key, {
          ...prev,
          data: prev.data.map((row) =>
            row.patientVisitId === vars.visitId ? { ...row, outcome: fresh.outcome } : row,
          ),
        });
      }
      // Force-refresh from the server as well so anything the optimistic
      // patch missed (stats, other cached filter combos) catches up. Awaiting
      // here so the menu doesn't close before the row actually updates.
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["visits", "list"], type: "active" }),
        queryClient.invalidateQueries({ queryKey: ["visits", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["visits", "detail", vars.visitId] }),
        queryClient.invalidateQueries({ queryKey: ["patients", "detail", fresh.patient.patientId] }),
      ]);
      setOutcomeMenuId(null);
    },
    onError: (err) => {
      setOutcomeError(err instanceof ApiError ? err.message : (err as Error).message || "Failed to update outcome");
      setOutcomeMenuId(null);
    },
  });

  // Load doctors for the doctor filter.
  const doctorsQ = useQuery({
    queryKey: ["users", "list"],
    queryFn: ({ signal }) => listUsers(signal),
    staleTime: 5 * 60_000,
  });
  const doctorOptions = useMemo(
    () =>
      (doctorsQ.data ?? [])
        .filter((u) => u.userType === 1 && u.isActive)
        .map((u) => ({ value: u.userId, label: u.fullName })),
    [doctorsQ.data],
  );

  // Default state = last 30 days range, no other filters applied.
  // Reset link is enabled whenever the user has deviated from this default.
  const hasFilter =
    !!patientFilter ||
    !!doctorId ||
    visitType !== "" ||
    outcome !== "" ||
    from !== monthAgoLocal() ||
    to !== todayLocal();

  // One detail query serves two purposes:
  //   1. Hydrating the picker from ?patientId= on first mount (e.g. from "View all visits").
  //   2. Powering the patient-brief banner whenever a patient is selected.
  const effectivePatientId = patientFilter?.patientId ?? urlPatientId ?? null;
  const patientDetailQ = useQuery({
    queryKey: ["patients", "detail", effectivePatientId],
    queryFn: ({ signal }) => getPatient(effectivePatientId!, signal),
    enabled: !!effectivePatientId,
    staleTime: 60_000,
  });
  useEffect(() => {
    // IMPORTANT: `patientFilter` is intentionally NOT in the deps. Including it would re-fire
    // this effect when Reset clears the picker, and in that intermediate render `urlPatientId`
    // can still hold the old id (router state updates separately from React state), causing
    // an unwanted re-hydration from the stale react-query cache.
    if (
      urlPatientId &&
      !patientFilter &&
      patientDetailQ.data &&
      patientDetailQ.data.patientId === urlPatientId
    ) {
      const d = patientDetailQ.data;
      setPatientFilter({
        patientId: d.patientId,
        nationalId: d.nationalId,
        fullName: d.fullName,
        fullNameAr: d.fullNameAr,
        sex: d.sex,
        dateOfBirth: d.dateOfBirth,
        mobileNumber: d.mobileNumber,
        email: d.email,
        photoUrl: d.photoUrl,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientDetailQ.data, urlPatientId]);

  // Keep ?patientId= in sync when the user changes the picker.
  const handlePatientFilterChange = (p: PatientListItem | null): void => {
    setPatientFilter(p);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (p) params.set("patientId", p.patientId);
    else params.delete("patientId");
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFrom(from);
      setDebouncedTo(to);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [from, to]);

  const filterParams = useMemo(() => ({
    from: debouncedFrom ? `${debouncedFrom}T00:00:00.000Z` : undefined,
    to: debouncedTo ? `${debouncedTo}T23:59:59.999Z` : undefined,
    patientId: patientFilter?.patientId,
    doctorId: doctorId || undefined,
    visitType: visitType === "" ? undefined : Number(visitType),
    outcome: outcome === "" ? undefined : Number(outcome),
  }), [debouncedFrom, debouncedTo, patientFilter?.patientId, doctorId, visitType, outcome]);

  const query = useQuery({
    queryKey: [
      "visits", "list",
      debouncedFrom, debouncedTo,
      patientFilter?.patientId,
      doctorId, visitType, outcome,
      page, sortBy, sortDir,
    ],
    queryFn: ({ signal }) =>
      listVisits({ ...filterParams, page, pageSize: PAGE_SIZE, sortBy, sortDir }, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // KPI stats — same filters minus pagination/sort. Cached separately.
  const statsQ = useQuery({
    queryKey: ["visits", "stats", debouncedFrom, debouncedTo, patientFilter?.patientId, doctorId, visitType, outcome],
    queryFn: ({ signal }) => getVisitStats(filterParams, signal),
    staleTime: 60_000,
  });

  // ── Quick filters ─────────────────────────────────────────────────────────
  const applyQuickFilter = (key: "today" | "week" | "open" | "mine"): void => {
    const today = todayLocal();
    if (key === "today") {
      setFrom(today);
      setTo(today);
    } else if (key === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setFrom(start.toISOString().split("T")[0]);
      setTo(today);
    } else if (key === "open") {
      setOutcome(0);
    } else if (key === "mine" && user?.userId) {
      setDoctorId(user.userId);
    }
    setPage(1);
  };

  // ── Saved presets ─────────────────────────────────────────────────────────
  type Preset = {
    name: string;
    from: string;
    to: string;
    patientId: string | null;
    doctorId: string;
    visitType: number | "";
    outcome: number | "";
    sortBy: SortBy;
    sortDir: SortDir;
  };
  const PRESETS_KEY = `teriac:visits-presets:${hcenter?.hcenterId ?? "anon"}:${user?.userId ?? "anon"}`;
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? (JSON.parse(raw) as Preset[]) : [];
    } catch {
      return [];
    }
  });
  const persistPresets = (next: Preset[]): void => {
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };
  const savePreset = (name: string): void => {
    const p: Preset = {
      name,
      from,
      to,
      patientId: patientFilter?.patientId ?? null,
      doctorId,
      visitType,
      outcome,
      sortBy,
      sortDir,
    };
    persistPresets([...presets.filter((x) => x.name !== name), p]);
  };
  const loadPreset = async (p: Preset): Promise<void> => {
    setFrom(p.from);
    setTo(p.to);
    setDoctorId(p.doctorId);
    setVisitType(p.visitType);
    setOutcome(p.outcome);
    setSortBy(p.sortBy);
    setSortDir(p.sortDir);
    setPage(1);
    if (p.patientId) {
      try {
        const pat = await getPatient(p.patientId);
        setPatientFilter({
          patientId: pat.patientId,
          nationalId: pat.nationalId,
          fullName: pat.fullName,
          fullNameAr: pat.fullNameAr,
          sex: pat.sex,
          dateOfBirth: pat.dateOfBirth,
          mobileNumber: pat.mobileNumber,
          email: pat.email,
          photoUrl: pat.photoUrl,
        });
      } catch {
        setPatientFilter(null);
      }
    } else {
      setPatientFilter(null);
    }
  };
  const deletePreset = (name: string): void => persistPresets(presets.filter((x) => x.name !== name));

  // ── CSV export ────────────────────────────────────────────────────────────
  const onExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const token = (await import("../../lib/auth/store")).authStore.getState().accessToken;
      const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/v1";
      const qs = new URLSearchParams(listVisitsQuery({ ...filterParams, page: 1, pageSize: 10_000, sortBy, sortDir }));
      const res = await fetch(`${base}/visits/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visits-${todayLocal()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── Sort toggling ─────────────────────────────────────────────────────────
  const toggleSort = (col: SortBy): void => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir(col === "visitDate" ? "desc" : "asc");
    }
    setPage(1);
  };

  const totalPages = useMemo(
    () => (query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1),
    [query.data],
  );

  const visits = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  // Browser tab title: include active patient filter + count + clinic suffix.
  const clinicSuffix = hcenter?.hcenterName?.trim() || "Teriac";
  const visitsLabel = t("nav.visits", { defaultValue: "Visits" });
  useDocumentTitle(
    patientFilter
      ? `${patientFilter.fullName} (${total}) - ${visitsLabel} - ${clinicSuffix}`
      : `${visitsLabel} (${total}) - ${clinicSuffix}`,
  );

  return (
    <>
      <PageHead
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={t("visits.title")}
        actions={
          <button
            type="button"
            onClick={() => setAddingVisit(true)}
            className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-600"
          >
            {t("visits.add_visit")}
          </button>
        }
      />

      {/* KPI stats strip */}
      <VisitStatsStrip stats={statsQ.data} loading={statsQ.isLoading} />

      {/* Quick-filter chips + saved presets */}
      <QuickFilterBar
        onApply={applyQuickFilter}
        presets={presets}
        onLoadPreset={loadPreset}
        onDeletePreset={deletePreset}
        onSavePreset={savePreset}
        hasFilter={hasFilter}
      />

      {/* Active filter chips */}
      <ActiveFilterChips
        patientFilter={patientFilter}
        doctorId={doctorId}
        doctors={doctorsQ.data}
        visitType={visitType}
        outcome={outcome}
        from={from}
        to={to}
        defaultFrom={monthAgoLocal()}
        defaultTo={todayLocal()}
        t={t}
        onClearPatient={() => setPatientFilter(null)}
        onClearDoctor={() => setDoctorId("")}
        onClearType={() => setVisitType("")}
        onClearOutcome={() => setOutcome("")}
        onClearDates={() => {
          setFrom(monthAgoLocal());
          setTo(todayLocal());
        }}
      />

      {/* Filters card */}
      <section className="relative mb-5 rounded-lg border border-rule bg-card shadow-1">
        <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="flex items-baseline gap-3">
            <h2 className="eyebrow text-ink-3">{t("common.filter")}</h2>
            {query.isFetching ? (
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                {t("common.loading")}
              </span>
            ) : (
              <span className="font-mono text-[12px] text-ink-3 tnum">
                {total}{" "}
                {total === 1
                  ? t("visits.col_visit_singular", { defaultValue: "visit" })
                  : t("visits.col_visit_plural", { defaultValue: "visits" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting || total === 0}
              title="Download the filtered list as CSV"
              className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 hover:border-rule-2 hover:text-ink-2 disabled:opacity-40"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            {hasFilter ? (
              <Link
                to="/visits"
                onClick={() => {
                  // Clear local state alongside the navigation so the picker, dates and
                  // dropdowns all return to their defaults in the same tick the URL clears.
                  setPatientFilter(null);
                  setDoctorId("");
                  setVisitType("");
                  setOutcome("");
                  setFrom(monthAgoLocal());
                  setTo(todayLocal());
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
          </div>
        </header>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Patient */}
          <div className="lg:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("visits.col_patient")}
            </label>
            <PatientCombobox
              id="visit-filter-patient"
              label=""
              value={patientFilter}
              onChange={handlePatientFilterChange}
            />
          </div>

          {/* Doctor */}
          <div>
            <label htmlFor="visit-filter-doctor" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("visits.col_doctor", { defaultValue: "Doctor" })}
            </label>
            <SearchableSelect
              id="visit-filter-doctor"
              value={doctorId}
              onChange={(v) => { setDoctorId(String(v)); setPage(1); }}
              emptyLabel={t("common.all", { defaultValue: "All doctors" })}
              options={doctorOptions}
            />
          </div>

          {/* Visit type */}
          <div>
            <label htmlFor="visit-filter-type" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("visits.col_type", { defaultValue: "Type" })}
            </label>
            <SearchableSelect
              id="visit-filter-type"
              value={visitType === "" ? "" : visitType}
              onChange={(v) => { setVisitType(v === "" ? "" : Number(v)); setPage(1); }}
              emptyLabel={t("common.all", { defaultValue: "All" })}
              options={[
                { value: 1, label: t("visits.type_new", { defaultValue: "New" }) },
                { value: 2, label: t("visits.type_follow_up", { defaultValue: "Follow-up" }) },
                { value: 3, label: t("visits.type_emergency", { defaultValue: "Emergency" }) },
                { value: 4, label: t("visits.type_routine", { defaultValue: "Routine" }) },
                { value: 5, label: t("visits.type_walk_in", { defaultValue: "Walk-in" }) },
              ]}
            />
          </div>

          {/* Outcome */}
          <div>
            <label htmlFor="visit-filter-outcome" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("visits.col_outcome", { defaultValue: "Outcome" })}
            </label>
            <SearchableSelect
              id="visit-filter-outcome"
              value={outcome === "" ? "" : outcome}
              onChange={(v) => { setOutcome(v === "" ? "" : Number(v)); setPage(1); }}
              emptyLabel={t("common.all", { defaultValue: "All" })}
              options={[
                { value: 0, label: t("visits.outcome_open", { defaultValue: "Open" }) },
                { value: 1, label: t("visits.outcome_resolved", { defaultValue: "Resolved" }) },
                { value: 2, label: t("visits.outcome_referred", { defaultValue: "Referred" }) },
                { value: 3, label: t("visits.outcome_failed", { defaultValue: "Failed" }) },
                { value: 4, label: t("visits.outcome_cancelled", { defaultValue: "Cancelled" }) },
                { value: 5, label: t("visits.outcome_no_show", { defaultValue: "No-show" }) },
              ]}
            />
          </div>

          {/* From */}
          <div>
            <label htmlFor="visit-filter-from" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("common.from")}
            </label>
            <input
              id="visit-filter-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>

          {/* To */}
          <div>
            <label htmlFor="visit-filter-to" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
              {t("common.to")}
            </label>
            <input
              id="visit-filter-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 font-mono text-[13px] tnum outline-none hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]"
            />
          </div>
        </div>
      </section>

      {/* Patient brief — shown once a patient is selected */}
      {patientFilter && patientDetailQ.data && (
        <PatientBriefHint p={patientDetailQ.data} />
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-1">
        {query.isLoading ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-3">{t("visits.loading")}</div>
        ) : query.error ? (
          <div className="px-5 py-12 text-center text-[13px] text-alert-fg">
            {(query.error as Error).message}
          </div>
        ) : visits.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-ink-3">
            {t("visits.no_visits")}
          </div>
        ) : (
          <>
          {outcomeError && (
            <div
              role="alert"
              className="m-4 flex items-start gap-2 rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg"
            >
              <span aria-hidden>⚠</span>
              <span className="flex-1">{outcomeError}</span>
              <button
                type="button"
                onClick={() => setOutcomeError(null)}
                aria-label="Dismiss"
                className="opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
          <table className="hidden w-full text-[13px] md:table">
            <thead>
              <tr className="border-b border-rule bg-card-2">
                <SortableTh col="visitDate" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>{t("visits.col_date")}</SortableTh>
                <SortableTh col="patient" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>{t("visits.col_patient")}</SortableTh>
                <SortableTh col="doctor" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} className="hidden md:table-cell">{t("visits.col_doctor")}</SortableTh>
                <th className="hidden px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3 lg:table-cell">{t("visits.col_type")}</th>
                <th className="hidden px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3 lg:table-cell">{t("visits.col_chief_complaint")}</th>
                <th className="px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3">{t("visits.col_status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-rule">
              {visits.map((v) => {
                return (
                  <tr
                    key={v.patientVisitId}
                    onClick={() => navigate(`/visits/${v.patientVisitId}`)}
                    className="cursor-pointer transition-colors duration-[150ms] hover:bg-card-2"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono tnum text-ink-2">{formatDateLong(v.visitDate)}</div>
                      <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-4">
                        {new Date(v.visitDate.includes(" ") ? v.visitDate.replace(" ", "T") + "Z" : v.visitDate)
                          .toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPatientId(v.patient.patientId);
                        }}
                        className="text-start"
                      >
                        <span
                          className="block font-medium text-ink underline-offset-4 hover:text-primary hover:underline"
                          dir="auto"
                        >
                          {v.patient.fullName}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-4">
                          {v.patient.nationalId}
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-2 md:table-cell">
                      {v.doctor?.fullName ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
                        <span aria-hidden>{VISIT_TYPE_ICON[v.visitType] ?? "📋"}</span>
                        {t(VISIT_TYPE_KEYS[v.visitType] ?? "visits.type_visit")}
                      </span>
                    </td>
                    <td className="hidden max-w-[260px] px-4 py-3 lg:table-cell">
                      {(() => {
                        const plain = toDisplayText(v.chiefComplaint);
                        return (
                          <>
                            <div className="truncate text-ink-3">
                              {plain ? plain.substring(0, 80) + (plain.length > 80 ? "…" : "") : "—"}
                            </div>
                            {(v.topDiagnosis || v.prescriptionCount > 0) && (
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-4">
                                {v.topDiagnosis && (
                                  <span className="truncate" title={v.topDiagnosis}>
                                    <span className="font-mono uppercase tracking-wider opacity-70">Dx</span>{" "}
                                    {v.topDiagnosis}
                                    {v.diagnosisCount > 1 && (
                                      <span className="opacity-70"> +{v.diagnosisCount - 1}</span>
                                    )}
                                  </span>
                                )}
                                {v.prescriptionCount > 0 && (
                                  <span className="font-mono">
                                    <span className="uppercase tracking-wider opacity-70">Rx</span> {v.prescriptionCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeMenu
                        size="sm"
                        currentOutcome={v.outcome}
                        open={outcomeMenuId === v.patientVisitId}
                        onToggle={() =>
                          setOutcomeMenuId((cur) =>
                            cur === v.patientVisitId ? null : v.patientVisitId,
                          )
                        }
                        onClose={() => setOutcomeMenuId(null)}
                        onSelect={(next) => {
                          // eslint-disable-next-line no-console
                          console.debug("[VisitsList] onSelect", {
                            visitId: v.patientVisitId,
                            next,
                            current: v.outcome,
                            willMutate: next !== v.outcome,
                          });
                          if (next !== v.outcome) {
                            outcomeMutation.mutate({ visitId: v.patientVisitId, outcome: next });
                          } else {
                            setOutcomeMenuId(null);
                          }
                        }}
                        pending={
                          outcomeMutation.isPending &&
                          outcomeMutation.variables?.visitId === v.patientVisitId
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}

        {/* Mobile card layout — replaces the table below md viewports. */}
        {visits.length > 0 && (
          <ul className="divide-y divide-dashed divide-rule md:hidden">
            {visits.map((v) => {
              return (
                <li
                  key={v.patientVisitId}
                  onClick={() => navigate(`/visits/${v.patientVisitId}`)}
                  className="cursor-pointer px-4 py-3 transition-colors duration-2 hover:bg-card-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-ink" dir="auto">
                        {v.patient.fullName}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
                        <span>{formatDateLong(v.visitDate)}</span>
                        {v.doctor && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{v.doctor.fullName}</span>
                          </>
                        )}
                      </div>
                      {(v.topDiagnosis || v.prescriptionCount > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
                          {v.topDiagnosis && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] text-primary-700">
                              Dx · {v.topDiagnosis.slice(0, 32)}
                              {v.topDiagnosis.length > 32 ? "…" : ""}
                            </span>
                          )}
                          {v.prescriptionCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                              Rx · {v.prescriptionCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <OutcomeMenu
                        size="sm"
                        currentOutcome={v.outcome}
                        open={outcomeMenuId === v.patientVisitId}
                        onToggle={() =>
                          setOutcomeMenuId((cur) =>
                            cur === v.patientVisitId ? null : v.patientVisitId,
                          )
                        }
                        onClose={() => setOutcomeMenuId(null)}
                        onSelect={(next) => {
                          // eslint-disable-next-line no-console
                          console.debug("[VisitsList] onSelect", {
                            visitId: v.patientVisitId,
                            next,
                            current: v.outcome,
                            willMutate: next !== v.outcome,
                          });
                          if (next !== v.outcome) {
                            outcomeMutation.mutate({ visitId: v.patientVisitId, outcome: next });
                          } else {
                            setOutcomeMenuId(null);
                          }
                        }}
                        pending={
                          outcomeMutation.isPending &&
                          outcomeMutation.variables?.visitId === v.patientVisitId
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-rule px-4 py-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("common.prev")}
            </button>
            <span className="font-mono text-[12px] text-ink-3 tnum">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-rule-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("common.next")} ›
            </button>
          </div>
        )}
      </div>
      <NewVisitModal
        open={addingVisit}
        patient={patientFilter ? { patientId: patientFilter.patientId, fullName: patientFilter.fullName } : null}
        onClose={() => setAddingVisit(false)}
      />

      <PatientPreviewModal
        patientId={previewPatientId}
        onClose={() => setPreviewPatientId(null)}
      />
    </>
  );
}

// ── Stats strip ──────────────────────────────────────────────────────────────

function VisitStatsStrip({
  stats,
  loading,
}: {
  stats?: VisitStats;
  loading: boolean;
}): JSX.Element {
  const tiles: Array<{ label: string; value: number; tone: "primary" | "warn" | "vital" | "alert" }> = [
    { label: "Total", value: stats?.total ?? 0, tone: "primary" },
    { label: "Open", value: stats?.open ?? 0, tone: "warn" },
    { label: "Resolved", value: stats?.resolved ?? 0, tone: "vital" },
    { label: "No-show", value: stats?.noShow ?? 0, tone: "alert" },
    { label: "Today", value: stats?.today ?? 0, tone: "primary" },
  ];
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} muted={loading} />
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: number;
  tone: "primary" | "warn" | "vital" | "alert";
  muted?: boolean;
}): JSX.Element {
  const colors = {
    primary: { rail: "bg-primary", text: "text-ink" },
    warn: { rail: "bg-warn-fg", text: "text-warn-fg" },
    vital: { rail: "bg-vital-fg", text: "text-vital-fg" },
    alert: { rail: "bg-alert-fg", text: "text-alert-fg" },
  }[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-rule bg-card shadow-1 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className={`absolute inset-y-0 start-0 w-[3px] ${colors.rail}`} />
      <div className="px-3 py-2 ps-4">
        <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </div>
        <div className={`mt-0.5 font-serif text-[22px] leading-none tnum ${colors.text}`}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ── Quick-filter chips + presets ────────────────────────────────────────────

interface QuickPreset {
  name: string;
  from: string;
  to: string;
  patientId: string | null;
  doctorId: string;
  visitType: number | "";
  outcome: number | "";
  sortBy: SortBy;
  sortDir: SortDir;
}

function QuickFilterBar({
  onApply,
  presets,
  onLoadPreset,
  onDeletePreset,
  onSavePreset,
  hasFilter,
}: {
  onApply: (key: "today" | "week" | "open" | "mine") => void;
  presets: QuickPreset[];
  onLoadPreset: (p: QuickPreset) => void;
  onDeletePreset: (name: string) => void;
  onSavePreset: (name: string) => void;
  hasFilter: boolean;
}): JSX.Element {
  const [showPresets, setShowPresets] = useState(false);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
        Quick
      </span>
      <QuickChip label="Today" onClick={() => onApply("today")} />
      <QuickChip label="This week" onClick={() => onApply("week")} />
      <QuickChip label="Open only" onClick={() => onApply("open")} />
      <QuickChip label="My visits" onClick={() => onApply("mine")} />

      <span className="mx-2 h-4 w-px bg-rule" aria-hidden />

      <button
        type="button"
        onClick={() => setShowPresets((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-2 hover:bg-paper-2"
      >
        Presets {presets.length > 0 && <span className="text-ink-4">({presets.length})</span>} {showPresets ? "▾" : "▸"}
      </button>

      {showPresets && (
        <div className="basis-full">
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-[10px] border border-rule bg-card-2 px-3 py-2">
            {presets.length === 0 ? (
              <span className="text-[12px] text-ink-3">No saved presets yet.</span>
            ) : (
              presets.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 font-mono text-[11px] font-medium text-ink-2 ring-1 ring-rule"
                >
                  <button
                    type="button"
                    onClick={() => onLoadPreset(p)}
                    className="text-ink-2 hover:text-primary-700"
                    title="Apply this preset"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePreset(p.name)}
                    aria-label={`Delete ${p.name}`}
                    className="text-ink-4 hover:text-alert-fg"
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt("Preset name?");
                  if (name && name.trim()) onSavePreset(name.trim());
                }}
                className="ms-auto rounded-full bg-primary px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-white hover:bg-primary-600"
              >
                + Save current
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full bg-paper-3 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-2 hover:bg-primary-100 hover:text-primary-700"
    >
      {label}
    </button>
  );
}

// ── Active filter chips ─────────────────────────────────────────────────────

function ActiveFilterChips({
  patientFilter,
  doctorId,
  doctors,
  visitType,
  outcome,
  from,
  to,
  defaultFrom,
  defaultTo,
  t,
  onClearPatient,
  onClearDoctor,
  onClearType,
  onClearOutcome,
  onClearDates,
}: {
  patientFilter: PatientListItem | null;
  doctorId: string;
  doctors: Array<{ userId: string; fullName: string }> | undefined;
  visitType: number | "";
  outcome: number | "";
  from: string;
  to: string;
  defaultFrom: string;
  defaultTo: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
  onClearPatient: () => void;
  onClearDoctor: () => void;
  onClearType: () => void;
  onClearOutcome: () => void;
  onClearDates: () => void;
}): JSX.Element | null {
  const doctor = doctorId ? doctors?.find((d) => d.userId === doctorId) : null;
  const datesChanged = from !== defaultFrom || to !== defaultTo;
  const anything =
    patientFilter || doctor || visitType !== "" || outcome !== "" || datesChanged;
  if (!anything) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
        Filtered by
      </span>
      {patientFilter && (
        <FilterChip
          label="Patient"
          value={patientFilter.fullName}
          tone="primary"
          onClear={onClearPatient}
        />
      )}
      {doctor && (
        <FilterChip label="Doctor" value={doctor.fullName} tone="primary" onClear={onClearDoctor} />
      )}
      {visitType !== "" && (
        <FilterChip
          label="Type"
          value={t(VISIT_TYPE_KEYS[Number(visitType)] ?? "visits.type_visit")}
          tone="info"
          onClear={onClearType}
        />
      )}
      {outcome !== "" && (
        <FilterChip
          label="Outcome"
          value={OUTCOME[Number(outcome)]?.label ?? String(outcome)}
          tone="info"
          onClear={onClearOutcome}
        />
      )}
      {datesChanged && (
        <FilterChip
          label="Dates"
          value={`${from || "any"} → ${to || "any"}`}
          tone="neutral"
          onClear={onClearDates}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  value,
  tone,
  onClear,
}: {
  label: string;
  value: string;
  tone: "primary" | "info" | "neutral";
  onClear: () => void;
}): JSX.Element {
  const cls = {
    primary: "bg-primary-100 text-primary-700",
    info: "bg-primary-50 text-primary-700",
    neutral: "bg-paper-3 text-ink-2",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${cls}`}
    >
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        title="Clear"
        className="-me-1 ms-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-current/10"
      >
        ✕
      </button>
    </span>
  );
}

// ── Sortable table header ───────────────────────────────────────────────────

function SortableTh({
  col,
  sortBy,
  sortDir,
  onClick,
  className = "",
  children,
}: {
  col: SortBy;
  sortBy: SortBy;
  sortDir: SortDir;
  onClick: (col: SortBy) => void;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  const active = sortBy === col;
  return (
    <th className={`px-4 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-ink-3 ${className}`}>
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {children}
        <span aria-hidden className="text-[9px] opacity-60">
          {active ? (sortDir === "desc" ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );
}

// ── Patient brief hint ───────────────────────────────────────────────────────

function PatientBriefHint({ p }: { p: PatientDetail }): JSX.Element {
  const initials = (p.firstName ?? p.fullName ?? "?").slice(0, 1).toUpperCase();
  const ageStr = formatAge(p.dateOfBirth);

  return (
    <div className="relative mb-5 overflow-hidden rounded-lg border border-rule bg-card shadow-1">
      <div
        aria-hidden
        className="absolute inset-y-0 w-[3px] bg-primary"
        style={{ insetInlineStart: 0 }}
      />
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 ps-5">
        <div className="size-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-700 text-center font-serif text-[15px] font-semibold leading-10 text-white">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              to={`/patients/${p.patientId}`}
              className="text-[14px] font-medium text-ink no-underline hover:text-primary-700"
              dir="auto"
            >
              {p.fullName || "—"}
            </Link>
            {p.fullNameAr && p.fullNameAr !== p.fullName && (
              <span className="text-[11.5px] text-ink-3" dir="rtl">
                {p.fullNameAr}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-3">
            <span className="font-mono uppercase tracking-wider">{p.nationalId || "—"}</span>
            <BriefDot />
            <span>{sexLabel(p.sex)}</span>
            <BriefDot />
            <span className="tnum">{ageStr}</span>
            <BriefDot />
            <span className="tnum">{formatDateLong(p.dateOfBirth)}</span>
            {p.mobileNumber && (
              <>
                <BriefDot />
                <span className="font-mono">{p.mobileNumber}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {p.summary.allergyCount > 0 && (
            <BriefStat icon="⚠" label="allergies" value={p.summary.allergyCount} tone="alert" />
          )}
          {p.summary.activeProblemCount > 0 && (
            <BriefStat label="active" value={p.summary.activeProblemCount} tone="vital" />
          )}
          {p.summary.chronicDiseaseCount > 0 && (
            <BriefStat label="chronic" value={p.summary.chronicDiseaseCount} />
          )}
          <BriefStat label="visits" value={p.summary.visitCount} />
        </div>

        <Link
          to={`/patients/${p.patientId}`}
          className="rounded-[10px] border border-rule bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 no-underline hover:border-rule-2"
        >
          Open chart
        </Link>
      </div>
    </div>
  );
}

function BriefStat({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "alert" | "vital";
  icon?: string;
}): JSX.Element {
  const colors: Record<typeof tone, string> = {
    neutral: "bg-paper-3 text-ink-2",
    alert: "bg-alert-bg text-alert-fg",
    vital: "bg-vital-bg text-vital-fg",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] ${colors[tone]}`}
    >
      {icon && <span aria-hidden>{icon}</span>}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="uppercase tracking-wider">{label}</span>
    </span>
  );
}

function BriefDot(): JSX.Element {
  return <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-4" />;
}

// ── Patient preview modal ────────────────────────────────────────────────────

function PatientPreviewModal({
  patientId,
  onClose,
}: {
  patientId: string | null;
  onClose: () => void;
}): JSX.Element {
  const q = useQuery({
    queryKey: ["patients", "detail", patientId],
    queryFn: ({ signal }) => getPatient(patientId!, signal),
    enabled: !!patientId,
    staleTime: 60_000,
  });
  const p = q.data ?? null;
  const initials = (p?.firstName ?? p?.fullName ?? "?").slice(0, 1).toUpperCase();
  const ageStr = p ? formatAge(p.dateOfBirth) : "—";

  return (
    <Modal
      open={!!patientId}
      onClose={onClose}
      title={p?.fullName || "Patient"}
      description={p?.nationalId ?? undefined}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2"
          >
            Close
          </button>
          {p && (
            <Link
              to={`/patients/${p.patientId}`}
              onClick={onClose}
              className="rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white no-underline hover:bg-primary-600"
            >
              Open chart
            </Link>
          )}
        </>
      }
    >
      {q.isLoading ? (
        <div className="py-10 text-center text-[13px] text-ink-3">Loading…</div>
      ) : q.error ? (
        <div className="rounded-[10px] bg-alert-bg px-3 py-2 text-[13px] text-alert-fg">
          {(q.error as Error).message}
        </div>
      ) : !p ? null : (
        <div className="space-y-5">
          {/* Header band */}
          <div className="relative overflow-hidden rounded-lg border border-rule bg-card-2 px-4 py-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 size-40 rounded-full"
              style={{
                background: "radial-gradient(circle, var(--primary-100) 0%, transparent 60%)",
                insetInlineEnd: "-3rem",
              }}
            />
            <div className="relative flex items-center gap-4">
              <div className="size-14 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-700 text-center font-serif text-[20px] font-semibold leading-[56px] text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-medium" dir="auto">
                  {p.fullName || "—"}
                </div>
                {p.fullNameAr && p.fullNameAr !== p.fullName && (
                  <div className="mt-0.5 text-[13px] text-ink-3" dir="rtl">
                    {p.fullNameAr}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-3">
                  <span className="font-mono uppercase tracking-wider">{p.nationalId || "—"}</span>
                  <BriefDot />
                  <span>{sexLabel(p.sex)}</span>
                  <BriefDot />
                  <span className="tnum">{ageStr}</span>
                  <BriefDot />
                  <span className="tnum">{formatDateLong(p.dateOfBirth)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PreviewStat label="Allergies" value={p.summary.allergyCount} alert={p.summary.allergyCount > 0} />
            <PreviewStat label="Chronic" value={p.summary.chronicDiseaseCount} />
            <PreviewStat label="Long-term Rx" value={p.summary.longTermMedicationCount} />
            <PreviewStat label="Problems" value={p.summary.activeProblemCount} />
            <PreviewStat label="Insurance" value={p.summary.activeInsuranceCount} />
            <PreviewStat label="Visits" value={p.summary.visitCount} />
            <div className="col-span-2 rounded-lg border border-rule bg-card-2 px-3 py-2">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-3">Last visit</div>
              <div className="mt-0.5 font-mono text-[13px] text-ink tnum">
                {p.summary.lastVisitDate ? formatDateLong(p.summary.lastVisitDate) : "—"}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-rule bg-card-2 px-4 py-3 sm:grid-cols-2">
            <PreviewField label="Mobile" value={p.mobileNumber} mono />
            <PreviewField label="Email" value={p.email} />
            <PreviewField label="Address" value={p.address} />
            <PreviewField label="Passport" value={p.passportNumber} mono />
          </div>

          {/* Special notes */}
          {p.specialNotes && p.specialNotes.length > 0 && (
            <div className="rounded-lg border border-warn-fg/30 bg-warn-bg px-4 py-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-warn-fg">
                Notes ({p.specialNotes.length})
              </div>
              <ul className="mt-2 space-y-1.5">
                {p.specialNotes.slice(0, 3).map((n) => (
                  <li key={n.patientSpecialNoteId} className="text-[13px] text-warn-fg" dir="auto">
                    • {n.note}
                  </li>
                ))}
                {p.specialNotes.length > 3 && (
                  <li className="text-[11.5px] text-warn-fg/70">
                    +{p.specialNotes.length - 3} more — open chart to see all
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PreviewStat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-rule bg-card-2 px-3 py-2">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div
        className={`mt-0.5 font-serif text-[20px] leading-none tnum ${
          alert ? "text-alert-fg" : "text-ink"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function PreviewField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className={`mt-0.5 text-[13px] text-ink ${mono ? "font-mono" : ""}`} dir="auto">
        {value && value.trim() !== "" ? value : "—"}
      </div>
    </div>
  );
}
