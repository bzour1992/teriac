import type { ReactNode } from "react";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** True for destructive actions — confirm button uses alert color. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Thin wrapper around <Modal> for yes/no confirmations.
 *
 * Used by:
 *   - Delete prescription
 *   - Future: discard unsaved changes, void invoice, etc.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: Props): JSX.Element {
  const confirmClass = destructive
    ? "bg-alert-fg text-white hover:opacity-90"
    : "bg-primary text-white hover:bg-primary-600";
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={title}
      dismissOnOverlay={!pending}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-[10px] border border-rule bg-card px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:border-rule-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-[10px] px-3.5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {body && <div className="text-[14px] leading-6 text-ink-2">{body}</div>}
    </Modal>
  );
}
