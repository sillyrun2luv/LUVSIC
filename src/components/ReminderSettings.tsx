import { Bell, BellOff, Clock, Volume2, VolumeX, Radio, CalendarDays, Repeat } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import { useNotification } from "@/hooks/useNotification";
import { t } from "@/store/useI18nStore";
import { cn } from "@/lib/utils";
import type { ReminderMode } from "@/types";

const WEEKDAY_KEYS = ["calendar.weekday7", "calendar.weekday1", "calendar.weekday2", "calendar.weekday3", "calendar.weekday4", "calendar.weekday5", "calendar.weekday6"];

const MODE_OPTIONS: { value: ReminderMode; labelKey: string; icon: typeof Clock }[] = [
  { value: "daily", labelKey: "reminder.frequencyDaily", icon: Clock },
  { value: "weekly", labelKey: "reminder.frequencyWeekly", icon: CalendarDays },
  { value: "interval", labelKey: "reminder.frequencyEveryNHours", icon: Repeat },
];

/** 生成提醒摘要文字 */
function summarize(r: ReturnType<typeof useRecordStore.getState>["settings"]["reminder"]): string {
  if (!r.enabled) return t("reminder.offWhenClosed");
  if (r.mode === "daily") return t("reminder.dailyAt", r.time);
  if (r.mode === "weekly") {
    const days = r.weekdays.length
      ? [...r.weekdays].sort().map((w) => "周" + t(WEEKDAY_KEYS[w])).join("、")
      : t("common.none");
    return t("reminder.weeklyAt", days, r.time);
  }
  return t("reminder.everyNHours", r.intervalHours);
}

export default function ReminderSettings() {
  const reminder = useRecordStore((s) => s.settings.reminder);
  const setReminder = useRecordStore((s) => s.setReminder);
  const { permission, requestPermission, fire, isNative } = useNotification();

  const handleToggleEnabled = async () => {
    if (!reminder.enabled) {
      const ok = await requestPermission();
      if (!ok) {
        toast(permission === "unsupported" ? t("reminder.notSupported") : t("reminder.permissionNotGranted"), "warn");
      }
    }
    setReminder({ enabled: !reminder.enabled });
  };

  const handleTest = async () => {
    if (permission !== "granted") {
      toast(t("reminder.sendTest"), "warn");
      return;
    }
    await fire(`${t("app.name")} · ${t("reminder.sendTest")}`, t("reminder.sendTest"));
    toast(t("reminder.sendTest"), "success");
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
            <div className="text-sm text-cream">{t("reminder.title")}</div>
            <div className="text-xs text-muted">{summarize(reminder)}</div>
          </div>
        </div>

        <button
          onClick={handleToggleEnabled}
          role="switch"
          aria-checked={reminder.enabled}
          aria-label={reminder.enabled ? t("common.close") : t("reminder.title")}
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
              {t("reminder.frequency")}
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
                    {t(opt.labelKey)}
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
                {t("reminder.time")}
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
                {t("reminder.weekdays")}
              </div>
              <div className="flex gap-1.5">
                {WEEKDAY_KEYS.map((key, w) => {
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
                      {t(key)}
                    </button>
                  );
                })}
              </div>
              {reminder.weekdays.length === 0 && (
                <p className="mt-2 text-xs text-red-300/80">{t("reminder.selectAtLeastOneDay")}</p>
              )}
            </div>
          )}

          {/* 间隔小时（interval） */}
          {reminder.mode === "interval" && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-mist">
                <Repeat size={15} />
                {t("reminder.intervalHours")}
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
                <span className="text-sm text-muted">{t("reminder.hourUnit")}</span>
              </div>
            </div>
          )}

          {/* 提示音 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-mist">
              {reminder.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {t("reminder.sound")}
            </div>
            <button
              onClick={() => setReminder({ sound: !reminder.sound })}
              role="switch"
              aria-checked={reminder.sound}
              aria-label={reminder.sound ? t("common.close") : t("reminder.sound")}
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
            {t("reminder.sendTest")}
          </button>

          {permission === "denied" && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {t("reminder.permissionNotGranted")}
            </p>
          )}
          {permission === "unsupported" && (
            <p className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs text-muted">
              {t("reminder.notSupported")}
            </p>
          )}
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              onClick={() => void requestPermission()}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
            >
              {t("reminder.requestPermission")}
            </button>
          )}
          <p className="text-[11px] leading-relaxed text-muted/80">
            {isNative
              ? t("reminder.backgroundDelivery")
              : t("reminder.browserNote")}
          </p>
        </div>
      )}
    </div>
  );
}
