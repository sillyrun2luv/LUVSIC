import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import { isSameDay, weekdayShort, formatDateCN, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";

type CalendarView = "week" | "month" | "year";

interface DayInfo {
  ts: number; // 当天 0 点时间戳
  count: number;
  totalMinutes: number;
}

export default function Calendar() {
  const records = useRecordStore((s) => s.records);
  const openDetail = useUIStore((s) => s.openDetail);
  const [viewMode, setViewMode] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => Date.now());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  /** 记录按"当天 0 点时间戳"分组，用于快速统计 */
  const dayMap = useMemo(() => {
    const m = new Map<number, DayInfo>();
    for (const r of records) {
      const d = new Date(r.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      const info = m.get(key) ?? { ts: key, count: 0, totalMinutes: 0 };
      info.count += 1;
      info.totalMinutes += r.duration;
      m.set(key, info);
    }
    return m;
  }, [records]);

  const anchorDate = useMemo(() => new Date(anchor), [anchor]);

  /** ============ 月视图 ============ */
  const monthCells = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const first = new Date(year, month, 1);
    first.setHours(0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    // 周一开始的网格
    const leading = (first.getDay() + 6) % 7;
    const cells: { ts: number; inMonth: boolean; dayNum: number }[] = [];
    for (let i = 0; i < leading; i++) {
      const d = new Date(year, month, 1 - leading + i);
      d.setHours(0, 0, 0, 0);
      cells.push({ ts: d.getTime(), inMonth: false, dayNum: d.getDate() });
    }
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      d.setHours(0, 0, 0, 0);
      cells.push({ ts: d.getTime(), inMonth: true, dayNum: i });
    }
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month, lastDay + (cells.length - leading - lastDay) + 1);
      d.setHours(0, 0, 0, 0);
      cells.push({ ts: d.getTime(), inMonth: false, dayNum: d.getDate() });
    }
    return cells;
  }, [anchorDate]);

  /** ============ 周视图 ============ */
  const weekCells = useMemo(() => {
    const base = new Date(anchorDate);
    base.setHours(0, 0, 0, 0);
    const weekday = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - weekday);
    const cells: { ts: number; dayNum: number; monthNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      cells.push({ ts: d.getTime(), dayNum: d.getDate(), monthNum: d.getMonth() + 1 });
    }
    return cells;
  }, [anchorDate]);

  /** ============ 年视图（热力月图） ============ */
  const yearMonths = useMemo(() => {
    const year = anchorDate.getFullYear();
    const months: { ts: number; label: string; days: { ts: number; dayNum: number }[] }[] = [];
    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1);
      first.setHours(0, 0, 0, 0);
      const lastDay = new Date(year, m + 1, 0).getDate();
      const days: { ts: number; dayNum: number }[] = [];
      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(year, m, d);
        dt.setHours(0, 0, 0, 0);
        days.push({ ts: dt.getTime(), dayNum: d });
      }
      months.push({
        ts: first.getTime(),
        label: `${m + 1}月`,
        days,
      });
    }
    return months;
  }, [anchorDate]);

  /** 点击日期，打开当天详情 */
  const openDay = (ts: number) => setSelectedDay(ts);

  /** 向前/向后翻页 */
  const shift = (dir: number) => {
    const d = new Date(anchorDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() + 7 * dir);
    } else if (viewMode === "month") {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setFullYear(d.getFullYear() + dir);
    }
    setAnchor(d.getTime());
  };

  const gotoToday = () => setAnchor(Date.now());

  /** 根据次数返回强度等级 0-4，用于不同深度热力色 */
  const intensity = (count: number) => {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
  };

  const INTENSITY_CLS = [
    "bg-transparent text-muted",
    "bg-amber/15 text-amber-glow ring-1 ring-amber/20",
    "bg-amber/30 text-amber-glow ring-1 ring-amber/40",
    "bg-amber/50 text-ink-950 ring-1 ring-amber/60",
    "bg-amber text-ink-950 ring-1 ring-amber shadow-glow",
  ];

  const selectedInfo = selectedDay !== null ? dayMap.get(selectedDay) : null;
  const selectedRecords = useMemo(() => {
    if (selectedDay === null) return [];
    const dayEnd = selectedDay + 86400000;
    return records
      .filter((r) => r.timestamp >= selectedDay && r.timestamp < dayEnd)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedDay, records, selectedDay !== null ? selectedDay : 0]);

  const anchorToday = new Date();
  anchorToday.setHours(0, 0, 0, 0);
  const todayTs = anchorToday.getTime();

  /** 标题（右上角月份/年份/周范围） */
  const headerTitle = useMemo(() => {
    if (viewMode === "year") return `${anchorDate.getFullYear()} 年`;
    if (viewMode === "month") return `${anchorDate.getFullYear()} 年 ${anchorDate.getMonth() + 1} 月`;
    const start = weekCells[0];
    const end = weekCells[6];
    const startD = new Date(start.ts);
    const endD = new Date(end.ts);
    if (startD.getMonth() === endD.getMonth()) {
      return `${startD.getFullYear()} 年 ${startD.getMonth() + 1} 月 ${startD.getDate()}–${endD.getDate()} 日`;
    }
    return `${startD.getMonth() + 1}月${startD.getDate()}日 – ${endD.getMonth() + 1}月${endD.getDate()}日`;
  }, [viewMode, anchorDate, weekCells]);

  return (
    <div className="animate-fadeIn space-y-6">
      <header>
        <p className="label-eyebrow mb-2">日历</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          岁月<em className="not-italic text-cyan-300">刻度</em>
        </h1>
        <p className="mt-2 text-sm text-muted">
          共 {records.length} 次 · 有记录 {dayMap.size} 天
        </p>
      </header>

      {/* 视图切换 + 翻页控件 */}
      <section className="surface space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full bg-ink-800 p-1">
            {(["week", "month", "year"] as CalendarView[]).map((m) => {
              const active = viewMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm transition-all",
                    active
                      ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"
                      : "text-muted hover:text-mist",
                  )}
                >
                  {m === "week" ? "周" : m === "month" ? "月" : "年"}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => gotoToday()}
              className="rounded-full border border-line px-2.5 py-1.5 text-xs text-muted hover:border-cyan/40 hover:text-cyan-300"
            >
              今天
            </button>
            <button
              onClick={() => shift(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink-800 hover:text-mist"
              aria-label="上一页"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => shift(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink-800 hover:text-mist"
              aria-label="下一页"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{headerTitle}</h2>
          <Legend />
        </div>
      </section>

      {/* 月视图 */}
      {viewMode === "month" && (
        <section className="surface p-4">
          <WeekHeader />
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {monthCells.map((c) => {
              const info = dayMap.get(c.ts);
              const isToday = c.ts === todayTs;
              const isSelected = c.ts === selectedDay;
              const lv = intensity(info?.count ?? 0);
              return (
                <button
                  key={c.ts}
                  onClick={() => openDay(c.ts)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all",
                    INTENSITY_CLS[lv],
                    !c.inMonth && "opacity-40",
                    isToday && !isSelected && "ring-2 ring-cyan-400/70 ring-offset-1 ring-offset-ink-900",
                    isSelected && "ring-2 ring-white/70 scale-105 z-10",
                  )}
                >
                  <span className="text-base font-medium leading-none">{c.dayNum}</span>
                  {info && info.count > 0 && (
                    <span className="mt-0.5 text-[9px] leading-none opacity-80">{info.count}次</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 周视图 */}
      {viewMode === "week" && (
        <section className="surface p-4">
          <WeekHeader />
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {weekCells.map((c) => {
              const info = dayMap.get(c.ts);
              const isToday = c.ts === todayTs;
              const isSelected = c.ts === selectedDay;
              const lv = intensity(info?.count ?? 0);
              const hrs = c.monthNum + "月";
              return (
                <button
                  key={c.ts}
                  onClick={() => openDay(c.ts)}
                  className={cn(
                    "relative flex min-h-[96px] flex-col items-center justify-between rounded-xl p-2 transition-all",
                    INTENSITY_CLS[lv],
                    isToday && !isSelected && "ring-2 ring-cyan-400/70 ring-offset-1 ring-offset-ink-900",
                    isSelected && "ring-2 ring-white/70 scale-105 z-10",
                  )}
                >
                  <div className="w-full text-center">
                    <div className="text-[10px] text-muted/80">{c.monthNum}月</div>
                    <div className="text-xl font-medium leading-tight">{c.dayNum}</div>
                    <div className="text-[10px] text-muted/80">{weekdayShort(new Date(c.ts))}</div>
                  </div>
                  {info && info.count > 0 && (
                    <div className="w-full space-y-1 text-center">
                      <div className="text-xs font-semibold leading-none">{info.count}次</div>
                      <div className="text-[10px] opacity-75 leading-none">
                        {info.totalMinutes >= 1 ? `${Math.round(info.totalMinutes)}分` : ""}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 年视图 */}
      {viewMode === "year" && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {yearMonths.map((m) => (
            <div key={m.ts} className="surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-display text-sm text-cream">{m.label}</div>
                <MonthSummary days={m.days} dayMap={dayMap} />
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {m.days.map((d) => {
                  const info = dayMap.get(d.ts);
                  const lv = intensity(info?.count ?? 0);
                  const isToday = d.ts === todayTs;
                  const isSelected = d.ts === selectedDay;
                  return (
                    <button
                      key={d.ts}
                      onClick={() => openDay(d.ts)}
                      title={`${d.dayNum}日 · ${info ? info.count + "次" : "无记录"}`}
                      className={cn(
                        "aspect-square rounded-[4px] text-[9px] transition-all",
                        lv === 0 && "bg-ink-800/50 text-transparent",
                        lv === 1 && "bg-amber/25 text-amber-glow/80",
                        lv === 2 && "bg-amber/45 text-amber-glow",
                        lv === 3 && "bg-amber/65 text-ink-950",
                        lv === 4 && "bg-amber text-ink-950 shadow-glow",
                        isToday && "ring-1 ring-cyan-400/70",
                        isSelected && "ring-2 ring-white/80 scale-110 z-10",
                      )}
                    >
                      {info && info.count > 0 ? d.dayNum : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 选中日期详情抽屉 */}
      {selectedDay !== null && (
        <DayDetailDrawer
          dayTs={selectedDay}
          info={selectedInfo || { ts: selectedDay, count: 0, totalMinutes: 0 }}
          records={selectedRecords}
          onClose={() => setSelectedDay(null)}
          onRecordClick={(id) => {
            setSelectedDay(null);
            openDetail(id);
          }}
        />
      )}
    </div>
  );
}

/** ===== 子组件 ===== */

function WeekHeader() {
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {labels.map((l, i) => (
        <div
          key={l}
          className={cn(
            "text-center text-[11px] font-medium",
            i >= 5 ? "text-cyan-dim" : "text-muted/70",
          )}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function Legend() {
  const items = [
    { label: "无", cls: "bg-ink-800/50" },
    { label: "1", cls: "bg-amber/25" },
    { label: "2", cls: "bg-amber/45" },
    { label: "3", cls: "bg-amber/65" },
    { label: "4+", cls: "bg-amber shadow-glow" },
  ];
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted">
      <span>热度</span>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1">
          <span className={cn("h-3 w-3 rounded-[3px]", it.cls)} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function MonthSummary({
  days,
  dayMap,
}: {
  days: { ts: number; dayNum: number }[];
  dayMap: Map<number, DayInfo>;
}) {
  let count = 0;
  let total = 0;
  for (const d of days) {
    const info = dayMap.get(d.ts);
    if (info) {
      count += info.count;
      total += info.totalMinutes;
    }
  }
  if (count === 0) return <div className="text-[10px] text-muted">0次</div>;
  return (
    <div className="text-right text-[10px]">
      <div className="text-amber-glow">{count}次</div>
      <div className="text-muted/80">{Math.round(total)}分</div>
    </div>
  );
}

function DayDetailDrawer({
  dayTs,
  info,
  records,
  onClose,
  onRecordClick,
}: {
  dayTs: number;
  info: DayInfo;
  records: { id: string; timestamp: number; duration: number; forms: string[]; tools: string[]; note?: string }[];
  onClose: () => void;
  onRecordClick: (id: string) => void;
}) {
  const date = new Date(dayTs);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="surface relative z-10 w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden animate-slideUp rounded-t-3xl border-t border-line/70 bg-ink-900/98 backdrop-blur-md">
        {/* 头部：不滚动区域 */}
        <div className="shrink-0 px-5 pt-5">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <header className="mb-4 flex items-end justify-between">
              <div>
                <p className="label-eyebrow mb-1">{weekdayShort(date)} · {isSameDay(dayTs, Date.now()) ? "今天" : ""}</p>
                <h3 className="font-display text-2xl text-cream">{formatDateCN(date)}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-amber/40 hover:text-mist"
              >
                关闭
              </button>
            </header>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="次数" value={info.count} unit="次" />
              <Stat label="总时长" value={info.totalMinutes >= 1 ? `${Math.round(info.totalMinutes)}` : "0"} unit={info.totalMinutes >= 1 ? "分" : ""} />
              <Stat label="平均" value={info.count ? `${Math.round(info.totalMinutes / info.count)}` : "0"} unit={info.count ? "分" : ""} />
            </div>
          </div>
        </div>

        {/* 列表区：可独立滚动 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto w-full max-w-2xl">
            {records.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                </div>
                <p className="text-sm text-muted">这天还没有记录，是平静的一天。</p>
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {records.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => onRecordClick(r.id)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-ink-800/60 p-3 text-left transition-all hover:border-amber/40 hover:bg-ink-800"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-amber/10 text-amber-glow ring-1 ring-amber/20">
                      <span className="text-[10px] text-muted">第</span>
                      <span className="text-sm font-semibold leading-none">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-cream">{formatTime(r.timestamp)}</span>
                        <span className="text-xs text-muted">
                          {r.duration >= 1 ? `${Math.round(r.duration * 10) / 10} 分钟` : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {r.forms.slice(0, 2).map((f) => (
                          <span key={f} className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-mist">{f}</span>
                        ))}
                        {r.tools.slice(0, 2).map((t) => (
                          <span key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-muted">{t}</span>
                        ))}
                      </div>
                      {r.note && (
                        <p className="mt-1 truncate text-xs text-muted/80">{r.note}</p>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted opacity-0 transition-opacity group-hover:opacity-100"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-ink-800/60 p-3">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-xl text-cream">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
    </div>
  );
}
