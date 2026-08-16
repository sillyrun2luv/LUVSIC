import { useEffect, useRef, useState } from "react";
import { Bell, Heart, Sparkles, Loader2, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFriendStore } from "@/store/useFriendStore";
import {
  getReceivedFriendReminders,
  markFriendRemindersRead,
  deleteFriendReminder,
  type ReceivedFriendReminder,
  type FriendReminderCategory,
} from "@/lib/friends";
import {
  loadCachedReminders,
  saveCachedReminders,
  mergeReminders,
  markCachedRead,
  removeCachedReminder,
  clearCachedReminders,
} from "@/lib/reminderCache";
import Avatar from "@/components/Avatar";
import { t } from "@/store/useI18nStore";
import { cn } from "@/lib/utils";

function formatAgo(ts: number): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return t("common.justNow");
    if (diff < 3600) return t("date.intervalMinutesAgo", Math.floor(diff / 60));
    if (diff < 86400) return t("date.intervalHoursAgo", Math.floor(diff / 3600));
    if (diff < 86400 * 7) return t("date.intervalDaysAgo", Math.floor(diff / 86400));
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

function categoryMeta(c: FriendReminderCategory): { label: string; chip: string; icon: React.ReactNode } {
  if (c === "care_health") {
    return {
      label: t("friendReminder.careTitle"),
      chip: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
      icon: <Heart size={13} />,
    };
  }
  return {
    label: t("friendReminder.relaxTitle"),
    chip: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
    icon: <Sparkles size={13} />,
  };
}

/**
 * 收到好友提醒的列表（收件箱内容本体）。
 * 假设调用方已确保登录态；挂载即拉取并把未读标记为已读（清空红点）。
 * 既可作为独立页面，也可嵌入「星球」Tab 内。
 */
export default function ReminderList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReceivedFriendReminder[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 当前登录用户（用于缓存命名空间，避免同设备多账号串扰）
      let uid: string | null = null;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        uid = user?.id ?? null;
      } catch {
        /* 忽略 */
      }
      uidRef.current = uid;
      if (cancelled) return;

      // 1) 先展示本机缓存（即时、离线可用）
      const cached = loadCachedReminders(uid);
      if (cached.length > 0) {
        setItems(cached);
        setLoading(false);
      }

      // 2) 再从云端同步并写回本机（云端是权威来源，本地是超集）
      try {
        const list = await getReceivedFriendReminders(50, 0);
        if (cancelled) return;
        const merged = mergeReminders(cached, list);
        setItems(merged);
        saveCachedReminders(uid, merged);

        const unreadIds = merged.filter((r) => r.readAt === null).map((r) => r.id);
        if (unreadIds.length > 0) {
          try {
            await markFriendRemindersRead(unreadIds);
          } catch {
            /* 云端标记失败不影响本地展示 */
          }
          const updated = merged.map((r) =>
            unreadIds.includes(r.id) ? { ...r, readAt: Date.now() } : r,
          );
          setItems(updated);
          saveCachedReminders(uid, updated);
          useFriendStore.setState({ reminderUnread: 0 });
        }
      } catch {
        // 云端失败：保留本地缓存（若有）
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadCount = items.filter((r) => r.readAt === null).length;

  const handleMarkAll = async () => {
    const unreadIds = items.filter((r) => r.readAt === null).map((r) => r.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      try {
        await markFriendRemindersRead(unreadIds);
      } catch {
        /* 云端失败也继续本地更新 */
      }
      const updated = items.map((r) =>
        unreadIds.includes(r.id) ? { ...r, readAt: Date.now() } : r,
      );
      setItems(updated);
      markCachedRead(uidRef.current, unreadIds);
      useFriendStore.setState({ reminderUnread: 0 });
    } finally {
      setMarkingAll(false);
    }
  };

  // 删除单条：云端 + 本机缓存同步移除
  const handleDelete = async (id: string) => {
    try {
      await deleteFriendReminder(id);
    } catch {
      /* 云端失败也继续本地移除 */
    }
    removeCachedReminder(uidRef.current, id);
    setItems((prev) => prev.filter((r) => r.id !== id));
    // 同步底部红点（云端删除后未读数会下降）
    useFriendStore.getState().refreshReminderUnread().catch(() => {});
  };

  // 清空本机缓存（两步确认）：仅删本地，云端仍在，下次打开会重新同步
  const handleClearCache = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearCachedReminders(uidRef.current);
    setItems([]);
    setConfirmClear(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line/80 bg-ink-900/40 px-5 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-muted ring-1 ring-line/60">
          <Bell size={22} />
        </div>
        <div className="text-sm font-medium text-cream">{t("reminders.empty")}</div>
        <p className="max-w-sm text-xs leading-relaxed text-muted">{t("reminders.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted">{t("reminders.unreadCount", unreadCount)}</span>
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="flex h-8 items-center gap-1.5 rounded-full border border-line/70 bg-ink-900/70 px-3 text-xs text-mist transition hover:border-amber/40 hover:text-amber-glow disabled:opacity-60"
          >
            {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
            {t("reminders.markAllRead")}
          </button>
        </div>
      )}
      <div className="flex items-center justify-end px-1">
        <button
          onClick={handleClearCache}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition",
            confirmClear
              ? "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
              : "border-line/70 bg-ink-900/70 text-muted hover:border-rose-500/40 hover:text-rose-300",
          )}
        >
          <Trash2 size={13} />
          {confirmClear ? t("reminders.confirmClear") : t("reminders.clearCache")}
        </button>
      </div>
      <p className="px-1 text-[11px] text-muted/70">{t("reminders.cachedHint")}</p>
      <div className="space-y-2">
        {items.map((r) => {
          const meta = categoryMeta(r.category);
          const unread = r.readAt === null;
          return (
            <div
              key={r.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3",
                unread ? "border-amber/30 bg-amber/[0.06]" : "border-line/70 bg-ink-900/60",
              )}
            >
              <div className="relative shrink-0">
                <Avatar value={r.fromAvatar} size={44} />
                {unread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-ink-900" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-cream">{r.fromName}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1",
                      meta.chip,
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted">{formatAgo(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-mist">{r.message}</p>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                aria-label={t("reminders.deleteOne")}
                title={t("reminders.deleteOne")}
                className="shrink-0 self-start rounded-lg p-1.5 text-muted/60 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
