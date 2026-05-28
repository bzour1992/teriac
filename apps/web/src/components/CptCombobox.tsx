import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { searchCpt, type CptSuggestion } from "../lib/coding/api";

interface Props {
  value: CptSuggestion | null;
  onChange: (s: CptSuggestion | null) => void;
  label?: ReactNode;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CptCombobox({
  value,
  onChange,
  label,
  id,
  required,
  disabled,
}: Props): JSX.Element {
  const autoId = useId();
  const inputId = id ?? `cpt-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [text, setText] = useState(value ? `${value.cptCode} — ${value.shortDescription}` : "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText(value ? `${value.cptCode} — ${value.shortDescription}` : "");
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 280);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({
    queryKey: ["cpt", "search", debounced],
    queryFn: ({ signal }) => searchCpt(debounced, signal, { limit: 20 }),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const suggestions: CptSuggestion[] = query.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (s: CptSuggestion): void => {
    onChange(s);
    setText(`${s.cptCode} — ${s.shortDescription}`);
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
      if (open && suggestions[highlight]) { e.preventDefault(); choose(suggestions[highlight]); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); }
    }
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
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={disabled}
          placeholder="CPT code or procedure…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (value) onChange(null);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-[10px] border border-rule bg-card px-3 py-2 pe-9 font-mono text-[13px] outline-none transition-colors duration-[150ms] hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)] disabled:bg-paper-2"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setText(""); setOpen(false); inputRef.current?.focus(); }}
            aria-label="Clear"
            className="absolute top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:bg-paper-3"
            style={{ insetInlineEnd: "0.375rem" }}
          >
            ×
          </button>
        )}
      </div>

      {value && (
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-[11.5px] font-medium text-primary-700">{value.cptCode}</span>
          {value.sgroup && (
            <span className="rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
              {value.sgroup}
            </span>
          )}
        </div>
      )}

      {open && debounced.length >= 2 && (
        <ul
          role="listbox"
          id={listboxId}
          className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-rule bg-card shadow-2"
        >
          {query.isLoading && (
            <li className="px-3 py-2 text-[13px] text-ink-3">Searching…</li>
          )}
          {!query.isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-ink-3">No CPT codes found.</li>
          )}
          {suggestions.map((s, i) => {
            const isActive = i === highlight;
            return (
              <li
                key={s.cptCodeId}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                className={`cursor-pointer border-b border-dashed border-rule px-3 py-2.5 last:border-b-0 ${
                  isActive ? "bg-primary-50" : "bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-mono text-[12px] font-semibold text-primary-700 pt-px">
                    {s.cptCode}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{s.shortDescription}</div>
                    {s.longDescription && s.longDescription !== s.shortDescription && (
                      <div className="mt-0.5 text-[11.5px] text-ink-3 line-clamp-1">
                        {s.longDescription}
                      </div>
                    )}
                  </div>
                  {s.sgroup && (
                    <span className="ms-auto shrink-0 rounded-full bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase text-ink-4">
                      {s.sgroup}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && debounced.length > 0 && debounced.length < 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-ink-3 shadow-2">
          Type at least 2 characters.
        </div>
      )}
    </div>
  );
}
