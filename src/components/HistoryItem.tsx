import { Clock, ChevronRight } from "lucide-react";
import type { RecordEntry } from "@/types";
import {
  formatDuration,
  formatDateShort,
  formatTime,
  weekdayShort,
} from "@/lib/date";
import { cn } from "@/lib/utils";

interface HistoryItemProps {
  record: RecordEntry;
  onOpen: (r: RecordEntry) => void;
}

/** 按时长分级：越久颜色越深 */
function durationTier(minutes: number): {
  tier: string;
  badge: string;
  bar: string;
  dot: string;
} {
  const m = Math.max(0, minutes);
  if (m < 3)
    return {
      tier: "片刻",
      badge: "border-amber/20 bg-amber/[0.06] text-amber/70",
      bar: "bg-amber/30",
      dot: "bg-amber/40",
    };
  if (m < 10)
    return {
      tier: "短暂",
      badge: "border-amber/30 bg-amber/10 text-amber-glow/80",
      bar: "bg-amber/50",
      dot: "bg-amber/60",
    };
  if (m < 20)
    return {
      tier: "适中",
      badge: "border-amber/40 bg-amber/15 text-amber-glow",
      bar: "bg-amber/70",
      dot: "bg-amber",
    };
  if (m < 40)
    return {
      tier: "绵长",
      badge: "border-amber-deep/50 bg-amber-deep/20 text-amber-glow",
      bar: "bg-amber-deep",
      dot: "bg-amber-deep",
    };
  return {
    tier: "沉溺",
    badge: "border-amber-deep/70 bg-amber-deep/30 text-amber-glow",
    bar: "bg-amber-deep shadow-glow",
    dot: "bg-amber-deep",
  };
}

export default function HistoryItem({ record, onOpen }: HistoryItemProps) {
  const tier = durationTier(record.duration);
  const hasForms = record.forms && record.forms.length > 0;
  const hasTools = record.tools && record.tools.length > 0;
  const totalSec = Math.round(record.duration * 60);

  return (
    <button
      onClick={() => onOpen(record)}
      className="group surface surface-hover relative flex w-full items-stretch gap-0 p-0 text-left"
    >
      {/* 左侧时长色条 */}
      <div className={cn("w-1.5 shrink-0 rounded-l-2xl", tier.bar)} />

      <div className="flex min-w-0 flex-1 items-center gap-4 p-4 pl-3.5">
        {/* 时长徽章 */}
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border",
            tier.badge,
          )}
        >
          <span className="stat-number text-sm leading-none">
            {formatDuration(record.duration)}
          </span>
          <span className="mt-0.5 text-[9px] opacity-70">{tier.tier}</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* 时间 */}
          <div className="flex items-center gap-2 text-sm text-cream">
            <Clock size={13} className="text-muted" />
            <span className="truncate">
              {formatDateShort(record.timestamp)} 周{weekdayShort(record.timestamp)}{" "}
              <span className="font-mono text-amber-glow">{formatTime(record.timestamp)}</span>
            </span>
          </div>

          {/* 秒级时长 */}
          <p className="mt-0.5 text-[11px] text-muted">
            精确 {totalSec} 秒 · {record.duration.toFixed(1)} 分钟
          </p>

          {/* 形式 / 道具 */}
          {(hasForms || hasTools) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hasForms &&
                record.forms.map((f) => (
                  <span
                    key={`f-${f}`}
                    className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] text-amber-glow"
                  >
                    {f}
                  </span>
                ))}
              {hasTools &&
                record.tools.map((t) => (
                  <span
                    key={`t-${t}`}
                    className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-mist"
                  >
                    {t}
                  </span>
                ))}
            </div>
          )}

          {/* 备注 */}
          {record.note && (
            <p className="mt-1.5 line-clamp-2 text-xs text-mist italic">
              “{record.note}”
            </p>
          )}
        </div>

        <ChevronRight
          size={16}
          className="shrink-0 text-muted transition-colors group-hover:text-amber-glow"
        />
      </div>
    </button>
  );
}
