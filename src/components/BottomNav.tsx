import { LayoutDashboard, NotebookPen, History, LineChart } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import type { ViewKey } from "@/types";
import { cn } from "@/lib/utils";

const ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "概览", icon: LayoutDashboard },
  { key: "record", label: "记录", icon: NotebookPen },
  { key: "history", label: "历史", icon: History },
  { key: "insights", label: "洞察", icon: LineChart },
];

export default function BottomNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);

  return (
    <nav className="sticky bottom-0 z-30 mt-8 border-t border-line/70 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                active ? "text-amber-glow" : "text-muted hover:text-mist",
              )}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-amber shadow-glow" />
              )}
              <Icon size={20} strokeWidth={1.6} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
