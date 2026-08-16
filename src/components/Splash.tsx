import { useEffect } from "react";
import { t } from "@/store/useI18nStore";

interface SplashProps {
  onDone: () => void;
}

/** 气泡方向（相对香槟 cork 中心的偏移） */
const BUBBLES: { bx: string; by: string; r: number; delay: number }[] = [
  { bx: "-30px", by: "-58px", r: 4.5, delay: 0.6 },
  { bx: "38px", by: "-64px", r: 4, delay: 0.62 },
  { bx: "-54px", by: "-32px", r: 3.5, delay: 0.66 },
  { bx: "50px", by: "-26px", r: 4.5, delay: 0.6 },
  { bx: "8px", by: "-84px", r: 4, delay: 0.64 },
  { bx: "62px", by: "-50px", r: 3.5, delay: 0.68 },
  { bx: "-66px", by: "-60px", r: 3, delay: 0.65 },
  { bx: "26px", by: "-80px", r: 3.5, delay: 0.63 },
  { bx: "-20px", by: "-76px", r: 3, delay: 0.67 },
  { bx: "46px", by: "-72px", r: 3, delay: 0.69 },
];

export default function Splash({ onDone }: SplashProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-[100] flex animate-splashFade cursor-pointer flex-col items-center justify-center bg-ink-950"
    >
      {/* 光晕背景 */}
      <div
        className="pointer-events-none absolute h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: "rgb(var(--accent) / 0.5)" }}
      />

      {/* 香槟简笔画 */}
      <svg
        viewBox="0 0 120 200"
        className="relative h-[26rem] w-[10.5rem]"
        fill="none"
        stroke="rgb(var(--accent-glow))"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 瓶身（带摇晃） */}
        <g
          className="origin-bottom animate-splashShake"
          style={{ transformBox: "fill-box", transformOrigin: "60px 190px" }}
        >
          {/* 地面投影 */}
          <ellipse cx="60" cy="192" rx="34" ry="4" stroke="rgb(var(--accent) / 0.35)" strokeWidth={1.5} />

          {/* 瓶身轮廓 */}
          <path d="M30 188 L30 112 Q30 90 47 84 L47 46 Q47 40 52 38 L68 38 Q73 40 73 46 L73 84 Q90 90 90 112 L90 188 Z" />

          {/* 颈部锡箔环 */}
          <path d="M47 50 L73 50 M47 56 L73 56" stroke="rgb(var(--accent))" strokeWidth={1.6} />

          {/* 标签 */}
          <rect x="42" y="128" width="36" height="44" rx="3" stroke="rgb(var(--accent))" strokeWidth={1.6} />
          <path d="M48 142 L72 142 M48 150 L66 150 M52 158 L68 158" stroke="rgb(var(--accent-dim))" strokeWidth={1.2} />

          {/* 瓶底凹槽 */}
          <path d="M50 188 Q60 184 70 188" strokeWidth={1.4} />

          {/* 香槟软木塞（跟随瓶身摇晃，延迟弹出） */}
          <g
            className="animate-corkPop"
            style={{ animationDelay: "0.6s", transformBox: "fill-box", transformOrigin: "60px 30px" }}
          >
            <path d="M54 38 L54 24 Q54 18 60 18 Q66 18 66 24 L66 38" />
            <path d="M54 24 L66 24" stroke="rgb(var(--accent))" strokeWidth={1.6} />
          </g>
        </g>

        {/* 爆裂星芒 */}
        <g
          className="origin-center animate-starBurst"
          style={{ animationDelay: "0.55s", transformBox: "fill-box", transformOrigin: "60px 22px" }}
          stroke="rgb(var(--accent-glow))"
          strokeWidth={2}
        >
          <path d="M60 14 L60 -2" />
          <path d="M60 30 L60 46" />
          <path d="M68 22 L84 22" />
          <path d="M46 22 L30 22" />
          <path d="M66 16 L77 5" />
          <path d="M43 5 L54 16" />
          <path d="M66 28 L77 39" />
          <path d="M43 39 L54 28" />
        </g>

        {/* 飞溅气泡 */}
        {BUBBLES.map((b, i) => (
          <circle
            key={i}
            cx={60}
            cy={22}
            r={b.r}
            fill="rgb(var(--accent-glow))"
            stroke="none"
            className="animate-bubbleBurst"
            style={
              {
                animationDelay: `${b.delay}s`,
                "--bx": b.bx,
                "--by": b.by,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>

      {/* 文案 */}
      <h1
        className="font-display animate-riseIn mt-6 text-6xl font-medium tracking-wide text-amber-glow"
        style={{ animationDelay: "0.9s" }}
      >
        {t('splash.appName')}
      </h1>
      <p
        className="animate-fadeIn mt-3 text-sm text-muted"
        style={{ animationDelay: "1.2s" }}
      >
        {t('splash.subtitle')}
      </p>
      <p
        className="animate-fadeIn mt-4 max-w-xs text-center text-xs leading-relaxed text-muted/90"
        style={{ animationDelay: "1.4s" }}
      >
        {t('splash.message')}
      </p>

      {/* 跳过提示 */}
      <p
        className="animate-fadeIn absolute bottom-8 text-[11px] text-muted/60"
        style={{ animationDelay: "1.6s" }}
      >
        {t('splash.tapToSkip')}
      </p>
    </div>
  );
}
