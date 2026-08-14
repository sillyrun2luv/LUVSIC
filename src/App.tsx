import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useThemeStore, applyTheme } from "@/store/useThemeStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
import { initAuth } from "@/store/useAuthStore";
import { useFriendStore } from "@/store/useFriendStore";
import Overview from "@/pages/Overview";
import Record from "@/pages/Record";
import Friends from "@/pages/Friends";
import Profile from "@/pages/Profile";
import BottomNav from "@/components/BottomNav";
import Splash from "@/components/Splash";
import SettingsSheet from "@/components/SettingsSheet";
import AuthSheet from "@/components/AuthSheet";
import ProfileSetupSheet from "@/components/ProfileSetupSheet";
import FriendDetailSheet from "@/components/FriendDetailSheet";
import PKPopupSheet from "@/components/PKPopupSheet";
import LockGate from "@/components/LockGate";
import RecordDetailProvider from "@/components/RecordDetailProvider";
import Toaster from "@/components/Toaster";
import FloatingTimer from "@/components/FloatingTimer";
import TimerStartSheet from "@/components/TimerStartSheet";
import TimerStopSheet from "@/components/TimerStopSheet";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import AuthCallbackOverlay from "@/components/AuthCallbackOverlay";
import AnnouncementSheet from "@/components/AnnouncementSheet";
import { useAnnouncementStore } from "@/store/useAnnouncementStore";
import { useNotification } from "@/hooks/useNotification";
import { startAutoSync } from "@/lib/autoSync";

// 初始化认证监听（只执行一次）
initAuth();
// 启动自动云同步（登录后按需自动上传记录/设置/资料/主题）
startAutoSync();

export default function App() {
  const view = useUIStore((s) => s.view);
  const themeId = useThemeStore((s) => s.themeId);
  const customColor = useThemeStore((s) => s.customColor);
  const user = useAuthStore((s) => s.user);
  const profileName = useProfileStore((s) => s.name);
  const profileSetupDismissedFor = useProfileStore((s) => s.profileSetupDismissedFor);
  const openProfileSetup = useUIStore((s) => s.openProfileSetup);
  const [showSplash, setShowSplash] = useState(true);
  const fetchAnnouncement = useAnnouncementStore((s) => s.fetchActive);
  useNotification();

  // 启动闪屏结束后拉取公告
  useEffect(() => {
    if (!showSplash) fetchAnnouncement();
  }, [showSplash, fetchAnnouncement]);

  // 应用主题：启动时 + 切换时
  useEffect(() => {
    applyTheme(themeId, customColor);
  }, [themeId, customColor]);

  // 登录后引导设置昵称：
  // - 仅在 user.id 发生变化时触发（避免昵称变化、user 引用变化反复弹）
  // - 昵称是默认"我" + 该用户未 dismiss 过 → 弹窗
  const lastTriggeredUserId = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.id ?? null;
    if (!uid) {
      lastTriggeredUserId.current = null;
      return;
    }
    // 同一个 user.id 只处理一次（防止 profileName 后续变化导致重复弹）
    if (lastTriggeredUserId.current === uid) return;
    lastTriggeredUserId.current = uid;

    const needSetup =
      profileName === "我" && profileSetupDismissedFor !== uid;
    if (needSetup) {
      // 延迟一点，让 AuthSheet 先关闭
      const t = setTimeout(() => openProfileSetup(), 400);
      return () => clearTimeout(t);
    }
  }, [user, profileName, profileSetupDismissedFor, openProfileSetup]);

  // 进入好友页面时刷新好友数据，顺便更新待审核红点
  useEffect(() => {
    if (view === "friends") {
      useFriendStore.getState().refreshAll();
    } else {
      // 其他页面只轻量刷新红点（登录后最多 30s 有效，登录态未就绪忽略）
      useFriendStore.getState().refreshPendingCount().catch(() => {});
    }
  }, [view]);

  return (
    <div className="relative flex min-h-screen flex-col">
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}

      <LockGate />
      <SettingsSheet />
      <AuthSheet />
      <ProfileSetupSheet />
      <FriendDetailSheet />
      <PKPopupSheet />

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-4 pt-6 sm:pt-8">
        {view === "overview" && <Overview />}
        {view === "record" && <Record />}
        {view === "friends" && <Friends />}
        {view === "profile" && <Profile />}
      </main>
      <BottomNav />
      <RecordDetailProvider />
      <FloatingTimer />
      <TimerStartSheet />
      <TimerStopSheet />
      <PWAUpdatePrompt />
      <Toaster />
      <AuthCallbackOverlay />
      <AnnouncementSheet />
    </div>
  );
}
