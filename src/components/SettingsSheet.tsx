import { useEffect, useState } from "react";
import {
  X,
  Lock,
  LockKeyhole,
  Pencil,
  Check,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Cloud,
  RefreshCw,
  Download,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { exportRecordsXls } from "@/lib/exportExcel";
import { uploadToCloud, downloadFromCloud, getCloudRecordCount } from "@/lib/sync";
import { APP_VERSION, checkUpdate, type VersionInfo } from "@/config/appVersion";
import DonateSheet from "@/components/DonateSheet";
import { cn, isValidPin, sha256Hex } from "@/lib/utils";

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
      toast("请输入 4-8 位数字", "warn");
      return;
    }
    if (newPin !== newPin2) {
      toast("两次密码不一致", "warn");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(newPin);
      setLock({ passwordHash: hash, enabled: true });
      toast("密码已设置并开启密码锁", "success");
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
      toast("请输入 4-8 位数字", "warn");
      return;
    }
    if (newPin !== newPin2) {
      toast("两次新密码不一致", "warn");
      return;
    }
    setBusy(true);
    try {
      const oldHash = await sha256Hex(oldPin);
      if (oldHash !== lock.passwordHash) {
        toast("原密码错误", "warn");
        return;
      }
      const newHash = await sha256Hex(newPin);
      setLock({ passwordHash: newHash });
      toast("密码已修改", "success");
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
      toast("请输入 4-8 位数字密码", "warn");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(oldPin);
      if (hash !== lock.passwordHash) {
        toast("密码错误", "warn");
        return;
      }
      // 关闭并清除密码
      setLock({ enabled: false, passwordHash: undefined });
      toast("已关闭密码锁", "success");
      setStage("idle");
      setOldPin("");
    } finally {
      setBusy(false);
    }
  };

  const handleExportXls = () => {
    if (records.length === 0) {
      toast("暂无记录可导出", "warn");
      return;
    }
    exportRecordsXls(records);
    toast(`已导出 ${records.length} 条记录到 Excel`, "success");
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
          <h3 className="font-display text-xl text-cream">设置</h3>
          <button
            onClick={close}
            className="text-muted hover:text-mist"
            aria-label="关闭设置"
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
                  <div className="text-sm text-cream">密码锁</div>
                  <div className="text-xs text-muted">
                    {lock.enabled ? "打开 App 前需输入密码" : "未开启"}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleEnabled}
                role="switch"
                aria-checked={lock.enabled || pending}
                aria-label={pending ? "取消操作" : lock.enabled ? "关闭密码锁" : "开启密码锁"}
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
                  设置 4-8 位数字密码（仅保存在你本机，不可逆，请记牢）
                </p>
                <PinRow label="新密码" value={newPin} onChange={setNewPin} show={showNew} onToggle={() => setShowNew((v) => !v)} />
                <PinRow
                  label="再输一次"
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
                    取消
                  </button>
                  <button
                    onClick={() => void commitCreate()}
                    disabled={busy}
                    className="flex-1 rounded-full bg-amber px-4 py-2 text-sm text-ink-950 hover:bg-amber-glow disabled:opacity-60"
                  >
                    {busy ? "设置中…" : "完成"}
                  </button>
                </div>
              </div>
            )}

            {stage === "change" && (
              <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
                <PinRow label="原密码" value={oldPin} onChange={setOldPin} show={showOld} onToggle={() => setShowOld((v) => !v)} />
                <PinRow label="新密码" value={newPin} onChange={setNewPin} show={showNew} onToggle={() => setShowNew((v) => !v)} />
                <PinRow
                  label="再输一次"
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
                    取消
                  </button>
                  <button
                    onClick={() => void commitChange()}
                    disabled={busy}
                    className="flex-1 rounded-full bg-amber px-4 py-2 text-sm text-ink-950 hover:bg-amber-glow disabled:opacity-60"
                  >
                    {busy ? "提交中…" : "修改"}
                  </button>
                </div>
              </div>
            )}

            {stage === "disable" && (
              <div className="animate-fadeIn mt-4 space-y-3 rounded-xl border border-line bg-ink-900/60 p-4">
                <p className="text-xs text-muted">请输入当前密码，以关闭密码锁</p>
                <PinRow label="当前密码" value={oldPin} onChange={setOldPin} show={showOld} onToggle={() => setShowOld((v) => !v)} />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setStage("idle"); setOldPin(""); }}
                    className="flex-1 rounded-full border border-line px-4 py-2 text-sm text-mist hover:bg-ink-800"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void commitDisable()}
                    disabled={busy}
                    className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {busy ? "验证中…" : "确认关闭"}
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
                修改密码
              </button>
            )}
          </section>

          {/* 云同步 */}
          <section>
            <div className="label-eyebrow mb-2.5">云端 · 同步</div>
            <CloudSyncCard />
          </section>

          {/* 数据导出（Excel） */}
          <section>
            <div className="label-eyebrow mb-2.5">数据 · 导出</div>
            <div className="rounded-xl border border-line bg-ink-900/60 p-4">
              <p className="mb-3 text-xs leading-relaxed text-muted">
                将所有记录一键导出为 Excel 文件（.xls），可在 Excel / WPS / 表格 App 中打开。
              </p>
              <button
                onClick={handleExportXls}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow border border-line"
              >
                <FileSpreadsheet size={15} />
                导出 Excel
              </button>
              <p className="mt-3 text-[11px] text-muted/80">
                共 {records.length} 条记录可导出
              </p>
            </div>
          </section>

          {/* 赞赏 */}
          <section>
            <div className="label-eyebrow mb-2.5">支持作者</div>
            <div className="rounded-xl border border-amber/20 bg-amber/5 p-4">
              <p className="mb-3 text-xs leading-relaxed text-muted">
                App 功能完全免费，我只是一个讨口子 OVO（非强制付费）
              </p>
              <DonateSheet />
            </div>
          </section>

          {/* 关于 · 更新 */}
          <section>
            <div className="label-eyebrow mb-2.5">关于</div>
            <div className="rounded-xl border border-line bg-ink-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted">当前版本</span>
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
                    toast("已是最新版本", "success");
                  }
                  setCheckingUpdate(false);
                }}
                disabled={checkingUpdate}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow disabled:opacity-60"
              >
                <RefreshCw size={15} className={checkingUpdate ? "animate-spin" : ""} />
                {checkingUpdate ? "检查中…" : "检查更新"}
              </button>
            </div>
          </section>
        </div>

        {/* 底部版权样式 */}
        <div className="border-t border-line/60 p-4">
          <p className="font-display text-sm text-muted">自卫吧</p>
          <p className="text-[11px] text-muted/70">与自己相处的片刻</p>
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
            placeholder="4-8 位数字"
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
            aria-label={show ? "隐藏" : "显示"}
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
        <p className="ml-[4.75rem] mt-1 text-[11px] text-red-300/90">两次密码不一致</p>
      )}
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
            <h3 className="text-base font-medium text-cream">发现新版本</h3>
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
            稍后
          </button>
          <a
            href={info.apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 transition-colors hover:bg-amber-glow"
          >
            <Download size={15} />
            下载更新
          </a>
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
            取消
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
function CloudSyncCard() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const openAuth = useUIStore((s) => s.openAuth);
  const [confirm, setConfirm] = useState<"upload" | "download" | "logout" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const records = useRecordStore((s) => s.records);

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
            <div className="text-sm text-cream">云端账户</div>
            <div className="text-xs text-muted">未登录</div>
          </div>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          登录后可上传/下载数据，多设备互通。密码锁仅保存在本机。
        </p>
        <button
          onClick={openAuth}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <Cloud size={15} />
          登录 / 注册
        </button>
      </div>
    );
  }

  const doUpload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await uploadToCloud(user.id);
      toast("已上传到云端", "success", undo ? { label: "撤销", onAction: async () => {
        await undo();
        toast("已撤销上传", "success");
        refreshCloudCount();
      } } : undefined);
      refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || "上传失败", "warn");
    } finally {
      setLoading(false);
    }
  };

  const doDownload = async () => {
    setConfirm(null);
    setLoading(true);
    try {
      const undo = await downloadFromCloud(user.id);
      toast("已从云端下载", "success", undo ? { label: "撤销", onAction: () => {
        undo();
        toast("已撤销下载", "success");
        refreshCloudCount();
      } } : undefined);
      refreshCloudCount();
    } catch (e: any) {
      toast(e?.message || "下载失败", "warn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <Cloud size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-cream">已连接云端</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span>本地 {records.length} 条记录</span>
          <span>云端 {cloudCount !== null ? `${cloudCount} 条` : "…"}</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => setConfirm("upload")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {loading ? "处理中…" : "上传到云端"}
          </button>
          <button
            onClick={() => setConfirm("download")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-60"
          >
            {loading ? "处理中…" : "从云端下载"}
          </button>
          <button
            onClick={() => setConfirm("logout")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-rose-300/80 transition-colors hover:border-rose-500/40 hover:text-rose-300"
          >
            退出登录
          </button>
        </div>
      </div>

      {confirm === "upload" && (
        <ConfirmDialog
          title="上传到云端"
          message="将用本地数据覆盖云端所有记录。云端原有数据会被替换，5 秒内可撤销。"
          confirmLabel="确认上传"
          onConfirm={doUpload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "download" && (
        <ConfirmDialog
          title="从云端下载"
          message="将用云端数据覆盖本地所有记录。本地原有数据会被替换，5 秒内可撤销。"
          confirmLabel="确认下载"
          onConfirm={doDownload}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "logout" && (
        <ConfirmDialog
          title="退出登录"
          message="确定要退出云端账户吗？本地数据不会被删除。"
          confirmLabel="退出登录"
          onConfirm={async () => {
            setConfirm(null);
            await signOut();
            toast("已退出登录", "success");
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
