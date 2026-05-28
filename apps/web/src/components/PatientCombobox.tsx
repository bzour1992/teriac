import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listPatients, type PatientListItem } from "../screens/patients/api";

interface Props {
  value: PatientListItem | null;
  onChange: (p: PatientListItem | null) => void;
  label?: ReactNode;
  required?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Patient typeahead. Reuses the list endpoint (search by name, NationalID,
 * phone, email — server already does this). Same WAI-ARIA shape as
 * MedicineCombobox / ConditionCombobox.
 */
export function PatientCombobox({
  value,
  onChange,
  label,
  required,
  id,
  disabled,
}: Props): JSX.Element {
  const autoId = useId();
  const inputId = id ?? `combobox-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [text, setText] = useState(value ? value.fullName || value.nationalId : "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText(value ? value.fullName || value.nationalId : "");
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({
    queryKey: ["patients", "combobox", debounced],
    queryFn: ({ signal }) => listPatients({ q: debounced, page: 1, pageSize: 15 }, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const suggestions: PatientListItem[] = query.data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (p: PatientListItem): void => {
    onChange(p);
    setText(p.fullName || p.nationalId || "");
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
          placeholder="Search patient by name, ID, phone…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (value && e.target.value !== (value.fullName || value.nationalId)) onChange(null);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 pe-9 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] disabled:bg-paper-2"
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear patient"
            className="absolute top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:bg-paper-3 hover:text-ink"
            style={{ insetInlineEnd: "0.375rem" }}
          >
            <span aria-hidden>×</span>
          </button>
        )}
      </div>

      {value && (
        <div className="mt-1 text-[12px] text-ink-3" dir="auto">
          <span className="font-mono">{value.nationalId || "—"}</span>
          {value.mobileNumber && (
            <span className="ms-2 font-mono text-ink-4">{value.mobileNumber}</span>
          )}
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
          {suggestions.map((p, i) => {
            const isActive = i === highlight;
            return (
              <li
                key={p.patientId + "-" + i}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className={`cursor-pointer border-b border-dashed border-rule px-3 py-2 last:border-b-0 ${
                  isActive ? "bg-primary-50" : "bg-card"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-medium" dir="auto">
                    {p.fullName || p.fullNameAr || "—"}
                  </span>
                  <span className="font-mono text-[11px] text-ink-3">{p.nationalId || ""}</span>
                </div>
                {p.mobileNumber && (
                  <div className="font-mono text-[11px] text-ink-4">{p.mobileNumber}</div>
                )}
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
