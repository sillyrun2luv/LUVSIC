import { useEffect, useState, useRef } from "react";
import {
  X,
  Lock,
  LockKeyhole,
  Pencil,
  Check,
  FileSpreadsheet,
  FileJson,
  Eye,
  EyeOff,
  Cloud,
  RefreshCw,
  Download,
  Users,
  Search,
  BarChart3,
  Upload,
  Globe,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
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
import { Capacitor } from "@capacitor/core";
import DonateSheet from "@/components/DonateSheet";
import { cn, isValidPin, sha256Hex } from "@/lib/utils";
import { t, useI18nStore, LOCALES, type LocaleCode } from "@/store/useI18nStore";

/**
 * 三步设置密码：
 *  1. create 从未设过 → 输入新密码 + 确认新密码
 *  2. change 已设过 → 输入旧密码 + 新密码 + 确认新密码
 *  3. disable 关闭密码锁 → 校验一次旧密码
 */
type PinStage = "idle" | "create" | "change" | "disable";

export default function SettingsSheet() {
  const open = useUIStore((s) => s.settingsOpen);
  const close = useUIStore((s) => s.closeSettings);

  const lock = useRecordStore((s) => s.settings.lock);
  const setLock = useRecordStore((s) => s.setLock);
  const records = useRecordStore((s) => s.records);

  // 社交隐私
  const searchable = useProfileStore((s) => s.searchable);
  const showAgg = useProfileStore((s) => s.showAggregatesToFriends);
  const setSearchable = useProfileStore((s) => s.setSearchable);
  const setShowAggregates = useProfileStore((s) => s.setShowAggregatesToFriends);

  // 语言
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  // 本地改动的 privacy 是否需要「点同步到云端」提示（和上传到云端一起），这里不拦截，
  // 用户下次按「上传到云端」就会自然同步。操作时给个提示即可。

  const [stage, setStage] = useState<PinStage>("idle");

  // 输入状态
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importData = useRecordStore((s) => s.importData);
  const clearAll = useRecordStore((s) => s.clearAll);

  useEffect(() => {
    if (!open) {
      setStage("idle");
      setOldPin("");
      setNewPin("");
      setNewPin2("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const hasPin = !!lock.passwordHash;
  const pending = stage !== "idle";

  const resetInputs = () => {
    setOldPin("");
    setNewPin("");
    setNewPin2("");
  };

  const toggleEnabled = async () => {
    // 正在某个流程中时，再点开关 = 取消还原
    if (pending) {
      setStage("idle");
      resetInputs();
      return;
    }
    if (!lock.enabled) {
      // 打开密码锁：若还没设密码，进入 create；已设过则直接开启
      if (!hasPin) {
        setStage("create");
        return;
      }
      setLock({ enabled: true });
      toast("密码锁已开启", "success");
    } else {
      // 关闭：需要输入旧密码验证
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
        toast(t("settings.passwordLock.oldPasswordWrong", "原密码错误"), "warn");
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
        toast(t("settings.passwordLock.passwordWrong", "密码错误"), "warn");
        return;
      }
      // 关闭并清除密码
      setLock({ enabled: false, passwordHash: undefined });
      toast(t("common.done"), "success");
      setStage("idle");
      setOldPin("");
    } finally {
      setBusy(false);
    }
  };

  const handleExportXls = async () => {
    if (records.length === 0) {
      toast(t("settings.dataExport.noRecordsToExport"), "warn");
      return;
    }
    try {
      await exportRecordsXls(records);
      toast(t("settings.dataExport.exportSuccess"), "success");
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
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
    // 重置 input，允许重复选同一文件
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={stage === "idle" ? close : undefined}
      />
      <aside className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm animate-slideInLeft flex-col border-l border-line/80 bg-ink-900/95 backdrop-blur-md"
           style={{ animationName: "slideInRight" }}>
        {/* 头 */}
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
          <h3 className="font-display text-xl text-cream">{t("settings.title")}</h3>
          <button
            onClick={close}
            className="text-muted hover:text-mist"
            aria-label={t("settings.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-7">
          {/* 密码锁 */}
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
                aria-label={pending ? t("settings.passwordLock.cancelAction") : lock.enabled ? t("settings.passwordLock.disable") : t("settings.passwordLock.enable")}
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

            {/* 折叠：设置 / 修改 / 关闭密码流程 */}
            {stage === "create" && (
              <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
                <p className="text-xs text-muted">
                  {t("settings.passwordLock.setNewHint")}
                </p>
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

            {/* 已设密码时展示「修改密码」 */}
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

          {/* 云同步 */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.cloudSync.title")}</div>
            <CloudSyncCard />
          </section>

          {/* 数据导出（Excel + JSON） */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.dataExport.title")}</div>
            <div className="rounded-xl border border-line bg-ink-900/60 p-4">
              <p className="mb-3 text-xs leading-relaxed text-muted">
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
              <p className="mt-3 text-[11px] text-muted/80">
                {t("settings.dataExport.exportableCount", records.length)}
              </p>
            </div>
          </section>

          {/* 社交隐私 */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.socialPrivacy.title")}</div>
            <div className="space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
              <PrivacyToggle
                icon={<Search size={18} />}
                title={t("settings.socialPrivacy.searchable")}
                desc={
                  searchable
                    ? t("settings.socialPrivacy.searchableDesc")
                    : t("settings.socialPrivacy.searchableOffDesc")
                }
                checked={searchable}
                onChange={(v) => {
                  setSearchable(v);
                  toast(v ? t("settings.socialPrivacy.searchableOn", "已允许被搜索") : t("settings.socialPrivacy.searchableOff", "已关闭被搜索"), "success");
                }}
                accent="teal"
              />
              <PrivacyToggle
                icon={<BarChart3 size={18} />}
                title={t("settings.socialPrivacy.showAggregates")}
                desc={
                  showAgg
                    ? t("settings.socialPrivacy.showAggregatesDesc")
                    : t("settings.socialPrivacy.showAggregatesOffDesc")
                }
                checked={showAgg}
                onChange={(v) => {
                  setShowAggregates(v);
                  toast(v ? t("settings.socialPrivacy.showAggregatesOn", "已允许好友查看统计") : t("settings.socialPrivacy.showAggregatesOff", "已隐藏统计概览"), "success");
                }}
                accent="violet"
              />
              <p className="pt-1 text-[11px] leading-relaxed text-muted/80">
                <Users size={11} className="-mt-0.5 mr-1 inline" />
                {t("settings.socialPrivacy.syncReminder")}
              </p>
            </div>
          </section>

          {/* 语言 · Language */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.language.title")}</div>
            <div className="rounded-xl border border-line bg-ink-900/60 p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-mist">
                  <Globe size={18} />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-cream">
                    {t("settings.language.label")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t("settings.language.desc")}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LOCALES.map((opt) => {
                  const selected = locale === opt.code;
                  return (
                    <button
                      key={opt.code}
                      onClick={() => {
                        setLocale(opt.code);
                      }}
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

          {/* 赞赏 */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.supportAuthor.title")}</div>
            <div className="rounded-xl border border-amber/20 bg-amber/5 p-4">
              <p className="mb-3 text-xs leading-relaxed text-muted">
                {t("settings.supportAuthor.desc")}
              </p>
              <DonateSheet />
            </div>
          </section>

          {/* 关于 · 更新 */}
          <section>
            <div className="label-eyebrow mb-2.5">{t("settings.about.title")}</div>
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
                  if (hasUpdate && info) {
                    setUpdateInfo(info);
                  } else {
                    toast(t("settings.about.isLatest"), "success");
                  }
                  setCheckingUpdate(false);
                }}
                disabled={checkingUpdate}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow disabled:opacity-60"
              >
                <RefreshCw size={15} className={checkingUpdate ? "animate-spin" : ""} />
                {checkingUpdate ? t("settings.about.checking") : t("settings.about.checkUpdate")}
              </button>
            </div>
          </section>
        </div>

        {/* 底部版权样式 */}
        <div className="border-t border-line/60 p-4">
          <p className="font-display text-sm text-muted">{t("app.name")}</p>
          <p className="text-[11px] text-muted/70">{t("app.subtitle")}</p>
        </div>
      </aside>

      {updateInfo && (
        <UpdateDialog info={updateInfo} onClose={() => setUpdateInfo(null)} />
      )}
    </div>
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
    <div>
      <label className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
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
              "w-full rounded-lg border bg-ink-800 px-3 py-2 pr-9 font-mono text-amber-glow outline-none transition-colors",
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
          <X size={15} className="w-4 shrink-0 text-red-400" />
        ) : (
          <Check size={15} className={cn("w-4 shrink-0", value.length >= 4 ? "text-amber-glow" : "text-transparent")} />
        )}
      </label>
      {mismatch && (
        <p className="ml-[4.75rem] mt-1 text-[11px] text-red-300/90">{t("settings.passwordLock.notMatch")}</p>
      )}
    </div>
  );
}

/** 隐私开关行（复用密码锁的 switch 样式） */
interface PrivacyToggleProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: "amber" | "teal" | "violet";
}
export function PrivacyToggle({ icon, title, desc, checked, onChange, accent = "amber" }: PrivacyToggleProps) {
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
        <div className="min-w-0">
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
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

/** 更新弹窗 */
function UpdateDialog({
  info,
  onClose,
}: {
  info: VersionInfo;
  onClose: () => void;
}) {
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
              // APK 环境：用系统浏览器打开，避免 WebView 内部加载 GitHub 下载链接时 404
              // 浏览器环境：新标签页打开
              const target = Capacitor.isNativePlatform() ? "_system" : "_blank";
              window.open(info.apkUrl, target, "noopener,noreferrer");
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 transition-colors hover:bg-amber-glow"
          >
            <Download size={15} />
            {t("settings.about.downloadUpdate", "下载更新")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 确认弹窗 */
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

/** 云同步卡片：未登录 → 登录按钮；已登录 → 上传/下载按钮 */
export function CloudSyncCard() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const openAuth = useUIStore((s) => s.openAuth);
  const [confirm, setConfirm] = useState<"upload" | "download" | "logout" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const records = useRecordStore((s) => s.records);
  const [autoStatus, setAutoStatus] = useState<AutoSyncStatus>(getAutoSyncStatus());

  // 监听自动同步状态变化
  useEffect(() => {
    startAutoSync();
    return onAutoSyncStatusChange(setAutoStatus);
  }, []);

  // 登录后 / 操作完成后刷新云端记录数
  const refreshCloudCount = async () => {
    if (!user) return;
    const n = await getCloudRecordCount(user.id);
    setCloudCount(n);
  };

  useEffect(() => {
    if (session && user) {
      refreshCloudCount();
    }
  }, [session, user?.id]);

  if (!session || !user) {
    return (
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
            <Cloud size={18} />
          </div>
          <div>
            <div className="text-sm text-cream">{t("settings.cloudSync.notLoggedIn", "云端账户")}</div>
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

  const doUpload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await uploadToCloud(user.id);
      toast(t("settings.cloudSync.uploadSuccess"), "success", undo ? { label: t("common.undo"), onAction: async () => {
        await undo();
        toast(t("settings.cloudSync.uploadUndone", "已撤销上传"), "success");
        refreshCloudCount();
      } } : undefined);
      refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || t("settings.cloudSync.uploadFailed", "上传失败"), "warn");
    } finally {
      setLoading(false);
    }
  };

  const doDownload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await downloadFromCloud(user.id);
      toast(t("settings.cloudSync.downloadSuccess"), "success", undo ? { label: t("common.undo"), onAction: () => {
        undo();
        toast(t("settings.cloudSync.downloadUndone", "已撤销下载"), "success");
        refreshCloudCount();
      } } : undefined);
      refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || t("settings.cloudSync.downloadFailed", "下载失败"), "warn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
              {t("settings.cloudSync.connected", "已连接云端")}
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
          <span>{t("settings.cloudSync.localCount", "本地 {0} 条记录", records.length)}</span>
          <span>{t("settings.cloudSync.cloudCount", "云端 {0} 条", cloudCount !== null ? cloudCount : 0)}</span>
        </div>
        <div className="mb-3 rounded-xl border border-dashed border-emerald-500/25 bg-emerald-500/5 p-2.5">
          <div className="flex items-center gap-2 text-[11px] text-emerald-200/90">
            <RefreshCw size={12} />
            <span>{t("settings.cloudSync.autoSyncHint", "修改记录 / 设置 / 资料后 1.5 秒自动同步到云端")}</span>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => triggerAutoSync({ full: false })}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
          >
            <RefreshCw size={14} />
            {loading ? t("common.processing") : t("settings.cloudSync.syncIncremental", "立即同步（增量）")}
          </button>
          <button
            onClick={() => setConfirm("upload")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
          >
            {loading ? t("common.processing") : t("settings.cloudSync.forceUpload", "强制覆盖上传")}
          </button>
          <button
            onClick={() => setConfirm("download")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
          >
            {loading ? t("common.processing") : t("settings.cloudSync.downloadFromCloud", "从云端下载")}
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
          title={t("settings.cloudSync.uploadTitle", "上传到云端")}
          message={t("settings.cloudSync.uploadMessage", "将用本地数据覆盖云端所有记录。云端原有数据会被替换，5 秒内可撤销。")}
          confirmLabel={t("settings.cloudSync.confirmUpload", "确认上传")}
          onConfirm={doUpload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "download" && (
        <ConfirmDialog
          title={t("settings.cloudSync.downloadTitle", "从云端下载")}
          message={t("settings.cloudSync.downloadMessage", "将用云端数据覆盖本地所有记录。本地原有数据会被替换，5 秒内可撤销。")}
          confirmLabel={t("settings.cloudSync.confirmDownload", "确认下载")}
          onConfirm={doDownload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "logout" && (
        <ConfirmDialog
          title={t("settings.cloudSync.logoutTitle", "退出登录")}
          message={t("settings.cloudSync.logoutMessage", "确定要退出云端账户吗？本地数据不会被删除。")}
          confirmLabel={t("settings.auth.logout")}
          onConfirm={async () => {
            setConfirm(null);
            await signOut();
            toast(t("auth.logoutSuccess"), "success");
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function AutoStatusBadge({ status }: { status: AutoSyncStatus }) {
  const cfg: Record<AutoSyncStatus, { text: string; cls: string }> = {
    idle:    { text: t("settings.cloudSync.idle", "空闲"),    cls: "bg-ink-800 text-muted ring-1 ring-line/60" },
    waiting: { text: t("settings.cloudSync.waiting"),  cls: "bg-amber/15 text-amber-glow ring-1 ring-amber/30" },
    syncing: { text: t("settings.cloudSync.syncing"),  cls: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
    synced:  { text: t("settings.cloudSync.synced"),  cls: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30" },
    error:   { text: t("settings.cloudSync.failed"),    cls: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" },
  };
  const c = cfg[status];
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", c.cls)}>
      {c.text}
    </span>
  );
}
