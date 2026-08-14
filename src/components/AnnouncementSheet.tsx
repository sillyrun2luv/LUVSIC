import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Megaphone, Sparkles, AlertCircle } from "lucide-react";
import { useAnnouncementStore, type AnnouncementType } from "@/store/useAnnouncementStore";

const STYLES: Record<
  AnnouncementType,
  { Icon: typeof Megaphone; color: string; bg: string }
> = {
  info: { Icon: Megaphone, color: "text-mist", bg: "bg-mist/15" },
  update: { Icon: Sparkles, color: "text-amber-glow", bg: "bg-amber/15" },
  warn: { Icon: AlertCircle, color: "text-amber-glow", bg: "bg-amber/15" },
};

export default function AnnouncementSheet() {
  const announcement = useAnnouncementStore((s) => s.announcement);
  const open = useAnnouncementStore((s) => s.sheetOpen);
  const dismiss = useAnnouncementStore((s) => s.dismiss);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!announcement || !open) return null;

  const { Icon, color, bg } = STYLES[announcement.type] ?? STYLES.info;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted hover:text-mist"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="mb-5 text-center">
          <div
            className={`mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full ${bg} ${color}`}
          >
            <Icon size={22} />
          </div>
          <p className="font-display text-lg text-cream">{announcement.title}</p>
        </div>

        <div className="mb-6 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-mist">
          {announcement.content}
        </div>

        <button
          onClick={dismiss}
          className="w-full rounded-full bg-cream py-3 text-sm font-medium text-ink-900 transition-colors hover:bg-mist"
        >
          我知道了
        </button>
      </div>
    </div>,
    document.body,
  );
}
