import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PrivacySettings } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/** 可选头像 emoji 列表（扩展到 36 个） */
export const AVATAR_OPTIONS = [
  "🌙", "✨", "🌸", "🍵", "🕯️", "🦊", "🐱", "🍃",
  "🔥", "💧", "🎭", "📖", "🎧", "🎲", "🪐", "🐚",
  "🌈", "⚡", "🍀", "🫧", "🌊", "🌸", "🍒", "🧸",
  "🌿", "🍑", "🪷", "🐯", "🦄", "🎐", "🌌", "🪄",
  "🧊", "🍯", "🌠", "🐢",
];

interface ProfileState {
  name: string;
  avatar: string;
  searchable: PrivacySettings["searchable"];
  showAggregatesToFriends: PrivacySettings["showAggregatesToFriends"];
  /**
   * 记录"对哪个 userId 已经 dismiss 过资料设置弹窗"。
   * - 新用户首次登录：此值为 null/其他 id → 会弹
   * - 用户点"稍后再说"或"保存"后：此值 = 当前 user.id → 不再自动弹
   * - 切换账号：此值 !== 新 user.id → 新账号会弹
   * 持久化在 localStorage，清缓存后会重新弹。
   */
  profileSetupDismissedFor: string | null;

  setName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setSearchable: (v: boolean) => void;
  setShowAggregatesToFriends: (v: boolean) => void;
  /** 标记某用户已 dismiss 资料设置弹窗 */
  markProfileSetupDismissed: (userId: string) => void;
  /** 把当前昵称/头像/隐私设置同步到云端（登录时自动调用，登录后改资料也调用） */
  saveToCloud: () => Promise<void>;
  /**
   * 用云端数据覆盖本地状态（只 set，不反向 push 到云端）。
   * 用于登录拉取 / 多端 realtime 同步，避免回环推送。
   */
  hydrateFromCloud: (data: {
    name?: string;
    avatar?: string;
    searchable?: boolean;
    showAggregatesToFriends?: boolean;
  }) => void;

  /** 危险：恢复默认昵称/头像/隐私设置（删除账户时使用） */
  resetAll: () => void;
}

/**
 * 同步当前 profile 到云端 user_profile。
 *  - 未登录时静默跳过
 *  - 失败时只打印日志，不阻塞 UI
 */
async function pushProfileToCloud(
  name: string,
  avatar: string,
  searchable: boolean,
  showAggregatesToFriends: boolean,
) {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const userId = session?.user?.id;
  if (!userId) return;

  const { error } = await supabase.from("user_profile").upsert(
    {
      user_id: userId,
      name,
      avatar,
      searchable,
      show_aggregates_to_friends: showAggregatesToFriends,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.warn("[pushProfileToCloud]", error.message);
  }
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      name: "我",
      avatar: "🌙",
      searchable: true,
      showAggregatesToFriends: true,
      profileSetupDismissedFor: null,

      setName: (name) => {
        const newName = name.trim() || "我";
        set({ name: newName });
        const s = get();
        pushProfileToCloud(newName, s.avatar, s.searchable, s.showAggregatesToFriends);
      },

      setAvatar: (avatar) => {
        set({ avatar });
        const s = get();
        pushProfileToCloud(s.name, avatar, s.searchable, s.showAggregatesToFriends);
      },

      setSearchable: (v) => {
        set({ searchable: v });
        const s = get();
        pushProfileToCloud(s.name, s.avatar, v, s.showAggregatesToFriends);
      },

      setShowAggregatesToFriends: (v) => {
        set({ showAggregatesToFriends: v });
        const s = get();
        pushProfileToCloud(s.name, s.avatar, s.searchable, v);
      },

      markProfileSetupDismissed: (userId) => {
        set({ profileSetupDismissedFor: userId });
      },

      saveToCloud: async () => {
        const s = get();
        await pushProfileToCloud(s.name, s.avatar, s.searchable, s.showAggregatesToFriends);
      },

      hydrateFromCloud: (data) => {
        const patch: Partial<ProfileState> = {};
        if (typeof data.name === "string" && data.name.trim()) patch.name = data.name;
        if (typeof data.avatar === "string" && data.avatar) patch.avatar = data.avatar;
        if (typeof data.searchable === "boolean") patch.searchable = data.searchable;
        if (typeof data.showAggregatesToFriends === "boolean") {
          patch.showAggregatesToFriends = data.showAggregatesToFriends;
        }
        if (Object.keys(patch).length > 0) set(patch);
      },

      resetAll: () => {
        set({
          name: "我",
          avatar: "🌙",
          searchable: true,
          showAggregatesToFriends: true,
          profileSetupDismissedFor: null,
        });
      },
    }),
    {
      name: "zwba_profile",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
