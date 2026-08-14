import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FloatingTimer() {
  const timer = useUIStore((s) => s.timer);
  const openTimerStart = useUIStore((s) => s.openTimerStart);
  const openTimerStop = useUIStore((s) => s.openTimerStop);
  const showFloatingTimer = useRecordStore((s) => s.settings.showFloatingTimer);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timer.running || timer.startTime === null) return;
    setElapsed(Date.now() - timer.startTime);
    const id = window.setInterval(() => {
      const start = useUIStore.getState().timer.startTime;
      if (start !== null) setElapsed(Date.now() - start);
    }, 500);
    return () => window.clearInterval(id);
  }, [timer.running, timer.startTime]);

  const handleClick = () => {
    if (timer.running) {
      // 停止计时，打开备注弹窗
      const totalSec = Math.floor(elapsed / 1000);
      const minutes = totalSec / 60;
      openTimerStop(minutes);
    } else {
      // 打开前置选择弹窗
      openTimerStart();
    }
  };

  if (timer.running) {
    return (
      <button
        onClick={handleClick}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full border border-red-400/50 bg-red-500/20 px-5 py-3 backdrop-blur-md transition-all hover:bg-red-500/30 animate-riseIn shadow-card"
        title="点击停止并记录"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
        </span>
        <span className="stat-number text-lg tabular-nums text-red-100">
          {formatTimer(elapsed)}
        </span>
        <span className="flex items-center gap-1 text-xs text-red-200">
          <Square size={12} fill="currentColor" />
          停止
        </span>
      </button>
    );
  }

  // 计时中始终显示（否则用户无法停止）；未计时时受开关控制
  if (!timer.running && !showFloatingTimer) return null;

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-ink-950 shadow-glow transition-all hover:scale-105 hover:bg-amber-glow animate-riseIn"
      title="开始计时"
      aria-label="开始计时"
    >
      <Play size={22} fill="currentColor" />
    </button>
  );
}
