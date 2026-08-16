import { Capacitor, Plugin } from "@capacitor/core";

export type AppIconType = "mushroom" | "abalone" | "default";

interface IconSwitchPlugin extends Plugin {
  switchIcon(options: { icon: AppIconType }): Promise<{ success: boolean; icon: AppIconType }>;
  getCurrentIcon(): Promise<{ icon: AppIconType }>;
  restartApp(): Promise<void>;
}

const plugin = Capacitor.registerPlugin<IconSwitchPlugin>("IconSwitch");

export async function switchAppIcon(icon: AppIconType): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await plugin.switchIcon({ icon });
}

export async function getCurrentAppIcon(): Promise<AppIconType> {
  if (!Capacitor.isNativePlatform()) return "mushroom";
  const { icon } = await plugin.getCurrentIcon();
  return icon;
}

export async function restartApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await plugin.restartApp();
}
