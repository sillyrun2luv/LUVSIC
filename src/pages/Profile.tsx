import { useState, useEffect } from "react";
import {
  Check,
  Pencil,
  Lock,
  Heart,
  Info,
  LogIn,
  Loader2,
  UserX,
  Megaphone,
  ChevronRight,
  Cloud,
  Bell,
  Palette,
  ShieldCheck,
  ShieldAlert,
  FileJson,
} from "lucide-react";
import { useProfileStore, AVATAR_OPTIONS } from "@/store/useProfileStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useAnnouncementStore } from "@/store/useAnnouncementStore";
import { streakDays } from "@/lib/stats";
import { greeting } from "@/lib/date";
import { cn } from "@/lib/utils";
import { checkNameConflict } from "@/lib/friends";
import { toast } from "@/store/useToastStore";
import DeleteAccountSheet from "@/components/DeleteAccountSheet";
import Avatar, { buildTextAvatar, avatarKind } from "@/components/Avatar";
import { getCurrentAppIcon, type AppIconType } from "@/lib/iconSwitch";
import { t } from "@/store/useI18nStore";
import OtherSettingsSheet, { type SubPanel } from "@/components/OtherSettingsSheet";

export default function Profile() {
  const name = useProfileStore((s) => s.name);
  const avatar = useProfileStore((s) => s.avatar);
  const setName = useProfileStore((s) => s.setName);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const records = useRecordStore((s) => s.records);
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const userId = useAuthStore((s) => s.user?.id);
  const openAuth = useUIStore((s) => s.openAuth);
  const streak = streakDays(records);
  const g = greeting();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [showAvatars, setShowAvatars] = useState(false);
  const [committing, setCommitting] = useState(false);

  // 公告
  const isAnnouncementAdmin = useAnnouncementStore((s) => s.isAdmin);
  const refreshAnnouncementAdmin = useAnnouncementStore((s) => s.refreshAdmin);
  const openAnnouncementList = useAnnouncementStore((s) => s.openList);
  const openAnnouncementAdmin = useAnnouncementStore((s) => s.openAdmin);
  const activeAnnouncement = useAnnouncementStore((s) => s.activeAnnouncement);

  // 二级面板开关（无中间「设置列表」层，点设置项直接进对应子面板，返回/遮罩=直接关）
  const [openDeleteAccount, setOpenDeleteAccount] = useState(false);
  const [openOtherSettings, setOpenOtherSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SubPanel>("password");

  const [currentIcon, setCurrentIcon] = useState<AppIconType>("mushroom");
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => { void refreshAnnouncementAdmin(); }, [refreshAnnouncementAdmin]);
  useEffect(() => { void getCurrentAppIcon().then(setCurrentIcon); }, []);

  const commitName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setEditingName(false); return; }
    if (trimmed === name) { setEditingName(false); return; }
    if (isLoggedIn) {
      setCommitting(true);
      try {
        const { conflict, conflictName } = await checkNameConflict(trimmed, userId ?? undefined);
        if (conflict) {
          toast(t("toast.nameConflict", conflictName ?? trimmed), "warn");
          return;
        }
      } catch { /* 放行，云端唯一约束兜底 */ }
      finally { setCommitting(false); }
    }
    setName(trimmed);
    setEditingName(false);
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <header>
        <p className="label-eyebrow mb-2">{t("profile.title")}</p>
        <h1 className="font-display text-4xl font-medium text-cream">{t("profile.my")}</h1>
      </header>

      {/* 头像与昵称 */}
      <section className="surface p-5">
        {isLoggedIn ? (
          <>
            <div className="mb-4 flex items-center gap-4">
              <button
                onClick={() => setShowAvatars((v) => !v)}
                className="shrink-0 rounded-full border border-amber/40 bg-amber/10 shadow-glow transition-transform hover:scale-105"
                aria-label={t("profile.changeAvatar")}
              >
                <Avatar value={avatar} size={64} emojiScale={0.5} ringClass="ring-0 border-0" />
              </button>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      autoFocus maxLength={12}
                      placeholder={t("profile.nicknamePlaceholder")}
                      disabled={committing}
                      className="flex-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-sm text-cream outline-none focus:border-amber/50 disabled:opacity-60"
                    />
                    <button
                      onClick={() => void commitName()}
                      disabled={committing}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-ink-950 disabled:opacity-60"
                      aria-label={t("profile.confirm")}
                    >
                      {committing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNameInput(name); setEditingName(true); }}
                    className="group flex items-center gap-1.5 text-left"
                  >
                    <span className="font-display text-xl text-cream">{name}</span>
                    <Pencil size={13} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {g.period}好，{streak > 0 ? t("overview.streakDays", streak) : t("profile.greetingFresh")}
                </p>
              </div>
            </div>
            {showAvatars && (
              <div className="rounded-xl border border-line bg-ink-850/80 p-2.5">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <div className="text-[11px] text-muted">{t("profile.emojiAvatarCount", AVATAR_OPTIONS.length)}</div>
                  <button
                    onClick={() => {
                      const textAva = buildTextAvatar(name || "我");
                      setAvatar(textAva);
                      setShowAvatars(false);
                      toast(t("toast.textAvatarSwitched"), "success");
                    }}
                    className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
                  >
                    <Avatar value={buildTextAvatar(name || "我")} size={14} ringClass="ring-0" emojiScale={0.85} />
                    {t("profile.generateFromInitial")}
                  </button>
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  {AVATAR_OPTIONS.map((a) => (
                    <button
                      key={a}
                      onClick={() => { setAvatar(a); setShowAvatars(false); }}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors",
                        a === avatar ? "bg-amber/20 ring-1 ring-amber/60" : "hover:bg-ink-700",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                  {avatarKind(avatar) === "text" && (
                    <div title={t("common.current")} className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 ring-1 ring-amber/60">
                      <Avatar value={avatar} size={28} ringClass="ring-0" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-4 flex items-center gap-4">
            <Avatar value={avatar} size={64} emojiScale={0.5} ringClass="border border-line ring-0" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl text-cream">{name}</div>
              <button
                onClick={openAuth}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs text-amber-glow transition-colors hover:bg-amber/20"
              >
                <LogIn size={12} />
                {t("profileSetup.title")}
              </button>
              <p className="mt-1.5 text-xs text-muted">
                {g.period}好，{streak > 0 ? t("overview.streakDays", streak) : t("profile.greetingFresh")}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 公告 */}
      <section>
        <div className="label-eyebrow mb-3">{t("profile.announcement")}</div>
        <div className="surface divide-y divide-line/40 overflow-hidden rounded-2xl">
          <button
            onClick={() => void openAnnouncementList()}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/15 text-amber-glow">
              <Megaphone size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-cream">{t("profile.announcementCenter")}</div>
              <div className="text-xs text-muted">
                {activeAnnouncement ? activeAnnouncement.title : t("profile.announcementDesc")}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>
          {isAnnouncementAdmin && (
            <button
              onClick={() => void openAnnouncementAdmin()}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-amber/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 text-amber-glow">
                <Pencil size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-cream">{t("profile.announcementManage")}</div>
                <div className="text-xs text-muted">{t("profile.announcementManageDesc")}</div>
              </div>
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber-glow ring-1 ring-amber/30">
                {t("profile.adminTag")}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* 其他设置（一级列表 → 共用 OtherSettingsSheet 二级面板，内部返回列表切换，无第三级跳转） */}
      <section>
        <div className="label-eyebrow mb-3">{t("profile.settings")}</div>
        <div className="surface divide-y divide-line/40 overflow-hidden rounded-2xl">
          <Row
            icon={<Cloud size={18} className="text-sky-300" />}
            iconBg="bg-sky-500/15"
            label={t("profile.dataSync")}
            desc={t("profile.dataSyncDesc")}
            onClick={() => { setSettingsPanel("cloud"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<Lock size={18} />}
            label={t("profile.passwordLock")}
            desc={t("profile.passwordLockDesc")}
            onClick={() => { setSettingsPanel("password"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<Bell size={18} />}
            label={t("profile.reminder")}
            desc={t("profile.reminderDesc")}
            onClick={() => { setSettingsPanel("reminder"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<Palette size={18} />}
            label={t("profile.appearanceTheme")}
            desc={t("profile.appearanceDesc")}
            onClick={() => { setSettingsPanel("appearance"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<ShieldAlert size={18} className="text-orange-400" />}
            iconBg="bg-orange-400/15"
            label={t("keepalive.title")}
            desc={t("keepalive.rowDesc")}
            onClick={() => { setSettingsPanel("keepalive"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<FileJson size={18} />}
            label={t("profile.dataExport")}
            desc={t("profile.dataExportDesc")}
            onClick={() => { setSettingsPanel("backup"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<ShieldCheck size={18} className="text-teal-300" />}
            iconBg="bg-teal-500/15"
            label={t("profile.socialPrivacy")}
            desc={t("profile.socialPrivacyDesc")}
            onClick={() => { setSettingsPanel("privacy"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<Heart size={18} className="text-amber-glow" />}
            iconBg="bg-amber/15"
            label={t("profile.supportAuthor")}
            desc={t("profile.supportAuthorDesc")}
            onClick={() => { setSettingsPanel("support"); setOpenOtherSettings(true); }}
          />
          <Row
            icon={<Info size={18} />}
            label={t("profile.about")}
            desc={t("profile.aboutDesc")}
            onClick={() => { setSettingsPanel("about"); setOpenOtherSettings(true); }}
          />
          {isLoggedIn && (
            <button
              onClick={() => setOpenDeleteAccount(true)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-red-500/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-300">
                <UserX size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-200">{t("profile.deleteAccount")}</div>
                <div className="text-xs text-red-300/70">{t("profile.deleteAccountDesc")}</div>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* 二级面板：OtherSettingsSheet（打开直接进对应子面板；返回/遮罩/ESC/X=直接关；无中间设置列表层） */}
      <OtherSettingsSheet
        open={openOtherSettings}
        onClose={() => { setOpenOtherSettings(false); setShowIconPicker(false); }}
        panel={settingsPanel}
        currentIcon={currentIcon}
        showIconPicker={showIconPicker}
        onRequestShowIcon={setShowIconPicker}
        onCurrentIconChange={setCurrentIcon}
      />
      {/* 删除账户保持独立红色入口，外部单独打开 */}
      <DeleteAccountSheet open={openDeleteAccount} onClose={() => setOpenDeleteAccount(false)} />

      <div className="pb-4 text-center">
        <p className="font-display text-sm text-muted">{t("app.name")}</p>
        <p className="text-[11px] text-muted/70">{t("app.subtitle")}</p>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  desc,
  onClick,
  iconBg = "bg-ink-800",
  hidden = false,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  iconBg?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/50"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mist", iconBg)}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-cream">{label}</div>
        <div className="text-xs text-muted truncate">{desc}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}
