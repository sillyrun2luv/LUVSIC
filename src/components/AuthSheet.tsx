import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, Cloud, LogOut, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export default function AuthSheet() {
  const open = useUIStore((s) => s.authOpen);
  const close = useUIStore((s) => s.closeAuth);

  const { user, session, loading, error, signUp, signIn, signOut, clearError } = useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      clearError();
    }
  }, [open, clearError]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast("请填写邮箱和密码", "warn");
      return;
    }
    const ok = mode === "login" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    // 从 store 取最新 user（setState 后立即可读）
    const currentUser = useAuthStore.getState().user;
    if (ok && currentUser) {
      toast(mode === "login" ? "登录成功" : "注册成功", "success");
      close();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast("已退出登录", "success");
    close();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <div className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md">
        <button
          onClick={close}
          className="absolute right-4 top-4 text-muted hover:text-mist"
          aria-label="关闭"
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
              <p className="font-display text-lg text-cream">已登录云端</p>
              <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
            </div>

            <div className="rounded-xl border border-line bg-ink-900/60 p-4 text-xs leading-relaxed text-muted">
              <p>· 在「设置 → 云端 · 同步」中上传或下载数据</p>
              <p>· 密码锁仅保存在本机，不会上传</p>
              <p>· 多设备登录可实现数据互通</p>
            </div>

            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-red-500/40 px-4 py-2.5 text-sm text-red-200 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={15} />
              退出登录
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
                {mode === "login" ? "登录云端账户" : "注册云端账户"}
              </p>
              <p className="mt-1 text-xs text-muted">同步记录与设置，多设备互通</p>
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
                  {m === "login" ? "登录" : "注册"}
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
                  placeholder="邮箱"
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
                  placeholder="密码（至少 6 位）"
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
                {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
              </button>
            </form>

            <p className="text-center text-[11px] leading-relaxed text-muted/70">
              {mode === "signup"
                ? "注册后需到邮箱点击确认链接才能登录"
                : "登录后数据会自动同步，密码锁不会上传"}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
