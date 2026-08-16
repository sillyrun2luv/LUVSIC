import { create } from "zustand";
import { persist } from "zustand/middleware";
import zhCN from "@/locales/zh-CN.json";
import zhTW from "@/locales/zh-TW.json";
import enUS from "@/locales/en.json";

export type LocaleCode = "zh-CN" | "zh-TW" | "en";

export const LOCALES: { code: LocaleCode; label: string; nativeName: string }[] = [
  { code: "zh-CN", label: "简体中文", nativeName: "简体中文" },
  { code: "zh-TW", label: "繁體中文", nativeName: "繁體中文" },
  { code: "en", label: "English", nativeName: "English" },
];

type Dict = Record<string, any>;

const DICT: Record<LocaleCode, Dict> = {
  "zh-CN": zhCN as Dict,
  "zh-TW": zhTW as Dict,
  en: enUS as Dict,
};

function detectBrowserLocale(): LocaleCode {
  try {
    const nav = (navigator?.language || "zh-CN").toLowerCase();
    if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.startsWith("zh-mo")) return "zh-TW";
    if (nav.startsWith("zh")) return "zh-CN";
    if (nav.startsWith("en")) return "en";
  } catch {
    /* ignore */
  }
  return "zh-CN";
}

interface I18nState {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: detectBrowserLocale(),
      setLocale: (code) => set({ locale: code }),
    }),
    {
      name: "zwba-i18n",
      partialize: (s) => ({ locale: s.locale }),
    },
  ),
);

function _lookup(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * 按点路径查找「字符串数组」型翻译 key。
 * 用于 friendReminder.templates.careHealth 这种 5 句模板随机挑的场景。
 * 找不到或非数组时回退 fallback locale，仍不对返回空数组。
 */
export function lookupArray(key: string): string[] {
  const locale = useI18nStore.getState().locale;
  const current = DICT[locale] || DICT["zh-CN"];
  const fallback = DICT["zh-CN"];
  const parts = key.split(".");
  let curCurrent: any = current;
  for (const p of parts) { if (curCurrent == null) break; curCurrent = curCurrent[p]; }
  if (Array.isArray(curCurrent)) {
    return curCurrent.filter((x: unknown) => typeof x === "string") as string[];
  }
  let curFb: any = fallback;
  for (const p of parts) { if (curFb == null) break; curFb = curFb[p]; }
  if (Array.isArray(curFb)) {
    return curFb.filter((x: unknown) => typeof x === "string") as string[];
  }
  return [];
}

function format(tmpl: string, args: any[]): string {
  if (args.length === 0) return tmpl;
  return tmpl.replace(/\{(\d+)\}/g, (_m, idx) => {
    const i = Number(idx);
    return args[i] != null ? String(args[i]) : "";
  });
}

export function t(key: string, ...args: any[]): string {
  const locale = useI18nStore.getState().locale;
  const current = DICT[locale] || DICT["zh-CN"];
  const fallback = DICT["zh-CN"];
  let result = _lookup(current, key);
  if (result == null) result = _lookup(fallback, key);
  if (result == null) {
    // Key not found: if args[0] is a string, use it as fallback template
    if (args.length > 0 && typeof args[0] === "string") {
      return format(args[0], args.slice(1));
    }
    console.warn(`[i18n] Missing key: ${key} (locale: ${locale})`);
    return key;
  }
  // Key found: detect fallback-string convention
  // Pattern: t("key", "fallback with {0}", realArg) — skip the fallback string
  if (args.length > 1 && typeof args[0] === "string" && result.includes("{0}")) {
    return format(result, args.slice(1));
  }
  return format(result, args);
}
