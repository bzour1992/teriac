import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  searchMedicalConditions,
  type MedicalConditionSuggestion,
} from "../lib/coding/api";

interface Props {
  value: MedicalConditionSuggestion | null;
  onChange: (m: MedicalConditionSuggestion | null) => void;
  label?: ReactNode;
  placeholder?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional server-side filter: only allergy / chronic / hereditary items. */
  category?: "allergy" | "chronic" | "hereditary";
}

/**
 * Typeahead combobox for `medicalconditions` rows. Same WAI-ARIA shape as
 * MedicineCombobox; the differences are the data source and the option
 * rendering (chronic / allergy / hereditary chips + a verified mark).
 *
 * If we end up with a third combobox we'll extract a shared base, but resisting
 * the abstraction for now keeps both implementations easy to read.
 */
export function ConditionCombobox({
  value,
  onChange,
  label,
  placeholder = "Search condition…",
  id,
  required,
  disabled,
  category,
}: Props): JSX.Element {
  const autoId = useId();
  const inputId = id ?? `combobox-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [text, setText] = useState(value ? value.name : "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText(value ? value.name : "");
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({
    queryKey: ["medical-conditions", "search", debounced, category ?? null],
    queryFn: ({ signal }) =>
      searchMedicalConditions(debounced, signal, category ? { category } : undefined),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const suggestions: MedicalConditionSuggestion[] = query.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (m: MedicalConditionSuggestion): void => {
    onChange(m);
    setText(m.name);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && suggestions[highlight]) {
        e.preventDefault();
        choose(suggestions[highlight]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const onClear = (): void => {
    onChange(null);
    setText("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3"
        >
          {label}
          {required && <span className="ms-0.5 text-alert-fg">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && suggestions[highlight] ? `${listboxId}-opt-${highlight}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (value && e.target.value !== value.name) onChange(null);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 pe-9 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] disabled:bg-paper-2"
        />

        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear condition"
            className="absolute top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:bg-paper-3 hover:text-ink"
            style={{ insetInlineEnd: "0.375rem" }}
          >
            <span aria-hidden>×</span>
          </button>
        )}
      </div>

      {value && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {flagChips(value)}
        </div>
      )}

      {open && debounced.length >= 2 && (
        <ul
          role="listbox"
          id={listboxId}
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-rule bg-card shadow-2"
        >
          {query.isLoading && (
            <li className="px-3 py-2 text-[13px] text-ink-3">Searching…</li>
          )}
          {!query.isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-ink-3">No matches.</li>
          )}
          {suggestions.map((m, i) => {
            const isActive = i === highlight;
            return (
              <li
                key={m.medicalConditionId + "-" + i}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
                className={`cursor-pointer border-b border-dashed border-rule px-3 py-2 last:border-b-0 ${
                  isActive ? "bg-primary-50" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-[13.5px] font-medium">{m.name}</div>
                  {!m.isVerified && (
                    <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warn-fg">
                      unverified
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">{flagChips(m)}</div>
              </li>
            );
          })}
        </ul>
      )}

      {open && debounced.length > 0 && debounced.length < 2 && (
        <div
          aria-live="polite"
          className="absolute z-10 mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-ink-3 shadow-2"
        >
          Type at least 2 characters.
        </div>
      )}
    </div>
  );
}

function flagChips(m: MedicalConditionSuggestion): JSX.Element[] {
  const chips: JSX.Element[] = [];
  if (m.isChronic)
    chips.push(
      <span
        key="chronic"
        className="rounded-full bg-info-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-info-fg"
      >
        chronic
      </span>,
    );
  if (m.isAllergy)
    chips.push(
      <span
        key="allergy"
        className="rounded-full bg-alert-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-alert-fg"
      >
        allergy
      </span>,
    );
  if (m.isHereditary)
    chips.push(
      <span
        key="hereditary"
        className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-2"
      >
        hereditary
      </span>,
    );
  if (m.category)
    chips.push(
      <span
        key="cat"
        className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3"
      >
        {m.category}
      </span>,
    );
  return chips;
}
