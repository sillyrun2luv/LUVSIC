import { useEffect, useState } from "react";
import { CheckCircle, Clock, X } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import { toast } from "@/store/useToastStore";
import { formatDuration } from "@/lib/date";

export default function TimerStopSheet() {
  const open = useUIStore((s) => s.showTimerStop);
  const closeTimerStop = useUIStore((s) => s.closeTimerStop);
  const timerDuration = useUIStore((s) => s.timerDuration);
  const timer = useUIStore((s) => s.timer);

  const addRecord = useRecordStore((s) => s.addRecord);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTimerStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeTimerStop]);

  if (!open) return null;

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    addRecord({
      timestamp: Date.now(),
      duration: timerDuration,
      forms: timer.forms,
      tools: timer.tools,
      note: note.trim() || undefined,
      isTimerEntry: true, // 计时按钮来的 —— 真实时长，计入排行榜
    });
    toast("已保存记录", "success");
    setSaving(false);
    closeTimerStop();
  };

  const handleDiscard = () => {
    toast("已丢弃本次记录", "warn");
    closeTimerStop();
  };

  const totalSec = Math.round(timerDuration * 60);
  const hasForms = timer.forms.length > 0;
  const hasTools = timer.tools.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={handleDiscard}
      />

      <div className="surface relative z-10 w-full max-w-lg animate-slideUp p-5 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={22} className="text-amber" />
            <div>
              <h3 className="font-display text-lg text-cream">时间到了</h3>
              <p className="text-xs text-muted">记录这次感受，几秒就好</p>
            </div>
          </div>
          <button onClick={handleDiscard} className="text-muted hover:text-mist">
            <X size={18} />
          </button>
        </div>

        {/* 时长显示 */}
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-900/60 py-4">
          <Clock size={18} className="text-amber-glow" />
          <span className="stat-number text-3xl text-amber-glow tabular-nums">
            {formatDuration(timerDuration)}
          </span>
        </div>

        {/* 已选形式/道具预览 */}
        {(hasForms || hasTools) && (
          <div className="mb-4 rounded-xl border border-line bg-ink-900/40 p-3">
            {hasForms && (
              <div className="mb-2">
                <span className="text-[11px] text-muted">形式</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {timer.forms.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11px] text-amber-glow"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {hasTools && (
              <div>
                <span className="text-[11px] text-muted">道具</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {timer.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-mist"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 备注 */}
        <div className="mb-5">
          <label className="label-eyebrow mb-2 block">此刻的感受</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="身体的感受、心里的想法、环境的氛围……"
            autoFocus
            className="w-full resize-none rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-sm text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-amber/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscard}
            className="rounded-full border border-line px-4 py-2.5 text-sm text-mist transition-colors hover:bg-ink-800"
          >
            丢弃
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber py-2.5 font-medium text-ink-950 shadow-glow transition-all hover:bg-amber-glow disabled:opacity-50"
          >
            保存记录
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted">
          {totalSec}秒 · {timer.forms.join("、") || "无形式"} · {timer.tools.join("、") || "无道具"}
        </p>
      </div>
    </div>
  );
}
