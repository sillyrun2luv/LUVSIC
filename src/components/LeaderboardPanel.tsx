import { useEffect } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Award,
  RefreshCw,
  Users,
  Globe,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useLeaderboardStore } from "@/store/useLeaderboardStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { formatDuration, type LeaderboardEntry } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import Avatar from "./Avatar";

/**
 * 排行榜面板：好友榜 / 全球榜 二选一切换
 * 数据通过 useLeaderboardStore 管理，5 分钟缓存
 */
export default function LeaderboardPanel() {
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const openAuth = useUIStore((s) => s.openAuth);

  const scope = useLeaderboardStore((s) => s.scope);
  const setScope = useLeaderboardStore((s) => s.setScope);
  const refresh = useLeaderboardStore((s) => s.refresh);
  const forceRefresh = useLeaderboardStore((s) => s.forceRefresh);
  const loading = useLeaderboardStore((s) => s.loading);
  const friendsList = useLeaderboardStore((s) => s.friendsList);
  const globalList = useLeaderboardStore((s) => s.globalList);
  const initialLoadedFriends = useLeaderboardStore((s) => s.initialLoadedFriends);
  const initialLoadedGlobal = useLeaderboardStore((s) => s.initialLoadedGlobal);

  // 进入面板时若未加载过则拉取一次
  useEffect(() => {
    if (!isLoggedIn) return;
    const need =
      (scope === "friends" && !initialLoadedFriends) ||
      (scope === "global" && !initialLoadedGlobal);
    if (need) void refresh();
  }, [isLoggedIn, scope, initialLoadedFriends, initialLoadedGlobal, refresh]);

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-900/50 p-8 text-center">
        <Trophy size={28} className="mx-auto text-amber-glow/70" />
        <div className="mt-3 text-sm font-medium text-cream">登录后查看排行榜</div>
        <p className="mt-1 text-xs text-muted">和好友、全球用户比拼记录时长</p>
        <button
          onClick={openAuth}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-xs font-medium text-ink-950 transition hover:bg-amber-glow"
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  const list = scope === "friends" ? friendsList : globalList;
  const initialLoaded = scope === "friends" ? initialLoadedFriends : initialLoadedGlobal;

  return (
    <div className="space-y-4">
      {/* Scope 切换：好友榜 / 全球榜 */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line/70 bg-ink-900/50 p-1.5">
        <ScopeBtn
          active={scope === "friends"}
          onClick={() => setScope("friends")}
          icon={<Users size={14} />}
          label="好友榜"
        />
        <ScopeBtn
          active={scope === "global"}
          onClick={() => setScope("global")}
          icon={<Globe size={14} />}
          label="全球榜"
        />
      </div>

      {/* 刷新按钮 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <TrendingUp size={12} className="text-amber-glow" />
          按总时长排名 · 5 分钟缓存
        </div>
        <button
          onClick={() => void forceRefresh()}
          disabled={loading}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line/70 bg-ink-900/70 text-muted transition hover:border-amber/40 hover:text-amber-glow disabled:opacity-50"
          aria-label="刷新排行榜"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* 列表 */}
      {loading && !initialLoaded ? (
        <LeaderboardSkeleton />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line/80 bg-ink-900/40 px-5 py-10 text-center">
          <Trophy size={24} className="mx-auto text-muted/70" />
          <div className="mt-2 text-sm text-cream">
            {scope === "friends" ? "还没有可显示的好友" : "暂无数据"}
          </div>
          <p className="mt-1 text-xs text-muted">
            {scope === "friends"
              ? "加了好友且对方开启统计可见后，这里会显示排行"
              : "去「我的 → 社交隐私」开启「好友可见统计」即可上榜"}
          </p>
        </div>
      ) : (
        <>
          {/* 前三名（如果有 3+ 条数据） */}
          {list.length >= 3 && <TopThree entries={list.slice(0, 3)} />}

          {/* 完整列表（含自己，自己可能在前三也可能在更后面） */}
          <div className="space-y-1.5">
            {list.map((entry, idx) => (
              <LeaderboardRow key={entry.userId} entry={entry} highlight={idx < 3} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ 子组件 ============================ */

function ScopeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
        active
          ? "bg-amber/15 text-amber-glow ring-1 ring-amber/30"
          : "text-muted hover:text-mist",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** 前三名领奖台 */
function TopThree({ entries }: { entries: LeaderboardEntry[] }) {
  // entries[0]=第1, [1]=第2, [2]=第3
  const config = [
    { color: "text-amber-400", ring: "ring-amber-400/50", bg: "bg-amber-400/10", icon: Crown },
    { color: "text-zinc-300", ring: "ring-zinc-300/50", bg: "bg-zinc-300/10", icon: Medal },
    { color: "text-orange-400", ring: "ring-orange-400/50", bg: "bg-orange-400/10", icon: Award },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {entries.map((e, i) => {
        const c = config[i];
        const Icon = c.icon;
        // 第 2 名居左、1 名居中、3 名居右——这里简化为顺序排列
        return (
          <div
            key={e.userId}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-2xl border border-line/60 p-3 text-center",
              c.bg,
              e.isMe && "ring-2 ring-amber/60",
              i === 0 && "scale-[1.04] z-10",
            )}
          >
            <Icon size={i === 0 ? 22 : 18} className={c.color} />
            <Avatar value={e.avatar} size={40} emojiScale={0.5} />
            <div className="max-w-full truncate text-xs font-medium text-cream">
              {e.name}
              {e.isMe && <span className="ml-1 text-[10px] text-amber-glow">(我)</span>}
            </div>
            <div className={cn("text-[11px] font-semibold", c.color)}>
              {formatDuration(e.totalSeconds)}
            </div>
            <div className="text-[10px] text-muted">{e.recordCount} 次</div>
          </div>
        );
      })}
    </div>
  );
}

/** 单行排行 */
function LeaderboardRow({
  entry,
  highlight,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  const rank = entry.rank;
  const rankColor =
    rank === 1
      ? "text-amber-400 bg-amber-400/10"
      : rank === 2
        ? "text-zinc-300 bg-zinc-300/10"
        : rank === 3
          ? "text-orange-400 bg-orange-400/10"
          : "text-muted bg-ink-800/60";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
        entry.isMe
          ? "border-amber/40 bg-amber/[0.06]"
          : "border-line/60 bg-ink-900/50",
      )}
    >
      {/* 排名 */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          rankColor,
        )}
      >
        {rank}
      </div>

      {/* 头像 */}
      <Avatar value={entry.avatar} size={36} emojiScale={0.5} />

      {/* 名字 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-cream">{entry.name}</span>
          {entry.isMe && (
            <span className="rounded-full bg-amber/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-glow">
              我
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">{entry.recordCount} 次记录</div>
      </div>

      {/* 时长 */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-cream">{formatDuration(entry.totalSeconds)}</div>
        {highlight && <div className="text-[10px] text-amber-glow">Top 3</div>}
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" />
        加载排行榜中...
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-line/60 bg-ink-900/50 p-2.5"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-ink-800" />
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-ink-800" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
            <div className="h-2 w-1/4 animate-pulse rounded bg-ink-800/70" />
          </div>
          <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-ink-800" />
        </div>
      ))}
    </div>
  );
}
