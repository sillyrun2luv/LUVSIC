import { LayoutDashboard, NotebookPen, Globe, UserCircle } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useFriendStore } from "@/store/useFriendStore";
import { t } from "@/store/useI18nStore";
import type { ViewKey } from "@/types";
import { cn } from "@/lib/utils";

const ITEMS: { key: ViewKey; labelKey: string; icon: typeof LayoutDashboard; badge?: "planet" }[] = [
  { key: "overview", labelKey: "bottomNav.overview", icon: LayoutDashboard },
  { key: "record", labelKey: "bottomNav.record", icon: NotebookPen },
  { key: "friends", labelKey: "bottomNav.planet", icon: Globe, badge: "planet" },
  { key: "profile", labelKey: "bottomNav.profile", icon: UserCircle },
];

export default function BottomNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const pendingCount = useFriendStore((s) => s.pendingCount);
  const reminderUnread = useFriendStore((s) => s.reminderUnread);

  return (
    <nav className="sticky bottom-0 z-30 mt-8 border-t border-line/70 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ key, labelKey, icon: Icon, badge }) => {
          const active = view === key;
          const badgeCount = badge === "planet" ? pendingCount + reminderUnread : 0;
          const showBadge = !!badge && badgeCount > 0;
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
              <div className="relative">
                <Icon size={20} strokeWidth={1.6} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1 min-w-[16px] h-4 rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-ink-950 flex items-center justify-center">
                    {badgeCount > 99 ? t("bottomNav.pendingBadge") : badgeCount}
                  </span>
                )}
              </div>
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
