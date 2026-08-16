import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useThemeStore, applyTheme } from "@/store/useThemeStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
import { initAuth } from "@/store/useAuthStore";
import { useFriendStore } from "@/store/useFriendStore";
import { t } from "@/store/useI18nStore";
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

initAuth();
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

  useEffect(() => {
    if (!showSplash) fetchAnnouncement();
  }, [showSplash, fetchAnnouncement]);

  useEffect(() => {
    applyTheme(themeId, customColor);
  }, [themeId, customColor]);

  const lastTriggeredUserId = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.id ?? null;
    if (!uid) {
      lastTriggeredUserId.current = null;
      return;
    }
    if (lastTriggeredUserId.current === uid) return;
    lastTriggeredUserId.current = uid;

    const needSetup =
      profileName === t("common.me") && profileSetupDismissedFor !== uid;
    if (needSetup) {
      const timer = setTimeout(() => openProfileSetup(), 400);
      return () => clearTimeout(timer);
    }
  }, [user, profileName, profileSetupDismissedFor, openProfileSetup]);

  // 进入好友（星球）页面时刷新好友数据，顺便更新待审核/提醒红点
  useEffect(() => {
    if (view === "friends") {
      useFriendStore.getState().refreshAll();
      useFriendStore.getState().refreshReminderUnread().catch(() => {});
    } else {
      // 其他页面只轻量刷新红点（登录后最多 30s 有效，登录态未就绪忽略）
      useFriendStore.getState().refreshPendingCount().catch(() => {});
      useFriendStore.getState().refreshReminderUnread().catch(() => {});
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
