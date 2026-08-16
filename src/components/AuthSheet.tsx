import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Lock,
  Cloud,
  LogOut,
  CheckCircle2,
  ArrowLeft,
  Inbox,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

type Mode = "login" | "signup";

export default function AuthSheet() {
  const open = useUIStore((s) => s.authOpen);
  const close = useUIStore((s) => s.closeAuth);

  const {
    user,
    session,
    loading,
    error,
    pendingEmailVerification,
    signUp,
    signIn,
    signOut,
    clearError,
    resendConfirm,
    clearPendingEmail,
  } = useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // 60 秒倒计时
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      clearError();
      setResendCountdown(0);
    }
  }, [open, clearError]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 待验证态：ESC 不允许关闭（强制邮箱确认流程）
      if (e.key === "Escape" && !pendingEmailVerification) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, pendingEmailVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast(t("auth.fillRequired"), "warn");
      return;
    }
    const ok = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    const currentUser = useAuthStore.getState().user;
    const pending = useAuthStore.getState().pendingEmailVerification;
    if (pending) {
      // 进入待验证态，不关闭
      return;
    }
    if (ok && currentUser) {
      toast(mode === "login" ? t("auth.loginSuccess") : t("auth.registerSuccess"), "success");
      close();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast(t("auth.logoutSuccess"), "success");
    close();
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    await resendConfirm();
    if (!useAuthStore.getState().error) {
      setResendCountdown(60);
      toast(t("settings.auth.resendSuccess", "已重新发送，请注意查收"), "success");
    } else {
      // rate limit 错误也启动倒计时（Supabase 默认 60 秒冷却）
      const err = useAuthStore.getState().error || "";
      if (/rate.?limit|too.?many|频繁/i.test(err)) {
        setResendCountdown(60);
      }
    }
  };

  if (!open) return null;

  // ========================================================
  //  A. 邮箱待验证态：专用 UI，关闭按钮被禁用
  // ========================================================
  if (pendingEmailVerification) {
    return createPortal(
      <div className="fixed inset-0 z-[110] pb-[72px] flex items-end justify-center">
        {/* 点击遮罩也不关闭 */}
        <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm" />

        <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-medium text-amber-glow ring-1 ring-amber/30">
              <ShieldCheck size={12} />
              {t("settings.auth.securityVerify")}
            </span>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
              <Inbox size={26} />
            </div>
            <p className="font-display text-xl text-cream">{t("settings.auth.pleaseConfirmEmail")}</p>
            <p className="mt-1 break-all text-sm text-muted">
              {t("settings.auth.verifyLinkSent", pendingEmailVerification)}
            </p>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-relaxed text-muted">
            <p className="text-sky-200">{t("settings.auth.nextStep", "下一步：")}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted/90">
              <li>{t("settings.auth.step1", "登录刚才填写的邮箱（如未收到，先看垃圾邮件）")}</li>
              <li>{t("settings.auth.step2", "打开主题为「Confirm your signup」的邮件")}</li>
              <li>{t("settings.auth.step3", "点击邮件中「Confirm your email」按钮")}</li>
              <li>{t("settings.auth.step4", "点下方「我已验证，重新登录」回到这里")}</li>
            </ol>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 space-y-2.5">
            <button
              onClick={() => {
                clearPendingEmail();
                setMode("login");
                setEmail(pendingEmailVerification);
                setPassword("");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-4 py-3 font-medium text-ink-950 shadow-glow transition-colors hover:bg-amber-glow disabled:opacity-60"
            >
              <CheckCircle2 size={17} />
              {t("settings.auth.verifiedRelogin")}
            </button>

            <button
              onClick={handleResend}
              disabled={loading || resendCountdown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm text-mist transition-colors hover:bg-ink-800 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : resendCountdown > 0 ? (
                <Clock size={15} className="text-muted" />
              ) : (
                <RefreshCw size={15} />
              )}
              {resendCountdown > 0
                ? t("settings.auth.resendCooldown", resendCountdown)
                : t("settings.auth.resendEmail")}
            </button>

            <button
              onClick={() => {
                clearPendingEmail();
                setMode("signup");
                setEmail("");
                setPassword("");
              }}
              className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs text-muted transition-colors hover:text-mist"
            >
              <ArrowLeft size={13} />
              {t("settings.auth.changeEmail")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ========================================================
  //  B. 正常登录/注册表单
  // ========================================================
  return createPortal(
    <div className="fixed inset-0 z-[110] pb-[72px] flex items-end justify-center">
      <div className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md">
        <button
          onClick={close}
          className="absolute right-4 top-4 text-muted hover:text-mist"
          aria-label={t("auth.close")}
        >
          <X size={18} />
        </button>

        {/* 已登录状态 */}
        {session && user ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 size={22} />
              </div>
              <p className="font-display text-lg text-cream">{t("settings.auth.loggedIn")}</p>
              <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
            </div>

            <div className="rounded-xl border border-line bg-ink-900/60 p-4 text-xs leading-relaxed text-muted">
              <p>· {t("settings.auth.syncHint")}</p>
              <p>· {t("settings.auth.passwordLockLocalOnly")}</p>
              <p>· {t("settings.auth.multiDeviceSync")}</p>
            </div>

            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-red-500/40 px-4 py-2.5 text-sm text-red-200 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={15} />
              {t("settings.auth.logout")}
            </button>
          </div>
        ) : (
          /* 未登录：登录/注册表单 */
          <div className="space-y-5">
            <div className="text-center">
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                <Cloud size={22} />
              </div>
              <p className="font-display text-lg text-cream">
                {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">{t("auth.syncDesc")}</p>
            </div>

            {/* Tab 切换 */}
            <div className="flex gap-2 rounded-full border border-line p-1">
              {(["login", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); clearError(); }}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-sm transition-colors",
                    mode === m ? "bg-amber/15 text-amber-glow" : "text-muted hover:text-mist",
                  )}
                >
                  {m === "login" ? t("auth.login") : t("auth.register")}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.email")}
                  autoComplete="email"
                  className="w-full rounded-lg border border-line bg-ink-800 py-2.5 pl-9 pr-3 text-sm text-cream outline-none focus:border-amber/50"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/70" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password")}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-line bg-ink-800 py-2.5 pl-9 pr-3 text-sm text-cream outline-none focus:border-amber/50"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 transition-colors hover:bg-amber-glow disabled:opacity-60"
              >
                {loading ? t("common.processing") : mode === "login" ? t("auth.login") : t("auth.register")}
              </button>
            </form>

            <p className="text-center text-[11px] leading-relaxed text-muted/70">
              {mode === "signup"
                ? t("auth.signupNote", "注册后必须到邮箱点击确认链接，否则无法登录")
                : t("auth.loginNote", "登录后数据会自动同步，密码锁不会上传")}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
