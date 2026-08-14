import { cn } from "@/lib/utils";

/**
 * 头像支持两种格式：
 *   1) 普通 emoji / 任何字符 → "🌙" / "🦊"
 *   2) 首字母渐变头像 → "text:XX"（冒号后是要显示的字，通常 1 字）
 *   3) data URI 图片（兼容未来图片上传方案）→ "data:image/..."
 *
 * 字符 hash → 渐变 ID 是确定性的，同一个字颜色永远一样。
 */

export const TEXT_AVATAR_PREFIX = "text:";
export const DATA_URI_PREFIX = "data:image/";
/** 头像选项里的静态图片：以 / 开头或 http(s):// 开头的视作图片 URL 类型 */
const IMAGE_PATH_RE = /^(https?:)?\//;

const GRADIENTS: string[] = [
  "from-rose-400 to-pink-500",
  "from-amber-400 to-rose-500",
  "from-amber to-orange-500",
  "from-yellow-400 to-amber",
  "from-lime-400 to-emerald-500",
  "from-emerald-400 to-teal-500",
  "from-teal-400 to-cyan-500",
  "from-cyan-400 to-sky-500",
  "from-sky-400 to-blue-500",
  "from-blue-400 to-indigo-500",
  "from-indigo-400 to-violet-500",
  "from-violet-400 to-purple-500",
  "from-purple-400 to-fuchsia-500",
  "from-fuchsia-400 to-pink-500",
  "from-rose-500 to-amber",
  "from-teal-500 to-emerald-400",
  "from-sky-500 to-violet-500",
  "from-pink-500 to-violet-500",
  "from-emerald-500 to-sky-500",
  "from-orange-500 to-rose-500",
  "from-violet-500 to-fuchsia-500",
  "from-amber-glow to-rose-400",
  "from-ink-800 to-ink-600",
  "from-cyan-500 to-emerald-500",
];

/** 从字符串稳定 hash 到 [0, GRADIENTS.length) */
export function pickGradientIndex(s: string): number {
  if (!s) return 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % GRADIENTS.length;
}

/** 提取昵称/任意字里的首字（优先汉字 > 英文 > 数字） */
export function pickInitial(name: string): string {
  const s = (name || "").trim();
  if (!s) return "·";
  // 跳过表情符号和空格，取第一个可显示字符；
  // 直接取 Array.from 第一个码位，避免 surrogate pair 被切半
  const cp = Array.from(s);
  for (const c of cp) {
    if (/\s/.test(c)) continue;
    // 对 CJK / 英文数字 / 其他 Unicode 直接用首字
    return c;
  }
  return cp[0] ?? "·";
}

/** 基于昵称生成 "text:X" 格式的渐变头像值 */
export function buildTextAvatar(name: string): string {
  const ch = pickInitial(name);
  return `${TEXT_AVATAR_PREFIX}${ch}`;
}

/** 判断头像值的类型 */
export function avatarKind(v: string): "emoji" | "text" | "image" {
  if (typeof v !== "string") return "emoji";
  if (v.startsWith(TEXT_AVATAR_PREFIX)) return "text";
  if (v.startsWith(DATA_URI_PREFIX)) return "image";
  if (IMAGE_PATH_RE.test(v)) return "image";
  return "emoji";
}

export interface AvatarProps {
  value: string;
  /** 圆形直径，默认 44px */
  size?: number;
  className?: string;
  /** 外框 ring（默认有一层 ring-line/60） */
  ringClass?: string;
  /** emoji 大小倍数（相对 size）。默认 0.55 */
  emojiScale?: number;
}

/**
 * 通用头像渲染：可替换所有内联的"圆形 div + emoji"
 *  现在支持 emoji / text 渐变 / data:image 三种格式。
 */
export default function Avatar({
  value,
  size = 44,
  className,
  ringClass = "ring-1 ring-line/60",
  emojiScale = 0.55,
}: AvatarProps) {
  const kind = avatarKind(value);
  const base = cn(
    "shrink-0 flex items-center justify-center rounded-full overflow-hidden select-none bg-ink-800/80",
    ringClass,
    className,
  );
  const style: React.CSSProperties = { width: size, height: size };

  if (kind === "image") {
    return (
      <img
        src={value}
        alt=""
        className={cn(base, "object-cover")}
        style={style}
        draggable={false}
      />
    );
  }

  if (kind === "text") {
    const ch = value.slice(TEXT_AVATAR_PREFIX.length).slice(0, 4) || "·";
    const g = GRADIENTS[pickGradientIndex(value)];
    const fontSize = Math.max(10, Math.round(size * 0.5));
    return (
      <div
        className={cn(base, "bg-gradient-to-br text-white font-semibold", g, ringClass && "ring-1 ring-white/20")}
        style={{ ...style, fontSize }}
        aria-label={ch}
      >
        <span className="translate-y-[1px]">{ch}</span>
      </div>
    );
  }

  // emoji
  const fontSize = Math.max(14, Math.round(size * emojiScale));
  return (
    <div className={base} style={{ ...style, fontSize }} aria-label={value}>
      <span>{value || "🌙"}</span>
    </div>
  );
}
