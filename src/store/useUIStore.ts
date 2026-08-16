import { create } from "zustand";
import type { ViewKey } from "@/types";

interface TimerState {
  running: boolean;
  startTime: number | null;
  forms: string[];
  tools: string[];
}

/* ---------------------------------------------------------------------------
 * 计时状态持久化：startTime 用墙钟时间，App 被杀/退出后重开，
 * 依据 startTime 与当前时间差即可继续"真实计时"。
 * ------------------------------------------------------------------------- */
const TIMER_STATE_KEY = "ziweiba_timer_state";
const TIMER_LAST_KEY = "ziweiba_timer_last"; // 上次计时用的形式/道具

function hydrateTimer(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (
        p &&
        p.running === true &&
        typeof p.startTime === "number" &&
        Array.isArray(p.forms) &&
        Array.isArray(p.tools) &&
        p.startTime <= Date.now() + 5000
      ) {
        return { running: true, startTime: p.startTime, forms: p.forms, tools: p.tools };
      }
    }
  } catch {
    /* ignore */
  }
  return { running: false, startTime: null, forms: [], tools: [] };
}

function persistTimer(timer: TimerState) {
  try {
    if (timer.running) localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_STATE_KEY);
  } catch {
    /* ignore */
  }
}

function persistLastSelection(forms: string[], tools: string[]) {
  try {
    localStorage.setItem(TIMER_LAST_KEY, JSON.stringify({ forms, tools }));
  } catch {
    /* ignore */
  }
}

/** 读取上次计时使用的形式/道具（供"一键直接开始计时"复用） */
export function getLastTimerSelection(): { forms: string[]; tools: string[] } {
  try {
    const raw = localStorage.getItem(TIMER_LAST_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        forms: Array.isArray(p.forms) ? p.forms : [],
        tools: Array.isArray(p.tools) ? p.tools : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { forms: [], tools: [] };
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

  // 资料完善弹窗（首次登录设置昵称头像）
  profileSetupOpen: boolean;

  // 好友详情弹窗（点击好友头像查看近 N 小时统计）
  friendDetailOpen: boolean;
  friendDetailUserId: string | null;
  friendDetailName: string;
  friendDetailAvatar: string;

  // PK 弹窗：点击好友头像"PK"按钮弹出
  pkOpen: boolean;
  pkUserId: string | null;
  pkName: string;
  pkAvatar: string;

  // 记录详情弹窗（全局）
  detailRecordId: string | null;

  // 密码锁：本次会话是否已验证通过
  lockVerified: boolean;

  // 邮箱验证 / 重置密码回调阶段（从邮件链接带 hash 进入时触发）
  authCallback: null | {
    stage: "processing" | "verified" | "recovery" | "error";
    message?: string;
  };

  setView: (v: ViewKey) => void;
  goRecord: (editingId?: string | null) => void;

  openSidebar: () => void;
  closeSidebar: () => void;

  openSettings: () => void;
  closeSettings: () => void;

  openAuth: () => void;
  closeAuth: () => void;

  openProfileSetup: () => void;
  closeProfileSetup: () => void;

  openFriendDetail: (userId: string, name: string, avatar: string) => void;
  closeFriendDetail: () => void;

  openPK: (userId: string, name: string, avatar: string) => void;
  closePK: () => void;

  openDetail: (id: string) => void;
  closeDetail: () => void;

  setLockVerified: (v: boolean) => void;

  setAuthCallback: (v: UIState["authCallback"]) => void;
  closeAuthCallback: () => void;

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
  timer: hydrateTimer(),

  showTimerStart: false,
  showTimerStop: false,
  timerDuration: 0,

  sidebarOpen: false,
  settingsOpen: false,
  authOpen: false,
  profileSetupOpen: false,
  friendDetailOpen: false,
  friendDetailUserId: null,
  friendDetailName: "",
  friendDetailAvatar: "🌙",
  pkOpen: false,
  pkUserId: null,
  pkName: "",
  pkAvatar: "🌙",
  detailRecordId: null,
  lockVerified: false,
  authCallback: null,

  setView: (v) => set({ view: v, editingId: null }),
  goRecord: (editingId = null) => set({ view: "record", editingId }),

  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),

  openSettings: () => set({ settingsOpen: true, sidebarOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),

  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),

  openProfileSetup: () => set({ profileSetupOpen: true }),
  closeProfileSetup: () => set({ profileSetupOpen: false }),

  openFriendDetail: (userId, name, avatar) =>
    set({
      friendDetailOpen: true,
      friendDetailUserId: userId,
      friendDetailName: name,
      friendDetailAvatar: avatar,
    }),
  closeFriendDetail: () =>
    set({
      friendDetailOpen: false,
      friendDetailUserId: null,
    }),

  openPK: (userId, name, avatar) =>
    set({
      pkOpen: true,
      pkUserId: userId,
      pkName: name,
      pkAvatar: avatar,
    }),
  closePK: () =>
    set({
      pkOpen: false,
      pkUserId: null,
    }),

  openDetail: (id) => set({ detailRecordId: id }),
  closeDetail: () => set({ detailRecordId: null }),

  setLockVerified: (v) => set({ lockVerified: v }),

  setAuthCallback: (v) => set({ authCallback: v }),
  closeAuthCallback: () => set({ authCallback: null }),

  openTimerStart: () => set({ showTimerStart: true }),
  closeTimerStart: () => set({ showTimerStart: false }),

  startTimerWithSelection: (forms, tools) => {
    const timer = { running: true, startTime: Date.now(), forms, tools };
    persistTimer(timer);
    persistLastSelection(forms, tools);
    set({ showTimerStart: false, timer });
  },

  openTimerStop: (duration) =>
    set({ showTimerStop: true, timerDuration: duration }),

  closeTimerStop: () => {
    const timer = { running: false, startTime: null, forms: [], tools: [] };
    persistTimer(timer);
    set({ showTimerStop: false, timer });
  },

  cancelTimer: () => {
    const timer = { running: false, startTime: null, forms: [], tools: [] };
    persistTimer(timer);
    set({
      showTimerStart: false,
      showTimerStop: false,
      timer,
    });
  },
}));
