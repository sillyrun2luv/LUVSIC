import { useEffect, useRef, useState } from "react";
import { Clock, RotateCcw, Square } from "lucide-react";
import { useUIStore, getLastTimerSelection } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { t } from "@/store/useI18nStore";
import { toast } from "@/store/useToastStore";

/* ============================================================================
 * App 内 FloatingTimer —— 可拖动计时按钮
 * --------------------------------------------------------------------------
 * 职责单一：
 *   - 未计时：点击【直接开始计时】（复用上次的形式/道具，不再弹选择页）。
 *   - 计时中：显示红色胶囊（脉动红点 + MM:SS + 方停按钮），
 *             方停按钮点击弹「继续计时 / 结束并记录」菜单（防误触）。
 *   - 计时状态持久化在 useUIStore（localStorage），退出/杀死 App 后
 *     重开仍按墙钟时间继续计时。
 * ========================================================================== */

const POS_KEY = "ziweiba_float_pos";
// 容器统一大小（链接态 & 计时态都用这个盒，居中绘制内容）
const BOX_W = 188;
const BOX_H = 72;
const DRAG_THRESHOLD = 6;
const NAV_INSET = 88;

function formatTimer(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clampPos(x: number, y: number) {
  const maxX = Math.max(8, window.innerWidth - BOX_W - 8);
  const maxY = Math.max(8, window.innerHeight - BOX_H - NAV_INSET);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number") return clampPos(p.x, p.y);
    }
  } catch {
    /* ignore */
  }
  return clampPos(window.innerWidth - BOX_W - 16, window.innerHeight - BOX_H - NAV_INSET - 8);
}

type DragState = {
  active: boolean;
  moved: boolean;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
};

