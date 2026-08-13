import { create } from "zustand";
import type { PublicUser } from "@/types";
import { toast } from "@/store/useToastStore";
import {
  searchUsers as apiSearch,
  getFriendList as apiFriends,
  getIncomingRequests as apiIncoming,
  getOutgoingRequests as apiOutgoing,
  getPendingCount as apiPendingCount,
  sendFriendRequest as apiSend,
  acceptFriendRequest as apiAccept,
  rejectFriendRequest as apiReject,
  cancelFriendRequest as apiCancel,
  removeFriend as apiRemove,
  type PendingRequest,
} from "@/lib/friends";

function msgOf(e: unknown, fallback: string): string {
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

interface FriendState {
  loading: boolean;
  initialLoaded: boolean;

  friends: PublicUser[];
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
  pendingCount: number;

  searchKeyword: string;
  searching: boolean;
  searchResults: PublicUser[];

  /** 拉取好友 + 待审核 + 数量（页面进入时调用） */
  refreshAll: () => Promise<void>;

  /** 只刷新待审核数量（红点，轻量） */
  refreshPendingCount: () => Promise<void>;

  /** 搜索（本地缓存 keyword，组件里自行防抖调用这个） */
  searchUsers: (keyword: string) => Promise<void>;

  /** 清空搜索结果和关键词 */
  clearSearch: () => void;

  /** 发送申请 + 自动刷新 */
  sendRequest: (toUserId: string) => Promise<boolean>;

  /** 接受 */
  accept: (friendshipId: string) => Promise<void>;

  /** 拒绝 */
  reject: (friendshipId: string) => Promise<void>;

  /** 撤销发出的申请 */
  cancel: (friendshipId: string) => Promise<void>;

  /** 删除好友（带二次确认应由组件层处理） */
  removeFriend: (friendUserId: string, friendName: string) => Promise<void>;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  loading: false,
  initialLoaded: false,
  friends: [],
  incoming: [],
  outgoing: [],
  pendingCount: 0,
  searchKeyword: "",
  searching: false,
  searchResults: [],

  refreshAll: async () => {
    set({ loading: true });
    try {
      const [friends, inc, out, count] = await Promise.all([
        apiFriends(),
        apiIncoming(),
        apiOutgoing(),
        apiPendingCount(),
      ]);
      set({ friends, incoming: inc, outgoing: out, pendingCount: count, initialLoaded: true });
    } catch (e: unknown) {
      // 未配置 Supabase 或未登录不报错，静默空列表
      const msg = msgOf(e, "刷新失败");
      if (!msg.includes("未配置") && !msg.includes("未登录")) {
        toast(msg, "warn");
      }
      set({ friends: [], incoming: [], outgoing: [], pendingCount: 0, initialLoaded: true });
    } finally {
      set({ loading: false });
    }
  },

  refreshPendingCount: async () => {
    try {
      const n = await apiPendingCount();
      set({ pendingCount: n });
    } catch {
      /* 忽略 */
    }
  },

  searchUsers: async (keyword) => {
    const kw = keyword.trim();
    set({ searchKeyword: keyword, searching: true });
    if (kw.length < 2) {
      set({ searchResults: [], searching: false });
      return;
    }
    try {
      const results = await apiSearch(kw);
      // 只有关键词还是这个（用户没继续输入）才写入结果，避免旧响应覆盖新的
      if (get().searchKeyword.trim() === kw) {
        set({ searchResults: results });
      }
    } catch (e: unknown) {
      toast(msgOf(e, "搜索失败"), "warn");
      set({ searchResults: [] });
    } finally {
      set({ searching: false });
    }
  },

  clearSearch: () => set({ searchKeyword: "", searchResults: [] }),

  sendRequest: async (toUserId) => {
    try {
      await apiSend(toUserId);
      toast("已发送好友申请", "success");
      // 发送完：如果对方正好也给我发了，相当于 accept，需要刷新两个列表
      const [inc, out, friends] = await Promise.all([
        apiIncoming(),
        apiOutgoing(),
        apiFriends(),
      ]);
      set({ incoming: inc, outgoing: out, friends });
      await get().refreshPendingCount();

      // 同步搜索结果里的 relation
      set((s) => ({
        searchResults: s.searchResults.map((u) =>
          u.userId === toUserId ? { ...u, relation: "pending_from_me" } : u,
        ),
      }));
      return true;
    } catch (e: unknown) {
      toast(msgOf(e, "发送失败"), "warn");
      return false;
    }
  },

  accept: async (id) => {
    try {
      await apiAccept(id);
      toast("已成为好友 🎉", "success");
      // 刷新列表
      const [inc, out, friends] = await Promise.all([
        apiIncoming(),
        apiOutgoing(),
        apiFriends(),
      ]);
      set({ incoming: inc, outgoing: out, friends });
      await get().refreshPendingCount();
    } catch (e: unknown) {
      toast(msgOf(e, "操作失败"), "warn");
    }
  },

  reject: async (id) => {
    try {
      await apiReject(id);
      toast("已拒绝", "success");
      const inc = await apiIncoming();
      set({ incoming: inc });
      await get().refreshPendingCount();
    } catch (e: unknown) {
      toast(msgOf(e, "操作失败"), "warn");
    }
  },

  cancel: async (id) => {
    try {
      await apiCancel(id);
      toast("已撤销申请", "success");
      const out = await apiOutgoing();
      set({ outgoing: out });
    } catch (e: unknown) {
      toast(msgOf(e, "操作失败"), "warn");
    }
  },

  removeFriend: async (friendUserId, friendName) => {
    try {
      await apiRemove(friendUserId);
      toast(`已和「${friendName}」解除好友`, "success");
      const friends = await apiFriends();
      set({ friends });
      // 同时刷新搜索结果（该用户 relation 从 friend 变 stranger）
      set((s) => ({
        searchResults: s.searchResults.map((u) =>
          u.userId === friendUserId ? { ...u, relation: "stranger" } : u,
        ),
      }));
    } catch (e: unknown) {
      toast(msgOf(e, "删除失败"), "warn");
    }
  },
}));
