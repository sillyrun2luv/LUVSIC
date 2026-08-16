import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  Cloud,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileJson,
  Upload,
  Users,
  Search,
  BarChart3,
  Globe,
  Heart,
  Info,
  Palette,
  Timer,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Check,
  Loader2,
  Lock,
  LockKeyhole,
  Pencil,
  Eye,
  EyeOff,
  Bell,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  UserX,
  CloudOff,
  History,
  Settings,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  overlayAvailable,
  hasOverlayPermission,
  requestOverlayPermission,
  syncOverlayTimer,
} from "@/lib/floatingOverlay";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useThemeStore, THEMES } from "@/store/useThemeStore";
import { useUIStore } from "@/store/useUIStore";
import { useI18nStore, LOCALES } from "@/store/useI18nStore";
import { toast } from "@/store/useToastStore";
import { exportRecordsXls } from "@/lib/exportExcel";
import { saveFile } from "@/lib/saveFile";
import { uploadToCloud, downloadFromCloud, getCloudRecordCount } from "@/lib/sync";
import {
  startAutoSync,
  triggerAutoSync,
  getAutoSyncStatus,
  getAutoSyncError,
  onAutoSyncStatusChange,
  type AutoSyncStatus,
} from "@/lib/autoSync";
import { APP_VERSION, checkUpdate, type VersionInfo } from "@/config/appVersion";
import { cn, isValidPin, sha256Hex } from "@/lib/utils";
import { t } from "@/store/useI18nStore";
import type { AppIconType } from "@/lib/iconSwitch";
import { switchAppIcon, getCurrentAppIcon, restartApp } from "@/lib/iconSwitch";
import ReminderSettings from "@/components/ReminderSettings";
import DonateSheet from "@/components/DonateSheet";
import { useNotification } from "@/hooks/useNotification";
import type { ReminderMode } from "@/types";

/* ==================== 子面板类型 ==================== */
export type SubPanel =
  | "cloud"     // 云同步
  | "backup"    // 数据备份
  | "privacy"   // 社交隐私
  | "appearance"// 外观与偏好
  | "keepalive" // 后台保活
  | "about"     // 关于
  | "support"   // 支持作者
  | "password"  // 密码锁
  | "reminder"; // 提醒设置

/* ==================== 通用底部 Sheet 容器 ==================== */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  panel: SubPanel;
  currentIcon: AppIconType;
  showIconPicker: boolean;
  onRequestShowIcon: (v: boolean) => void;
  onCurrentIconChange?: (icon: AppIconType) => void;
}
export default function OtherSettingsSheet({
  open,
  onClose,
  panel,
  currentIcon,
  showIconPicker,
  onRequestShowIcon,
  onCurrentIconChange,
}: SheetProps) {

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleMap: Record<SubPanel, string> = {
    cloud: t("settings.cloudSync.title"),
    backup: t("settings.dataExport.title"),
    privacy: t("settings.socialPrivacy.title"),
    appearance: t("profile.appearanceTheme"),
    keepalive: t("keepalive.title"),
    about: t("settings.about.title"),
    support: t("settings.supportAuthor.title"),
    password: t("settings.passwordLock.title"),
    reminder: t("reminder.title"),
  };

  return (
    <div className="fixed inset-0 z-[90]">
      {/* 点击遮罩空白 → 直接关（不再回到中间列表层）*/}
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 遮罩依旧覆盖全屏（从 0 0 到 0 0）*/}
      {/* Sheet 整体上移 72px，给 BottomNav(sticky bottom-0 z-30) 让位，避免被底栏压住下半部 */}
      {/* max-h 同步缩小 72px，保证短屏下仍有滚动，不顶出屏幕顶部 */}
      {/* pb 加手机底部安全区，保证内容与物理横条之间留空 */}
      <div className="absolute inset-x-0 bottom-[72px] mx-auto flex w-full max-w-md max-h-[calc(92vh-72px)] flex-col animate-slideInUp rounded-3xl border border-line/80 bg-ink-900 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        {/* 顶部栏（不缩放，固定高度，返回→直接关，不做中间跳转）*/}
        <div className="shrink-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink-900/95 px-5 py-4 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="mr-1 rounded-full p-1 text-muted transition-colors hover:bg-ink-800 hover:text-mist"
              aria-label={t("common.close")}
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="font-display text-lg text-cream">{titleMap[panel]}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-mist"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>
        {/* 内容区：自动占满剩余空间，内容多时可滚；min-h-0 保证 flex 内部滚动生效 */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-5 p-5 pb-10">
          {panel === "cloud" && <CloudPanel />}
          {panel === "backup" && <BackupPanel />}
          {panel === "privacy" && <PrivacyPanel />}
          {panel === "keepalive" && <KeepAlivePanel />}
          {panel === "appearance" && (
            <AppearancePanel
              currentIcon={currentIcon}
              showIconPicker={showIconPicker}
              onRequestShowIcon={onRequestShowIcon}
              onCurrentIconChange={onCurrentIconChange}
            />
          )}
          {panel === "about" && <AboutPanel />}
          {panel === "support" && <SupportPanel />}
          {panel === "password" && <PasswordPanel />}
          {panel === "reminder" && <ReminderSettings />}
        </div>
      </div>
    </div>
  );
}

