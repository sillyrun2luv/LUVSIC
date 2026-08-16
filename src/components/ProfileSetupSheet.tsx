import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Check, Users } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useProfileStore, AVATAR_OPTIONS } from "@/store/useProfileStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { checkNameConflict } from "@/lib/friends";
import { cn } from "@/lib/utils";
import Avatar, { buildTextAvatar, avatarKind } from "./Avatar";
import { t } from "@/store/useI18nStore";

export default function ProfileSetupSheet() {
  const open = useUIStore((s) => s.profileSetupOpen);
  const close = useUIStore((s) => s.closeProfileSetup);

  const currentName = useProfileStore((s) => s.name);
  const currentAvatar = useProfileStore((s) => s.avatar);
  const setName = useProfileStore((s) => s.setName);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const markProfileSetupDismissed = useProfileStore((s) => s.markProfileSetupDismissed);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [nameInput, setNameInput] = useState(currentName);
  const [avatar, setLocalAvatar] = useState(currentAvatar);
  const [submitting, setSubmitting] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  useEffect(() => {
    if (open) {
      setNameInput(currentName === t('common.me') ? "" : currentName);
      setLocalAvatar(currentAvatar);
    }
  }, [open, currentName, currentAvatar]);

  if (!open) return null;

  /** 关闭弹窗并标记 dismissed（保存和"稀后再说"都走这里） */
  const handleClose = () => {
    if (userId) markProfileSetupDismissed(userId);
    close();
  };

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast(t('profileSetup.nicknameHint'), "warn");
      return;
    }
    if (trimmed.length > 12) {
      toast(t('profileSetup.nicknamePlaceholder'), "warn");
      return;
    }
    setSubmitting(true);
    setCheckingName(true);
    try {
      // 重名检测：如果和别人冲突，阻止保存
      const { conflict, conflictName } = await checkNameConflict(
        trimmed,
        userId ?? undefined,
      );
      if (conflict) {
        toast(`昵称「${conflictName ?? trimmed}」已经被别人使用了，换一个吧`, "warn");
        return;
      }
    } catch {
      // 出错放行，最终云端 UNIQUE 兜底
    } finally {
      setCheckingName(false);
    }
    setName(trimmed);
    setAvatar(avatar);
    setSubmitting(false);
    toast(t('common.save'), "success");
    handleClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] pb-[72px] flex items-end justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={() => {
          // 点遮罩不关闭（首次设置必须完成）
          // 但允许关闭按钮
        }}
      />

      {/* 弹窗 */}
      <div className="relative z-10 m-4 w-full max-w-md animate-slideUp overflow-hidden rounded-3xl border border-line/80 bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-line/60 p-5 pb-4">
          <div className="flex items-center gap-2 text-amber-glow">
            <Sparkles size={18} />
            <span className="label-eyebrow">{t('profileSetup.title')}</span>
          </div>
          <h2 className="mt-1 font-display text-2xl text-cream">
            {t('profileSetup.nicknameHint')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('profileSetup.nicknameDesc')}
          </p>
        </div>

        {/* 内容 */}
        <div className="space-y-5 p-5">
          {/* 头像选择 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-muted">{t('profileSetup.chooseAvatar')}</label>
              <button
                onClick={() => {
                  const avatar = buildTextAvatar(nameInput.trim() || t('common.me'));
                  setLocalAvatar(avatar);
                }}
                className="flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
              >
                <Avatar
                  value={buildTextAvatar(nameInput.trim() || t('common.me'))}
                  size={14}
                  ringClass="ring-0"
                  emojiScale={0.85}
                />
                {t('profileSetup.generateFromInitial')}
              </button>
            </div>

            {/* 当前预览 */}
            <div className="mb-3 flex items-center justify-center">
              <Avatar value={avatar} size={72} ringClass="ring-2 ring-amber/50" emojiScale={0.5} />
            </div>

            <div className="grid grid-cols-9 gap-1.5 rounded-xl border border-line bg-ink-850/80 p-2.5">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => setLocalAvatar(a)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors",
                    a === avatar
                      ? "bg-amber/20 ring-1 ring-amber/60"
                      : "hover:bg-ink-700",
                  )}
                >
                  {a}
                </button>
              ))}
              {avatarKind(avatar) === "text" && (
                <div
                  title="当前：首字母渐变"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 ring-1 ring-amber/60"
                >
                  <Avatar value={avatar} size={28} ringClass="ring-0" />
                </div>
              )}
            </div>
          </div>

          {/* 昵称输入 */}
          <div>
            <label className="mb-2 block text-xs text-muted">{t('profileSetup.nicknameLabel')}</label>
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                autoFocus
                maxLength={12}
                placeholder={t('profileSetup.nicknamePlaceholder')}
                className="flex-1 rounded-xl border border-line bg-ink-800 px-4 py-3 text-cream outline-none transition-colors focus:border-amber/50"
              />
            </div>
            <div className="mt-1 flex justify-end text-xs text-muted">
              {t('profileSetup.charCount', nameInput.length)}
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="border-t border-line/60 p-4">
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber py-3.5 text-base font-medium text-ink-950 transition-all hover:bg-amber-glow disabled:opacity-60"
          >
            <Check size={18} />
            {t('profileSetup.saveAndStart')}
          </button>
          <button
            onClick={handleClose}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-muted transition-colors hover:text-mist"
          >
            {t('profileSetup.skipForNow')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
