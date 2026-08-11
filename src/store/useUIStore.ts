import { create } from "zustand";
import type { ViewKey } from "@/types";

interface TimerState {
  running: boolean;
  startTime: number | null;
  forms: string[];
  tools: string[];
}

interface UIState {
  view: ViewKey;
  editingId: string | null;
  timer: TimerState;

  // 弹窗控制
  showTimerStart: boolean;
  showTimerStop: boolean;
  timerDuration: number; // 停止时的浮点分钟

  // 侧边栏
  sidebarOpen: boolean;

  // 设置弹窗
  settingsOpen: boolean;

  // 认证弹窗
  authOpen: boolean;

  // 记录详情弹窗（全局）
  detailRecordId: string | null;

  // 密码锁：本次会话是否已验证通过
  lockVerified: boolean;

  setView: (v: ViewKey) => void;
  goRecord: (editingId?: string | null) => void;

  openSidebar: () => void;
  closeSidebar: () => void;

  openSettings: () => void;
  closeSettings: () => void;

  openAuth: () => void;
  closeAuth: () => void;

  openDetail: (id: string) => void;
  closeDetail: () => void;

  setLockVerified: (v: boolean) => void;

  openTimerStart: () => void;
  closeTimerStart: () => void;

  startTimerWithSelection: (forms: string[], tools: string[]) => void;
  openTimerStop: (duration: number) => void;
  closeTimerStop: () => void;
  cancelTimer: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: "overview",
  editingId: null,
  timer: { running: false, startTime: null, forms: [], tools: [] },

  showTimerStart: false,
  showTimerStop: false,
  timerDuration: 0,

  sidebarOpen: false,
  settingsOpen: false,
  authOpen: false,
  detailRecordId: null,
  lockVerified: false,

  setView: (v) => set({ view: v, editingId: null }),
  goRecord: (editingId = null) => set({ view: "record", editingId }),

  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),

  openSettings: () => set({ settingsOpen: true, sidebarOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),

  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),

  openDetail: (id) => set({ detailRecordId: id }),
  closeDetail: () => set({ detailRecordId: null }),

  setLockVerified: (v) => set({ lockVerified: v }),

  openTimerStart: () => set({ showTimerStart: true }),
  closeTimerStart: () => set({ showTimerStart: false }),

  startTimerWithSelection: (forms, tools) =>
    set({
      showTimerStart: false,
      timer: { running: true, startTime: Date.now(), forms, tools },
    }),

  openTimerStop: (duration) =>
    set({ showTimerStop: true, timerDuration: duration }),

  closeTimerStop: () =>
    set({
      showTimerStop: false,
      timer: { running: false, startTime: null, forms: [], tools: [] },
    }),

  cancelTimer: () =>
    set({
      showTimerStart: false,
      showTimerStop: false,
      timer: { running: false, startTime: null, forms: [], tools: [] },
    }),
}));
