import { useEffect, useState } from "react";
import {
  X,
  Lock,
  LockKeyhole,
  Pencil,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import { cn, isValidPin, sha256Hex } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

type PinStage = "idle" | "create" | "change" | "disable";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PasswordLockSheet({ open, onClose }: Props) {
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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={stage === "idle" ? onClose : undefined}
      />
      {/* 整体上移 72px 给 BottomNav 让位，不再被底栏压住下半部；overflow-y-auto 让 sticky header 正常工作 */}
      <div className="absolute inset-x-0 bottom-[72px] mx-auto max-w-md max-h-[calc(92vh-72px)] overflow-y-auto animate-slideInUp rounded-3xl border border-line/80 bg-ink-900 pb-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-ink-900/95 px-5 py-4">
          <h3 className="font-display text-lg text-cream">{t("settings.passwordLock.title")}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-mist"
            disabled={stage !== "idle"}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
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
        </div>
      </div>
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
