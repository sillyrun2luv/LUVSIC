import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, useThemeStore } from './store/useThemeStore'
import './index.css'

// 启动前同步应用主题，避免非默认主题首屏闪烁
{
  const { themeId, customColor } = useThemeStore.getState();
  applyTheme(themeId, customColor);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
