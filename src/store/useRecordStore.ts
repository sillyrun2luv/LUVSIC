import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecordEntry, Settings, Preset } from "@/types";

const DEFAULT_FORMS = ["视频", "图片", "文字", "音频", "想象"];
const DEFAULT_TOOLS = ["手", "玩具", "其他"];

const DEFAULT_PRESETS: Preset[] = [
  { id: "p1", name: "视频 + 手", forms: ["视频"], tools: ["手"] },
  { id: "p2", name: "音频 + 玩具", forms: ["音频"], tools: ["玩具"] },
  { id: "p3", name: "小说 + 手", forms: ["文字"], tools: ["手"] },
];

const DEFAULT_SETTINGS: Settings = {
  forms: [...DEFAULT_FORMS],
  tools: [...DEFAULT_TOOLS],
  presets: DEFAULT_PRESETS,
  reminder: {
    enabled: false,
    sound: true,
    mode: "daily",
    time: "22:00",
    weekdays: [1, 2, 3, 4, 5],
    intervalHours: 24,
  },
  lock: { enabled: false },
  showFloatingTimer: true,
};

// 旧材料 → 形式 / 道具 的最佳映射
const KNOWN_FORMS = new Set(DEFAULT_FORMS);

function classifyOldMaterial(name: string): "form" | "tool" {
  if (KNOWN_FORMS.has(name)) return "form";
  // 含"玩具""手""棒""环""杯""丹""药""其他" → tool
  if (/玩具|手|其他|棒|环|杯|丹|药/.test(name)) return "tool";
  return "tool"; // 默认归道具
}

function splitMaterials(materials: string[] | undefined): { forms: string[]; tools: string[] } {
  if (!Array.isArray(materials) || materials.length === 0) {
    return { forms: [], tools: [] };
  }
  const forms: string[] = [];
  const tools: string[] = [];
  for (const m of materials) {
    const bucket = classifyOldMaterial(m);
    if (bucket === "form") forms.push(m);
    else tools.push(m);
  }
  return { forms, tools };
}

interface RecordState {
  records: RecordEntry[];
  settings: Settings;

  addRecord: (input: Omit<RecordEntry, "id" | "createdAt">) => void;
  updateRecord: (id: string, patch: Partial<Omit<RecordEntry, "id" | "createdAt">>) => void;
  deleteRecord: (id: string) => void;
  restoreRecord: (record: RecordEntry) => void;
  clearAll: () => void;

  setReminder: (patch: Partial<Settings["reminder"]>) => void;

  setLock: (patch: Partial<Settings["lock"]>) => void;

  setShowFloatingTimer: (v: boolean) => void;

  addForm: (name: string) => void;
  removeForm: (name: string) => void;
  addTool: (name: string) => void;
  removeTool: (name: string) => void;

  addPreset: (name: string, forms: string[], tools: string[]) => void;
  removePreset: (id: string) => void;

  importData: (records: RecordEntry[]) => void;
  exportData: () => RecordEntry[];

  /** 危险：彻底清空本地记录/设置/预设 + 清 zwba_deleted。删除账户时使用 */
  resetAll: () => void;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      settings: DEFAULT_SETTINGS,

      addRecord: (input) =>
        set((state) => ({
          records: [
            ...state.records,
            {
              ...input,
              id: genId(),
              createdAt: Date.now(),
              // 默认值：没传时按"补录"处理（false）。计时按钮来源会显式传 true
              isTimerEntry: input.isTimerEntry ?? false,
            },
          ],
        })),