export default function FloatingTimer() {
  const timer = useUIStore((s) => s.timer);
  const startTimerWithSelection = useUIStore((s) => s.startTimerWithSelection);
  const openTimerStop = useUIStore((s) => s.openTimerStop);
  const showLauncher = useRecordStore((s) => s.settings.showFloatingTimer);

  const [elapsed, setElapsed] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number }>(loadPos);
  const [dragging, setDragging] = useState(false);
  const [showStopMenu, setShowStopMenu] = useState(false);

  const dragRef = useRef<DragState | null>(null);

  // 计时滴答
  useEffect(() => {
    if (!timer.running || timer.startTime === null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - timer.startTime);
    const id = window.setInterval(() => {
      const start = useUIStore.getState().timer.startTime;
      if (start !== null) setElapsed(Date.now() - start);
    }, 500);
    return () => window.clearInterval(id);
  }, [timer.running, timer.startTime]);

  // 计时停止时收起停止菜单
  useEffect(() => {
    if (!timer.running) setShowStopMenu(false);
  }, [timer.running]);

  // App 回到前台（从外部返回）时立即刷新一次真实经过时间
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const start = useUIStore.getState().timer.startTime;
        if (start !== null) setElapsed(Date.now() - start);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* ---------------- 点击 / 拖动 ---------------- */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.x,
      oy: pos.y,
    };
    setDragging(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !d.active) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      d.moved = true;
      setDragging(true);
      setShowStopMenu(false);
    }
    if (d.moved) setPos(clampPos(d.ox + dx, d.oy + dy));
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      setDragging(false);
      setPos((p) => {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
        return p;
      });
    } else if (timer.running) {
      // 计时态：点方块按钮 → 弹「继续 / 结束」菜单（防误触）
      setShowStopMenu((v) => !v);
    } else {
      startTiming();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (timer.running) setShowStopMenu((v) => !v);
      else startTiming();
    }
  };

  /* ---------------- 直接开始计时（复用上次的形式/道具，不弹选择页） ---------------- */
  const startTiming = () => {
    if (timer.running) return;
    const last = getLastTimerSelection();
    startTimerWithSelection(last.forms, last.tools);
    toast(t("floatingTimer.startedToast"), "success");
  };

  /* ---------------- 计时中菜单回调 ---------------- */
  const continueTiming = () => setShowStopMenu(false);

  const finishTiming = () => {
    setShowStopMenu(false);
    // 用实时 startTime 计算准确时长（elapsed 状态可能有 500ms 滞后）
    const start = useUIStore.getState().timer.startTime;
    const duration =
      start !== null ? Math.max(0, Date.now() - start) / 60000 : elapsed / 60000;
    openTimerStop(duration);
  };

  /* ===================== 渲染 ===================== */
  // 计时段：即使入口开关关闭，计时中也保留（用户关闭入口仍能看到计时）
  if (timer.running) {
    return (
      <>
        {showStopMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowStopMenu(false)}
            aria-hidden
          />
        )}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          style={{
            left: pos.x,
            top: pos.y,
            width: BOX_W,
            height: BOX_H,
            touchAction: "none",
          }}
          className={`fixed z-40 flex select-none items-center justify-between rounded-full border px-4 backdrop-blur-md ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          } ${
            showStopMenu
              ? "border-red-300/70 bg-red-500/35"
              : "border-red-400/50 bg-red-500/25 hover:bg-red-500/30"
          } animate-riseIn shadow-card`}
          title={t("floatingTimer.tapToStop")}
          aria-label={t("floatingTimer.tapToStop")}
          role="button"
          tabIndex={0}
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-400" />
          </span>
          <span className="stat-number text-xl tabular-nums text-red-50">
            {formatTimer(elapsed)}
          </span>
          <button
            onPointerDown={(ev) => ev.stopPropagation()}
            onPointerUp={(ev) => {
              // 阻止冒泡到胶囊容器的 onPointerUp，避免"弹开又立刻关上"的双重切换
              ev.stopPropagation();
              setShowStopMenu((v) => !v);
            }}
            onClick={(ev) => ev.stopPropagation()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-300/90 text-red-900 shadow-sm transition hover:bg-red-200 active:scale-95"
            aria-label={t("floatingTimer.stop")}
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>

        {showStopMenu && (
          <div
            className="fixed z-50 w-44 rounded-2xl border border-line bg-ink-900/95 p-1.5 shadow-card backdrop-blur-md"
            style={popoverStyle(pos)}
            role="menu"
          >
            <button
              onClick={continueTiming}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-cream transition-colors hover:bg-ink-800"
              role="menuitem"
            >
              <RotateCcw size={15} className="text-teal-300" />
              {t("floatingTimer.continue")}
            </button>
            <button
              onClick={finishTiming}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-100 transition-colors hover:bg-red-500/20"
              role="menuitem"
            >
              <Square size={15} fill="currentColor" className="text-red-300" />
              {t("floatingTimer.finishRecord")}
            </button>
          </div>
        )}
      </>
    );
  }

  // 未计时 + 入口开关关闭：什么都不渲染
  if (!showLauncher) return null;

  // 未计时：可拖动的"开始计时"按钮（点按直接起停计时，不弹悬浮窗授权）
  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      style={{ left: pos.x, top: pos.y, width: BOX_W, height: BOX_H, touchAction: "none" }}
      className={`fixed z-40 flex select-none items-center justify-between gap-2 rounded-full border border-amber/30 bg-amber/15 px-3.5 backdrop-blur-md transition-colors ${
        dragging ? "cursor-grabbing" : "cursor-grab hover:bg-amber/25"
      } animate-riseIn shadow-card`}
      title={t("floatingTimer.start")}
      aria-label={t("floatingTimer.start")}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/35 text-amber-glow">
        <Clock size={16} />
      </span>
      <span className="flex flex-1 flex-col items-start leading-tight text-left">
        <span className="text-[12px] font-medium text-cream">{t("floatingTimer.start")}</span>
        <span className="text-[10px] text-muted">{t("floatingTimer.idleHint")}</span>
      </span>
    </button>
  );
}

function popoverStyle(pos: { x: number; y: number }) {
  const w = 176;
  const h = 104;
  const gap = 10;
  const left = Math.min(Math.max(8, pos.x), Math.max(8, window.innerWidth - w - 8));
  const top = pos.y - h - gap > 8 ? pos.y - h - gap : pos.y + BOX_H + gap;
  return { left, top };
}
