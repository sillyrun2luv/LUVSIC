import type { DayCount } from "@/lib/stats";
import { formatDateShort } from "@/lib/date";

interface TrendChartProps {
  data: DayCount[]; // 近 30 天
}

export default function TrendChart({ data }: TrendChartProps) {
  const width = 640;
  const height = 180;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...data.map((d) => d.count));

  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = height - padY - (d.count / max) * (height - padY * 2);
    return { x, y, d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M${padX},${height - padY} ` +
    points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${(padX + (data.length - 1) * stepX).toFixed(1)},${height - padY} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 基线 */}
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="#2A2630"
          strokeWidth="1"
        />
        <path d={areaPath} fill="url(#trendFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) =>
          p.d.count > 0 ? (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="rgb(var(--accent-glow))" />
          ) : null,
        )}
        {/* 今日高亮 */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="4"
            fill="rgb(var(--accent))"
            className="animate-flicker"
          />
        )}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>{formatDateShort(data[0]?.day ?? Date.now())}</span>
        <span>{formatDateShort(data[data.length - 1]?.day ?? Date.now())}</span>
      </div>
    </div>
  );
}