/* ==================== 列表条目 Row ==================== */
function ListRow({
  icon,
  iconBg,
  label,
  desc,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  iconBg?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 p-4 text-left transition-colors",
        danger ? "hover:bg-red-500/5" : "hover:bg-ink-800/50",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mist", iconBg || "bg-ink-800")}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-medium", danger ? "text-red-200" : "text-cream")}>
          {label}
        </div>
        <div className={cn("text-xs truncate", danger ? "text-red-300/70" : "text-muted")}>
          {desc}
        </div>
      </div>
      <ChevronRight />
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0 text-muted">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ==================== 一级列表 ==================== */
function ListPanel({ onPick }: { onPick: (p: SubPanel) => void }) {
  const appearanceDesc = useThemeStore((s) => {
    const th = THEMES.find((t) => t.id === s.themeId);
    return th ? th.name : t("profile.customColor");
  });
  const reminder = useRecordStore((s) => s.settings.reminder);
  const reminderDesc = summarize(reminder);
  const lock = useRecordStore((s) => s.settings.lock);
  const lockDesc = lock.enabled
    ? t("settings.passwordLock.desc")
    : t("settings.passwordLock.notEnabled");

  return (
    <div className="surface -mx-1 divide-y divide-line/40 overflow-hidden rounded-2xl">
      <ListRow
        icon={<Cloud size={18} className="text-sky-300" />}
        iconBg="bg-sky-500/15"
        label={t("profile.dataSync")}
        desc={t("profile.dataSyncDesc")}
        onClick={() => onPick("cloud")}
      />
      <ListRow
        icon={<Lock size={18} />}
        label={t("profile.passwordLock")}
        desc={lockDesc}
        onClick={() => onPick("password")}
      />
      <ListRow
        icon={<Bell size={18} />}
        label={t("profile.reminder")}
        desc={reminderDesc}
        onClick={() => onPick("reminder")}
      />
      <ListRow
        icon={<Palette size={18} />}
        label={t("profile.appearanceTheme")}
        desc={appearanceDesc + " · " + t("profile.appearanceDesc")}
        onClick={() => onPick("appearance")}
      />
      <ListRow
        icon={<FileJson size={18} />}
        label={t("profile.dataExport")}
        desc={t("profile.dataExportDesc")}
        onClick={() => onPick("backup")}
      />
      <ListRow
        icon={<ShieldCheck size={18} className="text-teal-300" />}
        iconBg="bg-teal-500/15"
        label={t("profile.socialPrivacy")}
        desc={t("profile.socialPrivacyDesc")}
        onClick={() => onPick("privacy")}
      />
      <ListRow
        icon={<Heart size={18} className="text-amber-glow" />}
        iconBg="bg-amber/15"
        label={t("profile.supportAuthor")}
        desc={t("profile.supportAuthorDesc")}
        onClick={() => onPick("support")}
      />
      <ListRow
        icon={<Info size={18} />}
        label={t("profile.about")}
        desc={t("profile.aboutDesc") + " · v" + APP_VERSION}
        onClick={() => onPick("about")}
      />
    </div>
  );
}

const WEEKDAY_KEYS = ["calendar.weekday7", "calendar.weekday1", "calendar.weekday2", "calendar.weekday3", "calendar.weekday4", "calendar.weekday5", "calendar.weekday6"];
function summarize(r: ReturnType<typeof useRecordStore.getState>["settings"]["reminder"]): string {
  if (!r.enabled) return t("reminder.offWhenClosed");
  if (r.mode === "daily") return t("reminder.dailyAt", r.time);
  if (r.mode === "weekly") {
    const days = r.weekdays.length
      ? [...r.weekdays].sort().map((w) => t(WEEKDAY_KEYS[w])).join("、")
      : t("common.none");
    return t("reminder.weeklyAt", days, r.time);
  }
  return t("reminder.everyNHours", r.intervalHours);
}

