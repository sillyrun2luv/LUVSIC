import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { t } from "@/store/useI18nStore";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = t("confirmDialog.confirm"),
  cancelText = t("confirmDialog.cancel"),
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[72px] sm:pb-4 sm:items-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="surface relative w-full max-w-sm animate-riseIn p-6 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          {danger && <AlertTriangle size={18} className="text-red-300" />}
          <h3 className="font-display text-xl text-cream">{title}</h3>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:bg-ink-800"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={
              danger
                ? "rounded-full bg-red-500/90 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500"
                : "rounded-full bg-amber px-4 py-2 text-sm text-ink-950 transition-colors hover:bg-amber-glow"
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
