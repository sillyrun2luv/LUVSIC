import { useMemo, useState } from "react";
import { Search, History as HistoryIcon } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import HistoryItem from "@/components/HistoryItem";
import SectionTitle from "@/components/SectionTitle";
import { formatDuration } from "@/lib/date";
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

/** 时长图例 */
const TIERS = [
  { label: t("history.moment"), desc: t("history.d1"), bar: "bg-amber/30" },
  { label: t("history.d1Label"), desc: t("history.d2"), bar: "bg-amber/50" },
  { label: t("history.d2Label"), desc: t("history.d3"), bar: "bg-amber/70" },
  { label: t("history.d3Label"), desc: t("history.d4"), bar: "bg-amber-deep" },
  { label: t("history.d4Label"), desc: t("history.d5"), bar: "bg-amber-deep shadow-glow" },
];

export default function History() {
  const records = useRecordStore((s) => s.records);
  const openDetail = useUIStore((s) => s.openDetail);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.timestamp - a.timestamp),
    [records],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim();
    return sorted.filter(
      (r) =>
        (r.forms ?? []).some((m) => m.includes(q)) ||
        (r.tools ?? []).some((m) => m.includes(q)) ||
        (r.note ?? "").includes(q),
    );
  }, [sorted, query]);

  // 总时长（分钟）
  const totalMinutes = useMemo(
    () => records.reduce((s, r) => s + r.duration, 0),
    [records],
  );
  const avgMinutes =
    records.length > 0 ? totalMinutes / records.length : 0;

  return (
    <div className="animate-fadeIn space-y-8">
      <header>
        <p className="label-eyebrow mb-2">{t("history.title")}</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          全部<em className="not-italic text-amber-glow">痕迹</em>
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t("history.summary", records.length, formatDuration(totalMinutes), formatDuration(avgMinutes))}
        </p>
      </header>

      {/* 时长图例 */}
      <section className="surface flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <span className="label-eyebrow w-full">{t("history.durationLegend")}</span>
        {TIERS.map((tier) => (
          <div key={tier.label} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-full", tier.bar)} />
            <span className="text-xs text-mist">{tier.label}</span>
            <span className="text-[10px] text-muted">{tier.desc}</span>
          </div>
        ))}
      </section>

      {/* 搜索 */}
      <section>
        <SectionTitle eyebrow={t("history.recordList")} title={t("history.totalCount", filtered.length)} />
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full rounded-full border border-line bg-ink-900 py-2.5 pl-9 pr-4 text-sm text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-amber/40"
          />
        </div>

        {records.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <HistoryIcon size={22} className="text-muted" />
            <p className="text-sm text-muted">{t("history.emptyTip")}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r) => (
              <HistoryItem key={r.id} record={r} onOpen={(rec) => openDetail(rec.id)} />
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{t("history.noMatch")}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
