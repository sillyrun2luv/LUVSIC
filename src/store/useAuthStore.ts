import { create } from "zustand";
import type { Session, User, RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/sync";
import { useProfileStore } from "@/store/useProfileStore";
import { useRecordStore } from "@/store/useRecordStore";

interface AuthState {
  ready: boolean; // 初始化完成
  session: Session | null;
  user: User | null;
  loading: boolean; // 登录/注册中
  error: string | null;
  /** 注册成功但邮箱未确认时的"待验证邮箱"地址（展示用） */
  pendingEmailVerification: string | null;

  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  resendConfirm: () => Promise<void>;
  /** 清掉待验证邮箱标记（切 tab、手动登出等触发） */
  clearPendingEmail: () => void;
  /** 删除自己账户：清云端 + 本地所有数据（不可逆） */
  deleteAccount: () => Promise<boolean>;
}

/**
 * user_profile 实时订阅 channel。
 * 多端登录时，一端改昵称/头像/隐私 → 另一端实时同步。
 */
let profileChannel: RealtimeChannel | null = null;

function subscribeProfile(userId: string) {
  unsubscribeProfile();
  profileChannel = supabase
    .channel(`user_profile:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_profile",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const n = payload.new as {
          name?: string;
          avatar?: string;
          searchable?: boolean;
          show_aggregates_to_friends?: boolean;
        };
        // hydrateFromCloud 只 set，不反向 push，避免回环
        useProfileStore.getState().hydrateFromCloud({
          name: n.name,
          avatar: n.avatar,
          searchable: n.searchable,
          showAggregatesToFriends: n.show_aggregates_to_friends,
        });
      },
    )
    .subscribe();
}

function unsubscribeProfile() {
  if (profileChannel) {
    supabase.removeChannel(profileChannel);
    profileChannel = null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  user: null,
  loading: false,
  error: null,
  pendingEmailVerification: null,

  signUp: async (email, password) => {
    set({ loading: true, error: null, pendingEmailVerification: null });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }
      const u = data.user;
      // 情况 1：没 session（Supabase 已开 Confirm email）→ 直接走待验证
      // 情况 2：有 session 但 email_confirmed_at 还是 null（Supabase 没开 Confirm email 也没关系）
      //   → 我们**强制要求邮箱验证**：立即 signOut，然后走待验证态（相当于前端兜底）
      if (u && (!data.session || !u.email_confirmed_at)) {
        // 如果已经发了 session 但邮箱未验证，先强制登出，防止任何自动登录流程
        if (data.session && !u.email_confirmed_at) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // 静默忽略
          }
        }
        set({
          loading: false,
          error: null,
          session: null,
          user: null,
          pendingEmailVerification: email,
        });
        return false;
      }
      // 邮箱已确认（极端情况：用户已经通过别的流程确认过邮箱）
      set({
        session: data.session,
        user: data.user,
        loading: false,
        pendingEmailVerification: null,
      });
      return true;
    } catch (e: any) {
      const msg = e?.message || "注册失败";
      if (/rate.?limit|too.?many/i.test(msg)) {
        set({ error: "注册请求太频繁，请等一分钟后再试", loading: false });
      } else {
        set({ error: msg, loading: false });
      }
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // 邮箱未确认（常见：Signup 后 Email 未点）
        const msg = error.message || "";
        const needsConfirm =
          /Email not confirmed/i.test(msg) ||
          /unconfirmed/i.test(msg) ||
          /email.*confirm/i.test(msg);
        if (needsConfirm) {
          set({
            loading: false,
            pendingEmailVerification: email,
            error: null,
          });
          return false;
        }
        set({ error: msg, loading: false });
        return false;
      }
      set({
        session: data.session,
        user: data.user,
        loading: false,
        pendingEmailVerification: null,
      });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "登录失败", loading: false });
      return false;
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    unsubscribeProfile();
    set({ session: null, user: null, error: null, pendingEmailVerification: null });
  },

  clearError: () => set({ error: null }),

  clearPendingEmail: () => set({ pendingEmailVerification: null }),

  resendConfirm: async () => {
    set({ loading: true, error: null });
    try {
      const em = get().pendingEmailVerification;
      if (!em) throw new Error("没有待验证的邮箱");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: em,
      });
      if (error) throw error;
      set({ loading: false });
    } catch (e: any) {
      const msg = e?.message || "重发失败";
      // 友好提示 rate limit
      if (/rate.?limit|too.?many/i.test(msg)) {
        set({ loading: false, error: "发送太频繁，请等一分钟后再试" });
      } else {
        set({ loading: false, error: msg });
      }
    }
  },

  deleteAccount: async () => {
    const u = get().user;
    if (!u) {
      set({ error: "未登录" });
      return false;
    }
    set({ loading: true, error: null });
    try {
      // 1. 服务端：删云端 records / settings / profile / friendships / auth.users（SECURITY DEFINER）
      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) throw rpcError;

      // 2. 客户端：清本地 Supabase session（因为 auth.users 已不存在，RPC 做完就直接清）
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // 静默
      }
      unsubscribeProfile();

      // 3. 清本地 store：记录 / 资料 / 会话
      useRecordStore.getState().resetAll();
      useProfileStore.getState().resetAll();
      set({
        session: null,
        user: null,
        error: null,
        pendingEmailVerification: null,
        loading: false,
      });
      return true;
    } catch (e: any) {
      set({ loading: false, error: e?.message || "删除账户失败" });
      return false;
    }
  },
}));

/**
 * 初始化认证监听：监听 session 变化，更新 store。
 * 在 App.tsx 中调用一次。
 */
export function initAuth() {
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({
      session: data.session,
      user: data.session?.user ?? null,
      ready: true,
    });
    // 已有 session（如刷新页面恢复登录态），也确保 profile
    if (data.session?.user?.id) {
      ensureProfile(data.session.user.id).catch((e) => console.warn("[ensureProfile]", e));
      subscribeProfile(data.session.user.id);
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, user: session?.user ?? null });
    // 登录成功后自动确保 user_profile 有记录（让用户可被搜索）
    if (session?.user?.id) {
      ensureProfile(session.user.id).catch((e) => console.warn("[ensureProfile]", e));
      subscribeProfile(session.user.id);
    } else {
      // 退出登录时取消订阅
      unsubscribeProfile();
    }
  });
}
