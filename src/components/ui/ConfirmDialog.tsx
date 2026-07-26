/**
 * Small styled confirm dialog used in place of window.confirm()/alert().
 * Matches the app's dark theme surface/border tokens.
 */

import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-dark-border bg-surface-elevated p-5 shadow-2xl outline-none"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-text-primary mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-text-muted mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-surface-raised hover:bg-surface text-text-primary font-medium rounded-lg border border-dark-border transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
              danger
                ? 'bg-danger text-gray-950 hover:bg-red-400'
                : 'bg-accent text-gray-950 hover:bg-accent-strong'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
