import { create } from "zustand";
import type { Session, User, RealtimeChannel } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/sync";
import { useProfileStore } from "@/store/useProfileStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";

/**
 * 邮件验证回跳地址：
 * - 原生（Android）：用 app scheme 深链拉回 App（com.selfdefense.app://auth/callback）
 * - Web/PWA：不传，让 Supabase 用后台配置的 Site URL（即本站），由现有 hash 流程处理
 *   若这里硬编码 app scheme，桌面浏览器点邮件链接会被重定向到无法识别的 scheme 而失效。
 */
function getAuthRedirectTo(): string | undefined {
  return Capacitor.isNativePlatform()
    ? "com.selfdefense.app://auth/callback"
    : "https://sillyrun2luv.github.io/LUVSIC/";
}

interface AuthState {
  ready: boolean; // 初始化完成
  session: Session | null;
  user: User | null;
  loading: boolean; // 登录/注册中
  error: string | null;
  /** 注册成功但邮箱未确认时的"待验证邮箱"地址（展示用） */
  pendingEmailVerification: string | null;

  signUp: (email: string, password: string, inviteCode?: string) => Promise<boolean>;
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

  signUp: async (email, password, inviteCode?: string) => {
    set({ loading: true, error: null, pendingEmailVerification: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: getAuthRedirectTo()
          ? { emailRedirectTo: getAuthRedirectTo() }
          : {},
      });
      if (error) {
        set({ error: error.message || "注册失败", loading: false });
        return false;
      }
      // 注册成功，进入待验证态（等待用户点邮件链接完成验证）
      set({ loading: false, pendingEmailVerification: email });
      return true;
    } catch (e: any) {
      const msg = e?.message || "注册失败";
      set({ error: msg, loading: false });
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
        options: getAuthRedirectTo()
          ? { emailRedirectTo: getAuthRedirectTo() }
          : {},
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
 * 处理原生深链回跳（Android app scheme）：
 *   com.selfdefense.app://auth/callback#access_token=...&refresh_token=...&type=signup
 * 或（PKCE 流程）带 ?code=... 的回跳。
 * 由 MainActivity 通过 WebView 注入 window.__ZIWEIBA_DEEPLINK__ / 'ziwe...' 事件触发。
 */
let deepLinkHandled = false;
function handleDeepLink(url: string) {
  if (deepLinkHandled || !url) return;
  deepLinkHandled = true;

  let code: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let type: string | null = null;
  try {
    const u = new URL(url);
    code = u.searchParams.get("code");
    const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
    accessToken = hash.get("access_token");
    refreshToken = hash.get("refresh_token");
    type = hash.get("type") || u.searchParams.get("type");
  } catch {
    return;
  }
  if (!code && (!accessToken || !refreshToken)) return;

  useUIStore.getState().setAuthCallback({
    stage: "processing",
    message: "正在验证邮箱，请稍候…",
  });

  const finish = (session: Session | null, errMsg?: string) => {
    if (!session) {
      useUIStore.getState().setAuthCallback({
        stage: "error",
        message: errMsg || "验证失败，链接可能已过期，请重新发送验证邮件",
      });
      return;
    }
    // session 已由 setSession/exchangeCodeForSession 触发 onAuthStateChange 写入 store
    useUIStore.getState().setAuthCallback({
      stage: type === "recovery" ? "recovery" : "verified",
      message: session.user?.email
        ? `${session.user.email} 邮箱已验证成功，现在可以登录啦`
        : "邮箱已验证成功，现在可以登录啦",
    });
  };

  if (code) {
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ data, error }) => {
        if (error || !data.session) finish(null, error?.message);
        else finish(data.session);
      })
      .catch((e: any) => finish(null, e?.message));
  } else {
    supabase.auth
      .setSession({ access_token: accessToken!, refresh_token: refreshToken! })
      .then(({ data, error }) => {
        if (error || !data.session) finish(null, error?.message);
        else finish(data.session);
      })
      .catch((e: any) => finish(null, e?.message));
  }
}

/**
 * 初始化认证监听：监听 session 变化，更新 store。
 * 在 App.tsx 中调用一次。
 */
