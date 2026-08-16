import { Capacitor, Plugin, registerPlugin } from "@capacitor/core";

interface BackgroundKeepAlivePlugin extends Plugin {
  isIgnoringBatteryOptimizations(): Promise<{ ignored: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ ignored: boolean; opened: boolean }>;
  openAppInfo(): Promise<{ opened: boolean }>;
  openBatteryOptimizationSettings(): Promise<{ opened: boolean }>;
}

const plugin = registerPlugin<BackgroundKeepAlivePlugin>("BackgroundKeepAlive", {
  web: {
    async isIgnoringBatteryOptimizations() { return { ignored: true }; },
    async requestIgnoreBatteryOptimizations() { return { ignored: true, opened: false }; },
    async openAppInfo() { return { opened: false }; },
    async openBatteryOptimizationSettings() { return { opened: false }; },
  },
});

export interface KeepAliveStatus {
  ignored: boolean;
}

/** 是否已加入电池优化白名单（原生环境真实查询，Web 端当 true）*/
export async function checkKeepAliveStatus(): Promise<KeepAliveStatus> {
  if (!Capacitor.isNativePlatform()) return { ignored: true };
  try {
    return await plugin.isIgnoringBatteryOptimizations();
  } catch {
    return { ignored: false };
  }
}

/** 请求加入电池优化忽略白名单 → 返回 {ignored, opened}；
 *  opened=true 说明已弹系统弹窗（或跳系统设置页），后续要再 check 一次。
 */
export async function requestIgnoreBatteryOptimizations(): Promise<{
  ignored: boolean; opened: boolean;
}> {
  if (!Capacitor.isNativePlatform()) return { ignored: true, opened: false };
  try {
    return await plugin.requestIgnoreBatteryOptimizations();
  } catch {
    return { ignored: false, opened: false };
  }
}

/** 打开应用详情页（用户手动设置 自启动 / 锁后台 / 无限制省电 / 后台弹出界面）*/
export async function openAppInfo(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { opened } = await plugin.openAppInfo();
    return opened;
  } catch {
    return false;
  }
}

/** 打开系统电池优化白名单列表（用户手动切换应用为「不优化」）*/
export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { opened } = await plugin.openBatteryOptimizationSettings();
    return opened;
  } catch {
    return false;
  }
}
