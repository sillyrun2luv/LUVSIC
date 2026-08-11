/** App 版本配置 */

// 当前版本号（每次发新版需要手动改这里）
export const APP_VERSION = "1.0.1";

// 版本检查 URL（从 GitHub 仓库拉取 version.json）
// 仓库建好后替换成你的实际地址
export const VERSION_CHECK_URL =
  "https://cdn.jsdelivr.net/gh/sillyrun2luv/LUVSIC@main/version.json";

export interface VersionInfo {
  version: string;
  apkUrl: string;
  notes?: string;
}

/** 比较版本号，返回 true 表示 remote 比 local 新 */
export function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/** 检查更新 */
export async function checkUpdate(): Promise<{ hasUpdate: boolean; info?: VersionInfo }> {
  try {
    const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`);
    if (!res.ok) return { hasUpdate: false };
    const info: VersionInfo = await res.json();
    if (isNewerVersion(info.version, APP_VERSION)) {
      return { hasUpdate: true, info };
    }
    return { hasUpdate: false };
  } catch {
    return { hasUpdate: false };
  }
}
