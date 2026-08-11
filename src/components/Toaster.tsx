import { useToastStore } from "@/store/useToastStore";
import { cn } from "@/lib/utils";

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[150] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex animate-riseIn items-center gap-3 rounded-full border px-4 py-2 text-sm backdrop-blur-md",
            t.tone === "success" && "border-amber/40 bg-amber/15 text-amber-glow",
            t.tone === "warn" && "border-red-400/40 bg-red-500/15 text-red-200",
            t.tone === "default" && "border-line bg-ink-850/90 text-cream",
          )}
        >
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0"
          >
            {t.message}
          </button>
          {t.action && (
            <button
              onClick={() => {
                t.action?.onAction();
                dismiss(t.id);
              }}
              className="shrink-0 rounded-full border border-current/40 px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-current/10"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
