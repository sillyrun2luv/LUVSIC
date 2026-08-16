import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { t } from "@/store/useI18nStore";
import {
  hasOverlayPermission,
  syncOverlayTimer,
  stopOverlayTimer,
} from "@/lib/floatingOverlay";

/* ============================================================================
 * 计时「应用外入口」协调器（仅原生 APK 生效）
 * --------------------------------------------------------------------------
 * 优先级：全局悬浮窗（前台服务，自带常驻通知）> 本地通知（兜底）。
 * - 计时开始 → 悬浮窗可用则启动悬浮窗；否则发一条"计时中"常驻通知。
 * - 点悬浮窗方块 / 点通知 → 拉起 App，按真实经过时长打开「记录感受」页。
 * - 计时结束/取消 → 悬浮窗与通知都清掉。
 * - 回到前台时重新对齐（覆盖"结束并记录被取消后悬浮窗未恢复"等情况）。
 * ========================================================================== */

const TIMER_NOTIF_ID = 900001;

async function showTimerNotification() {
  try {
    // 未授权时主动请求（Android 13+ 的 POST_NOTIFICATIONS 运行时权限）
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt") {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== "granted") return;
    // 不带 schedule → 立即展示。带 at 的定时通知在 Android 12+ 会走精确闹钟
    // 路径（需 SCHEDULE_EXACT_ALARM 权限，默认无 → 静默失败不发）。
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TIMER_NOTIF_ID,
          title: t("floatingTimer.notifTitle"),
          body: t("floatingTimer.notifBody"),
        },
      ],
    });
  } catch {
    /* 通知失败不影响计时 */
  }
}

export async function cancelTimerNotification() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] });
  } catch {
    /* ignore */
  }
}

/** 计时开始 → 决定用悬浮窗还是通知 */
async function onTimerStarted() {
  const overlayOn =
    useRecordStore.getState().settings.overlayTimer && (await hasOverlayPermission());
  if (overlayOn) {
    // 悬浮窗的前台服务自带常驻通知（点按同样 = 结束并回 App），无需再发本地通知
    await syncOverlayTimer();
  } else {
    await showTimerNotification();
  }
}

/** 计时结束/取消 → 清掉所有应用外入口 */
async function onTimerStopped() {
  await stopOverlayTimer();
  await cancelTimerNotification();
}

/** floating 深链：com.selfdefense.app://floating/open|stop（MainActivity 注入） */
function handleFloatingLink(url?: string) {
  if (!url || !url.startsWith("com.selfdefense.app://floating/")) return;
  if (!url.endsWith("/stop")) return; // open：仅拉起 App，无额外动作
  const { timer, openTimerStop } = useUIStore.getState();
  if (!timer.running || timer.startTime === null) return;
  const duration = Math.max(0, Date.now() - timer.startTime) / 60000;
  openTimerStop(duration);
}

/**
 * 初始化（main.tsx 调用一次）：
 * 1. 监听 timer.running 变化 → 启停悬浮窗/通知
 * 2. 监听 floating 深链 + 本地通知点按 → 打开「记录感受」页
 * 3. 回到前台 → 重新对齐悬浮窗状态
 */
export function setupTimerNotification() {
  if (!Capacitor.isNativePlatform()) return;

  // --- 1. 计时状态变化 ---
  let prevRunning = useUIStore.getState().timer.running;
  // 若启动时水合出"计时中"状态（App 被杀后重开），补齐应用外入口
  if (prevRunning) void onTimerStarted();
  useUIStore.subscribe((s) => {
    const running = s.timer.running;
    if (running === prevRunning) return;
    prevRunning = running;
    if (running) void onTimerStarted();
    else void onTimerStopped();
  });

  // --- 2a. floating 深链（悬浮窗方块 / 前台服务通知点按） ---
  const queued = (window as any).__ZIWEIBA_DEEPLINK__;
  if (typeof queued === "string") handleFloatingLink(queued);
  window.addEventListener("ziweiba-deeplink", (e) =>
    handleFloatingLink((e as CustomEvent).detail as string),
  );

  // --- 2b. 本地通知点按（兜底入口） ---
  LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    if (event.notification?.id !== TIMER_NOTIF_ID) return;
    const { timer, openTimerStop } = useUIStore.getState();
    if (!timer.running || timer.startTime === null) return;
    void cancelTimerNotification();
    const duration = Math.max(0, Date.now() - timer.startTime) / 60000;
    openTimerStop(duration);
  }).catch(() => {
    /* ignore */
  });

  // --- 3. 回到前台 → 重新对齐悬浮窗（并刷新通知可用性） ---
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncOverlayTimer();
    }
  });
}
