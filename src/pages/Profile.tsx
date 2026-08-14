import { useState, useEffect } from "react";
import { Check, Pencil, Lock, FileDown, Heart, Info, Palette, LogIn, Loader2, UserX, Megaphone, ChevronRight, Timer, Image, Sparkles } from "lucide-react";
import { useProfileStore, AVATAR_OPTIONS } from "@/store/useProfileStore";
import { useThemeStore, THEMES } from "@/store/useThemeStore";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAnnouncementStore } from "@/store/useAnnouncementStore";
import { streakDays } from "@/lib/stats";
import { greeting } from "@/lib/date";
import { cn } from "@/lib/utils";
import { CloudSyncCard, PrivacyToggle } from "@/components/SettingsSheet";
import { Search, Eye } from "lucide-react";
import { checkNameConflict } from "@/lib/friends";
import { toast } from "@/store/useToastStore";
import DeleteAccountSheet from "@/components/DeleteAccountSheet";
import Avatar, { buildTextAvatar, avatarKind, TEXT_AVATAR_PREFIX } from "@/components/Avatar";
import { switchAppIcon, getCurrentAppIcon, restartApp, type AppIconType } from "@/lib/iconSwitch";
import { Capacitor } from "@capacitor/core";

export default function Profile() {
  const name = useProfileStore((s) => s.name);
  const avatar = useProfileStore((s) => s.avatar);
  const setName = useProfileStore((s) => s.setName);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const searchable = useProfileStore((s) => s.searchable);
  const showAggregatesToFriends = useProfileStore((s) => s.showAggregatesToFriends);
  const setSearchable = useProfileStore((s) => s.setSearchable);
  const setShowAggregatesToFriends = useProfileStore((s) => s.setShowAggregatesToFriends);

  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const customColor = useThemeStore((s) => s.customColor);
  const setCustomColor = useThemeStore((s) => s.setCustomColor);

  const records = useRecordStore((s) => s.records);
  const showFloatingTimer = useRecordStore((s) => s.settings.showFloatingTimer);
  const setShowFloatingTimer = useRecordStore((s) => s.setShowFloatingTimer);
  const openSettings = useUIStore((s) => s.openSettings);
  const openAuth = useUIStore((s) => s.openAuth);
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const userId = useAuthStore((s) => s.user?.id);
  const streak = streakDays(records);
  const g = greeting();

  // 公告
  const isAnnouncementAdmin = useAnnouncementStore((s) => s.isAdmin);
  const refreshAnnouncementAdmin = useAnnouncementStore((s) => s.refreshAdmin);
  const openAnnouncementList = useAnnouncementStore((s) => s.openList);
  const openAnnouncementAdmin = useAnnouncementStore((s) => s.openAdmin);
  const activeAnnouncement = useAnnouncementStore((s) => s.activeAnnouncement);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [showAvatars, setShowAvatars] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [openDeleteAccount, setOpenDeleteAccount] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<AppIconType>("mushroom");
  const [showIconSheet, setShowIconSheet] = useState(false);
  const [switchingIcon, setSwitchingIcon] = useState(false);

  // 进入"我的"页面时刷新管理员状态
  useEffect(() => {
    void refreshAnnouncementAdmin();
  }, [refreshAnnouncementAdmin]);

  // 加载当前图标设置
  useEffect(() => {
    void getCurrentAppIcon().then(setCurrentIcon);
  }, []);

  const handleSwitchIcon = async (icon: AppIconType) => {
    if (switchingIcon || icon === currentIcon) return;
    setSwitchingIcon(true);
    try {
      await switchAppIcon(icon);
      setCurrentIcon(icon);
      toast(`已切换为${icon === "mushroom" ? "蘑菇战士" : "鲍鱼战士"}图标`, "success");
      setShowIconSheet(false);
      // 延迟重启让 toast 显示
      setTimeout(async () => {
        await restartApp();
      }, 800);
    } catch (err) {
      console.error(err);
      toast("图标切换失败", "warn");
    } finally {
      setSwitchingIcon(false);
    }
  };

  const commitName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    if (trimmed === name) {
      setEditingName(false);
      return;
    }
    // 登录状态下做重名检测
    if (isLoggedIn) {
      setCommitting(true);
      try {
        const { conflict, conflictName } = await checkNameConflict(
          trimmed,
          userId ?? undefined,
        );
        if (conflict) {
          toast(`昵称「${conflictName ?? trimmed}」已被别人占用`, "warn");
          return;
        }
      } catch {
        // 失败放行，云端 UNIQUE 兜底
      } finally {
        setCommitting(false);
      }
    }
    setName(trimmed);
    setEditingName(false);
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* 标题 */}
      <header>
        <p className="label-eyebrow mb-2">个人</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          我的
        </h1>
      </header>

      {/* 头像与昵称 */}
      <section className="surface p-5">
        {isLoggedIn ? (
          <>
            <div className="mb-4 flex items-center gap-4">
              <button
                onClick={() => setShowAvatars((v) => !v)}
                className="shrink-0 rounded-full border border-amber/40 bg-amber/10 shadow-glow transition-transform hover:scale-105"
                aria-label="更换头像"
              >
                <Avatar value={avatar} size={64} emojiScale={0.5} ringClass="ring-0 border-0" />
              </button>
              <div className="min-w-0 flex-1">
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
                      placeholder="输入昵称"
                      disabled={committing}
                      className="flex-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-sm text-cream outline-none focus:border-amber/50 disabled:opacity-60"
                    />
                    <button
                      onClick={commitName}
                      disabled={committing}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-ink-950 disabled:opacity-60"
                      aria-label="确定"
                    >
                      {committing ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
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
                <p className="mt-0.5 text-xs text-muted">
                  {g.period}好，{streak > 0 ? `已连续记录 ${streak} 天` : "从一次开始"}
                </p>
              </div>
            </div>

            {/* 头像选择网格 */}
            {showAvatars && (
              <div className="rounded-xl border border-line bg-ink-850/80 p-2.5">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <div className="text-[11px] text-muted">选表情头像 · 共 {AVATAR_OPTIONS.length} 个</div>
                  <button
                    onClick={() => {
                      const t = buildTextAvatar(name || "我");
                      setAvatar(t);
                      setShowAvatars(false);
                      toast("已切换为昵称首字渐变头像", "success");
                    }}
                    className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
                  >
                    <Avatar
                      value={buildTextAvatar(name || "我")}
                      size={14}
                      ringClass="ring-0"
                      emojiScale={0.85}
                    />
                    用昵称首字生成
                  </button>
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  {AVATAR_OPTIONS.map((a) => (
                    <button
                      key={a}
                      onClick={() => {
                        setAvatar(a);
                        setShowAvatars(false);
                      }}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors",
                        a === avatar
                          ? "bg-amber/20 ring-1 ring-amber/60"
                          : "hover:bg-ink-700",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                  {/* 额外：当前如果是 text 头像，也提供一个预览 */}
                  {avatarKind(avatar) === "text" && (
                    <div
                      title="当前：首字母渐变"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 ring-1 ring-amber/60"
                    >
                      <Avatar value={avatar} size={28} ringClass="ring-0" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-4 flex items-center gap-4">
            <Avatar value={avatar} size={64} emojiScale={0.5} ringClass="border border-line ring-0" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl text-cream">{name}</div>
              <button
                onClick={openAuth}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs text-amber-glow transition-colors hover:bg-amber/20"
              >
                <LogIn size={12} />
                登录后设置昵称和头像
              </button>
              <p className="mt-1.5 text-xs text-muted">
                {g.period}好，{streak > 0 ? `已连续记录 ${streak} 天` : "从一次开始"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 公告 */}
      <section>
        <div className="label-eyebrow mb-3">公告</div>
        <div className="surface divide-y divide-line/40 overflow-hidden rounded-2xl">
          <button
            onClick={() => void openAnnouncementList()}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/15 text-amber-glow">
              <Megaphone size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-cream">公告中心</div>
              <div className="text-xs text-muted">
                {activeAnnouncement ? activeAnnouncement.title : "查看所有通知与更新"}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {isAnnouncementAdmin && (
            <button
              onClick={() => void openAnnouncementAdmin()}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-amber/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 text-amber-glow">
                <Pencil size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-cream">公告管理</div>
                <div className="text-xs text-muted">发布、编辑、上下线公告</div>
              </div>
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber-glow ring-1 ring-amber/30">
                管理员
              </span>
            </button>
          )}
        </div>
      </section>

      {/* 云端同步 */}
      <section>
        <div className="label-eyebrow mb-3">数据 · 同步</div>
        <CloudSyncCard />
      </section>

      {/* 社交隐私 */}
      <section>
        <div className="label-eyebrow mb-3">社交 · 隐私</div>
        {isLoggedIn ? (
          <div className="surface space-y-1 p-2">
            <PrivacyToggle
              icon={<Search size={16} />}
              title="允许被搜索"
              desc="好友可以通过昵称搜索到你"
              checked={searchable}
              onChange={setSearchable}
              accent="teal"
            />
            <PrivacyToggle
              icon={<Eye size={16} />}
              title="好友可见统计"
              desc="好友可以查看你的次数和时长概览"
              checked={showAggregatesToFriends}
              onChange={setShowAggregatesToFriends}
              accent="teal"
            />
          </div>
        ) : (
          <div className="surface p-4">
            <button
              onClick={openAuth}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-medium text-cream">登录后管理社交隐私</div>
                <div className="mt-0.5 text-xs text-muted">
                  设置是否允许被搜索、是否向好友展示统计
                </div>
              </div>
              <LogIn size={16} className="text-amber-glow" />
            </button>
          </div>
        )}
      </section>

      {/* 外观主题 */}
      <section>
        <div className="label-eyebrow mb-3 flex items-center gap-1.5">
          <Palette size={13} />
          外观 · 主题色
        </div>
        <div className="surface p-4">
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

          {/* 自定义颜色选取器 */}
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
      </section>

      {/* 更多设置 */}
      <section>
        <div className="label-eyebrow mb-3">更多设置</div>
        <div className="surface divide-y divide-line/40 overflow-hidden rounded-2xl">
          {/* 应用图标切换 */}
          <button
            onClick={() => setShowIconSheet(true)}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-mist">
              <Image size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-cream flex items-center gap-1.5">
                应用图标
                <Sparkles size={12} className="text-amber-glow" />
              </div>
              <div className="text-xs text-muted">
                当前：{currentIcon === "mushroom" ? "蘑菇战士" : "鲍鱼战士"}
                {!Capacitor.isNativePlatform() && "（仅 Android 原生可用）"}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* 密码锁 */}
          <SettingsRow
            icon={<Lock size={18} />}
            label="密码锁"
            desc="应用启动时需要密码"
            onClick={openSettings}
          />

          {/* 浮动计时按钮开关 */}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-mist">
                <Timer size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-cream">浮动计时按钮</div>
                <div className="text-xs text-muted">关闭后可在记录页内使用计时</div>
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
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                  showFloatingTimer ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* 数据导出 */}
          <SettingsRow
            icon={<FileDown size={18} />}
            label="数据导出"
            desc="导出 Excel / JSON 备份"
            onClick={openSettings}
          />

          {/* 支持作者 */}
          <SettingsRow
            icon={<Heart size={18} />}
            label="支持作者"
            desc="请作者喝杯咖啡"
            onClick={openSettings}
          />

          {/* 关于 */}
          <SettingsRow
            icon={<Info size={18} />}
            label="关于"
            desc="版本信息与更新"
            onClick={openSettings}
          />

          {/* 删除账户 */}
          {isLoggedIn && (
            <button
              onClick={() => setOpenDeleteAccount(true)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-red-500/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-300">
                <UserX size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-200">删除账户</div>
                <div className="text-xs text-red-300/70">永久清空云端+本地数据，不可恢复</div>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* 应用图标选择弹窗 */}
      {showIconSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !switchingIcon && setShowIconSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border-t border-line bg-ink-900 p-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cream">选择应用图标</h3>
              <button
                onClick={() => !switchingIcon && setShowIconSheet(false)}
                className="text-muted hover:text-cream"
                disabled={switchingIcon}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 蘑菇战士 */}
              <button
                onClick={() => void handleSwitchIcon("mushroom")}
                disabled={switchingIcon || currentIcon === "mushroom"}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all",
                  currentIcon === "mushroom"
                    ? "border-amber bg-amber/10"
                    : "border-line bg-ink-800 hover:border-amber/40",
                  switchingIcon && "opacity-50 pointer-events-none",
                )}
              >
                <img
                  src="/avatars/mushroom-warrior.jpg"
                  alt="蘑菇战士"
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div className="text-sm font-medium text-cream">蘑菇战士</div>
                {currentIcon === "mushroom" && (
                  <div className="flex items-center gap-1 text-xs text-amber-glow">
                    <Check size={12} /> 当前使用
                  </div>
                )}
              </button>

              {/* 鲍鱼战士 */}
              <button
                onClick={() => void handleSwitchIcon("abalone")}
                disabled={switchingIcon || currentIcon === "abalone"}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all",
                  currentIcon === "abalone"
                    ? "border-amber bg-amber/10"
                    : "border-line bg-ink-800 hover:border-amber/40",
                  switchingIcon && "opacity-50 pointer-events-none",
                )}
              >
                <img
                  src="/avatars/oyster-warrior.png"
                  alt="鲍鱼战士"
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div className="text-sm font-medium text-cream">鲍鱼战士</div>
                {currentIcon === "abalone" && (
                  <div className="flex items-center gap-1 text-xs text-amber-glow">
                    <Check size={12} /> 当前使用
                  </div>
                )}
              </button>
            </div>

            <p className="mt-5 text-center text-xs text-muted">
              切换后应用将自动重启，桌面图标会随之更新
            </p>

            {switchingIcon && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-amber-glow">
                <Loader2 size={14} className="animate-spin" />
                正在切换图标...
              </div>
            )}
          </div>
        </div>
      )}

      <DeleteAccountSheet
        open={openDeleteAccount}
        onClose={() => setOpenDeleteAccount(false)}
      />

      {/* 底部版权 */}
      <div className="pb-4 text-center">
        <p className="font-display text-sm text-muted">自卫吧</p>
        <p className="text-[11px] text-muted/70">与自己相处的片刻</p>
      </div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-mist">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium text-cream">{label}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
    </button>
  );
}
