import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const OUTCOME: Record<number, { label: string; fg: string; bg: string }> = {
  0: { label: "Open", fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
  1: { label: "Resolved", fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
  2: { label: "Referred", fg: "var(--info-fg)", bg: "var(--info-bg)" },
  3: { label: "Failed", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
  4: { label: "Cancelled", fg: "var(--ink-3)", bg: "var(--rule)" },
  5: { label: "No show", fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
};

interface Props {
  currentOutcome: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (next: number) => void;
  pending: boolean;
  /** Small variant — used in list rows. */
  size?: "sm" | "md";
}

/**
 * Quick-pick popover for the visit Outcome. Renders the current outcome as a
 * tinted pill (matches the design-system status-pill spec) with a ▾ chevron;
 * clicking opens a portaled menu of all six outcomes.
 *
 * The menu portals to document.body so it can render above ancestors with
 * `overflow:hidden` (e.g. the visit header card's radial-wash clip, or table
 * row containers).
 */
export function OutcomeMenu({
  currentOutcome,
  open,
  onToggle,
  onClose,
  onSelect,
  pending,
  size = "md",
}: Props): JSX.Element {
  const cur = OUTCOME[currentOutcome] ?? {
    label: `Outcome ${currentOutcome}`,
    fg: "var(--ink-3)",
    bg: "var(--rule)",
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Position the portaled menu against the trigger's bounding rect. Re-run on
  // every open and on scroll/resize so it tracks the page even mid-interaction.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = (): void => {
      const r = triggerRef.current?.getBoundingClientRect();
      // A `display:none` ancestor (e.g. the responsive list view that's hidden
      // at the current breakpoint) yields a zero-size rect. Skip positioning
      // so we don't render a duplicate menu anchored at (0,0) — the visible
      // sibling layout will render its own correctly-positioned menu.
      if (!r || (r.width === 0 && r.height === 0)) {
        setPos(null);
        return;
      }
      const width = 180;
      // Pin to the inline-end edge of the trigger so the menu's right side
      // aligns with the pill's right side. Clamp to viewport so list rows
      // near the edge stay visible.
      let left = r.right - width;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      // Flip above the trigger if there's not enough room below.
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < 260 ? r.top - 260 : r.bottom + 6;
      setPos({ top, left, width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click + Esc. Trigger + portaled menu count as "inside".
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const sizing =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[10.5px]"
      : "gap-1.5 px-3 py-1.5 text-[11.5px]";
  const dotSize = size === "sm" ? "size-1" : "size-1.5";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          // Stop bubbling so a click on the chip inside a clickable table row
          // doesn't also navigate to the visit detail.
          e.stopPropagation();
          onToggle();
        }}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change outcome"
        className={`inline-flex items-center rounded-full font-mono font-medium uppercase tracking-wider transition-opacity duration-2 hover:opacity-80 disabled:opacity-50 ${sizing}`}
        style={{ background: cur.bg, color: cur.fg }}
      >
        <span className={`${dotSize} rounded-full`} style={{ background: cur.fg }} />
        {pending ? "Saving…" : cur.label}
        <span aria-hidden className="text-[9px] opacity-70">▾</span>
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            // Stop clicks inside the menu from bubbling up to a clickable
            // ancestor (e.g. a table row that navigates on click).
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden rounded-[10px] border border-rule bg-card shadow-3"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 1000,
            }}
          >
            <div className="border-b border-rule px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3">
              Change outcome
            </div>
            <ul className="py-1">
              {Object.entries(OUTCOME).map(([keyStr, o]) => {
                const key = Number(keyStr);
                const active = key === currentOutcome;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="menuitem"
                      // Use onMouseDown so we beat the parent row's onClick
                      // even if React's synthetic event order surprises us.
                      // Also stop both phases of bubbling to be safe.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // eslint-disable-next-line no-console
                        console.debug("[OutcomeMenu] select", { key, current: currentOutcome });
                        onSelect(key);
                      }}
                      disabled={pending}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-[13px] transition-colors duration-2 ${
                        active ? "bg-card-2 font-medium text-ink" : "text-ink-2 hover:bg-card-2"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: o.fg }}
                      />
                      <span className="flex-1">{o.label}</span>
                      {active && <span aria-hidden className="text-[12px] text-ink-3">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
