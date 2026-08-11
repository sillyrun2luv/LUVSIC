import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Heart, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DONATE_ALIPAY_URL,
  DONATE_WECHAT_URL,
  DONATE_TITLE,
  DONATE_SUBTITLE,
  DONATE_FOOTER,
} from "@/config/donate";

type Channel = "alipay" | "wechat";

const CHANNELS: { key: Channel; label: string; img: string }[] = [
  { key: "alipay", label: "支付宝", img: DONATE_ALIPAY_URL },
  { key: "wechat", label: "微信", img: DONATE_WECHAT_URL },
];

export default function DonateSheet() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("wechat");
  // 图片是否加载失败（用于显示占位提示）
  const [imgError, setImgError] = useState<Record<Channel, boolean>>({
    alipay: false,
    wechat: false,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 切换 tab 时重置错误状态（允许重新尝试加载）
  useEffect(() => {
    setImgError({ alipay: false, wechat: false });
  }, [channel]);

  const current = CHANNELS.find((c) => c.key === channel)!;
  const errored = imgError[channel];
  const hasUrl = current.img.length > 0;

  return (
    <>
      {/* 入口按钮（留在 SettingsSheet 文档流内） */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-amber-glow transition-colors hover:bg-amber/20"
      >
        <Heart size={15} />
        请作者喝杯咖啡
      </button>

      {/* 弹窗通过 Portal 渲染到 body，避免父级 transform 干扰 fixed 定位 */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-end justify-center">
            <div
              className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md">
              {/* 关闭按钮 */}
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 text-muted hover:text-mist"
                aria-label="关闭"
              >
                <X size={18} />
              </button>

              {/* 文案 */}
              <div className="mb-5 text-center">
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber/15 text-amber-glow">
                  <Heart size={22} />
                </div>
                <p className="font-display text-lg text-cream">{DONATE_TITLE}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {DONATE_SUBTITLE}
                </p>
              </div>

              {/* 渠道 Tab */}
              <div className="mb-4 flex justify-center gap-2">
                {CHANNELS.map((c) => {
                  const active = c.key === channel;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setChannel(c.key)}
                      className={cn(
                        "rounded-full border px-5 py-1.5 text-sm transition-colors",
                        active
                          ? "border-amber/60 bg-amber/15 text-amber-glow"
                          : "border-line text-muted hover:border-amber/40 hover:text-mist",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* 二维码区域 */}
              <div className="flex justify-center">
                <div className="relative h-64 w-64 overflow-hidden rounded-2xl border border-line bg-ink-800">
                  {hasUrl && !errored ? (
                    <img
                      src={current.img}
                      alt={`${current.label}收款码`}
                      className="h-full w-full object-contain"
                      onError={() =>
                        setImgError((s) => ({ ...s, [channel]: true }))
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
                      <ImageOff size={32} className="text-muted/60" />
                      <p className="text-xs text-muted">二维码即将上线</p>
                      <p className="text-[10px] text-muted/60">
                        {hasUrl ? `${current.label}收款码加载失败，稍后再试` : `作者还没把${current.label}收款码放进来`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 提示 */}
              <p className="mt-4 text-center text-[11px] text-muted/80">
                {DONATE_FOOTER}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
