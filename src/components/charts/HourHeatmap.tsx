interface HourHeatmapProps {
  buckets: number[]; // 长度 24
}

const HOUR_LABELS = [0, 6, 12, 18];

export default function HourHeatmap({ buckets }: HourHeatmapProps) {
  const max = Math.max(1, ...buckets);

  return (
    <div>
      <div className="flex gap-1">
        {buckets.map((c, h) => {
          const intensity = c / max;
          const bg =
            c === 0
              ? "rgb(var(--accent) / 0.06)"
              : `rgb(var(--accent) / ${0.2 + intensity * 0.75})`;
          return (
            <div
              key={h}
              title={`${h}:00 - ${h}:59  共 ${c} 次`}
              className="group relative h-10 flex-1 rounded-sm transition-transform hover:scale-y-105"
              style={{ background: bg }}
            >
              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-amber-glow opacity-0 transition-opacity group-hover:opacity-100">
                {c}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        {HOUR_LABELS.map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
        <span>23:59</span>
      </div>
    </div>
  );
}