export function initAuth() {
  // 1) 检查 URL hash 是否来自邮件验证/重置密码/魔法登录
  //    典型形式：#access_token=xxx&expires_in=3600&refresh_token=yyy&token_type=bearer&type=signup|recovery|invite|magiclink
  let rawHash = window.location.hash?.slice(1) ?? "";

  // 1.5) 双保险：如果 URL 上没带 access_token，但 sessionStorage
  //     有 index.html 防御脚本暂存的 hash，就恢复它（防止 404 fallback
  //     重定向/手机邮件客户端吞掉 hash 的情况）。
  if (
    !/[#&?]access_token=/.test(window.location.href) &&
    !/access_token=/.test(rawHash)
  ) {
    try {
      const backup = window.sessionStorage.getItem("luvsic.authHash");
      const backupAt = parseInt(
        window.sessionStorage.getItem("luvsic.authHashAt") || "0",
        10,
      );
      const FIVE_MIN = 5 * 60 * 1000;
      if (backup && backupAt && Date.now() - backupAt < FIVE_MIN) {
        // 把 hash 写回 URL（replaceState 不触发页面刷新，不丢失已下载资源）
        const normalized = backup.startsWith("#") ? backup : "#" + backup;
        const restored =
          window.location.pathname + window.location.search + normalized;
        window.history.replaceState(null, "", restored);
        rawHash = normalized.slice(1);
        // 消费完即清，避免下一次刷新重复进入"验证中"遮罩
        window.sessionStorage.removeItem("luvsic.authHash");
        window.sessionStorage.removeItem("luvsic.authHashAt");
      }
    } catch {
      // ignore storage errors
    }
  }

  const hasAuthTokens =
    /[#&?]access_token=/.test(window.location.href) ||
    /^access_token=/.test(rawHash) ||
    rawHash.includes("access_token=");

  if (hasAuthTokens) {
    // 先把 UI 切到"处理中"，覆盖住 404 / 空白页的观感
    useUIStore.getState().setAuthCallback({
      stage: "processing",
      message: "正在验证邮箱，请稍候…",
    });

    // 用户点邮件里的 ConfirmationURL 跳回时，hash 里携带了 access_token
    // Supabase JS SDK 的 getSession() / onAuthStateChange() 默认会解析 URL hash 中的 token
    // 所以我们直接等待 SDK 内部处理后拿到结果即可。
  }

  supabase.auth.getSession().then(({ data, error: getSessionError }) => {
    const s = data.session;
    useAuthStore.setState({
      session: s,
      user: s?.user ?? null,
      ready: true,
    });
    // 已有 session（如刷新页面恢复登录态），也确保 profile
    if (s?.user?.id) {
      ensureProfile(s.user.id).catch((e) => console.warn("[ensureProfile]", e));
      subscribeProfile(s.user.id);
    }

    if (hasAuthTokens) {
      // 从邮件链接进来的回调：按 type 判定是 signup 验证还是 重置密码 recovery
      const params = new URLSearchParams(rawHash);
      const type = params.get("type");
      if (getSessionError || !s) {
        useUIStore.getState().setAuthCallback({
          stage: "error",
          message: getSessionError?.message || "验证失败，链接可能已过期，请重新发送验证邮件",
        });
      } else if (type === "recovery") {
        useUIStore.getState().setAuthCallback({
          stage: "recovery",
          message: "密码重置链接已生效，请在设置中修改密码",
        });
      } else {
        // signup / invite / magiclink 成功
        useUIStore.getState().setAuthCallback({
          stage: "verified",
          message: s.user?.email
            ? `${s.user.email} 邮箱已验证成功，现在可以登录啦`
            : "邮箱已验证成功，现在可以登录啦",
        });
      }
      // 清掉 URL hash + 备份，避免刷新页面再次触发
      try {
        const clean = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", clean);
        window.sessionStorage.removeItem("luvsic.authHash");
        window.sessionStorage.removeItem("luvsic.authHashAt");
      } catch {
        // ignore
      }
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

  // 原生深链（Android app scheme）回跳：MainActivity 把 URL 注入到 WebView，
  // 这里读取注入的全局 / 监听自定义事件，交 handleDeepLink 建立会话。
  try {
    const queued = (window as any).__ZIWEIBA_DEEPLINK__;
    if (queued) handleDeepLink(queued as string);
    window.addEventListener("ziweiba-deeplink", (e: any) =>
      handleDeepLink(e.detail as string),
    );
  } catch {
    // 忽略：非浏览器/WebView 环境
  }
}
