import { useEffect, useState } from "react";
import { X, Check, Pencil, LayoutDashboard, NotebookPen, History, LineChart, Settings, Calendar } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useProfileStore, AVATAR_OPTIONS } from "@/store/useProfileStore";
import { useThemeStore, THEMES } from "@/store/useThemeStore";
import { useRecordStore } from "@/store/useRecordStore";
import { streakDays } from "@/lib/stats";
import { greeting } from "@/lib/date";
import type { ViewKey } from "@/types";
import { cn } from "@/lib/utils";

const NAV_ITEMS: {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  activeCls: string;
  idleCls: string;
}[] = [
  {
    key: "overview",
    label: "概览",
    icon: LayoutDashboard,
    activeCls: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
    idleCls: "text-sky-400/80 hover:bg-sky-500/10 hover:text-sky-300",
  },
  {
    key: "calendar",
    label: "日历",
    icon: Calendar,
    activeCls: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
    idleCls: "text-cyan-400/80 hover:bg-cyan-500/10 hover:text-cyan-300",
  },
  {
    key: "record",
    label: "记录",
    icon: NotebookPen,
    activeCls: "bg-amber/15 text-amber-glow ring-1 ring-amber/30",
    idleCls: "text-amber-glow/80 hover:bg-amber/10 hover:text-amber-glow",
  },
  {
    key: "history",
    label: "历史",
    icon: History,
    activeCls: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
    idleCls: "text-violet-400/80 hover:bg-violet-500/10 hover:text-violet-300",
  },
  {
    key: "insights",
    label: "洞察",
    icon: LineChart,
    activeCls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    idleCls: "text-emerald-400/80 hover:bg-emerald-500/10 hover:text-emerald-300",
  },
];

export default function Sidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const openSettings = useUIStore((s) => s.openSettings);
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);

  const name = useProfileStore((s) => s.name);
  const avatar = useProfileStore((s) => s.avatar);
  const setName = useProfileStore((s) => s.setName);
  const setAvatar = useProfileStore((s) => s.setAvatar);

  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const customColor = useThemeStore((s) => s.customColor);
  const setCustomColor = useThemeStore((s) => s.setCustomColor);

  const records = useRecordStore((s) => s.records);
  const streak = streakDays(records);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [showAvatars, setShowAvatars] = useState(false);

  const g = greeting();

  useEffect(() => {
    if (open) {
      setEditingName(false);
      setShowAvatars(false);
      setNameInput(name);
    }
  }, [open, name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSidebar]);

  const commitName = () => {
    setName(nameInput);
    setEditingName(false);
  };

  const go = (k: ViewKey) => {
    setView(k);
    closeSidebar();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={closeSidebar}
      />

      {/* 抽屉 */}
      <aside className="absolute left-0 top-0 flex h-full w-[80%] max-w-xs animate-slideInLeft flex-col border-r border-line/80 bg-ink-900/95 backdrop-blur-md">
        {/* 头像与名字 */}
        <div className="border-b border-line/60 p-5">
          <div className="mb-3 flex items-start justify-between">
            <button
              onClick={() => setShowAvatars((v) => !v)}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-amber/40 bg-amber/10 text-3xl shadow-glow transition-transform hover:scale-105"
              aria-label="更换头像"
            >
              {avatar}
            </button>
            <button
              onClick={closeSidebar}
              className="text-muted hover:text-mist"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>

          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                maxLength={12}
                className="flex-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-sm text-cream outline-none focus:border-amber/50"
              />
              <button
                onClick={commitName}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-ink-950"
                aria-label="确定"
              >
                <Check size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameInput(name);
                setEditingName(true);
              }}
              className="group flex items-center gap-1.5 text-left"
            >
              <span className="font-display text-xl text-cream">{name}</span>
              <Pencil
                size={13}
                className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          )}

          <p className="mt-1 text-xs text-muted">
            {g.period}好，{streak > 0 ? `已连续记录 ${streak} 天` : "从一次开始"}
          </p>

          {/* 头像选择 */}
          {showAvatars && (
            <div className="mt-3 grid grid-cols-8 gap-1.5 rounded-xl border border-line bg-ink-850/80 p-2.5">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAvatar(a);
                    setShowAvatars(false);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors",
                    a === avatar ? "bg-amber/20 ring-1 ring-amber/60" : "hover:bg-ink-700",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-1.5 p-3">
          {NAV_ITEMS.map(({ key, label, icon: Icon, activeCls, idleCls }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => go(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all",
                  active ? activeCls : idleCls,
                )}
              >
                <Icon size={20} strokeWidth={1.8} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* 设置入口 */}
        <div className="border-t border-line/60 px-3 py-3">
          <button
            onClick={openSettings}
            className="flex w-full items-center gap-3 rounded-xl bg-rose-500/10 px-4 py-3.5 text-base font-medium text-rose-300 transition-all hover:bg-rose-500/20 hover:text-rose-200 ring-1 ring-rose-500/25"
          >
            <Settings size={22} strokeWidth={1.8} />
            设置
          </button>
        </div>

        {/* 外观 / 主题色 */}
        <div className="border-t border-line/60 p-4">
          <div className="label-eyebrow mb-2.5">外观 · 主题色</div>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  aria-label={t.name}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                    active
                      ? "border-amber/60 bg-amber/10 text-amber-glow"
                      : "border-line text-muted hover:border-amber/40 hover:text-mist",
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.swatch }}
                  />
                  {t.name}
                </button>
              );
            })}
            {/* 自定义 */}
            <button
              onClick={() => setTheme("custom")}
              aria-label="自定义颜色"
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                themeId === "custom"
                  ? "border-amber/60 bg-amber/10 text-amber-glow"
                  : "border-line text-muted hover:border-amber/40 hover:text-mist",
              )}
            >
              <span
                className="h-3 w-3 rounded-full ring-1 ring-white/30"
                style={{ backgroundColor: customColor }}
              />
              自定义
            </button>
          </div>

          {/* 自定义颜色选取器：选色块 + hex 输入 */}
          <div className="mt-3 flex items-center gap-2">
            <label
              className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-line"
              style={{ backgroundColor: customColor }}
              aria-label="选取颜色"
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
                if (/^#?[0-9a-fA-F]{0,6}$/.test(v.replace("#", ""))) {
                  setCustomColor(v);
                }
              }}
              maxLength={7}
              placeholder="#E8A87C"
              className="w-24 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 font-mono text-xs text-amber-glow outline-none focus:border-amber/50"
            />
            <span className="text-[11px] text-muted">输入任意颜色</span>
          </div>
        </div>

        <div className="border-t border-line/60 p-4">
          <p className="font-display text-sm text-muted">自卫吧</p>
          <p className="text-[11px] text-muted/70">与自己相处的片刻</p>
        </div>
      </aside>
    </div>
  );
}
