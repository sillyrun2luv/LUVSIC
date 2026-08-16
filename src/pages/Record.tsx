import { useEffect, useMemo, useState } from "react";
import RecordForm from "@/components/RecordForm";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import type { RecordEntry } from "@/types";
import SubTabs from "@/components/SubTabs";
import History from "@/pages/History";
import {
  Play, Clock, ChevronDown, ChevronUp, Sparkles, Eye, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { t } from "@/store/useI18nStore";
import { formatDuration } from "@/lib/date";
import { streakDays } from "@/lib/stats";
import { toast } from "@/store/useToastStore";

type SubTab = "new" | "history";

export default function Record() {
  const [subTab, setSubTab] = useState<SubTab>("new");
  const records = useRecordStore((s) => s.records);
  const editingId = useUIStore((s) => s.editingId);
  const goRecord = useUIStore((s) => s.goRecord);
  const setView = useUIStore((s) => s.setView);
  const openTimerStart = useUIStore((s) => s.openTimerStart);
  const cancelTimer = useUIStore((s) => s.cancelTimer);
  const timer = useUIStore((s) => s.timer);
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
          { key: "new", label: t('record.title') },
          { key: "history", label: t('record.history') },
        ]}
      />
      {subTab === "new" ? (
        <div className="space-y-6">
          {/* 隐私提示 */}
          {!editing && (
            <div className="flex items-center gap-2.5 rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-2.5 text-xs leading-relaxed text-teal-200/80">
              <ShieldCheck size={14} className="shrink-0 text-teal-300" />
              <span>{t('record.privacyTip')}</span>
            </div>
          )}

          <header>
            <p className="label-eyebrow mb-2">{editing ? t('record.edit') : t('record.title')}</p>
            <h1 className="font-display text-4xl font-medium text-cream">
              {editing ? (
                <>
                  {t('record.edit')}<em className="not-italic text-amber-glow">{t('record.thisOne')}</em>
                </>
              ) : (
                <>
                  {t('record.write')}<em className="not-italic text-amber-glow">{t('record.thisOne')}</em>
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
                      {t('record.recommended')}
                    </div>
                    <h2 className="mt-3 font-display text-2xl text-cream">
                      {t('record.start')}<em className="not-italic text-amber-glow">{t('record.startRealTimer').replace(t('record.start'), '')}</em>
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {loggedIn ? t('record.timerDesc') : t('record.timerDesc').split('。')[0] + '。'}
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
                    aria-label={t('timerStart.start')}
                  >
                    <span className="absolute inset-0 rounded-full bg-amber/40 blur-xl opacity-70 transition-opacity group-hover:opacity-100" />
                    <span className="relative flex flex-col items-center gap-0.5">
                      <Play size={28} strokeWidth={2.5} fill="currentColor" className="-mr-0.5" />
                      <span className="text-[11px] font-semibold tracking-wide">{t('record.start')}</span>
                    </span>
                  </button>
                </div>

                {/* 提示卡片 */}
                <div className="relative mt-5 flex items-center gap-3 rounded-xl border border-amber/25 bg-amber/5 p-3 text-xs leading-relaxed text-muted">
                  <Eye size={14} className="shrink-0 text-amber-glow" />
                  <p>
                    {t('record.timerAdvice')}
                  </p>
                </div>

                {/* 小统计条 */}
                <div className="relative mt-5 grid grid-cols-3 gap-3">
                  <StatPill label={t('record.totalTime')} value={formatDuration(timerOnlySeconds / 60)} accent />
                  <StatPill label={t('record.totalRecords')} value={String(records.length)} />
                  <StatPill label={t('record.streakDays')} value={streak > 0 ? `${streak} 天` : t('common.none')} />
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
                      {showCatchup ? t('record.collapseManual') : t('record.expandManual')}
                    </div>
                    <div className="text-[11px] text-muted">
                      {t('record.manualDesc')}
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
                    <span>{t('record.nonTimerNotice')}</span>
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


