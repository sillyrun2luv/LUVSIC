interface MaterialBarsProps {
  data: { name: string; count: number }[];
}

export default function MaterialBars({ data }: MaterialBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.count));

  if (data.length === 0) {
    return <p className="text-sm text-muted">暂无材料记录。</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-sm text-mist">{d.name}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-deep to-amber transition-all duration-500"
                style={{ width: `${Math.max(6, pct)}%`, animationDelay: `${i * 40}ms` }}
              />
            </div>
            <span className="stat-number w-8 shrink-0 text-right text-sm text-amber-glow">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
