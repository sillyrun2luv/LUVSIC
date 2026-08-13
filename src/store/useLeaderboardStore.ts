import { create } from "zustand";
import {
  fetchFriendsLeaderboard,
  fetchGlobalLeaderboard,
  type LeaderboardEntry,
  type LeaderboardScope,
} from "@/lib/leaderboard";
import { useAuthStore } from "@/store/useAuthStore";

interface LeaderboardState {
  scope: LeaderboardScope;
  friendsList: LeaderboardEntry[];
  globalList: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  /** 标记首次加载完成（避免首次进来显示"无数据"） */
  initialLoadedFriends: boolean;
  initialLoadedGlobal: boolean;
  /** 上次拉取时间戳（用于缓存控制，5 分钟内不重复拉） */
  lastFetchFriends: number;
  lastFetchGlobal: number;

  setScope: (s: LeaderboardScope) => void;
  refresh: () => Promise<void>;
  /** 强制刷新（下拉刷新用） */
  forceRefresh: () => Promise<void>;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  scope: "friends",
  friendsList: [],
  globalList: [],
  loading: false,
  error: null,
  initialLoadedFriends: false,
  initialLoadedGlobal: false,
  lastFetchFriends: 0,
  lastFetchGlobal: 0,

  setScope: (s) => {
    set({ scope: s });
    // 切换 scope 时如果没拉过，自动拉一次
    const st = get();
    if (!st.loading) {
      const need =
        (s === "friends" && !st.initialLoadedFriends) ||
        (s === "global" && !st.initialLoadedGlobal);
      if (need) void st.refresh();
    }
  },

  refresh: async () => {
    const st = get();
    const isLoggedIn = !!useAuthStore.getState().user?.id;
    if (!isLoggedIn) return;

    const now = Date.now();
    const scope = st.scope;

    // 缓存检查
    if (scope === "friends" && now - st.lastFetchFriends < CACHE_TTL && st.initialLoadedFriends) return;
    if (scope === "global" && now - st.lastFetchGlobal < CACHE_TTL && st.initialLoadedGlobal) return;

    set({ loading: true, error: null });
    try {
      if (scope === "friends") {
        const list = await fetchFriendsLeaderboard();
        set({
          friendsList: list,
          loading: false,
          initialLoadedFriends: true,
          lastFetchFriends: Date.now(),
        });
      } else {
        const list = await fetchGlobalLeaderboard(100);
        set({
          globalList: list,
          loading: false,
          initialLoadedGlobal: true,
          lastFetchGlobal: Date.now(),
        });
      }
    } catch (e: any) {
      set({ loading: false, error: e?.message || "加载失败" });
    }
  },

  forceRefresh: async () => {
    // 重置缓存时间戳，强制下一次 refresh 真正拉取
    const scope = get().scope;
    if (scope === "friends") {
      set({ lastFetchFriends: 0 });
    } else {
      set({ lastFetchGlobal: 0 });
    }
    await get().refresh();
  },
}));
