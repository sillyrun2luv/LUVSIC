import { Capacitor, registerPlugin, Plugin } from "@capacitor/core";

interface SaveFileOptions {
  filename: string;
  content: string;
  mimeType: string;
}

/* ==================== 原生 FileSavePlugin 接口 ==================== */
interface FileSavePluginInstance extends Plugin {
  saveToDownloads(options: {
    filename: string;
    contentBase64: string;
    mimeType?: string;
  }): Promise<{ success: boolean; filename: string; path: string; size: number }>;
}

const FileSavePlugin = registerPlugin<FileSavePluginInstance>("FileSavePlugin", {
  // web fallback（Android 包不会走到这里，仅在非原生环境时防止注册报错）
  web: {
    async saveToDownloads() {
      throw new Error("FileSavePlugin is Android-only; falling back to <a download>");
    },
  },
});

/**
 * 把字符串（JSON / 带 BOM 的 HTML-Excel）转成 UTF-8 bytes → Base64。
 * 兼容性：`unescape(encodeURIComponent(...))` 方案比 TextEncoder 更老，但在
 * 所有 Android WebView 版本都可用，且正确处理中文、BOM、Emoji 等。
 */
function stringToUtf8Base64(str: string): string {
  const percentEncoded = encodeURIComponent(str);
  // 将 %xx 序列转为单字节字符（Latin-1 范围）
  const binaryString = unescape(percentEncoded);
  return btoa(binaryString);
}

/**
 * 保存文件：
 *  - 安卓 Capacitor 原生环境 → 通过 FileSavePlugin 写入系统公共 "下载" 目录，
 *    用户在文件管理器/下载 App 里直接可见。
 *  - 纯 Web / 浏览器预览 → 保持原有的 Blob + <a download> 方案。
 */
export async function saveFile(opts: SaveFileOptions): Promise<void> {
  const { filename, content, mimeType } = opts;

  if (Capacitor.isNativePlatform()) {
    try {
      const contentBase64 = stringToUtf8Base64(content);
      await FileSavePlugin.saveToDownloads({
        filename,
        contentBase64,
        mimeType,
      });
      return;
    } catch (err) {
      // 原生保存失败时兜底走 Web 方案（防止用户丢失数据）
      console.warn("[FileSave] Native save failed, fallback to <a download>:", err);
    }
  }

  // Web / 兜底方案（原有实现）
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
