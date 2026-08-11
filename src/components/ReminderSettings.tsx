import { Bell, BellOff, Clock, Volume2, VolumeX, Radio, CalendarDays, Repeat } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import { useNotification } from "@/hooks/useNotification";
import { cn } from "@/lib/utils";
import type { ReminderMode } from "@/types";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const MODE_OPTIONS: { value: ReminderMode; label: string; icon: typeof Clock }[] = [
  { value: "daily", label: "每天", icon: Clock },
  { value: "weekly", label: "每周指定", icon: CalendarDays },
  { value: "interval", label: "每隔N小时", icon: Repeat },
];

/** 生成提醒摘要文字 */
function summarize(r: ReturnType<typeof useRecordStore.getState>["settings"]["reminder"]): string {
  if (!r.enabled) return "关闭时不会有任何提醒";
  if (r.mode === "daily") return `每天 ${r.time} 提醒你记录`;
  if (r.mode === "weekly") {
    const days = r.weekdays.length
      ? [...r.weekdays].sort().map((w) => "周" + WEEKDAY_LABELS[w]).join("、")
      : "未选";
    return `${days} ${r.time} 提醒`;
  }
  return `每隔 ${r.intervalHours} 小时提醒一次`;
}

export default function ReminderSettings() {
  const reminder = useRecordStore((s) => s.settings.reminder);
  const setReminder = useRecordStore((s) => s.setReminder);
  const { permission, requestPermission, fire, isNative } = useNotification();

  const handleToggleEnabled = async () => {
    if (!reminder.enabled) {
      const ok = await requestPermission();
      if (!ok) {
        toast(permission === "unsupported" ? "当前环境不支持系统通知" : "通知权限未授予，请到系统设置开启", "warn");
      }
    }
    setReminder({ enabled: !reminder.enabled });
  };

  const handleTest = async () => {
    if (permission !== "granted") {
      toast("先开启通知权限", "warn");
      return;
    }
    await fire("自卫吧 · 测试提醒", "这是一条测试提醒。");
    toast("已发送测试通知", "success");
  };

  const toggleWeekday = (w: number) => {
    const has = reminder.weekdays.includes(w);
    const next = has ? reminder.weekdays.filter((x) => x !== w) : [...reminder.weekdays, w];
    setReminder({ weekdays: next });
  };

  return (
    <div className="space-y-5">
      {/* 开关行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              reminder.enabled ? "bg-amber/20 text-amber-glow" : "bg-ink-800 text-muted",
            )}
          >
            {reminder.enabled ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div>
            <div className="text-sm text-cream">提醒</div>
            <div className="text-xs text-muted">{summarize(reminder)}</div>
          </div>
        </div>

        <button
          onClick={handleToggleEnabled}
          role="switch"
          aria-checked={reminder.enabled}
          aria-label={reminder.enabled ? "关闭提醒" : "开启提醒"}
          className={cn(
            "relative h-7 w-12 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors",
            reminder.enabled ? "bg-amber" : "bg-ink-700",
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              reminder.enabled ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {reminder.enabled && (
        <div className="animate-fadeIn space-y-4 rounded-xl border border-line bg-ink-900/60 p-4">
          {/* 频率模式选择 */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-mist">
              <Repeat size={15} />
              提醒频率
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = reminder.mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setReminder({ mode: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs transition-colors",
                      active
                        ? "border-amber bg-amber/10 text-amber-glow"
                        : "border-line bg-ink-800 text-muted hover:border-amber/40",
                    )}
                  >
                    <Icon size={16} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 时间选择（daily / weekly） */}
          {(reminder.mode === "daily" || reminder.mode === "weekly") && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-mist">
                <Clock size={15} />
                提醒时间
              </div>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => setReminder({ time: e.target.value })}
                className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-right font-mono text-amber-glow outline-none focus:border-amber/50 [color-scheme:dark]"
              />
            </div>
          )}

          {/* 星期选择（weekly） */}
          {reminder.mode === "weekly" && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-mist">
                <CalendarDays size={15} />
                提醒日（可多选）
              </div>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, w) => {
                  const active = reminder.weekdays.includes(w);
                  return (
                    <button
                      key={w}
                      onClick={() => toggleWeekday(w)}
                      className={cn(
                        "h-9 flex-1 rounded-lg border text-xs transition-colors",
                        active
                          ? "border-amber bg-amber/15 text-amber-glow"
                          : "border-line bg-ink-800 text-muted hover:border-amber/40",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {reminder.weekdays.length === 0 && (
                <p className="mt-2 text-xs text-red-300/80">请至少选择一天</p>
              )}
            </div>
          )}

          {/* 间隔小时（interval） */}
          {reminder.mode === "interval" && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-mist">
                <Repeat size={15} />
                间隔小时数
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={reminder.intervalHours}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(720, parseInt(e.target.value) || 1));
                    setReminder({ intervalHours: n });
                  }}
                  className="w-20 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-center font-mono text-amber-glow outline-none focus:border-amber/50"
                />
                <span className="text-sm text-muted">小时</span>
              </div>
            </div>
          )}

          {/* 提示音 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-mist">
              {reminder.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
              提示音
            </div>
            <button
              onClick={() => setReminder({ sound: !reminder.sound })}
              role="switch"
              aria-checked={reminder.sound}
              aria-label={reminder.sound ? "关闭提示音" : "开启提示音"}
              className={cn(
                "relative h-6 w-11 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors",
                reminder.sound ? "bg-amber" : "bg-ink-700",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  reminder.sound ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* 测试 */}
          <button
            onClick={handleTest}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
          >
            <Radio size={14} />
            发送一条测试通知
          </button>

          {permission === "denied" && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              通知权限未开启。请到手机「设置 → 应用 → 自卫吧 → 通知」打开通知权限，然后回到这里点「重新请求权限」。
            </p>
          )}
          {permission === "unsupported" && (
            <p className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs text-muted">
              当前环境不支持系统通知。
            </p>
          )}
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              onClick={() => void requestPermission()}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
            >
              重新请求通知权限
            </button>
          )}
          <p className="text-[11px] leading-relaxed text-muted/80">
            {isNative
              ? "提醒会在后台按时推送，即使关闭 App 也能收到。"
              : "提示：浏览器环境下通知仅在本应用打开时生效。关闭页面后不会收到后台提醒。"}
          </p>
        </div>
      )}
    </div>
  );
}
