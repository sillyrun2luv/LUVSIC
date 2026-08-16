import { useEffect, useRef, useState } from "react";
import {
  X,
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
  Sparkles,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
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
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";
import type { AppIconType } from "@/lib/iconSwitch";
import { switchAppIcon, getCurrentAppIcon, restartApp } from "@/lib/iconSwitch";
import ReminderSettings from "@/components/ReminderSettings";
import DonateSheet from "@/components/DonateSheet";

/* ==================== 通用底部 Sheet 容器 ==================== */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeDisabled?: boolean;
  maxH?: string;
}
function Sheet({ open, onClose, title, children, closeDisabled, maxH = "max-h-[82vh]" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, closeDisabled]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={!closeDisabled ? onClose : undefined}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-slideInUp rounded-t-3xl border-t border-line/80 bg-ink-900 pb-10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink-900/95 px-5 py-4">
          <h3 className="font-display text-lg text-cream">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-mist"
            disabled={closeDisabled}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>
        <div className={cn("space-y-5 overflow-y-auto p-5", maxH)}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ==================== 云同步 Sheet ==================== */
export function CloudSyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    if (!open) return;
    startAutoSync();
    return onAutoSyncStatusChange(setAutoStatus);
  }, [open]);

  const refreshCloudCount = async () => {
    if (!user) return;
    const n = await getCloudRecordCount(user.id);
    setCloudCount(n);
  };
  useEffect(() => {
    if (session && user) void refreshCloudCount();
  }, [session, user?.id, open]);

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

  let body: React.ReactNode;
  if (!session || !user) {
    body = (
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
          onClick={() => { onClose(); openAuth(); }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <Cloud size={15} />
          {t("auth.loginOrRegister")}
        </button>
      </div>
    );
  } else {
    body = (
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

  return (
    <Sheet open={open} onClose={onClose} title={t("settings.cloudSync.title")}>
      {body}
    </Sheet>
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

/* ==================== 数据备份 Sheet ==================== */
export function DataBackupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <Sheet open={open} onClose={onClose} title={t("settings.dataExport.title")}>
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
    </Sheet>
  );
}

/* ==================== 社交隐私 Sheet ==================== */
export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const searchable = useProfileStore((s) => s.searchable);
  const showAgg = useProfileStore((s) => s.showAggregatesToFriends);
  const setSearchable = useProfileStore((s) => s.setSearchable);
  const setShowAggregates = useProfileStore((s) => s.setShowAggregatesToFriends);
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const openAuth = useUIStore((s) => s.openAuth);

  if (!isLoggedIn) {
    return (
      <Sheet open={open} onClose={onClose} title={t("settings.socialPrivacy.title")}>
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
            onClick={() => { onClose(); openAuth(); }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-amber-glow transition-colors hover:bg-amber/20"
          >
            {t("auth.loginOrRegister")}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("settings.socialPrivacy.title")}>
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
    </Sheet>
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

/* ==================== 外观与偏好 Sheet (主题/图标/浮动计时/语言) ==================== */
export function AppearanceSheet({
  open,
  onClose,
  currentIcon,
  showIconPicker,
  onRequestShowIcon,
  onGotoOtherAppearancePanel,
}: {
  open: boolean;
  onClose: () => void;
  currentIcon: AppIconType;
  showIconPicker: boolean;
  onRequestShowIcon: (v: boolean) => void;
  onGotoOtherAppearancePanel?: () => void;
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
      toast(t("toast.iconSwitched", icon === "mushroom" ? t("profile.mushroomWarrior") : t("profile.abaloneWarrior")), "success");
      onRequestShowIcon(false);
      setTimeout(async () => { await restartApp(); }, 800);
    } catch {
      toast(t("toast.iconSwitchFailed"), "warn");
    } finally { setSwitchingIcon(false); }
  };

  // 刷新当前图标设置
  useEffect(() => {
    if (open) void getCurrentAppIcon();
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={t("profile.appearanceTheme")} closeDisabled={switchingIcon}>
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
            onClick={() => {
              onRequestShowIcon(false);
              onGotoOtherAppearancePanel?.();
            }}
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
              <div className="mt-1 text-[11px] text-amber-glow/70">
                → {t("profile.defaultIcon")} {t("common.plus")} {t("profile.mushroomWarrior")} {t("common.plus")} {t("profile.abaloneWarrior")}
              </div>
            </div>
            <ChevronRight className="mt-1 text-muted" size={18} />
          </button>
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
    </Sheet>
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

/* ==================== 关于 Sheet ==================== */
export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.about.title")}>
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
    </Sheet>
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

/* ==================== 支持作者 Sheet ==================== */
export function SupportAuthorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.supportAuthor.title")}>
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
    </Sheet>
  );
}

/* ==================== 提醒设置 Sheet (包装 ReminderSettings) ==================== */
export function ReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t("reminder.title")}>
      <ReminderSettings />
    </Sheet>
  );
}

/* ==================== 通用小确认弹窗 ==================== */
export function ConfirmDialog({
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
