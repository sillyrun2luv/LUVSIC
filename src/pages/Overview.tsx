import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, TrendingUp } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import {
  dailyStats,
  sinceLast,
  todayStats,
  streakDays,
} from "@/lib/stats";
import { formatDateCN, formatDuration, formatInterval, greeting } from "@/lib/date";
import StatCard from "@/components/StatCard";
import SectionTitle from "@/components/SectionTitle";
import WeekBars from "@/components/charts/WeekBars";
import RecordItem from "@/components/RecordItem";

export default function Overview() {
  const records = useRecordStore((s) => s.records);
  const goRecord = useUIStore((s) => s.goRecord);
  const setView = useUIStore((s) => s.setView);
  const openDetail = useUIStore((s) => s.openDetail);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nowDate = useMemo(() => new Date(now), [now]);
  const today = useMemo(() => todayStats(records, nowDate), [records, nowDate]);
  const week = useMemo(() => dailyStats(records, 7, nowDate), [records, nowDate]);
  const last = useMemo(() => sinceLast(records, nowDate), [records, nowDate]);
  const streak = useMemo(() => streakDays(records, nowDate), [records, nowDate]);
  const g = greeting(nowDate);

  const recent = useMemo(
    () => [...records].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [records],
  );

  const weekTotal = week.reduce((s, d) => s + d.count, 0);

  return (
    <div className="animate-fadeIn space-y-8">
      {/* 问候 */}
      <header>
        <p className="label-eyebrow mb-2">{formatDateCN(nowDate)}</p>
        <h1 className="font-display text-4xl font-medium leading-tight text-cream sm:text-5xl">
          {g.period}，
          <br />
          <span className="italic text-amber-glow">{g.subtitle}</span>
        </h1>
        {streak > 1 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-mist">
            <Sparkles size={14} className="text-amber" />
            已连续记录 {streak} 天
          </p>
        )}
      </header>

      {/* 今日 */}
      <section>
        <SectionTitle eyebrow="今日" title="此刻之前" />
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="次数"
            value={today.count}
            unit="次"
            accent
          />
          <StatCard
            label="总时长"
            value={formatDuration(today.totalMinutes)}
          />
          <StatCard
            label="距上次"
            value={last === null ? "—" : formatInterval(last)}
          />
        </div>
      </section>

      {/* 本周节律 */}
      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label-eyebrow mb-1">本周节律</div>
            <h2 className="font-display text-xl text-cream">七日之间</h2>
          </div>
          <div className="text-right">
            <div className="stat-number text-2xl text-amber-glow">{weekTotal}</div>
            <div className="text-xs text-muted">本周次数</div>
          </div>
        </div>
        <WeekBars data={week} now={nowDate} />
      </section>

      {/* 快速记录 */}
      <button
        onClick={() => goRecord(null)}
        className="group flex w-full items-center justify-between rounded-2xl border border-amber/30 bg-amber/[0.07] p-5 transition-all hover:border-amber/60 hover:bg-amber/[0.12] hover:shadow-glow"
      >
        <div className="text-left">
          <div className="font-display text-xl text-cream">记下这一次</div>
          <div className="text-xs text-muted">几秒就好，时间、时长、材料</div>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber text-ink-950 shadow-glow transition-transform group-hover:scale-105">
          <Plus size={22} strokeWidth={2.4} />
        </span>
      </button>

      {/* 近期记录 */}
      <section>
        <SectionTitle
          eyebrow="近期"
          title="最近的片刻"
          extra={
            <button
              onClick={() => setView("history")}
              className="flex items-center gap-1 text-sm text-amber-dim hover:text-amber-glow"
            >
              <TrendingUp size={14} />
              查看全部
            </button>
          }
        />
        {recent.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
              <Plus size={20} />
            </div>
            <p className="text-sm text-muted">还没有记录，从一次开始。</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recent.map((r) => (
              <RecordItem key={r.id} record={r} onOpen={() => openDetail(r.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
