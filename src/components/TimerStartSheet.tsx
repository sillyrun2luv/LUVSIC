import { useEffect, useState } from "react";
import { Check, Play, Sparkles, X } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

export default function TimerStartSheet() {
  const open = useUIStore((s) => s.showTimerStart);
  const close = useUIStore((s) => s.closeTimerStart);
  const startTimerWithSelection = useUIStore((s) => s.startTimerWithSelection);
  const cancelTimer = useUIStore((s) => s.cancelTimer);

  const forms = useRecordStore((s) => s.settings.forms);
  const tools = useRecordStore((s) => s.settings.tools);
  const presets = useRecordStore((s) => s.settings.presets);

  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedForms([]);
      setSelectedTools([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelTimer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cancelTimer]);

  if (!open) return null;

  const toggleForm = (f: string) =>
    setSelectedForms((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const toggleTool = (t: string) =>
    setSelectedTools((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const applyPreset = (id: string) => {
    const p = presets.find((p) => p.id === id);
    if (!p) return;
    setSelectedForms((prev) => [...new Set([...prev, ...p.forms])]);
    setSelectedTools((prev) => [...new Set([...prev, ...p.tools])]);
    toast(t('timerStart.presetApplied', p.name), "success");
  };

  const handleStart = () => {
    if (selectedForms.length === 0 && selectedTools.length === 0) {
      toast(t('timerStart.needAtLeastOne'), "warn");
      return;
    }
    startTimerWithSelection(selectedForms, selectedTools);
    toast(t('timerStart.start'), "success");
  };

  return (
    <div className="fixed inset-0 z-50 pb-[72px] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={cancelTimer}
      />

      <div className="surface relative z-10 w-full max-w-lg animate-slideUp p-5 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-cream">{t('timerStart.title')}</h3>
            <p className="text-xs text-muted">{t('timerStart.desc')}</p>
          </div>
          <button onClick={cancelTimer} className="text-muted hover:text-mist">
            <X size={18} />
          </button>
        </div>

        {/* 预设 */}
        {presets.length > 0 && (
          <div className="mb-4">
            <p className="label-eyebrow mb-2">{t('timerStart.quickCombo')}</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/[0.08] px-3 py-1.5 text-xs text-amber-glow transition-colors hover:bg-amber/[0.18]"
                >
                  <Sparkles size={12} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 形式 */}
        <div className="mb-4">
          <p className="label-eyebrow mb-2">{t('timerStart.forms')}</p>
          <div className="flex flex-wrap gap-2">
            {forms.map((f) => {
              const on = selectedForms.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleForm(f)}
                  className={cn("chip", on && "chip-active")}
                >
                  {on && <Check size={14} />}
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {/* 道具 */}
        <div className="mb-5">
          <p className="label-eyebrow mb-2">{t('timerStart.tools')}</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => {
              const on = selectedTools.includes(tool);
              return (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  className={cn("chip", on && "chip-active")}
                >
                  {on && <Check size={14} />}
                  {tool}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-amber py-3 font-medium text-ink-950 shadow-glow transition-all hover:bg-amber-glow"
        >
          <Play size={18} fill="currentColor" />
          {t('timerStart.start')}
        </button>
      </div>
    </div>
  );
}
