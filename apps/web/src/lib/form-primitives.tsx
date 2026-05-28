// Shared form primitives. Required for new modals per CLAUDE.md.
// Old modals still inline-copy these — TODO migrate as we touch them.

import type { ReactNode } from "react";
import { SearchableSelect } from "../components/SearchableSelect";

const INPUT_CLS =
  "w-full rounded-[10px] border border-rule bg-card px-3 py-2 text-[13.5px] outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-100)]";

const TEXTAREA_CLS =
  "w-full resize-y rounded-[10px] border border-rule bg-card-2 px-3 py-2 text-[13.5px] leading-6 outline-none transition-colors duration-2 hover:border-rule-2 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_var(--primary-100)]";

export function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11.5px] font-medium uppercase tracking-wider text-ink-3"
    >
      {children}
      {required && <span className="ms-0.5 text-alert-fg">*</span>}
    </label>
  );
}

export function Section({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <fieldset className="rounded-[10px] border border-rule p-4">
      <legend className="px-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  mono,
  required,
  rtl,
  readOnly,
  disabled,
  type = "text",
  min,
  max,
  step,
  inputMode,
}: {
  id?: string;
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
  rtl?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  type?: "text" | "date" | "datetime-local" | "number" | "email" | "tel" | "password" | "search";
  min?: number | string;
  max?: number | string;
  step?: number | string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "search" | "url" | "none";
}): JSX.Element {
  const cls = [
    INPUT_CLS,
    mono ? "font-mono tnum" : "",
    readOnly || disabled ? "bg-paper-2 text-ink-3" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      {label !== undefined && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        dir={rtl ? "rtl" : "auto"}
        className={cls}
      />
    </div>
  );
}

export function Textarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
  readOnly,
  disabled,
  rtl,
}: {
  id?: string;
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  rtl?: boolean;
}): JSX.Element {
  const cls = [TEXTAREA_CLS, readOnly || disabled ? "bg-paper-2 text-ink-3" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      {label !== undefined && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir={rtl ? "rtl" : "auto"}
        className={cls}
      />
    </div>
  );
}

export function NumberSelect<T extends number>({
  label,
  value,
  options,
  onChange,
  showValue,
}: {
  label?: ReactNode;
  value: T;
  options: ReadonlyArray<{ v: T; label: string }>;
  onChange: (v: T) => void;
  /** Show each option's numeric code as a chip next to the label. */
  showValue?: boolean;
}): JSX.Element {
  return (
    <div>
      {label !== undefined && <FieldLabel>{label}</FieldLabel>}
      <SearchableSelect
        value={value}
        onChange={(v) => onChange(Number(v) as T)}
        showValue={showValue}
        options={options.map((o) => ({ value: o.v, label: o.label }))}
      />
    </div>
  );
}

export function SelectFreeText({
  id,
  label,
  value,
  options,
  onChange,
  required,
  readOnly,
  disabled,
}: {
  id?: string;
  label?: ReactNode;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}): JSX.Element {
  const listId = `dl-${String(label).replace(/\s+/g, "")}-${options[0] ?? ""}`;
  const cls = [INPUT_CLS, readOnly || disabled ? "bg-paper-2 text-ink-3" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      {label !== undefined && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <input
        id={id}
        list={listId}
        type="text"
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

// ---- Diff helpers ----

export function nonEmpty(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}

/** True if at least one string in the array is non-empty after trimming. */
export function anyNonEmpty(arr: ReadonlyArray<string | null | undefined>): boolean {
  return arr.some((s) => s != null && String(s).trim().length > 0);
}

/**
 * Apply per-clinic default values to a blank form state. Only keys that
 * already exist on the form are copied — extras in the defaults map are
 * ignored, so it's safe to call with the entity-wide map.
 *
 * Usage in a modal's open-effect (add mode only — never seed over edit data):
 *
 *   useEffect(() => {
 *     if (!open) return;
 *     if (item) { setForm(initial); return; }
 *     setForm(applyDefaults(blankForm(null), rules.defaults));
 *   }, [open, item, initial, rules.defaults]);
 */
export function applyDefaults<T extends object>(
  blank: T,
  defaults: Record<string, string>,
): T {
  const next: Record<string, unknown> = { ...(blank as Record<string, unknown>) };
  for (const [key, value] of Object.entries(defaults)) {
    if (key in next) next[key] = value;
  }
  return next as T;
}

/** Convert a stored datetime ("2026-03-15 00:00:00.000" or ISO) to YYYY-MM-DD. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
