import { useEffect, useState } from "react";
import {
  X,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  UserX,
  CloudOff,
  History,
  Settings,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { useRecordStore } from "@/store/useRecordStore";
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage = "warn" | "typeEmail" | "confirm";

export default function DeleteAccountSheet({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const authLoading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.error);
  const clearAuthError = useAuthStore((s) => s.clearError);

  const records = useRecordStore((s) => s.records);

  const [stage, setStage] = useState<Stage>("warn");
  const [emailInput, setEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // 关闭 / 打开时重置流程
  useEffect(() => {
    if (!open) {
      setStage("warn");
      setEmailInput("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 只有 warn 阶段允许 ESC 关闭；typeEmail / confirm 阶段不让误点取消
      if (e.key === "Escape" && stage === "warn") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, onClose]);

  if (!open) return null;

  const expectedEmail = user?.email ?? "";
  const emailMatches = emailInput.trim() === expectedEmail;

  const doDelete = async () => {
    if (!emailMatches) return;
    if (deleting) return;
    if (authError) clearAuthError();
    setDeleting(true);
    try {
      const ok = await deleteAccount();
      if (ok) {
        toast(t("deleteAccount.deleteSuccess", "账户已删除，数据不可恢复"), "success");
        onClose();
      } else {
        toast(authError || t("deleteAccount.deleteFailed", "删除失败"), "warn");
      }
    } finally {
      setDeleting(false);
    }
  };

  const nonCloseable = stage !== "warn" || deleting || authLoading;

  return (
    <div className="fixed inset-0 z-[140]">
      <div
        className={cn(
          "absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity",
          nonCloseable ? "cursor-not-allowed" : "cursor-pointer",
        )}
        onClick={nonCloseable ? undefined : onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div
          className="relative w-full max-w-md animate-fadeIn overflow-hidden rounded-3xl border border-red-500/30 bg-ink-900 shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_30px_80px_-10px_rgba(0,0,0,0.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部红色光晕 + 关闭 */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-red-500/20 via-red-500/10 to-transparent pointer-events-none" />
          {stage === "warn" && !deleting && !authLoading && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink-800/80 text-muted transition-colors hover:bg-ink-700 hover:text-mist"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          )}

          <div className="relative p-6 md:p-8">
            {/* 图标 + 标题 */}
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/30 text-red-400">
                  <UserX size={28} />
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="font-display text-xl font-medium text-red-200">
                  {t("deleteAccount.title")}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t("deleteAccount.irreversibleWarning")}
                </p>
              </div>
            </div>

            {/* Stage 1：警告 + 后果清单 */}
            {stage === "warn" && (
              <div className="mt-6 space-y-4 animate-fadeIn">
                <div className="space-y-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-red-300">
                    <AlertTriangle size={14} />
                    {t("deleteAccount.willDeleteTitle")}
                  </div>
                  <ul className="mt-2 space-y-2.5 text-[13px] text-red-100/80">
                    <li className="flex items-start gap-2.5">
                      <CloudOff size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <span>{t("deleteAccount.cloudData")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <History size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <span>{t("deleteAccount.localRecords", records.length)}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Settings size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <span>{t("deleteAccount.localSettings")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Users size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <span>{t("deleteAccount.profileData")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0 text-red-400" />
                      <span>
                        {t("deleteAccount.accountIdentity", expectedEmail || "-")}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-line/60 bg-ink-800/50 p-4 text-[13px] leading-relaxed text-muted">
                  <div className="mb-1.5 flex items-center gap-2 text-mist">
                    <ShieldCheck size={14} className="text-amber-glow" />
                    <span className="text-xs font-medium">{t("deleteAccount.backupHintTitle", "想保留本地记录？")}</span>
                  </div>
                  {t("deleteAccount.backupHint")}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700 sm:flex-none sm:px-6"
                  >
                    {t("deleteAccount.thinkAgain")}
                  </button>
                  <button
                    onClick={() => setStage("typeEmail")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25 sm:flex-none sm:px-6"
                  >
                    <Trash2 size={15} />
                    {t("deleteAccount.understandRisk")}
                  </button>
                </div>
              </div>
            )}

            {/* Stage 2：输入邮箱确认 */}
            {stage === "typeEmail" && (
              <div className="mt-6 space-y-4 animate-fadeIn">
                <label className="block text-[13px] leading-relaxed text-mist">
                  {t("deleteAccount.confirmEmailHint")}
                </label>
                <div className="rounded-xl border border-line bg-ink-800 px-3 py-2">
                  <div className="mb-1 text-[11px] text-muted">{t("deleteAccount.currentLoginEmail")}</div>
                  <div className="font-mono text-sm text-amber-glow break-all">
                    {expectedEmail}
                  </div>
                </div>
                <div>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={t("deleteAccount.emailPlaceholder")}
                    spellCheck={false}
                    autoComplete="off"
                    className={cn(
                      "w-full rounded-xl border bg-ink-800 px-4 py-3 font-mono text-sm outline-none transition-colors",
                      emailInput.length > 0
                        ? emailMatches
                          ? "border-emerald-500/50 focus:border-emerald-400 text-emerald-200"
                          : "border-red-500/40 focus:border-red-400 text-red-200"
                        : "border-line focus:border-red-400 text-mist",
                    )}
                  />
                  {emailInput.length > 0 && !emailMatches && (
                    <p className="mt-1.5 pl-1 text-[11px] text-red-300/90">
                      {t("deleteAccount.emailMismatch")}
                    </p>
                  )}
                  {emailMatches && (
                    <p className="mt-1.5 pl-1 text-[11px] text-emerald-300/90">
                      {t("deleteAccount.emailMatched")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => {
                      setStage("warn");
                      setEmailInput("");
                    }}
                    className="flex-1 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700 sm:flex-none sm:px-6"
                  >
                    {t("deleteAccount.backToPrev")}
                  </button>
                  <button
                    onClick={() => emailMatches && setStage("confirm")}
                    disabled={!emailMatches}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
                  >
                    {t("deleteAccount.nextConfirm")}
                  </button>
                </div>
              </div>
            )}

            {/* Stage 3：最后确认（无返回无 ESC） */}
            {stage === "confirm" && (
              <div className="mt-6 space-y-4 animate-fadeIn">
                <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-400" />
                    <div className="text-[13px] leading-relaxed text-red-100/90">
                      {t("deleteAccount.finalWarning")}
                    </div>
                  </div>
                </div>

                {(authError || deleting || authLoading) && (
                  <div
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs",
                      authError
                        ? "border-red-500/40 bg-red-500/5 text-red-200/90"
                        : "border-line bg-ink-800 text-muted animate-pulse",
                    )}
                  >
                    {authError ? t("deleteAccount.error", authError) : t("deleteAccount.removingAccount")}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => {
                      setStage("typeEmail");
                      clearAuthError();
                    }}
                    disabled={deleting || authLoading}
                    className="flex-1 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700 disabled:opacity-50 sm:flex-none sm:px-6"
                  >
                    {t("deleteAccount.backToPrev")}
                  </button>
                  <button
                    onClick={() => void doDelete()}
                    disabled={!emailMatches || deleting || authLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-8px_rgba(239,68,68,0.6)] transition-colors hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-[10rem] sm:px-6"
                  >
                    <Trash2 size={15} className={deleting ? "animate-pulse" : ""} />
                    {deleting || authLoading ? t("deleteAccount.deleting") : t("deleteAccount.confirmPermanentDelete")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
