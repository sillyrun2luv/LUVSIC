import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  ready: boolean; // 初始化完成
  session: Session | null;
  user: User | null;
  loading: boolean; // 登录/注册中
  error: string | null;

  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  session: null,
  user: null,
  loading: false,
  error: null,

  signUp: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }
      // 需要邮箱确认
      if (data.user && !data.session) {
        set({
          loading: false,
          error: "注册成功，请去邮箱点击确认链接后再登录",
        });
        return false;
      }
      set({ session: data.session, user: data.user, loading: false });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "注册失败", loading: false });
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }
      set({ session: data.session, user: data.user, loading: false });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "登录失败", loading: false });
      return false;
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, error: null });
  },

  clearError: () => set({ error: null }),
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
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, user: session?.user ?? null });
  });
}
