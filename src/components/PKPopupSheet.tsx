import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Swords, Trophy, Handshake, Clock, Hash } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { fetchPKStats, formatDuration, type PKStatsSide } from "@/lib/leaderboard";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import Avatar from "./Avatar";

/**
 * PK 弹窗：好友 vs 我，比较「累计总时长」和「近 100h 时长」
 *  - 数据源：RPC pk_stats(好友ID, 100)
 *  - 只统计 is_timer_entry=true 的记录（按钮计时）
 */
export default function PKPopupSheet() {
  const open = useUIStore((s) => s.pkOpen);
  const close = useUIStore((s) => s.closePK);
  const openDetail = useUIStore((s) => s.openFriendDetail);
  const userId = useUIStore((s) => s.pkUserId);
  const name = useUIStore((s) => s.pkName);
  const avatar = useUIStore((s) => s.pkAvatar);

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<PKStatsSide | null>(null);
  const [friend, setFriend] = useState<PKStatsSide | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      setMe(null); setFriend(null);
      return;
    }
    let cancelled = false;
    setLoading(true); setMe(null); setFriend(null);
    fetchPKStats(userId, 100)
      .then(({ me, friend }) => {
        if (cancelled) return;
        setMe(me); setFriend(friend);
      })
      .catch((e) => {
        if (cancelled) return;
        toast(e?.message || "PK 数据加载失败", "warn");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, userId]);

  if (!open) return null;

  const goDetail = () => {
    close();
    if (userId && name && avatar) {
      setTimeout(() => openDetail(userId, name, avatar), 220);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] pb-[72px] sm:pb-0 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/75 backdrop-blur-sm"
        onClick={close}
      />

      <div className="relative z-10 m-4 w-full max-w-md animate-slideUp overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-ink-900 via-ink-900 to-violet-950/30 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-line/60 p-5 pb-4">
          <button
            onClick={close}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-ink-800 hover:text-cream"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
              <Swords size={15} />
            </div>
            <div className="font-display text-xl text-cream">好友 PK ⚔️</div>
          </div>
          <p className="mt-1 text-[11px] text-muted">只比较「开始计时」按钮产生的记录，补录不计入。</p>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 size={24} className="animate-spin text-violet-300" />
              <div className="text-sm text-muted">正在对比双方战绩...</div>
            </div>
          ) : !me || !friend ? (
            <EmptyState onClose={close} />
          ) : (
            <PKBody me={me} friend={friend} onOpenDetail={goDetail} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-muted">
        <Handshake size={22} />
      </div>
      <div className="text-sm font-medium text-cream">无法 PK</div>
      <p className="max-w-xs text-xs leading-relaxed text-muted">
        没有拉到双方数据（非好友关系 / 未登录）。
      </p>
      <button
        onClick={onClose}
        className="mt-2 rounded-full border border-line bg-ink-800 px-4 py-2 text-xs text-mist hover:bg-ink-700"
      >
        好的
      </button>
    </div>
  );
}

/* -------------------- PK Body -------------------- */
interface Score {
  win: number; // 0 / 0.5 / 1
  label: "胜" | "平" | "负";
  cls: string;
}

function judge(a: number, b: number): { aScore: Score; bScore: Score } {
  if (a > b) {
    return {
      aScore: { win: 1, label: "胜", cls: "text-amber-glow bg-amber/15 ring-amber/40" },
      bScore: { win: 0, label: "负", cls: "text-rose-300 bg-rose-500/10 ring-rose-500/30" },
    };
  }
  if (a < b) {
    return {
      aScore: { win: 0, label: "负", cls: "text-rose-300 bg-rose-500/10 ring-rose-500/30" },
      bScore: { win: 1, label: "胜", cls: "text-amber-glow bg-amber/15 ring-amber/40" },
    };
  }
  return {
    aScore: { win: 0.5, label: "平", cls: "text-teal-200 bg-teal-500/10 ring-teal-500/30" },
    bScore: { win: 0.5, label: "平", cls: "text-teal-200 bg-teal-500/10 ring-teal-500/30" },
  };
}

