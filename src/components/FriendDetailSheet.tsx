import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Clock, Hash, CalendarDays, ShieldOff } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { fetchFriendStats, formatDuration, type FriendStats } from "@/lib/leaderboard";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import Avatar from "./Avatar";

/**
 * 好友详情弹窗：点击好友头像后展示其近 100h 内的统计
 * 隐私：后端 RPC 校验（必须 accepted 好友 + 对方开启 show_aggregates_to_friends）
 */
export default function FriendDetailSheet() {
  const open = useUIStore((s) => s.friendDetailOpen);
  const close = useUIStore((s) => s.closeFriendDetail);
  const userId = useUIStore((s) => s.friendDetailUserId);
  const name = useUIStore((s) => s.friendDetailName);
  const avatar = useUIStore((s) => s.friendDetailAvatar);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FriendStats | null>(null);
  const [denied, setDenied] = useState(false); // 对方未开放

  useEffect(() => {
    if (!open || !userId) {
      setStats(null);
      setDenied(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setStats(null);
    setDenied(false);
    fetchFriendStats(userId, 100)
      .then((data) => {
        if (cancelled) return;
        if (data === null) {
          setDenied(true);
        } else {
          setStats(data);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        toast(e?.message || "加载失败", "warn");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={close}
      />

      {/* 弹窗 */}
      <div className="relative z-10 m-4 w-full max-w-md animate-slideUp overflow-hidden rounded-3xl border border-line/80 bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-line/60 p-5 pb-4">
          <button
            onClick={close}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-ink-800 hover:text-cream"
            aria-label="关闭"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3">
            <Avatar value={avatar} size={56} emojiScale={0.5} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-xl text-cream">{name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <Clock size={11} className="text-amber-glow" />
                近 100 小时数据
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={22} className="animate-spin text-amber-glow" />
              <div className="text-sm text-muted">加载中...</div>
            </div>
          ) : denied ? (
            <DeniedState />
          ) : stats ? (
            <StatsView stats={stats} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatsView({ stats }: { stats: FriendStats }) {
  const maxDaySeconds = Math.max(1, ...stats.byDay.map((d) => d.seconds));

  return (
    <div className="space-y-5">
      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          icon={<Clock size={14} />}
          label="总时长"
          value={formatDuration(stats.totalSeconds)}
          accent="amber"
        />
        <MetricCard
          icon={<Hash size={14} />}
          label="次数"
          value={String(stats.recordCount)}
          accent="teal"
        />
      </div>

      {/* 时间范围 */}
      <div className="rounded-xl border border-line/60 bg-ink-850/60 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays size={12} />
          时间范围
        </div>
        <div className="mt-1.5 text-sm text-cream">
          {stats.lastAtMs
            ? `最近一次：${formatTs(stats.lastAtMs)}`
            : "近 100 小时内暂无记录"}
        </div>
        {stats.firstAtMs && stats.lastAtMs && stats.firstAtMs !== stats.lastAtMs && (
          <div className="mt-0.5 text-xs text-muted">
            首次：{formatTs(stats.firstAtMs)}
          </div>
        )}
      </div>

      {/* 按日分布 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays size={12} />
          按日分布
        </div>
        {stats.byDay.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line/70 bg-ink-900/40 px-4 py-6 text-center text-xs text-muted">
            近 100 小时内没有记录
          </div>
        ) : (
          <div className="space-y-1.5">
            {stats.byDay.map((d) => (
              <div key={d.day} className="flex items-center gap-2.5">
                <div className="w-20 shrink-0 font-mono text-[11px] text-muted">
                  {d.day.slice(5)} {/* MM-DD */}
                </div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-ink-800/60">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-amber/30 to-amber/60"
                    style={{
                      width: `${Math.max(2, (d.seconds / maxDaySeconds) * 100)}%`,
                    }}
                  />
                  <div className="relative flex h-full items-center justify-between px-2 text-[11px]">
                    <span className="font-medium text-cream">
                      {d.count > 0 ? formatDuration(d.seconds) : "—"}
                    </span>
                    {d.count > 0 && (
                      <span className="text-muted">{d.count} 次</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "amber" | "teal";
}) {
  const cls = {
    amber: "text-amber-glow bg-amber/10 ring-amber/30",
    teal: "text-teal-200 bg-teal-500/10 ring-teal-500/30",
  }[accent];
  return (
    <div className="rounded-xl border border-line/60 bg-ink-850/60 p-3">
      <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", cls)}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold text-cream">{value}</div>
    </div>
  );
}

function DeniedState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-muted">
        <ShieldOff size={22} />
      </div>
      <div className="text-sm font-medium text-cream">对方未开放统计</div>
      <p className="max-w-xs text-xs leading-relaxed text-muted">
        好友可以在「我的 → 社交隐私」里打开"好友可见统计"开关。开启后你就能看到 TA 的数据。
      </p>
    </div>
  );
}

function formatTs(ts: number): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return "";
  }
}
