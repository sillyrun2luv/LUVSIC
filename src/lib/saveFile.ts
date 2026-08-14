interface SaveFileOptions {
  filename: string;
  content: string;
  mimeType: string;
}

/**
 * 保存文件（纯 Web 方案）。
 * 通过 Blob + <a download> 触发浏览器/WebView 下载。
 *
 * 注：在 Android Capacitor WebView 里下载可靠性有限，
 * 后续接入 @capacitor/filesystem + @capacitor/share 后可改为原生保存。
 */
export async function saveFile(opts: SaveFileOptions): Promise<void> {
  const { filename, content, mimeType } = opts;
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
