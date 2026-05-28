import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  /** Controls visibility. Component is unmounted from the DOM when false. */
  open: boolean;
  /** Called when user dismisses via overlay click, ESC, or the X button. */
  onClose: () => void;
  /** Header title. If omitted, no header is rendered. */
  title?: ReactNode;
  /** Optional secondary text under the title. */
  description?: ReactNode;
  /** Footer slot — typically action buttons. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Max-width preset. Default `md` (560px). */
  size?: ModalSize;
  /** Hide the close (×) button. Default false. */
  hideClose?: boolean;
  /** Prevent dismissing via overlay click or ESC. Use for destructive confirmations. */
  dismissOnOverlay?: boolean;
  /** Optional element id to receive focus on open (e.g. a primary input). */
  initialFocusId?: string;
  /** ARIA labelled-by override; otherwise we generate one. */
  ariaLabel?: string;
}

const SIZE_PX: Record<ModalSize, string> = {
  sm: "420px",
  md: "560px",
  lg: "720px",
  xl: "960px",
};

/**
 * General-purpose modal dialog.
 *
 * - Portaled to <body> so it sits above any stacking context.
 * - ESC key + overlay click dismiss (suppressible via `dismissOnOverlay={false}`).
 * - Focus is moved into the dialog on open and returned to the previously-focused
 *   element on close. Tab cycles inside the dialog (focus trap).
 * - Body scroll is locked while the modal is open.
 * - RTL-aware via Tailwind logical classes — no `left`/`right`.
 * - Uses design-system tokens: card, rule, shadow-3, radius-lg, dur-3, ease-emphasized.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
 *     ...
 *   </Modal>
 */
export function Modal(props: ModalProps): JSX.Element | null {
  const {
    open,
    onClose,
    title,
    description,
    footer,
    children,
    size = "md",
    hideClose = false,
    dismissOnOverlay = true,
    initialFocusId,
    ariaLabel,
  } = props;

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Body scroll lock + focus restore.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus to either the requested element or the dialog container.
    const t = setTimeout(() => {
      if (initialFocusId) {
        const el = document.getElementById(initialFocusId);
        if (el) {
          el.focus();
          return;
        }
      }
      dialogRef.current?.focus();
    }, 0);

    return (): void => {
      clearTimeout(t);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, initialFocusId]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (!open) return;
      if (e.key === "Escape" && dismissOnOverlay) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusable = getFocusable(root);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, onClose, dismissOnOverlay],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const labelledBy = title ? titleId : undefined;
  const describedBy = description ? descId : undefined;

  return createPortal(
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      onKeyDown={onKeyDown}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => dismissOnOverlay && onClose()}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-3 ease-emphasized"
        style={{ animation: "teriac-fade-in 220ms cubic-bezier(0.3, 0, 0, 1)" }}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-lg border border-rule bg-card shadow-3 outline-none"
        style={{
          maxWidth: SIZE_PX[size],
          maxHeight: "calc(100vh - 64px)",
          animation: "teriac-modal-in 220ms cubic-bezier(0.3, 0, 0, 1)",
        }}
      >
        {(title || !hideClose) && (
          <header className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="font-serif text-xl leading-7 tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-[13px] text-ink-3">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-me-1 -mt-1 rounded-[10px] p-2 text-ink-3 transition-colors duration-2 hover:bg-paper-3 hover:text-ink"
              >
                <span aria-hidden className="block size-4 text-base leading-4">×</span>
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-rule bg-card-2 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
  );
}