function PKBody({
  me,
  friend,
  onOpenDetail,
}: {
  me: PKStatsSide;
  friend: PKStatsSide;
  onOpenDetail: () => void;
}) {
  // 两项比较：
  //   1. 累计总时长
  //   2. 近 100h 时长
  const round1 = judge(me.totalSecondsAll, friend.totalSecondsAll);
  const round2 = judge(me.totalSecondsRecent, friend.totalSecondsRecent);

  const myTotal = round1.aScore.win + round2.aScore.win;
  const frTotal = round1.bScore.win + round2.bScore.win;

  let resultTitle: string;
  let resultEmoji: string;
  let resultCls: string;
  if (myTotal > frTotal) {
    resultTitle = "你赢了 🎉";
    resultEmoji = "🏆";
    resultCls = "text-amber-glow";
  } else if (myTotal < frTotal) {
    resultTitle = "再接再厉";
    resultEmoji = "💪";
    resultCls = "text-rose-300";
  } else {
    resultTitle = "势均力敌";
    resultEmoji = "⚖️";
    resultCls = "text-teal-200";
  }

  return (
    <div className="space-y-4">
      {/* 顶部：双方大头像 + 昵称 */}
      <div className="grid grid-cols-3 items-center gap-2">
        <SideCard side="me" data={me} />
        <div className="flex flex-col items-center gap-1.5">
          <div className={cn("font-display text-2xl", resultCls)}>{resultEmoji}</div>
          <div className="text-[11px] text-muted">{resultTitle}</div>
          <div className="rounded-full bg-ink-800/80 px-2.5 py-0.5 text-[10px] font-mono text-cream">
            {myTotal} : {frTotal}
          </div>
        </div>
        <SideCard side="friend" data={friend} />
      </div>

      {/* 比较项 1：累计总时长 */}
      <Row
        label="累计总时长"
        icon={<Clock size={14} />}
        meValue={formatDuration(me.totalSecondsAll)}
        meCount={`${me.recordCountAll} 次`}
        meScore={round1.aScore}
        frValue={formatDuration(friend.totalSecondsAll)}
        frCount={`${friend.recordCountAll} 次`}
        frScore={round1.bScore}
      />

      {/* 比较项 2：近 100h */}
      <Row
        label="近 100 小时"
        icon={<Hash size={14} />}
        meValue={formatDuration(me.totalSecondsRecent)}
        meCount={`${me.recordCountRecent} 次`}
        meScore={round2.aScore}
        frValue={formatDuration(friend.totalSecondsRecent)}
        frCount={`${friend.recordCountRecent} 次`}
        frScore={round2.bScore}
      />

      {/* 底部操作 */}
      <div className="pt-2 flex flex-wrap gap-2">
        <button
          onClick={onOpenDetail}
          className="flex-1 flex items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-xs text-mist hover:border-amber/40 hover:text-amber-glow"
        >
          <Trophy size={14} />
          看 TA 的详细数据
        </button>
        <button
          onClick={() => location.reload()}
          className="rounded-full bg-violet-500/15 px-4 py-2.5 text-xs text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
          title="重新拉取最新数据"
        >
          刷新
        </button>
      </div>
    </div>
  );
}

/* -------------------- 子组件 -------------------- */
function SideCard({ side, data }: { side: "me" | "friend"; data: PKStatsSide }) {
  const me = side === "me";
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 rounded-2xl border p-3",
      me
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-rose-500/30 bg-rose-500/5",
    )}>
      <Avatar value={data.avatar} size={56} emojiScale={0.55} ringClass="ring-1 ring-line/60" />
      <div className="w-full truncate text-center text-sm font-medium text-cream">
        {me ? "我" : data.name}
      </div>
      <div className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        me
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
          : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30",
      )}>
        {me ? "我" : "TA"}
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  meValue,
  meCount,
  meScore,
  frValue,
  frCount,
  frScore,
}: {
  label: string;
  icon: React.ReactNode;
  meValue: string;
  meCount: string;
  meScore: Score;
  frValue: string;
  frCount: string;
  frScore: Score;
}) {
  const meWins = meScore.win > frScore.win;
  const frWins = frScore.win > meScore.win;
  return (
    <div className="rounded-2xl border border-line/70 bg-ink-900/70 p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-muted">
        {icon}
        {label}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* 我方 */}
        <div className={cn(
          "rounded-xl p-2.5 text-right transition",
          meWins
            ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
            : "bg-ink-800/50 ring-1 ring-line/50",
        )}>
          <div className={cn("text-[15px] font-semibold text-cream", meWins && "text-emerald-200")}>
            {meValue}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">{meCount}</div>
        </div>

        <ScoreTag score={meScore} />
        <div className="h-0.5 w-4 bg-line/70" />
        <ScoreTag score={frScore} />

        {/* 对方 */}
        <div className={cn(
          "rounded-xl p-2.5 text-left transition",
          frWins
            ? "bg-rose-500/10 ring-1 ring-rose-500/30"
            : "bg-ink-800/50 ring-1 ring-line/50",
        )}>
          <div className={cn("text-[15px] font-semibold text-cream", frWins && "text-rose-200")}>
            {frValue}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">{frCount}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreTag({ score }: { score: Score }) {
  const Icon = score.label === "平" ? Handshake : Trophy;
  return (
    <div className={cn(
      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1",
      score.cls,
    )} title={score.label}>
      <Icon size={12} />
    </div>
  );
}
