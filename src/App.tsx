import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useThemeStore, applyTheme } from "@/store/useThemeStore";
import { initAuth } from "@/store/useAuthStore";
import Overview from "@/pages/Overview";
import Record from "@/pages/Record";
import History from "@/pages/History";
import Insights from "@/pages/Insights";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import Splash from "@/components/Splash";
import SettingsSheet from "@/components/SettingsSheet";
import AuthSheet from "@/components/AuthSheet";
import LockGate from "@/components/LockGate";
import RecordDetailProvider from "@/components/RecordDetailProvider";
import Toaster from "@/components/Toaster";
import FloatingTimer from "@/components/FloatingTimer";
import TimerStartSheet from "@/components/TimerStartSheet";
import TimerStopSheet from "@/components/TimerStopSheet";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import { useNotification } from "@/hooks/useNotification";

// 初始化认证监听（只执行一次）
initAuth();

export default function App() {
  const view = useUIStore((s) => s.view);
  const openSidebar = useUIStore((s) => s.openSidebar);
  const themeId = useThemeStore((s) => s.themeId);
  const customColor = useThemeStore((s) => s.customColor);
  const [showSplash, setShowSplash] = useState(true);
  useNotification();

  // 应用主题：启动时 + 切换时
  useEffect(() => {
    applyTheme(themeId, customColor);
  }, [themeId, customColor]);

  return (
    <div className="relative flex min-h-screen flex-col">
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}

      <LockGate />
      <SettingsSheet />
      <AuthSheet />

      {/* 侧边栏触发按钮 */}
      <button
        onClick={openSidebar}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-line/70 bg-ink-900/70 text-mist backdrop-blur-md transition-colors hover:border-amber/40 hover:text-amber-glow"
        aria-label="打开菜单"
      >
        <Menu size={18} />
      </button>

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-4 pt-10 sm:pt-14">
        {view === "overview" && <Overview />}
        {view === "record" && <Record />}
        {view === "history" && <History />}
        {view === "insights" && <Insights />}
      </main>
      <BottomNav />
      <Sidebar />
      <RecordDetailProvider />
      <FloatingTimer />
      <TimerStartSheet />
      <TimerStopSheet />
      <PWAUpdatePrompt />
      <Toaster />
    </div>
  );
}
