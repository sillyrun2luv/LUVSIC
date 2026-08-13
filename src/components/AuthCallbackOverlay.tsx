import { createPortal } from "react-dom";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  LogIn,
} from "lucide-react";

export default function AuthCallbackOverlay() {
  const cb = useUIStore((s) => s.authCallback);
  const close = useUIStore((s) => s.closeAuthCallback);
  const openAuth = useUIStore((s) => s.openAuth);
  const setPendingEmail = useAuthStore((s) => s.clearPendingEmail);

  if (!cb) return null;

  const stageIcon = {
    processing: <Loader2 size={28} className="animate-spin" />,
    verified: <CheckCircle2 size={28} />,
    recovery: <KeyRound size={28} />,
    error: <AlertTriangle size={28} />,
  }[cb.stage];

  const stageTint = {
    processing: "text-sky-300 bg-sky-500/15",
    verified: "text-emerald-300 bg-emerald-500/15",
    recovery: "text-violet-300 bg-violet-500/15",
    error: "text-red-300 bg-red-500/15",
  }[cb.stage];

  const heading = {
    processing: "邮箱验证中",
    verified: "验证成功",
    recovery: "重置密码链接已生效",
    error: "验证失败",
  }[cb.stage];

  const handleGoLogin = () => {
    setPendingEmail();
    openAuth();
    close();
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-md" />
      <div className="relative mx-4 w-full max-w-sm rounded-3xl border border-line/80 bg-ink-900/95 p-6 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <div
            className={
              "mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full " +
              stageTint
            }
          >
            {stageIcon}
          </div>
          <h2 className="font-display text-xl text-cream">{heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {cb.message || " "}
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          {cb.stage === "verified" && (
            <button
              onClick={handleGoLogin}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-4 py-3 font-medium text-ink-950 shadow-glow transition-colors hover:bg-amber-glow"
            >
              <LogIn size={16} />
              现在就去登录
            </button>
          )}
          {cb.stage === "recovery" && (
            <button
              onClick={() => {
                openAuth();
                close();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-4 py-3 font-medium text-ink-950 shadow-glow transition-colors hover:bg-amber-glow"
            >
              <KeyRound size={16} />
              登录后到设置里改密码
            </button>
          )}
          {cb.stage === "error" && (
            <button
              onClick={() => {
                openAuth();
                close();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-4 py-3 font-medium text-ink-950 shadow-glow transition-colors hover:bg-amber-glow"
            >
              返回登录 / 重新发送
            </button>
          )}
          {cb.stage === "processing" && (
            <div className="pointer-events-none opacity-70">
              <div className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-800 px-4 py-3 font-medium text-muted">
                <Loader2 size={15} className="animate-spin" />
                处理中，请勿关闭页面…
              </div>
            </div>
          )}

          {(cb.stage === "verified" || cb.stage === "recovery" || cb.stage === "error") && (
            <button
              onClick={close}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:bg-ink-800 hover:text-mist"
            >
              先关闭，直接浏览
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
