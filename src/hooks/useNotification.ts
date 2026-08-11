import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useRecordStore } from "@/store/useRecordStore";
import type { ReminderConfig } from "@/types";

export type NotificationPermission = "default" | "granted" | "denied" | "unsupported";

/** 是否运行在 Capacitor 原生壳里（APK） */
const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

// 后台提醒的通知 ID 区间
const ID_DAILY = 1001;
const ID_WEEKLY_BASE = 1100; // 1100 + weekday(0-6)
const ID_INTERVAL_BASE = 1200; // 1200..1299
const INTERVAL_SLOTS = 30; // interval 模式预调度未来 30 个时间点

const REMINDER_TITLE = "自卫吧 · 该记录了";
const REMINDER_BODY = "别忘了今天的这一笔，几秒就好。";

/** 把 "HH:mm" 拆成数字 */
function parseTime(time: string): [number, number] {
  const [h, m] = time.split(":").map(Number);
  return [Number.isNaN(h) ? 22 : h, Number.isNaN(m) ? 0 : m];
}

/** 计算下一次该触发的时间戳（daily / weekly 共用） */
function nextDailyAt(time: string, base = new Date()): Date {
  const [hh, mm] = parseTime(time);
  const at = new Date(base);
  at.setHours(hh, mm, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

/** 计算指定 weekday 的下一次出现时间（0=周日…6=周六） */
function nextWeekdayAt(weekday: number, time: string): Date {
  const [hh, mm] = parseTime(time);
  const now = new Date();
  const at = new Date(now);
  at.setHours(hh, mm, 0, 0);
  const diff = (weekday - now.getDay() + 7) % 7;
  at.setDate(now.getDate() + diff);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 7);
  return at;
}

/**
 * 通知 hook：
 * - 原生（APK）走 @capacitor/local-notifications，会触发 Android 权限请求
 * - 浏览器走 window.Notification
 * - 支持三种频率：每天 / 每周指定几天 / 每隔 N 小时
 * - 前台定时检查（达标则不提醒）；原生额外调度后台通知
 */
export function useNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "unsupported";
    if (isNative()) return "default";
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission as NotificationPermission;
  });

  // 前台已发标记：daily/weekly 用日期 key，interval 用时间戳
  const lastNotifiedKeyRef = useRef<string>("");
  const lastIntervalFireRef = useRef<number>(0);

  // 原生环境：启动时查询权限状态
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await LocalNotifications.checkPermissions();
        if (cancelled) return;
        const p = res.display;
        setPermission(p === "prompt" ? "default" : (p as NotificationPermission));
      } catch {
        if (!cancelled) setPermission("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        const granted = res.display === "granted";
        setPermission(granted ? "granted" : "denied");
        return granted;
      } catch {
        setPermission("unsupported");
        return false;
      }
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return false;
    }
    if (Notification.permission === "granted") {
      setPermission("granted");
      return true;
    }
    if (Notification.permission === "denied") {
      setPermission("denied");
      return false;
    }
    const res = await Notification.requestPermission();
    setPermission(res as NotificationPermission);
    return res === "granted";
  }, []);

  const fire = useCallback(async (title: string, body: string): Promise<void> => {
    if (isNative()) {
      try {
        await LocalNotifications.schedule({
          notifications: [{ id: Math.floor(Math.random() * 900000) + 100000, title, body }],
        });
      } catch {
        /* 忽略 */
      }
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, icon: "/favicon.svg", tag: "zwba-reminder" });
    } catch {
      /* 忽略 */
    }
  }, []);

  /** 取消所有后台提醒通知 */
  const cancelAllReminders = useCallback(async (): Promise<void> => {
    if (!isNative()) return;
    const ids: { id: number }[] = [];
    ids.push({ id: ID_DAILY });
    for (let w = 0; w < 7; w++) ids.push({ id: ID_WEEKLY_BASE + w });
    for (let i = 0; i < INTERVAL_SLOTS; i++) ids.push({ id: ID_INTERVAL_BASE + i });
    try {
      await LocalNotifications.cancel({ notifications: ids });
      // pending 里的也清掉
      await LocalNotifications.getPending().then((pending) => {
        const extra = pending.notifications
          .map((n) => n.id)
          .filter((id) => id >= 1000 && id < 2000)
          .map((id) => ({ id }));
        if (extra.length) return LocalNotifications.cancel({ notifications: extra });
      });
    } catch {
      /* 忽略 */
    }
  }, []);

  /** 根据 reminder 配置调度后台通知（仅原生） */
  const scheduleReminder = useCallback(async (reminder: ReminderConfig): Promise<void> => {
    if (!isNative()) return;
    await cancelAllReminders();

    if (reminder.mode === "daily") {
      const at = nextDailyAt(reminder.time);
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: ID_DAILY,
              title: REMINDER_TITLE,
              body: REMINDER_BODY,
              schedule: { at, repeats: true, every: "day" as const },
            },
          ],
        });
      } catch {
        /* 忽略 */
      }
      return;
    }

    if (reminder.mode === "weekly") {
      const days = reminder.weekdays?.length ? reminder.weekdays : [1, 2, 3, 4, 5];
      const list = days
        .filter((w) => w >= 0 && w <= 6)
        .map((w) => ({
          id: ID_WEEKLY_BASE + w,
          title: REMINDER_TITLE,
          body: REMINDER_BODY,
          schedule: {
            at: nextWeekdayAt(w, reminder.time),
            repeats: true,
            every: "week" as const,
          },
        }));
      if (list.length) {
        try {
          await LocalNotifications.schedule({ notifications: list });
        } catch {
          /* 忽略 */
        }
      }
      return;
    }

    // interval：预调度未来 INTERVAL_SLOTS 个一次性时间点
    const hours = Math.max(1, Math.min(720, reminder.intervalHours || 24));
    const ms = hours * 3600_000;
    const list = Array.from({ length: INTERVAL_SLOTS }, (_, i) => {
      const at = new Date(Date.now() + ms * (i + 1));
      return {
        id: ID_INTERVAL_BASE + i,
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        schedule: { at, repeats: false },
      };
    });
    try {
      await LocalNotifications.schedule({ notifications: list });
    } catch {
      /* 忽略 */
    }
  }, [cancelAllReminders]);

  // 前台定时检查（全平台）
  useEffect(() => {
    const check = () => {
      const store = useRecordStore.getState();
      const reminder = store.settings?.reminder;
      if (!reminder || !reminder.enabled) return;
      if (permission !== "granted") return;

      const now = new Date();

      if (reminder.mode === "interval") {
        const hours = Math.max(1, reminder.intervalHours || 24);
        const ms = hours * 3600_000;
        if (now.getTime() - lastIntervalFireRef.current < ms) return;
        lastIntervalFireRef.current = now.getTime();
        void fire(REMINDER_TITLE, REMINDER_BODY);
        return;
      }

      // daily / weekly：命中 HH:mm 才发
      const [hh, mm] = parseTime(reminder.time);
      if (now.getHours() !== hh || now.getMinutes() !== mm) return;

      if (reminder.mode === "weekly") {
        const wd = now.getDay();
        if (!reminder.weekdays?.includes(wd)) return;
      }

      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (lastNotifiedKeyRef.current === todayKey) return;

      lastNotifiedKeyRef.current = todayKey;
      void fire(REMINDER_TITLE, REMINDER_BODY);
    };

    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [permission, fire]);

  // 原生：监听提醒配置变化，调度或取消后台通知
  const reminder = useRecordStore((s) => s.settings.reminder);
  useEffect(() => {
    if (!isNative()) return;
    if (!reminder?.enabled) {
      void cancelAllReminders();
      return;
    }
    if (permission === "granted") {
      void scheduleReminder(reminder);
    } else {
      // 权限未授予时也先清掉旧的
      void cancelAllReminders();
    }
  }, [
    reminder?.enabled,
    reminder?.mode,
    reminder?.time,
    reminder?.weekdays,
    reminder?.intervalHours,
    permission,
    scheduleReminder,
    cancelAllReminders,
  ]);

  // App 启动时：如果是 interval 模式且权限已授予，补充调度（防止一次性通知用完）
  useEffect(() => {
    if (!isNative()) return;
    if (permission !== "granted") return;
    const r = reminder;
    if (r?.enabled && r.mode === "interval") {
      void scheduleReminder(r);
    }
    // 仅启动时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  return {
    permission,
    requestPermission,
    fire,
    scheduleReminder,
    cancelAllReminders,
    isNative: isNative(),
  };
}
