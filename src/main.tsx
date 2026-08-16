import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, useThemeStore } from './store/useThemeStore'
import { setupTimerNotification } from './lib/timerNotify'
import './index.css'

// 启动前同步应用主题，避免非默认主题首屏闪烁
{
  const { themeId, customColor } = useThemeStore.getState();
  applyTheme(themeId, customColor);
}

// 计时通知：计时中在通知栏常驻，点按返回 App 并打开「记录感受」页（仅原生）
setupTimerNotification();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
