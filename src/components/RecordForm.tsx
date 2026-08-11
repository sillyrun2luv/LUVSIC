import { useEffect, useState } from "react";
import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { RecordEntry } from "@/types";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/date";
import { cn } from "@/lib/utils";

interface RecordFormProps {
  editing: RecordEntry | null;
  onDone: () => void;
  onCancel: () => void;
}

const QUICK_DURATIONS = [5, 10, 15, 20, 30, 45, 60];

export default function RecordForm({ editing, onDone, onCancel }: RecordFormProps) {
  const forms = useRecordStore((s) => s.settings.forms);
  const tools = useRecordStore((s) => s.settings.tools);
  const presets = useRecordStore((s) => s.settings.presets);
  const addForm = useRecordStore((s) => s.addForm);
  const addTool = useRecordStore((s) => s.addTool);
  const addPreset = useRecordStore((s) => s.addPreset);
  const removePreset = useRecordStore((s) => s.removePreset);

  const addRecord = useRecordStore((s) => s.addRecord);
  const updateRecord = useRecordStore((s) => s.updateRecord);

  const [when, setWhen] = useState(() => toDatetimeLocalValue(Date.now()));
  const [duration, setDuration] = useState(15);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [newForm, setNewForm] = useState("");
  const [newTool, setNewTool] = useState("");
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  useEffect(() => {
    if (editing) {
      setWhen(toDatetimeLocalValue(editing.timestamp));
      setDuration(editing.duration);
      setSelectedForms(editing.forms);
      setSelectedTools(editing.tools);
      setNote(editing.note ?? "");
    } else {
      setWhen(toDatetimeLocalValue(Date.now()));
      setDuration(15);
      setSelectedForms([]);
      setSelectedTools([]);
      setNote("");
    }
  }, [editing]);

  const toggleForm = (f: string) =>
    setSelectedForms((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const toggleTool = (t: string) =>
    setSelectedTools((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const applyPreset = (id: string) => {
    const p = presets.find((p) => p.id === id);
    if (!p) return;
    setSelectedForms((prev) => [...new Set([...prev, ...p.forms])]);
    setSelectedTools((prev) => [...new Set([...prev, ...p.tools])]);
    toast(`已应用「${p.name}」`, "success");
  };

  const handleAddForm = () => {
    const trimmed = newForm.trim();
    if (!trimmed) return;
    addForm(trimmed);
    setSelectedForms((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewForm("");
  };

  const handleAddTool = () => {
    const trimmed = newTool.trim();
    if (!trimmed) return;
    addTool(trimmed);
    setSelectedTools((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewTool("");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    if (selectedForms.length === 0 && selectedTools.length === 0) {
      toast("请先选择至少一个形式或道具", "warn");
      return;
    }
    addPreset(name, selectedForms, selectedTools);
    toast(`已保存预设「${name}」`, "success");
    setPresetName("");
    setShowSavePreset(false);
  };

  const handleSubmit = () => {
    const ts = fromDatetimeLocalValue(when);
    if (!ts || Number.isNaN(ts)) {
      toast("时间不合法", "warn");
      return;
    }
    const dur = Math.max(0, Math.round(duration * 60) / 60); // 保留到秒精度
    const payload = {
      timestamp: ts,
      duration: dur,
      forms: selectedForms,
      tools: selectedTools,
      note: note.trim() || undefined,
    };
    if (editing) {
      updateRecord(editing.id, payload);
      toast("已更新记录", "success");
    } else {
      addRecord(payload);
      toast("已记录一次", "success");
    }
    onDone();
  };

  const hasSelection = selectedForms.length > 0 || selectedTools.length > 0;

  return (
    <div className="surface animate-riseIn p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-xl text-cream">{editing ? "编辑记录" : "新增一次"}</h3>
        <button onClick={onCancel} className="text-sm text-muted hover:text-mist">
          取消
        </button>
      </div>

      {/* 时间 */}
      <Field label="时间">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-cream outline-none transition-colors focus:border-amber/50 [color-scheme:dark]"
        />
      </Field>

      {/* 时长 */}
      <Field label="时长">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            step={0.1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-24 rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-center font-mono text-lg text-cream outline-none transition-colors focus:border-amber/50"
          />
          <span className="text-xs text-muted">分钟</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn("chip text-xs", duration === d && "chip-active")}
              >
                {d}分
              </button>
            ))}
          </div>
        </div>
      </Field>

      {/* 预设快捷栏 */}
      {presets.length > 0 && (
        <Field label="快速组合">
          <div className="mb-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  onClick={() => applyPreset(p.id)}
                  className="flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/[0.08] px-3 py-1.5 text-xs text-amber-glow transition-colors hover:bg-amber/[0.18]"
                >
                  <Sparkles size={12} />
                  {p.name}
                </button>
                <button
                  onClick={() => {
                    removePreset(p.id);
                    toast(`已删除预设「${p.name}」`, "success");
                  }}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-800 text-muted opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                  title="删除预设"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          {hasSelection && (
            <button
              onClick={() => setShowSavePreset(true)}
              className="flex items-center gap-1 text-xs text-amber-dim hover:text-amber-glow"
            >
              <Plus size={12} />
              保存当前选择为预设
            </button>
          )}
          {showSavePreset && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="预设名称，如：洗澡+手"
                className="flex-1 rounded-md border border-line bg-ink-900 px-2 py-1 text-xs outline-none focus:border-amber/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePreset();
                }}
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                className="rounded-full bg-amber px-3 py-1 text-xs text-ink-950"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowSavePreset(false);
                  setPresetName("");
                }}
                className="text-xs text-muted hover:text-mist"
              >
                取消
              </button>
            </div>
          )}
        </Field>
      )}

      {/* 刺激形式 */}
      <Field label="刺激形式">
        <div className="mb-2 flex flex-wrap gap-2">
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
        <div className="flex items-center gap-2">
          <input
            value={newForm}
            onChange={(e) => setNewForm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddForm();
            }}
            placeholder="添加自定义形式…"
            className="flex-1 rounded-md border border-line bg-ink-900 px-3 py-1.5 text-xs outline-none focus:border-amber/40"
          />
          <button
            onClick={handleAddForm}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:border-amber/40 hover:text-amber-glow"
          >
            + 添加
          </button>
        </div>
      </Field>

      {/* 辅助道具 */}
      <Field label="辅助道具">
        <div className="mb-2 flex flex-wrap gap-2">
          {tools.map((t) => {
            const on = selectedTools.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTool(t)}
                className={cn("chip", on && "chip-active")}
              >
                {on && <Check size={14} />}
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTool();
            }}
            placeholder="添加自定义道具…"
            className="flex-1 rounded-md border border-line bg-ink-900 px-3 py-1.5 text-xs outline-none focus:border-amber/40"
          />
          <button
            onClick={handleAddTool}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:border-amber/40 hover:text-amber-glow"
          >
            + 添加
          </button>
        </div>
      </Field>

      {/* 备注 */}
      <Field label="备注（可选）">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="此刻的状态、感受……"
          className="w-full resize-none rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm text-cream outline-none transition-colors placeholder:text-muted/60 focus:border-amber/50"
        />
      </Field>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSubmit}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber px-5 py-3 font-medium text-ink-950 shadow-glow transition-all hover:bg-amber-glow"
        >
          <Plus size={18} strokeWidth={2.2} />
          {editing ? "保存修改" : "记录下来"}
        </button>
        {editing && (
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-mist transition-colors hover:bg-ink-800"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="label-eyebrow mb-2 block">{label}</label>
      {children}
    </div>
  );
}
