import { useMemo, useState } from "react";
import RecordForm from "@/components/RecordForm";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import type { RecordEntry } from "@/types";
import SubTabs from "@/components/SubTabs";
import History from "@/pages/History";
import { Play, Clock, ChevronDown, ChevronUp, Sparkles, Eye, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { formatDuration } from "@/lib/date";
import { streakDays } from "@/lib/stats";

type SubTab = "new" | "history";

export default function Record() {
  const [subTab, setSubTab] = useState<SubTab>("new");
  const records = useRecordStore((s) => s.records);
  const editingId = useUIStore((s) => s.editingId);
  const goRecord = useUIStore((s) => s.goRecord);
  const setView = useUIStore((s) => s.setView);
  const openTimerStart = useUIStore((s) => s.openTimerStart);
  const loggedIn = useAuthStore((s) => !!s.user?.id);
  const [showCatchup, setShowCatchup] = useState(false);

  const editing: RecordEntry | null = useMemo(
    () => (editingId ? records.find((r) => r.id === editingId) ?? null : null),
    [editingId, records],
  );

  // 小统计：用计时按钮累计
  const timerOnlySeconds = records
    .filter((r) => r.isTimerEntry)
    .reduce((acc, r) => acc + Math.round((r.duration || 0) * 60), 0);
  const streak = streakDays(records);

  return (
    <div className="animate-fadeIn">
      <SubTabs
        value={subTab}
        onChange={(k) => setSubTab(k as SubTab)}
        tabs={[
          { key: "new", label: "记录" },
          { key: "history", label: "历史" },
        ]}
      />
      {subTab === "new" ? (
        <div className="space-y-6">
          {/* 隐私提示 */}
          {!editing && (
            <div className="flex items-center gap-2.5 rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-2.5 text-xs leading-relaxed text-teal-200/80">
              <ShieldCheck size={14} className="shrink-0 text-teal-300" />
              <span>请注意环境私密安全，确保无人打扰后再开始记录</span>
            </div>
          )}

          <header>
            <p className="label-eyebrow mb-2">{editing ? "编辑" : "记录"}</p>
            <h1 className="font-display text-4xl font-medium text-cream">
              {editing ? (
                <>
                  修改<em className="not-italic text-amber-glow">这一笔</em>
                </>
              ) : (
                <>
                  写下<em className="not-italic text-amber-glow">这一笔</em>
                </>
              )}
            </h1>
          </header>

          {/* ⭐ 计时卡片（主入口 —— 放最大最显眼） */}
          {!editing && (
            <section className="surface overflow-hidden p-0">
              {/* 渐变头部 */}
              <div className="relative overflow-hidden bg-gradient-to-br from-amber/25 via-amber/15 to-transparent px-6 pb-6 pt-7">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber/10 blur-3xl" />
                <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber/5 blur-3xl" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-medium text-amber-glow ring-1 ring-amber/30">
                      <Sparkles size={11} />
                      推荐方式
                    </div>
                    <h2 className="mt-3 font-display text-2xl text-cream">
                      开始<em className="not-italic text-amber-glow">真实计时</em>
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      开始后随时停止，时长自动记录。
                      {loggedIn && "只计按钮产生的时长才会进入排行榜"}
                    </p>
                  </div>

                  {/* 大大的开始按钮 */}
                  <button
                    onClick={openTimerStart}
                    className={cn(
                      "group relative flex shrink-0 items-center justify-center rounded-full",
                      "h-24 w-24 md:h-28 md:w-28",
                      "bg-amber text-ink-950 shadow-glow",
                      "transition-all duration-200 hover:scale-105 hover:bg-amber-glow",
                      "active:scale-95",
                    )}
                    aria-label="开始计时"
                  >
                    <span className="absolute inset-0 rounded-full bg-amber/40 blur-xl opacity-70 transition-opacity group-hover:opacity-100" />
                    <span className="relative flex flex-col items-center gap-0.5">
                      <Play size={28} strokeWidth={2.5} fill="currentColor" className="-mr-0.5" />
                      <span className="text-[11px] font-semibold tracking-wide">开始</span>
                    </span>
                  </button>
                </div>

                {/* 提示卡片 */}
                <div className="relative mt-5 flex items-center gap-3 rounded-xl border border-amber/25 bg-amber/5 p-3 text-xs leading-relaxed text-muted">
                  <Eye size={14} className="shrink-0 text-amber-glow" />
                  <p>
                    建议每次开始前按一下计时按钮，结束时再点停止。
                    这样记录的时长最准确，也能参加排行榜。
                    忘记计时了？翻到页面底部的「补录一条」。
                  </p>
                </div>

                {/* 小统计条 */}
                <div className="relative mt-5 grid grid-cols-3 gap-3">
                  <StatPill label="计时累计" value={formatDuration(timerOnlySeconds / 60)} accent />
                  <StatPill label="总记录" value={String(records.length)} />
                  <StatPill label="连续打卡" value={streak > 0 ? `${streak} 天` : "无"} />
                </div>
              </div>
            </section>
          )}

          {/* ⬇️ 折叠：记录一次 / 补录 */}
          {!editing ? (
            <section>
              <button
                onClick={() => setShowCatchup((v) => !v)}
                className="group flex w-full items-center justify-between rounded-2xl border border-line bg-ink-900/40 px-4 py-3 text-left transition-colors hover:border-mist/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-mist/20 bg-ink-850 text-muted">
                    <Clock size={16} />
                  </span>
                  <div>
                    <div className="text-sm text-mist">
                      {showCatchup ? "收起" : "展开"}补录一条
                    </div>
                    <div className="text-[11px] text-muted">
                      手动填写时间和时长（不计入排行榜）
                    </div>
                  </div>
                </div>
                {showCatchup ? (
                  <ChevronUp size={18} className="text-muted transition-transform group-hover:text-mist" />
                ) : (
                  <ChevronDown size={18} className="text-muted transition-transform group-hover:text-mist" />
                )}
              </button>

              {showCatchup && (
                <div className="mt-3 space-y-3 rounded-2xl border border-dashed border-mist/30 p-2">
                  <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-muted">
                    <Eye size={12} className="text-mist/70" />
                    <span>以下记录仅在本地/云端保存回看，不会进入全球/好友排行榜</span>
                  </div>
                  <RecordForm
                    editing={null}
                    onDone={() => {
                      setShowCatchup(false);
                      setView("overview");
                    }}
                    onCancel={() => {
                      setShowCatchup(false);
                    }}
                  />
                </div>
              )}
            </section>
          ) : (
            <RecordForm
              editing={editing}
              onDone={() => setView("overview")}
              onCancel={() => {
                if (editing) {
                  goRecord(null);
                } else {
                  setView("overview");
                }
              }}
            />
          )}
        </div>
      ) : (
        <History />
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        accent
          ? "border-amber/30 bg-amber/10"
          : "border-line bg-ink-900/60",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate font-medium tabular-nums",
          accent ? "stat-number text-lg text-amber-glow" : "text-base text-cream",
        )}
      >
        {value}
      </div>
    </div>
  );
}


