import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Eye, EyeOff, Check } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import { toast } from "@/store/useToastStore";
import { cn, isValidPin, sha256Hex } from "@/lib/utils";

export default function LockGate() {
  const lock = useRecordStore((s) => s.settings.lock);
  const verified = useUIStore((s) => s.lockVerified);
  const setVerified = useUIStore((s) => s.setLockVerified);

  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const required = useMemo(
    () => lock.enabled && !!lock.passwordHash && !verified,
    [lock.enabled, lock.passwordHash, verified],
  );

  useEffect(() => {
    if (!required) setPin("");
  }, [required]);

  const submit = async () => {
    if (busy || !isValidPin(pin)) return;
    setBusy(true);
    try {
      const hash = await sha256Hex(pin);
      if (hash === lock.passwordHash) {
        setVerified(true);
        setPin("");
      } else {
        toast("密码错误", "warn");
        setShake(true);
        setTimeout(() => setShake(false), 420);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!required) return null;

  // 6 格数字框
  const slots = new Array(8).fill(0);

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-ink-950">
      {/* 背景光晕 */}
      <div
        className="pointer-events-none absolute h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: "rgb(var(--accent) / 0.6)" }}
      />

      <div
        className={cn(
          "relative z-10 flex w-[88%] max-w-sm flex-col items-center gap-8 p-6",
          shake && "animate-[splashShake_0.42s_ease-in-out]",
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber/50 bg-amber/10 text-amber-glow shadow-glow">
          <LockKeyhole size={28} />
        </div>

        <div className="text-center">
          <h2 className="font-display text-3xl text-cream">请输入密码</h2>
          <p className="mt-2 text-sm text-muted">密码锁已开启，解锁后可使用</p>
        </div>

        {/* 输入框显示 + 实际输入 */}
        <div className="w-full space-y-3">
          <div className="flex justify-center gap-2">
            {slots.map((_, i) => {
              const filled = i < pin.length;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex h-12 w-10 items-center justify-center rounded-xl border text-xl font-mono",
                    filled
                      ? "border-amber/60 bg-amber/10 text-amber-glow"
                      : "border-line bg-ink-800 text-transparent",
                  )}
                >
                  {show ? pin[i] ?? "·" : filled ? "●" : "·"}
                </div>
              );
            })}
          </div>

          <div className="relative">
            <input
              autoFocus
              type={show ? "tel" : "password"}
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                setPin(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="sr-only"
              id="lock-pin-input"
            />
            {/* 点击此区域聚焦到输入框 */}
            <button
              onClick={() => document.getElementById("lock-pin-input")?.focus()}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-ink-800 px-4 py-2 text-sm text-mist"
            >
              <EyeOff size={14} className={cn("transition-opacity", show ? "opacity-30" : "opacity-100")} />
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShow((v) => !v);
                }}
                className="cursor-pointer select-none hover:text-amber-glow"
              >
                {show ? "显示密码" : "隐藏密码"}
              </span>
            </button>
          </div>
        </div>

        {/* 数字键盘（移动端友好） */}
        <div className="grid w-full grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => {
            if (k === "") return <div key={i} />;
            const isBack = k === "⌫";
            return (
              <button
                key={i}
                onClick={() => {
                  if (isBack) setPin((p) => p.slice(0, -1));
                  else if (pin.length < 8) setPin((p) => p + k);
                  if (!isBack && pin.length + 1 >= 4) {
                    // 输入 4 位以上，延迟自动校验（避免输到 8 位误触发）
                    clearTimeout((window as any).__lockAutoTimer);
                    (window as any).__lockAutoTimer = setTimeout(() => {
                      if (pin.length + 1 >= 4 && (pin.length + 1 === 8)) {
                        void submit();
                      }
                    }, 250);
                  }
                }}
                className={cn(
                  "flex h-14 items-center justify-center rounded-2xl border text-2xl font-medium transition-colors",
                  isBack
                    ? "border-line bg-ink-800 text-muted hover:text-red-300/90"
                    : "border-line/70 bg-ink-800/70 text-cream hover:border-amber/40 hover:text-amber-glow",
                )}
              >
                {k}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => void submit()}
          disabled={pin.length < 4 || busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-amber px-5 py-3 text-base text-ink-950 transition-colors hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={16} />
          {busy ? "验证中…" : "解锁"}
        </button>
      </div>
    </div>
  );
}
