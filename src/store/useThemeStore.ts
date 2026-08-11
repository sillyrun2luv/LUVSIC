import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ThemePreset {
  id: string;
  name: string;
  /** RGB 通道，空格分隔，用于 rgb(var(...) / <alpha>) 形式 */
  accent: string;
  accentDim: string;
  accentDeep: string;
  accentGlow: string;
  /** 色板预览用主色 hex */
  swatch: string;
}

export const THEMES: ThemePreset[] = [
  { id: "ember",  name: "烛火",   accent: "232 168 124", accentDim: "201 138 94",  accentDeep: "168 106 67",  accentGlow: "242 201 168", swatch: "#E8A87C" },
  { id: "moon",   name: "月白",   accent: "157 180 199", accentDim: "122 147 168", accentDeep: "90 120 145",  accentGlow: "214 228 240", swatch: "#9DB4C7" },
  { id: "moss",   name: "苔藓",   accent: "127 168 139", accentDim: "106 141 120", accentDeep: "74 109 90",   accentGlow: "184 217 192", swatch: "#7FA88B" },
  { id: "rose",   name: "玫瑰",   accent: "217 154 170", accentDim: "192 126 150", accentDeep: "166 107 126", accentGlow: "240 200 212", swatch: "#D99AAA" },
  { id: "violet", name: "紫罗兰", accent: "176 155 217", accentDim: "154 133 192", accentDeep: "126 107 166", accentGlow: "216 204 240", swatch: "#B09BD9" },
];

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [232, 168, 124];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 把颜色向 target 混合，t∈[0,1] */
function mix(rgb: RGB, target: RGB, t: number): RGB {
  return [
    Math.round(rgb[0] + (target[0] - rgb[0]) * t),
    Math.round(rgb[1] + (target[1] - rgb[1]) * t),
    Math.round(rgb[2] + (target[2] - rgb[2]) * t),
  ];
}

function toCssVar(rgb: RGB): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

/** 从一个 hex 主色派生 accent / glow / dim / deep */
function deriveFromHex(hex: string): Pick<ThemePreset, "accent" | "accentDim" | "accentDeep" | "accentGlow"> {
  const base = hexToRgb(hex);
  return {
    accent: toCssVar(base),
    accentGlow: toCssVar(mix(base, [255, 255, 255], 0.32)),
    accentDim: toCssVar(mix(base, [0, 0, 0], 0.18)),
    accentDeep: toCssVar(mix(base, [0, 0, 0], 0.40)),
  };
}

/** 把主题应用到 document 根元素 */
export function applyTheme(themeId: string, customColor?: string) {
  let vars: Pick<ThemePreset, "accent" | "accentDim" | "accentDeep" | "accentGlow">;
  if (themeId === "custom") {
    vars = deriveFromHex(customColor ?? "#E8A87C");
  } else {
    const t = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
    vars = t;
  }
  const root = document.documentElement;
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--accent-dim", vars.accentDim);
  root.style.setProperty("--accent-deep", vars.accentDeep);
  root.style.setProperty("--accent-glow", vars.accentGlow);
}

interface ThemeState {
  themeId: string;
  customColor: string;
  /** 选择预设主题 */
  setTheme: (id: string) => void;
  /** 设置自定义颜色，并自动切到 custom 主题 */
  setCustomColor: (hex: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: "ember",
      customColor: "#E8A87C",
      setTheme: (id) => set({ themeId: id }),
      setCustomColor: (hex) => set({ customColor: hex, themeId: "custom" }),
    }),
    { name: "zwba_theme", storage: createJSONStorage(() => localStorage) },
  ),
);