      updateRecord: (id, patch) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        })),

      deleteRecord: (id) => {
        // 记录到删除列表，供云同步时软删除云端数据
        try {
          const deleted: string[] = JSON.parse(localStorage.getItem("zwba_deleted") || "[]");
          if (!deleted.includes(id)) deleted.push(id);
          localStorage.setItem("zwba_deleted", JSON.stringify(deleted));
        } catch {
          // localStorage 不可用时静默跳过
        }
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        }));
      },

      restoreRecord: (record) =>
        set((state) => {
          // 已存在则不重复插入
          if (state.records.some((r) => r.id === record.id)) return state;
          return { records: [...state.records, record] };
        }),

      clearAll: () => set({ records: [] }),

      setReminder: (patch) =>
        set((state) => ({
          settings: { ...state.settings, reminder: { ...state.settings.reminder, ...patch } },
        })),

      setLock: (patch) =>
        set((state) => ({
          settings: { ...state.settings, lock: { ...state.settings.lock, ...patch } },
        })),

      setShowFloatingTimer: (v) =>
        set((state) => ({
          settings: { ...state.settings, showFloatingTimer: v },
        })),

      addForm: (name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed || state.settings.forms.includes(trimmed)) return state;
          return {
            settings: { ...state.settings, forms: [...state.settings.forms, trimmed] },
          };
        }),

      removeForm: (name) =>
        set((state) => ({
          settings: { ...state.settings, forms: state.settings.forms.filter((f) => f !== name) },
        })),

      addTool: (name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed || state.settings.tools.includes(trimmed)) return state;
          return {
            settings: { ...state.settings, tools: [...state.settings.tools, trimmed] },
          };
        }),

      removeTool: (name) =>
        set((state) => ({
          settings: { ...state.settings, tools: state.settings.tools.filter((t) => t !== name) },
        })),

      addPreset: (name, forms, tools) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return state;
          const preset: Preset = { id: genId(), name: trimmed, forms, tools };
          return {
            settings: { ...state.settings, presets: [...state.settings.presets, preset] },
          };
        }),

      removePreset: (id) =>
        set((state) => ({
          settings: { ...state.settings, presets: state.settings.presets.filter((p) => p.id !== id) },
        })),

      importData: (records) =>
        set({
          records: records.map((r: any) => {
            // 兼容旧格式：只有 materials
            const forms = Array.isArray(r.forms) ? r.forms : [];
            const tools = Array.isArray(r.tools) ? r.tools : [];
            const { forms: f2, tools: t2 } = splitMaterials(r.materials);
            return {
              id: r.id || genId(),
              timestamp: r.timestamp,
              duration: Number(r.duration) || 0,
              forms: [...new Set([...forms, ...f2])],
              tools: [...new Set([...tools, ...t2])],
              note: r.note,
              createdAt: r.createdAt || Date.now(),
              // 旧数据全部按"补录"计（没有计时器来源），用户重新用按钮计时会新建 true 的记录
              isTimerEntry: Boolean(r.isTimerEntry),
            };
          }),
        }),

      exportData: () => get().records,

      resetAll: () => {
        try {
          localStorage.removeItem("zwba_deleted");
        } catch {
          // 静默
        }
        set({
          records: [],
          settings: DEFAULT_SETTINGS,
        });
      },
    }),
    {
      name: "zwba_store",
      version: 6,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ records: state.records, settings: state.settings }),
      migrate: (persisted: any) => {
        // 处理版本缺失或低版本
        const s = persisted?.settings ?? {};
        // v4：移除已废弃的 dailyGoal 字段
        const { dailyGoal: _droppedGoal, ...restSettings } = s;

        // 合并默认设置（保障新增字段齐全）
        const mergedSettings: Settings = {
          ...DEFAULT_SETTINGS,
          ...restSettings,
          forms: Array.isArray(s.forms) && s.forms.length > 0 ? s.forms : [...DEFAULT_FORMS],
          tools: Array.isArray(s.tools) && s.tools.length > 0 ? s.tools : [...DEFAULT_TOOLS],
          presets: Array.isArray(s.presets) && s.presets.length > 0 ? s.presets : DEFAULT_PRESETS,
          showFloatingTimer: typeof s.showFloatingTimer === "boolean" ? s.showFloatingTimer : true,
          lock: {
            ...DEFAULT_SETTINGS.lock,
            ...(s.lock ?? {}),
          },
          reminder: {
            ...DEFAULT_SETTINGS.reminder,
            ...(s.reminder ?? {}),
            mode: ((): Settings["reminder"]["mode"] => {
              const m = s.reminder?.mode;
              return m === "weekly" || m === "interval" ? m : "daily";
            })(),
            weekdays: Array.isArray(s.reminder?.weekdays) && s.reminder.weekdays.length > 0
              ? s.reminder.weekdays
              : [...DEFAULT_SETTINGS.reminder.weekdays],
            intervalHours:
              typeof s.reminder?.intervalHours === "number" && s.reminder.intervalHours > 0
                ? s.reminder.intervalHours
                : DEFAULT_SETTINGS.reminder.intervalHours,
          },
        };

        // 迁移 records：如果有 materials 字段但没有 forms/tools，则拆分
        const records = Array.isArray(persisted?.records) ? persisted.records : [];
        const migratedRecords = records.map((r: any) => {
          let rec: any = r;
          if (!(rec.forms || rec.tools)) {
            const { forms, tools } = splitMaterials(rec.materials);
            rec = { ...rec, forms, tools };
          }
          // v5：新增 isTimerEntry 字段，旧数据默认 false（补录）
          if (typeof rec.isTimerEntry !== "boolean") {
            rec = { ...rec, isTimerEntry: false };
          }
          return rec;
        });

        return {
          ...persisted,
          records: migratedRecords,
          settings: mergedSettings,
        };
      },
    },
  ),
);