/* ==================== 云同步面板 ==================== */
function CloudPanel() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const openAuth = useUIStore((s) => s.openAuth);
  const records = useRecordStore((s) => s.records);

  const [confirm, setConfirm] = useState<"upload" | "download" | "logout" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoSyncStatus>(getAutoSyncStatus());

  useEffect(() => {
    startAutoSync();
    return onAutoSyncStatusChange(setAutoStatus);
  }, []);

  const refreshCloudCount = async () => {
    if (!user) return;
    const n = await getCloudRecordCount(user.id);
    setCloudCount(n);
  };
  useEffect(() => {
    if (session && user) void refreshCloudCount();
  }, [session, user?.id]);

  const doUpload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await uploadToCloud(user!.id);
      toast(t("settings.cloudSync.uploadSuccess"), "success", undo ? { label: t("common.undo"), onAction: async () => {
        await undo();
        toast(t("settings.cloudSync.uploadUndone"), "success");
        void refreshCloudCount();
      } } : undefined);
      void refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || t("settings.cloudSync.uploadFailed"), "warn");
    } finally { setLoading(false); }
  };
  const doDownload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await downloadFromCloud(user!.id);
      toast(t("settings.cloudSync.downloadSuccess"), "success", undo ? { label: t("common.undo"), onAction: () => {
        undo();
        toast(t("settings.cloudSync.downloadUndone"), "success");
        void refreshCloudCount();
      } } : undefined);
      void refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || t("settings.cloudSync.downloadFailed"), "warn");
    } finally { setLoading(false); }
  };

  if (!session || !user) {
    return (
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
            <Cloud size={18} />
          </div>
          <div>
            <div className="text-sm text-cream">{t("settings.cloudSync.notLoggedIn")}</div>
            <div className="text-xs text-muted">{t("settings.cloudSync.notLoggedIn")}</div>
          </div>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          {t("settings.auth.syncHint")} {t("settings.auth.passwordLockLocalOnly")}
        </p>
        <button
          onClick={openAuth}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <Cloud size={15} />
          {t("auth.loginOrRegister")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <Cloud size={18} className={cn(
              autoStatus === "syncing" && "animate-spin",
              autoStatus === "waiting" && "opacity-70",
              autoStatus === "error" && "text-rose-300",
            )} />
            <span className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ink-900",
              autoStatus === "synced"  && "bg-emerald-400",
              autoStatus === "syncing" && "bg-amber animate-pulse",
              autoStatus === "waiting" && "bg-amber/70",
              autoStatus === "error"   && "bg-rose-400",
              autoStatus === "idle"    && "bg-emerald-400/60",
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm text-cream">
              {t("settings.cloudSync.connected")}
              <AutoStatusBadge status={autoStatus} />
            </div>
            <div className="truncate text-xs text-muted">{t("settings.auth.email", user.email || "")}</div>
          </div>
        </div>
        {autoStatus === "error" && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <div className="truncate text-[11px] text-rose-200">
              {t("settings.cloudSync.syncFailed")}：{getAutoSyncError() || t("common.unknownError")}
            </div>
            <button
              onClick={() => triggerAutoSync({ full: false })}
              className="shrink-0 rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span>{t("settings.cloudSync.localCount", records.length)}</span>
          <span>{t("settings.cloudSync.cloudCount", cloudCount !== null ? cloudCount : 0)}</span>
        </div>
        <div className="mb-3 rounded-xl border border-dashed border-emerald-500/25 bg-emerald-500/5 p-2.5">
          <div className="flex items-center gap-2 text-[11px] text-emerald-200/90">
            <RefreshCw size={12} />
            <span>{t("settings.cloudSync.autoSyncHint")}</span>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => triggerAutoSync({ full: false })}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
          >
            <RefreshCw size={14} />
            {loading ? t("common.processing") : t("settings.cloudSync.syncIncremental")}
          </button>
          <button
            onClick={() => setConfirm("upload")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
          >
            {loading ? t("common.processing") : t("settings.cloudSync.forceUpload")}
          </button>
          <button
            onClick={() => setConfirm("download")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
          >
            {loading ? t("common.processing") : t("settings.cloudSync.downloadFromCloud")}
          </button>
          <button
            onClick={() => setConfirm("logout")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-rose-300/80 transition-colors hover:border-rose-500/40 hover:text-rose-300"
          >
            {t("settings.auth.logout")}
          </button>
        </div>
      </div>
      {confirm === "upload" && (
        <ConfirmDialog
          title={t("settings.cloudSync.uploadTitle")}
          message={t("settings.cloudSync.uploadMessage")}
          confirmLabel={t("settings.cloudSync.confirmUpload")}
          onConfirm={doUpload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "download" && (
        <ConfirmDialog
          title={t("settings.cloudSync.downloadTitle")}
          message={t("settings.cloudSync.downloadMessage")}
          confirmLabel={t("settings.cloudSync.confirmDownload")}
          onConfirm={doDownload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "logout" && (
        <ConfirmDialog
          title={t("settings.cloudSync.logoutTitle")}
          message={t("settings.cloudSync.logoutMessage")}
          confirmLabel={t("settings.auth.logout")}
          onConfirm={async () => {
            setConfirm(null);
            await signOut();
            toast(t("auth.logoutSuccess"), "success");
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function AutoStatusBadge({ status }: { status: AutoSyncStatus }) {
  const cfg: Record<AutoSyncStatus, { text: string; cls: string }> = {
    idle:    { text: t("settings.cloudSync.idle"),    cls: "bg-ink-800 text-muted ring-1 ring-line/60" },
    waiting: { text: t("settings.cloudSync.waiting"), cls: "bg-amber/15 text-amber-glow ring-1 ring-amber/30" },
    syncing: { text: t("settings.cloudSync.syncing"), cls: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
    synced:  { text: t("settings.cloudSync.synced"),  cls: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30" },
    error:   { text: t("settings.cloudSync.failed"),  cls: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" },
  };
  const c = cfg[status];
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", c.cls)}>
      {c.text}
    </span>
  );
}

/* ==================== 数据备份面板 ==================== */
function BackupPanel() {
  const records = useRecordStore((s) => s.records);
  const clearAll = useRecordStore((s) => s.clearAll);
  const importData = useRecordStore((s) => s.importData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportXls = async () => {
    if (records.length === 0) {
      toast(t("settings.dataExport.noRecordsToExport"), "warn");
      return;
    }
    try {
      await exportRecordsXls(records);
      toast(t("settings.dataExport.exportSuccess"), "success");
    } catch {
      toast(t("settings.dataExport.exportFailed"), "warn");
    }
  };
  const handleExportJson = async () => {
    if (records.length === 0) {
      toast(t("settings.dataExport.noRecordsToExport"), "warn");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    try {
      await saveFile({
        filename: `zwba-backup-${date}.json`,
        content: JSON.stringify(records, null, 2),
        mimeType: "application/json",
      });
      toast(t("settings.dataExport.exportSuccess"), "success");
    } catch {
      toast(t("settings.dataExport.exportFailed"), "warn");
    }
  };
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) {
          toast(t("settings.dataExport.invalidFileFormat"), "warn");
          return;
        }
        clearAll();
        importData(data);
        toast(t("settings.dataExport.importSuccess", data.length), "success");
      } catch {
        toast(t("settings.dataExport.invalidFileFormat"), "warn");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">
        {t("settings.dataExport.desc")}
      </p>
      <div className="space-y-2">
        <button
          onClick={handleExportXls}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow border border-line"
        >
          <FileSpreadsheet size={15} />
          {t("settings.dataExport.exportExcel")}
        </button>
        <button
          onClick={handleExportJson}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow border border-line"
        >
          <FileJson size={15} />
          {t("settings.dataExport.exportJson")}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow border border-line"
        >
          <Upload size={15} />
          {t("settings.dataExport.importJson")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportJson}
          className="hidden"
        />
      </div>
      <p className="text-[11px] text-muted/80">
        {t("settings.dataExport.exportableCount", records.length)}
      </p>
    </div>
  );
}

/* ==================== 社交隐私面板 ==================== */
function PrivacyPanel() {
  const searchable = useProfileStore((s) => s.searchable);
  const showAgg = useProfileStore((s) => s.showAggregatesToFriends);
  const setSearchable = useProfileStore((s) => s.setSearchable);
  const setShowAggregates = useProfileStore((s) => s.setShowAggregatesToFriends);
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const openAuth = useUIStore((s) => s.openAuth);

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-line bg-ink-900/60 p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
            <Users size={18} />
          </span>
          <div>
            <div className="text-sm font-medium text-cream">{t("profile.socialPrivacyLoginTip")}</div>
            <div className="mt-0.5 text-xs text-muted">{t("profile.socialPrivacyDesc")}</div>
          </div>
        </div>
        <button
          onClick={openAuth}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-amber-glow transition-colors hover:bg-amber/20"
        >
          {t("auth.loginOrRegister")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
      <PrivacyToggle
        icon={<Search size={18} />}
        title={t("settings.socialPrivacy.searchable")}
        desc={searchable ? t("settings.socialPrivacy.searchableDesc") : t("settings.socialPrivacy.searchableOffDesc")}
        checked={searchable}
        onChange={(v) => {
          setSearchable(v);
          toast(v ? t("settings.socialPrivacy.searchableOn") : t("settings.socialPrivacy.searchableOff"), "success");
        }}
        accent="teal"
      />
      <PrivacyToggle
        icon={<BarChart3 size={18} />}
        title={t("settings.socialPrivacy.showAggregates")}
        desc={showAgg ? t("settings.socialPrivacy.showAggregatesDesc") : t("settings.socialPrivacy.showAggregatesOffDesc")}
        checked={showAgg}
        onChange={(v) => {
          setShowAggregates(v);
          toast(v ? t("settings.socialPrivacy.showAggregatesOn") : t("settings.socialPrivacy.showAggregatesOff"), "success");
        }}
        accent="violet"
      />
      <p className="pt-1 text-[11px] leading-relaxed text-muted/80">
        <Users size={11} className="-mt-0.5 mr-1 inline" />
        {t("settings.socialPrivacy.syncReminder")}
      </p>
    </div>
  );
}

interface PrivacyToggleProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: "amber" | "teal" | "violet";
}
function PrivacyToggle({ icon, title, desc, checked, onChange, accent = "amber" }: PrivacyToggleProps) {
  const accentBg: Record<string, string> = {
    amber: "bg-amber/15 text-amber-glow",
    teal: "bg-teal-500/15 text-teal-300",
    violet: "bg-violet-500/15 text-violet-300",
  };
  const accentSwitch: Record<string, string> = {
    amber: "bg-amber",
    teal: "bg-teal-500",
    violet: "bg-violet-500",
  };
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", accentBg[accent])}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-cream">{title}</div>
          <div className="text-xs leading-relaxed text-muted">{desc}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={cn(
          "relative h-7 w-12 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors",
          checked ? accentSwitch[accent] : "bg-ink-700",
        )}
      >
        <span className={cn(
          "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )} />
      </button>
    </div>
  );
}

/* ==================== 外观与偏好面板 ==================== */
/* ==================== 全局悬浮窗卡片（外观面板 & 后台保活面板共用） ==================== */
function OverlayTimerCard() {
  const showOverlayTimer = useRecordStore((s) => s.settings.overlayTimer);
  const setShowOverlayTimer = useRecordStore((s) => s.setShowOverlayTimer);

  // 全局悬浮窗权限状态（原生才有；授权页返回后自动刷新）
  const [overlayPerm, setOverlayPerm] = useState<"unknown" | "granted" | "denied">("unknown");
  useEffect(() => {
    if (!overlayAvailable()) return;
    const check = () => {
      void hasOverlayPermission().then((g) => setOverlayPerm(g ? "granted" : "denied"));
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  if (!overlayAvailable()) return null;

  return (
    <section>
      <div className="rounded-xl border border-line bg-ink-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
              <Layers size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-cream">
                {t("floatingTimer.overlayTitle")}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {t("floatingTimer.overlayDesc")}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !showOverlayTimer;
              setShowOverlayTimer(next);
              void syncOverlayTimer();
            }}
            role="switch"
            aria-checked={showOverlayTimer}
            disabled={overlayPerm !== "granted"}
            className={cn(
              "relative h-7 w-12 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors disabled:opacity-40",
              showOverlayTimer ? "bg-amber" : "bg-ink-700",
            )}
          >
            <span className={cn(
              "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              showOverlayTimer ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          {overlayPerm === "granted" ? (
            <span className="flex items-center gap-1.5 text-xs text-teal-300">
              <ShieldCheck size={13} /> {t("floatingTimer.overlayGranted")}
            </span>
          ) : (
            <button
              onClick={() => void requestOverlayPermission()}
              className="flex items-center gap-1.5 rounded-lg border border-amber/40 bg-amber/10 px-3 py-1.5 text-xs text-amber-glow transition hover:bg-amber/20"
            >
              <ShieldAlert size={13} /> {t("floatingTimer.overlayGrant")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function AppearancePanel({
  currentIcon,
  showIconPicker,
  onRequestShowIcon,
  onCurrentIconChange,
}: {
  currentIcon: AppIconType;
  showIconPicker: boolean;
  onRequestShowIcon: (v: boolean) => void;
  onCurrentIconChange?: (icon: AppIconType) => void;
}) {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const customColor = useThemeStore((s) => s.customColor);
  const setCustomColor = useThemeStore((s) => s.setCustomColor);
  const showFloatingTimer = useRecordStore((s) => s.settings.showFloatingTimer);
  const setShowFloatingTimer = useRecordStore((s) => s.setShowFloatingTimer);
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const [switchingIcon, setSwitchingIcon] = useState(false);

  const handleSwitchIcon = async (icon: AppIconType) => {
    if (switchingIcon || icon === currentIcon) return;
    setSwitchingIcon(true);
    try {
      await switchAppIcon(icon);
      onCurrentIconChange?.(icon);
      const label = icon === "mushroom" ? t("profile.mushroomWarrior")
        : icon === "abalone" ? t("profile.abaloneWarrior")
        : t("profile.defaultIcon");
      toast(t("toast.iconSwitched", label), "success");
      onRequestShowIcon(false);
      setTimeout(async () => { await restartApp(); }, 800);
    } catch {
      toast(t("toast.iconSwitchFailed"), "warn");
    } finally { setSwitchingIcon(false); }
  };

  return (
    <div className="space-y-4">
      {/* 主题 */}
      <section>
        <div className="mb-2.5 label-eyebrow flex items-center gap-1.5">
          <Palette size={12} /> {t("profile.appearanceTheme")}
        </div>
        <div className="rounded-xl border border-line bg-ink-900/60 p-4">
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => {
              const active = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                    active ? "border-amber/60 bg-amber/10 text-amber-glow"
                           : "border-line text-muted hover:border-amber/40 hover:text-mist",
                  )}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.swatch }} />
                  {theme.name}
                </button>
              );
            })}
            <button
              onClick={() => setTheme("custom")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                themeId === "custom"
                  ? "border-amber/60 bg-amber/10 text-amber-glow"
                  : "border-line text-muted hover:border-amber/40 hover:text-mist",
              )}
            >
              <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: customColor }} />
              {t("profile.customColor")}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label
              className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-line"
              style={{ backgroundColor: customColor }}
            >
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                let v = e.target.value.trim();
                if (v && !v.startsWith("#")) v = "#" + v;
                if (/^#?[0-9a-fA-F]{0,6}$/.test(v.replace("#", ""))) setCustomColor(v);
              }}
              maxLength={7}
              placeholder="#E8A87C"
              className="w-24 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 font-mono text-xs text-amber-glow outline-none focus:border-amber/50"
            />
            <span className="text-[11px] text-muted">{t("profile.customColorPlaceholder")}</span>
          </div>
        </div>
      </section>

      {/* 应用图标 */}
      <section>
        <div className="rounded-xl border border-line bg-ink-900/60 p-4">
          <button
            onClick={() => onRequestShowIcon(!showIconPicker)}
            className="flex w-full items-start gap-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
              <ImageIcon size={18} />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-cream">
                {t("profile.appIcon")} <Sparkles size={12} className="text-amber-glow" />
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {t("app.name")} {t("common.current")}：{
                  currentIcon === "mushroom" ? t("profile.mushroomWarrior")
                  : currentIcon === "abalone" ? t("profile.abaloneWarrior")
                  : t("profile.defaultIcon")
                }
                {!Capacitor.isNativePlatform() && t("profile.iconNativeOnly")}
              </div>
            </div>
            <ChevronDown up={showIconPicker} />
          </button>

          {showIconPicker && (
            <div className="animate-fadeIn mt-4 grid grid-cols-3 gap-3">
              {(["mushroom", "abalone", "default"] as AppIconType[]).map((ic) => {
                const selected = currentIcon === ic;
                const previewSrc = ic === "mushroom" ? "/avatars/mushroom-warrior.jpg"
                  : ic === "abalone" ? "/avatars/oyster-warrior.png"
                  : "/icon-preview-classic-512.jpg";
                const label = ic === "mushroom" ? t("profile.mushroomWarrior")
                  : ic === "abalone" ? t("profile.abaloneWarrior")
                  : t("profile.defaultIcon");
                return (
                  <button
                    key={ic}
                    onClick={() => void handleSwitchIcon(ic)}
                    disabled={switchingIcon || selected}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                      selected ? "border-amber bg-amber/10" : "border-line bg-ink-800 hover:border-amber/40",
                      switchingIcon && "opacity-50 pointer-events-none",
                    )}
                  >
                    <img
                      src={previewSrc}
                      alt={label}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div className="text-center text-[13px] font-medium leading-tight text-cream">
                      {label}
                    </div>
                    {selected && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-glow">
                        <Check size={11} /> {t("profile.currentlyUsing")}
                      </div>
                    )}
                  </button>
                );
              })}
              <p className="col-span-3 text-center text-xs text-muted">
                {t("profile.iconSwitchRestart")}
              </p>
              {switchingIcon && (
                <div className="col-span-3 flex items-center justify-center gap-2 text-sm text-amber-glow">
                  <Loader2 size={14} className="animate-spin" /> {t("profile.iconSwitching")}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 浮动计时开关 */}
      <section>
        <div className="rounded-xl border border-line bg-ink-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
                <Timer size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-cream">{t("profile.floatingTimer")}</div>
                <div className="mt-0.5 text-xs text-muted">{t("profile.floatingTimerDesc")}</div>
              </div>
            </div>
            <button
              onClick={() => setShowFloatingTimer(!showFloatingTimer)}
              role="switch"
              aria-checked={showFloatingTimer}
              className={cn(
                "relative h-7 w-12 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors",
                showFloatingTimer ? "bg-amber" : "bg-ink-700",
              )}
            >
              <span className={cn(
                "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                showFloatingTimer ? "translate-x-5" : "translate-x-0",
              )} />
            </button>
          </div>
        </div>
      </section>

      {/* 全局悬浮窗（应用外显示计时胶囊，仅原生） */}
      <OverlayTimerCard />

      {/* 语言 */}
      <section>
        <div className="rounded-xl border border-line bg-ink-900/60 p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
              <Globe size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-cream">{t("settings.language.label")}</div>
              <div className="mt-0.5 text-xs text-muted">{t("settings.language.desc")}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LOCALES.map((opt) => {
              const selected = locale === opt.code;
              return (
                <button
                  key={opt.code}
                  onClick={() => setLocale(opt.code)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all",
                    selected
                      ? "border-amber/60 bg-amber/10 text-amber-glow"
                      : "border-line bg-ink-800/40 text-mist hover:border-amber/30 hover:text-cream",
                  )}
                >
                  <span className="text-base font-semibold">{opt.nativeName}</span>
                  <span className="text-[10px] text-muted/80">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ChevronDown({ up }: { up: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={cn("transition-transform text-muted", up && "rotate-180")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ==================== 后台保活面板 ==================== */
function KeepAlivePanel() {
  const [ignored, setIgnored] = useState<boolean>(false);
  const [busy, setBusy] = useState<"none" | "request" | "status">("none");

  const refreshStatus = async () => {
    setBusy("status");
    try {
      const {
        checkKeepAliveStatus,
      } = await import("@/lib/keepAlive");
      const s = await checkKeepAliveStatus();
      setIgnored(s.ignored);
    } finally {
      setBusy("none");
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const onRequest = async () => {
    if (busy !== "none") return;
    setBusy("request");
    try {
      const {
        requestIgnoreBatteryOptimizations,
      } = await import("@/lib/keepAlive");
      const r = await requestIgnoreBatteryOptimizations();
      if (r.ignored) {
        setIgnored(true);
        toast(t("keepalive.alreadyEnabled"), "success");
      } else if (r.opened) {
        toast(t("keepalive.dialogOpened"), "default");
        // 2s 后重新检查一次状态
        setTimeout(() => void refreshStatus(), 2200);
      } else {
        toast(t("keepalive.fallbackToAppInfo"), "warn");
      }
    } finally {
      setBusy("none");
    }
  };

  const onOpenAppInfo = async () => {
    const { openAppInfo } = await import("@/lib/keepAlive");
    const ok = await openAppInfo();
    if (!ok) toast(t("keepalive.openFailed"), "warn");
  };

  const onOpenBatteryList = async () => {
    const { openBatteryOptimizationSettings } = await import("@/lib/keepAlive");
    const ok = await openBatteryOptimizationSettings();
    if (!ok) toast(t("keepalive.openFailed"), "warn");
  };

  return (
    <div className="space-y-4">
      {/* 全局悬浮窗（应用外计时，与后台运行强相关） */}
      <OverlayTimerCard />

      <div className="mb-2.5 label-eyebrow flex items-center gap-1.5">
        <ShieldAlert size={12} className="text-orange-400" /> {t("keepalive.title")}
      </div>

      {/* 状态卡片 */}
      <div className={cn(
        "rounded-2xl border p-4",
        ignored
          ? "border-emerald-400/40 bg-emerald-400/5"
          : "border-orange-400/40 bg-orange-400/5",
      )}>
        <div className="flex items-start gap-3">
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            ignored ? "bg-emerald-400/15 text-emerald-300" : "bg-orange-400/15 text-orange-300",
          )}>
            {ignored ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-cream">
              {ignored ? t("keepalive.statusEnabled") : t("keepalive.statusDisabled")}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted">
              {ignored
                ? t("keepalive.statusEnabledHint")
                : t("keepalive.statusDisabledHint")}
            </div>
          </div>
          {busy === "status" && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
      </div>

      {/* 操作按钮组 */}
      <div className="space-y-2">
        <button
          onClick={onRequest}
          disabled={busy !== "none"}
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-sm font-medium text-cream transition-all",
            "bg-amber text-ink-950 hover:bg-amber/90",
            busy !== "none" && "opacity-60 pointer-events-none",
          )}
        >
          {busy === "request" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> {t("keepalive.requesting")}
            </span>
          ) : (
            t("keepalive.requestButton")
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenAppInfo}
            className="rounded-xl border border-line bg-ink-800 px-4 py-3 text-sm font-medium text-cream hover:border-amber/40"
          >
            {t("keepalive.openAppInfo")}
          </button>
          <button
            onClick={onOpenBatteryList}
            className="rounded-xl border border-line bg-ink-800 px-4 py-3 text-sm font-medium text-cream hover:border-amber/40"
          >
            {t("keepalive.openBatteryList")}
          </button>
        </div>
      </div>

      {/* 国内 ROM 手动设置指引 */}
      <div className="rounded-2xl border border-line bg-ink-900/60 p-4 space-y-2 text-xs leading-relaxed text-muted">
        <div className="text-sm font-medium text-cream">{t("keepalive.romGuideTitle")}</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("keepalive.romGuide1")}</li>
          <li>{t("keepalive.romGuide2")}</li>
          <li>{t("keepalive.romGuide3")}</li>
          <li>{t("keepalive.romGuide4")}</li>
        </ul>
        <div className="pt-2 text-[11px] text-muted/80">
          {t("keepalive.romGuideNote")}
        </div>
      </div>
    </div>
  );
}

/* ==================== 关于面板 ==================== */
function AboutPanel() {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-ink-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted">{t("settings.about.currentVersion")}</span>
          <span className="font-mono text-xs text-amber-glow">v{APP_VERSION}</span>
        </div>
        <button
          onClick={async () => {
            if (checkingUpdate) return;
            setCheckingUpdate(true);
            const { hasUpdate, info } = await checkUpdate();
            if (hasUpdate && info) setUpdateInfo(info);
            else toast(t("settings.about.isLatest"), "success");
            setCheckingUpdate(false);
          }}
          disabled={checkingUpdate}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow disabled:opacity-60"
        >
          <RefreshCw size={15} className={checkingUpdate ? "animate-spin" : ""} />
          {checkingUpdate ? t("settings.about.checking") : t("settings.about.checkUpdate")}
        </button>
      </div>
      {updateInfo && (
        <UpdateDialog info={updateInfo} onClose={() => setUpdateInfo(null)} />
      )}
    </div>
  );
}

function UpdateDialog({ info, onClose }: { info: VersionInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-amber-glow">
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-base font-medium text-cream">{t("settings.about.hasNewVersion")}</h3>
            <p className="text-xs text-muted">v{info.version}</p>
          </div>
        </div>
        {info.notes && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-line bg-ink-800/60 p-3 text-xs leading-relaxed text-mist whitespace-pre-wrap">
            {info.notes}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-line bg-ink-800 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => {
              const target = Capacitor.isNativePlatform() ? "_system" : "_blank";
              window.open(info.apkUrl, target, "noopener,noreferrer");
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 transition-colors hover:bg-amber-glow"
          >
            <Download size={15} />
            {t("settings.about.downloadUpdate")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== 支持作者面板 ==================== */
function SupportPanel() {
  return (
    <div className="rounded-xl border border-amber/20 bg-amber/5 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber-glow">
          <Heart size={18} />
        </span>
        <div>
          <div className="text-sm font-medium text-cream">{t("settings.supportAuthor.title")}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted">
            {t("settings.supportAuthor.desc")}
          </div>
        </div>
      </div>
      <DonateSheet />
    </div>
  );
}

/* ==================== 密码锁面板 ==================== */
type PinStage = "idle" | "create" | "change" | "disable";
function PasswordPanel() {
  const lock = useRecordStore((s) => s.settings.lock);
  const setLock = useRecordStore((s) => s.setLock);

  const [stage, setStage] = useState<PinStage>("idle");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasPin = !!lock.passwordHash;
  const pending = stage !== "idle";

  const resetInputs = () => {
    setOldPin("");
    setNewPin("");
    setNewPin2("");
  };

  const toggleEnabled = async () => {
    if (pending) {
      setStage("idle");
      resetInputs();
      return;
    }
    if (!lock.enabled) {
      if (!hasPin) {
        setStage("create");
        return;
      }
      setLock({ enabled: true });
      toast(t("settings.passwordLock.enabledToast"), "success");
    } else {
      setStage("disable");
    }
  };

  const startChange = () => setStage("change");

  const commitCreate = async () => {
    if (busy) return;
    if (!isValidPin(newPin)) {
      toast(t("settings.passwordLock.setNewHint"), "warn");
      return;
    }
    if (newPin !== newPin2) {
      toast(t("settings.passwordLock.notMatch"), "warn");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(newPin);
      setLock({ passwordHash: hash, enabled: true });
      toast(t("common.done"), "success");
      setStage("idle");
      setNewPin("");
      setNewPin2("");
    } finally {
      setBusy(false);
    }
  };

  const commitChange = async () => {
    if (busy) return;
    if (!isValidPin(oldPin) || !isValidPin(newPin)) {
      toast(t("settings.passwordLock.setNewHint"), "warn");
      return;
    }
    if (newPin !== newPin2) {
      toast(t("settings.passwordLock.newNotMatch"), "warn");
      return;
    }
    setBusy(true);
    try {
      const oldHash = await sha256Hex(oldPin);
      if (oldHash !== lock.passwordHash) {
        toast(t("settings.passwordLock.oldPasswordWrong"), "warn");
        return;
      }
      const newHash = await sha256Hex(newPin);
      setLock({ passwordHash: newHash });
      toast(t("common.done"), "success");
      setStage("idle");
      setOldPin("");
      setNewPin("");
      setNewPin2("");
    } finally {
      setBusy(false);
    }
  };

  const commitDisable = async () => {
    if (busy) return;
    if (!isValidPin(oldPin)) {
      toast(t("settings.passwordLock.enterToDisable"), "warn");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(oldPin);
      if (hash !== lock.passwordHash) {
        toast(t("settings.passwordLock.passwordWrong"), "warn");
        return;
      }
      setLock({ enabled: false, passwordHash: undefined });
      toast(t("common.done"), "success");
      setStage("idle");
      setOldPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              lock.enabled ? "bg-amber/20 text-amber-glow" : "bg-ink-800 text-muted",
            )}
          >
            {lock.enabled ? <LockKeyhole size={18} /> : <Lock size={18} />}
          </div>
          <div>
            <div className="text-sm text-cream">{t("settings.passwordLock.title")}</div>
            <div className="text-xs text-muted">
              {lock.enabled ? t("settings.passwordLock.desc") : t("settings.passwordLock.notEnabled")}
            </div>
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          role="switch"
          aria-checked={lock.enabled || pending}
          className={cn(
            "relative h-7 w-12 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors",
            pending
              ? "animate-pulse bg-amber/50"
              : lock.enabled
                ? "bg-amber"
                : "bg-ink-700",
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              lock.enabled || pending ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {stage === "create" && (
        <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
          <p className="text-xs text-muted">{t("settings.passwordLock.setNewHint")}</p>
          <PinRow label={t("settings.passwordLock.newPassword")} value={newPin} onChange={setNewPin} show={showNew} onToggle={() => setShowNew((v) => !v)} />
          <PinRow
            label={t("settings.passwordLock.confirmPassword")}
            value={newPin2}
            onChange={setNewPin2}
            show={showNew2}
            onToggle={() => setShowNew2((v) => !v)}
            mismatch={newPin2.length > 0 && newPin !== newPin2}
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setStage("idle"); setNewPin(""); setNewPin2(""); }}
              className="flex-1 rounded-full border border-line px-4 py-2 text-sm text-mist hover:bg-ink-800"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => void commitCreate()}
              disabled={busy}
              className="flex-1 rounded-full bg-amber px-4 py-2 text-sm text-ink-950 hover:bg-amber-glow disabled:opacity-60"
            >
              {busy ? t("settings.passwordLock.setting") : t("settings.passwordLock.done")}
            </button>
          </div>
        </div>
      )}

      {stage === "change" && (
        <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
          <PinRow label={t("settings.passwordLock.oldPassword")} value={oldPin} onChange={setOldPin} show={showOld} onToggle={() => setShowOld((v) => !v)} />
          <PinRow label={t("settings.passwordLock.newPassword2")} value={newPin} onChange={setNewPin} show={showNew} onToggle={() => setShowNew((v) => !v)} />
          <PinRow
            label={t("settings.passwordLock.confirmPassword")}
            value={newPin2}
            onChange={setNewPin2}
            show={showNew2}
            onToggle={() => setShowNew2((v) => !v)}
            mismatch={newPin2.length > 0 && newPin !== newPin2}
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setStage("idle"); setOldPin(""); setNewPin(""); setNewPin2(""); }}
              className="flex-1 rounded-full border border-line px-4 py-2 text-sm text-mist hover:bg-ink-800"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => void commitChange()}
              disabled={busy}
              className="flex-1 rounded-full bg-amber px-4 py-2 text-sm text-ink-950 hover:bg-amber-glow disabled:opacity-60"
            >
              {busy ? t("settings.passwordLock.submitting") : t("settings.passwordLock.modify")}
            </button>
          </div>
        </div>
      )}

      {stage === "disable" && (
        <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
          <p className="text-xs text-muted">{t("settings.passwordLock.enterToDisable")}</p>
          <PinRow label={t("settings.passwordLock.currentPassword")} value={oldPin} onChange={setOldPin} show={showOld} onToggle={() => setShowOld((v) => !v)} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setStage("idle"); setOldPin(""); }}
              className="flex-1 rounded-full border border-line px-4 py-2 text-sm text-mist hover:bg-ink-800"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => void commitDisable()}
              disabled={busy}
              className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
            >
              {busy ? t("settings.passwordLock.verifying") : t("settings.passwordLock.confirmDisable")}
            </button>
          </div>
        </div>
      )}

      {stage === "idle" && hasPin && (
        <button
          onClick={startChange}
          className="mt-3 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs text-mist hover:border-amber/40 hover:text-amber-glow"
        >
          <Pencil size={13} />
          {t("settings.passwordLock.modifyTitle")}
        </button>
      )}
    </section>
  );
}

interface PinRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  mismatch?: boolean;
}
function PinRow({ label, value, onChange, show, onToggle, mismatch }: PinRowProps) {
  return (
    <div className="shrink-0">
      <label className="flex items-center gap-3 py-1">
        <span className="w-16 shrink-0 text-xs leading-5 text-muted">{label}</span>
        <div className="relative flex-1">
          <input
            type={show ? "tel" : "password"}
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 8);
              onChange(v);
            }}
            maxLength={8}
            placeholder={t("settings.passwordLock.pinPlaceholder")}
            className={cn(
              // h-9 固定高度 + leading-6 + text-sm → 中文下延不会被切；min-h-0 min-w-0 防 flex 挤压
              "h-9 w-full rounded-lg border bg-ink-800 px-3 pr-9 font-mono text-sm leading-6 text-amber-glow outline-none transition-colors min-h-0 min-w-0",
              mismatch
                ? "border-red-500/70 focus:border-red-400"
                : "border-line focus:border-amber/50",
            )}
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/70 hover:text-amber-glow"
            aria-label={show ? t("lockGate.hidePassword") : t("lockGate.showPassword")}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {mismatch ? (
          <X size={15} className="h-4 w-4 shrink-0 text-red-400" />
        ) : (
          <Check size={15} className={cn("h-4 w-4 shrink-0", value.length >= 4 ? "text-amber-glow" : "text-transparent")} />
        )}
      </label>
      {mismatch && (
        <p className="ml-[4.75rem] mt-1 text-[11px] text-red-300/90">{t("settings.passwordLock.notMatch")}</p>
      )}
    </div>
  );
}

/* ==================== 通用小确认弹窗 ==================== */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-6" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-base font-medium text-cream">{title}</h3>
        <p className="mb-5 text-sm leading-relaxed text-muted">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-line bg-ink-800 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 transition-colors hover:bg-amber-glow"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
