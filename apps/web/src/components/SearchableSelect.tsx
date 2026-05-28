/**
 * Drop-in replacement for native <select> with typeahead search.
 *
 * - Same value/onChange API; accepts string or number values.
 * - Filters options client-side (good for short lists; for >200 items use a
 *   server-backed combobox like PatientCombobox).
 * - Full keyboard support: ArrowUp / ArrowDown / Enter / Esc / Home / End.
 * - Mirrors the visual style of existing inputs (rounded-[10px], border-rule,
 *   focus shadow, hover border-rule-2).
 *
 * Usage:
 *   <SearchableSelect
 *     value={form.statusId}
 *     onChange={(v) => setForm(f => ({ ...f, statusId: Number(v) }))}
 *     options={[{ value: 1, label: "Scheduled" }, ...]}
 *     placeholder="Select status…"
 *   />
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type SearchableValue = string | number;

export interface SearchableOption<V extends SearchableValue = SearchableValue> {
  value: V;
  label: string;
  /** Optional sub-label rendered below the main label. */
  description?: string;
  /** Optional badge text on the right side (e.g. "default"). */
  badge?: string;
  /** Disables this option. */
  disabled?: boolean;
}

export interface SearchableSelectProps<V extends SearchableValue> {
  value: V | "" | null | undefined;
  onChange: (value: V | "") => void;
  options: ReadonlyArray<SearchableOption<V>>;
  /** Placeholder when no value is selected. */
  placeholder?: string;
  /** Placeholder shown inside the search input when the dropdown is open. */
  searchPlaceholder?: string;
  /** Empty option label, e.g. "— All —". When provided, prepends a sentinel option. */
  emptyLabel?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  /** Render the chosen option differently (e.g. with an icon). */
  renderSelected?: (opt: SearchableOption<V>) => ReactNode;
  /** ClassName applied to the trigger button. */
  className?: string;
  /** ARIA label when no visible <label> precedes the control. */
  ariaLabel?: string;
  /**
   * When true, each option in the dropdown list shows its underlying `value`
   * as a small mono chip beside the label. Handy for enum-style selects (sex,
   * visit type, intensity) where the operator needs to know the numeric code
   * to enter in the rule editor's Default value box. The search input also
   * matches against the stringified value when this is on.
   */
  showValue?: boolean;
}

export function SearchableSelect<V extends SearchableValue>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel,
  id,
  disabled,
  required,
  renderSelected,
  className,
  ariaLabel,
  showValue,
}: SearchableSelectProps<V>): JSX.Element {
  const autoId = useId();
  const buttonId = id ?? `sel-${autoId}`;
  const listboxId = `${buttonId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  /** Viewport-relative position of the open menu — recomputed on open/scroll/resize. */
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>(
    { top: 0, left: 0, width: 0, openUp: false },
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Optionally prepend an "empty" sentinel option so the user can clear the selection.
  const fullOptions = useMemo<ReadonlyArray<SearchableOption<V | "">>>(() => {
    if (!emptyLabel) return options;
    return [{ value: "" as V | "", label: emptyLabel }, ...options];
  }, [options, emptyLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fullOptions;
    return fullOptions.filter((o) => {
      if (o.label.toLowerCase().includes(q)) return true;
      if (o.description && o.description.toLowerCase().includes(q)) return true;
      // When `showValue` is on, the value is visible — let the operator search by it.
      if (showValue && String(o.value).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [fullOptions, query, showValue]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  // Focus search input + reset highlight whenever opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      // Highlight the currently-selected option, or 0 if none.
      const idx = filtered.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click-outside to close. Since the menu is portaled to <body>, we also need
  // to count clicks inside the floating menu as "inside".
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Position the menu under (or above) the trigger using viewport coords, then
  // keep it pinned during scroll / resize. Rendered via portal so it escapes
  // any ancestor's `overflow:hidden` or `overflow:auto` (e.g. modal scroll
  // containers, scroll-locked drawers).
  useLayoutEffect(() => {
    if (!open) return;
    const compute = (): void => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const MENU_MAX_H = 320; // ~max-h-64 list + search header padding
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < MENU_MAX_H && r.top > spaceBelow;
      setMenuPos({
        top: openUp ? r.top - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
        openUp,
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  // Scroll the highlighted item into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const choose = (opt: SearchableOption<V | "">): void => {
    if (opt.disabled) return;
    onChange(opt.value as V | "");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(0, filtered.length - 1));
    } else if (e.key === "Enter") {
      if (filtered[highlight]) {
        e.preventDefault();
        choose(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const buttonClasses = [
    "flex w-full items-center justify-between gap-2",
    "rounded-[10px] border bg-card px-3 py-2 text-[13.5px]",
    "outline-none transition-colors duration-2",
    "hover:border-rule-2",
    disabled ? "cursor-not-allowed bg-paper-2 text-ink-4" : "text-ink",
    open
      ? "border-primary shadow-[0_0_0_3px_var(--primary-100)]"
      : "border-rule",
    className ?? "",
  ].join(" ");

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={buttonClasses}
        data-key={selected != null ? String(selected.value) : ""}
      >
        <span className={`min-w-0 truncate text-start ${selected ? "" : "text-ink-4"}`}>
          {selected
            ? renderSelected
              ? renderSelected(selected)
              : selected.label
            : placeholder}
        </span>
        <span aria-hidden className="shrink-0 text-[10px] text-ink-3">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open &&
        createPortal(
          (() => {
            // Build a fixed-position style so the menu floats above any
            // overflow-clipping ancestor (modals, drawers, cards).
            const style: CSSProperties = {
              position: "fixed",
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 1000,
              ...(menuPos.openUp
                ? { bottom: window.innerHeight - menuPos.top }
                : { top: menuPos.top }),
            };
            return (
              <div
                ref={menuRef}
                style={style}
                className="overflow-hidden rounded-lg border border-rule bg-card shadow-2"
                role="presentation"
              >
                <div className="border-b border-rule p-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setHighlight(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={searchPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-[8px] border border-rule bg-paper-2 px-2.5 py-1.5 text-[13px] outline-none focus:border-primary focus:bg-card focus:shadow-[0_0_0_2px_var(--primary-100)]"
                  />
                </div>

                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  className="max-h-64 overflow-y-auto py-1"
                >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12.5px] text-ink-3">No matches.</li>
            ) : (
              filtered.map((opt, i) => {
                const isActive = i === highlight;
                const isSelected = opt.value === value;
                return (
                  <li
                    key={String(opt.value) + ":" + i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-idx={i}
                    data-key={String(opt.value)}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(opt);
                    }}
                    className={[
                      "cursor-pointer px-3 py-1.5 text-[13px]",
                      opt.disabled ? "cursor-not-allowed text-ink-4" : "text-ink",
                      isActive && !opt.disabled ? "bg-primary-50" : "",
                      isSelected ? "font-medium text-primary-700" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {opt.badge && (
                        <span className="shrink-0 rounded-full bg-paper-3 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && !opt.badge && (
                        <span aria-hidden className="shrink-0 text-primary">✓</span>
                      )}
                    </div>
                    {opt.description && (
                      <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
                        {opt.description}
                      </div>
                    )}
                  </li>
                );
              })
            )}
                </ul>
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );
}
