import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewPatientModal } from "../screens/patients/NewPatientModal";
import { NewVisitModal } from "../screens/visits/NewVisitModal";
import { AppointmentFormModal } from "../screens/schedule/AppointmentFormModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionId = "patient" | "appointment" | "visit" | "billing" | "finance";

interface Action {
  id: ActionId;
  icon: string;
  label: string;
  shortcut: string;
  description: string;
  accent?: string;
}

const ACTIONS: Action[] = [
  {
    id: "patient",
    icon: "👥",
    label: "New patient",
    shortcut: "P",
    description: "Register a new patient",
  },
  {
    id: "appointment",
    icon: "🗓",
    label: "New appointment",
    shortcut: "A",
    description: "Schedule a clinic appointment",
  },
  {
    id: "visit",
    icon: "📋",
    label: "New visit",
    shortcut: "V",
    description: "Open a clinical encounter",
  },
  {
    id: "billing",
    icon: "💳",
    label: "Go to Billing",
    shortcut: "B",
    description: "View invoices and charges",
  },
  {
    id: "finance",
    icon: "📊",
    label: "Go to Finance",
    shortcut: "F",
    description: "Open the finance ledger",
  },
];

// ── Default appointment datetime (next round hour) ────────────────────────────
function nextRoundHour(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  const h  = String(d.getHours()).padStart(2, "0");
  return `${y}-${mo}-${dy}T${h}:00`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuickActions(): JSX.Element {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const [modal, setModal] = useState<ActionId | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);

  // ⌘K / Ctrl+K  —  toggle palette
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPanelOpen((o) => !o);
      }
      if (e.key === "Escape" && panelOpen) {
        setPanelOpen(false);
      }
      // Letter shortcuts only when panel is open and no modal is open
      if (panelOpen && !modal) {
        const key = e.key.toUpperCase();
        const action = ACTIONS.find((a) => a.shortcut === key);
        if (action) { e.preventDefault(); handleAction(action.id); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelOpen, modal]);

  // Click-outside to close panel
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent): void => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        fabRef.current && !fabRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  const handleAction = (id: ActionId): void => {
    setPanelOpen(false);
    if (id === "billing") { navigate("/billing"); return; }
    if (id === "finance") { navigate("/finance"); return; }
    setModal(id);
  };

  const closeModal = (): void => setModal(null);

  return (
    <>
      {/* Floating action button */}
      <div className="fixed z-40 no-print" style={{ insetInlineEnd: "1.5rem", bottom: "1.5rem" }}>
        {/* Panel */}
        {panelOpen && (
          <div
            ref={panelRef}
            className="mb-3 overflow-hidden rounded-xl border border-rule bg-card shadow-3"
            style={{ width: "280px" }}
            role="dialog"
            aria-label="Quick actions"
          >
            {/* Header */}
            <div className="border-b border-rule px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink">Quick actions</span>
                <kbd className="rounded-[6px] border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                  ⌘K
                </kbd>
              </div>
              <p className="mt-0.5 text-[11.5px] text-ink-4">
                Press the shortcut key or click an action
              </p>
            </div>

            {/* Actions */}
            <ul className="py-1">
              {ACTIONS.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => handleAction(action.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors duration-[100ms] hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-paper-3 text-base">
                      {action.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink">{action.label}</div>
                      <div className="text-[11px] text-ink-3">{action.description}</div>
                    </div>
                    <kbd className="shrink-0 rounded-[6px] border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {action.shortcut}
                    </kbd>
                  </button>
                </li>
              ))}
            </ul>

            {/* Footer */}
            <div className="border-t border-rule px-4 py-2">
              <p className="text-[11px] text-ink-4">
                <kbd className="rounded border border-rule bg-paper-2 px-1 font-mono text-[9px]">Esc</kbd>
                {" "}to close
              </p>
            </div>
          </div>
        )}

        {/* FAB */}
        <button
          ref={fabRef}
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label="Quick actions (⌘K)"
          aria-expanded={panelOpen}
          className={`flex size-12 items-center justify-center rounded-full shadow-3 transition-all duration-[200ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            panelOpen
              ? "bg-ink text-white scale-95"
              : "bg-primary text-white hover:bg-primary-600 hover:scale-105"
          }`}
        >
          <span
            aria-hidden
            className={`text-xl font-light transition-transform duration-[200ms] ${panelOpen ? "rotate-45" : ""}`}
          >
            +
          </span>
        </button>
      </div>

      {/* Modals */}
      <NewPatientModal open={modal === "patient"} onClose={closeModal} />

      <AppointmentFormModal
        open={modal === "appointment"}
        onClose={closeModal}
        item={null}
        defaultDateTimeLocal={nextRoundHour()}
      />

      <NewVisitModal
        open={modal === "visit"}
        onClose={closeModal}
        patient={null}
      />
    </>
  );
}
