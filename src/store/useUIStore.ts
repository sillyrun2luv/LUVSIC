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
  timer: { running: false, startTime: null, forms: [], tools: [] },

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
