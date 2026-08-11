import { useMemo, useState } from "react";
import { useRecordStore } from "@/store/useRecordStore";
import {
  dailyStats,
  hourlyDistribution,
  formFrequency,
  toolFrequency,
  regularityAdvice,
  regularityScore,
  totalStats,
} from "@/lib/stats";
import { formatDuration, formatInterval } from "@/lib/date";
import StatCard from "@/components/StatCard";
import SectionTitle from "@/components/SectionTitle";
import TrendChart from "@/components/charts/TrendChart";
import HourHeatmap from "@/components/charts/HourHeatmap";
import MaterialBars from "@/components/charts/MaterialBars";
import ScoreRing from "@/components/charts/ScoreRing";
import BackupBar from "@/components/BackupBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import ReminderSettings from "@/components/ReminderSettings";

export default function Insights() {
  const records = useRecordStore((s) => s.records);
  const clearAll = useRecordStore((s) => s.clearAll);
  const [confirmClear, setConfirmClear] = useState(false);

  const now = useMemo(() => new Date(), []);
  const totals = useMemo(() => totalStats(records), [records]);
  const trend = useMemo(() => dailyStats(records, 30, now), [records, now]);
  const hours = useMemo(() => hourlyDistribution(records), [records]);
  const forms = useMemo(() => formFrequency(records), [records]);
  const tools = useMemo(() => toolFrequency(records), [records]);
  const score = useMemo(() => regularityScore(records, now), [records, now]);
  const advice = useMemo(
    () => regularityAdvice(score, totals.avgIntervalMs),
    [score, totals.avgIntervalMs],
  );

  if (records.length === 0) {
    return (
      <div className="animate-fadeIn">
        <header className="mb-8">
          <p className="label-eyebrow mb-2">洞察</p>
          <h1 className="font-display text-4xl font-medium text-cream">
            看见<em className="not-italic text-amber-glow">节律</em>
          </h1>
        </header>
        <div className="surface mb-4 flex flex-col items-center gap-3 p-12 text-center">
          <ScoreRing score={0} />
          <p className="max-w-xs text-sm text-muted">
            还没有足够的数据。先在「记录」里写下几次，这里会慢慢浮现你的节律。
          </p>
        </div>
        <div className="rounded-2xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs leading-relaxed text-amber-glow/90">
          <span className="mr-1">✨</span>
          小提示：单次时长 15~20 分钟左右最好哦，既放松又不伤身。以身体舒服为准，不用追求时长。
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-8">
      <header>
        <p className="label-eyebrow mb-2">洞察</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          看见<em className="not-italic text-amber-glow">节律</em>
        </h1>
      </header>

      {/* 总览 */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="总次数" value={totals.count} unit="次" accent />
        <StatCard label="总时长" value={formatDuration(totals.totalMinutes)} />
        <StatCard
          label="平均时长"
          value={totals.avgMinutes}
          unit="分"
        />
        <StatCard
          label="平均间隔"
          value={totals.avgIntervalMs > 0 ? formatInterval(totals.avgIntervalMs) : "—"}
        />
      </section>

      {/* 小提示 */}
      <div className="animate-fadeIn rounded-2xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs leading-relaxed text-amber-glow/90">
        <span className="mr-1">✨</span>
        小提示：单次时长 15~20 分钟左右最好哦，既放松又不伤身。以身体舒服为准，不用追求时长。
      </div>

      {/* 规律性评分 */}
      <section className="surface flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
        {score !== null ? (
          <ScoreRing score={score} />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border border-line text-center text-xs text-muted">
            数据不足
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <div className="label-eyebrow mb-2">节律评分</div>
          <p className="font-display text-xl text-cream">{advice}</p>
          <p className="mt-2 text-xs text-muted">
            基于近 30 天间隔稳定性估算，仅作自我觉察参考。
          </p>
        </div>
      </section>

      {/* 30 天趋势 */}
      <section className="surface p-5">
        <SectionTitle eyebrow="趋势" title="近 30 天" />
        <TrendChart data={trend} />
      </section>

      {/* 时段分布 */}
      <section className="surface p-5">
        <SectionTitle eyebrow="时段" title="一天之中" />
        <HourHeatmap buckets={hours} />
      </section>

      {/* 形式偏好 */}
      <section className="surface p-5">
        <SectionTitle eyebrow="偏好" title="刺激形式" />
        <MaterialBars data={forms} />
      </section>

      {/* 道具偏好 */}
      <section className="surface p-5">
        <SectionTitle eyebrow="偏好" title="辅助道具" />
        <MaterialBars data={tools} />
      </section>

      {/* 每日习惯 */}
      <section>
        <SectionTitle eyebrow="习惯" title="每日提醒与目标" />
        <div className="surface p-5">
          <ReminderSettings />
        </div>
      </section>

      {/* 数据管理 */}
      <section>
        <SectionTitle eyebrow="数据" title="备份与清空" />
        <div className="surface p-5">
          <p className="mb-4 text-xs leading-relaxed text-muted">
            所有数据仅保存在这台设备的浏览器里。换设备或清理浏览器前，请导出备份。
          </p>
          <BackupBar onClearAll={() => setConfirmClear(true)} />
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        danger
        title="清空全部记录？"
        message="这将删除你所有的记录，且无法恢复。建议先导出备份。"
        confirmText="确认清空"
        onConfirm={() => {
          clearAll();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
