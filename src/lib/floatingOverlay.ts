import { Capacitor, registerPlugin } from "@capacitor/core";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { t } from "@/store/useI18nStore";

/* ============================================================================
 * 全局悬浮计时窗（应用外显示）—— JS 侧桥接
 * --------------------------------------------------------------------------
 * 原生侧（FloatingTimerService）自己按墙钟算时间并渲染胶囊，
 * JS 只负责：授权查询/跳转、启动/停止信号、以及状态变化的同步调度。
 * ========================================================================== */

interface FloatingTimerNative {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ opened: boolean }>;
  start(options: { startAt: number; title: string; body: string }): Promise<{
    started: boolean;
    reason?: string;
  }>;
  stop(): Promise<void>;
}

const native = Capacitor.isNativePlatform()
  ? registerPlugin<FloatingTimerNative>("FloatingTimer")
  : null;

/** 是否在原生环境（APK）中 */
export function overlayAvailable(): boolean {
  return native !== null;
}

/** 是否已授予"显示在其他应用上层"权限 */
export async function hasOverlayPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    return (await native.hasPermission()).granted;
  } catch {
    return false;
  }
}

/** 跳转系统悬浮窗授权页（返回 App 后需重新查询权限状态） */
export async function requestOverlayPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    return (await native.requestPermission()).opened;
  } catch {
    return false;
  }
}

/** 计时状态是否应当显示悬浮窗（原生 + 开关 + 权限 三者齐备） */
async function shouldOverlayRun(): Promise<boolean> {
  if (!native) return false;
  const { timer } = useUIStore.getState();
  if (!timer.running || timer.startTime === null) return false;
  if (!useRecordStore.getState().settings.overlayTimer) return false;
  return await hasOverlayPermission();
}

/**
 * 把悬浮窗状态与计时状态对齐：
 * - 计时中 + 开关开 + 已授权 → start（传 startTime 墙钟 + 本地化文案）
 * - 其他情况 → stop
 * 重复调用安全（原生幂等）。
 */
export async function syncOverlayTimer(): Promise<boolean> {
  if (!native) return false;
  try {
    if (await shouldOverlayRun()) {
      const startAt = useUIStore.getState().timer.startTime ?? Date.now();
      const res = await native.start({
        startAt,
        title: t("floatingTimer.notifTitle"),
        body: t("floatingTimer.notifBody"),
      });
      return res.started;
    }
    await native.stop();
    return false;
  } catch {
    return false;
  }
}

/** 停止悬浮窗（计时结束/取消时调用） */
export async function stopOverlayTimer(): Promise<void> {
  if (!native) return;
  try {
    await native.stop();
  } catch {
    /* ignore */
  }
}
