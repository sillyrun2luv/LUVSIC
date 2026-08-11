import { ChevronRight } from "lucide-react";
import type { RecordEntry } from "@/types";
import { formatDuration, relativeTime } from "@/lib/date";

interface RecordItemProps {
  record: RecordEntry;
  onOpen: (r: RecordEntry) => void;
}

export default function RecordItem({ record, onOpen }: RecordItemProps) {
  const hasForms = record.forms && record.forms.length > 0;
  const hasTools = record.tools && record.tools.length > 0;

  return (
    <button
      onClick={() => onOpen(record)}
      className="group surface surface-hover flex w-full items-center gap-4 p-4 text-left"
    >
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-amber/30 bg-amber/10">
        <span className="stat-number text-base leading-none text-amber-glow">
          {formatDuration(record.duration)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-cream">
          <span className="truncate">{relativeTime(record.timestamp)}</span>
        </div>
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
        {record.note && (
          <p className="mt-1 truncate text-xs text-muted italic">“{record.note}”</p>
        )}
        <span className="sr-only">{formatDuration(record.duration)}</span>
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 text-muted transition-colors group-hover:text-amber-glow"
      />
    </button>
  );
}
