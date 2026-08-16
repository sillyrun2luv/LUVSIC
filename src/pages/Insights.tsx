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
import { t } from "@/store/useI18nStore";
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
          <p className="label-eyebrow mb-2">{t('insights.title')}</p>
          <h1 className="font-display text-4xl font-medium text-cream">
            {t('insights.seeRhythm').slice(0, 2)}<em className="not-italic text-amber-glow">{t('insights.seeRhythm').slice(2)}</em>
          </h1>
        </header>
        <div className="surface mb-4 flex flex-col items-center gap-3 p-12 text-center">
          <ScoreRing score={0} />
          <p className="max-w-xs text-sm text-muted">
            {t('insights.needMoreData')}
          </p>
        </div>
        <div className="rounded-2xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs leading-relaxed text-amber-glow/90">
          <span className="mr-1">✨</span>
          {t('insights.healthTip')}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-8">
      <header>
        <p className="label-eyebrow mb-2">{t('insights.title')}</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          {t('insights.seeRhythm').slice(0, 2)}<em className="not-italic text-amber-glow">{t('insights.seeRhythm').slice(2)}</em>
        </h1>
      </header>

      {/* 总览 */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard label={t('insights.totalCount')} value={totals.count} unit={t('insights.countUnit')} accent />
        <StatCard label={t('insights.totalDuration')} value={formatDuration(totals.totalMinutes)} />
        <StatCard
          label={t('insights.avgDuration')}
          value={totals.avgMinutes}
          unit={t('insights.minuteUnit')}
        />
        <StatCard
          label={t('insights.avgInterval')}
          value={totals.avgIntervalMs > 0 ? formatInterval(totals.avgIntervalMs) : "—"}
        />
      </section>

      {/* 小提示 */}
      <div className="animate-fadeIn rounded-2xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs leading-relaxed text-amber-glow/90">
        <span className="mr-1">✨</span>
        {t('insights.healthTip')}
      </div>

      {/* 规律性评分 */}
      <section className="surface flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
        {score !== null ? (
          <ScoreRing score={score} />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border border-line text-center text-xs text-muted">
            {t('stats.needMoreRecords')}
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <div className="label-eyebrow mb-2">{t('insights.rhythmScore')}</div>
          <p className="font-display text-xl text-cream">{advice}</p>
          <p className="mt-2 text-xs text-muted">
            {t('insights.scoreNote')}
          </p>
        </div>
      </section>

      {/* 30 天趋势 */}
      <section className="surface p-5">
        <SectionTitle eyebrow={t('insights.trend')} title={t('insights.last30Days')} />
        <TrendChart data={trend} />
      </section>

      {/* 时段分布 */}
      <section className="surface p-5">
        <SectionTitle eyebrow={t('insights.timeOfDay')} title={t('insights.withinDay')} />
        <HourHeatmap buckets={hours} />
      </section>

      {/* 形式偏好 */}
      <section className="surface p-5">
        <SectionTitle eyebrow={t('insights.preference')} title={t('insights.formPreference')} />
        <MaterialBars data={forms} />
      </section>

      {/* 道具偏好 */}
      <section className="surface p-5">
        <SectionTitle eyebrow={t('insights.preference')} title={t('insights.toolPreference')} />
        <MaterialBars data={tools} />
      </section>

      {/* 每日习惯 */}
      <section>
        <SectionTitle eyebrow={t('insights.habit')} title={t('insights.dailyReminderGoal')} />
        <div className="surface p-5">
          <ReminderSettings />
        </div>
      </section>

      {/* 数据管理 */}
      <section>
        <SectionTitle eyebrow={t('insights.data')} title={t('insights.backupClear')} />
        <div className="surface p-5">
          <p className="mb-4 text-xs leading-relaxed text-muted">
            {t('insights.localOnlyWarning')}
          </p>
          <BackupBar onClearAll={() => setConfirmClear(true)} />
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        danger
        title={t('insights.clearAllConfirm')}
        message={t('insights.clearAllWarning')}
        confirmText={t('insights.confirmClear')}
        onConfirm={() => {
          clearAll();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
