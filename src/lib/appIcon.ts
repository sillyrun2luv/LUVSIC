import { registerPlugin } from "@capacitor/core";

export type AppIconName = "oyster" | "mushroom";

interface AppIconPlugin {
  getIcon(): Promise<{ icon: AppIconName; supported: boolean }>;
  switchIcon(options: { icon: AppIconName }): Promise<{ icon: AppIconName }>;
  isSupported(): Promise<{ supported: boolean }>;
}

// 原生端注册了 @CapacitorPlugin(name = "AppIcon")，Web 端做个 mock fallback
const AppIcon = registerPlugin<AppIconPlugin>("AppIcon", {
  web: () =>
    new (class {
      private current: AppIconName = "oyster";
      async getIcon() {
        return { icon: this.current, supported: false };
      }
      async switchIcon(o: { icon: AppIconName }) {
        this.current = o.icon;
        return { icon: this.current };
      }
      async isSupported() {
        return { supported: false };
      }
    })(),
});

export function getAppIcon() {
  return AppIcon.getIcon();
}

export function switchAppIcon(icon: AppIconName) {
  return AppIcon.switchIcon({ icon });
}

export function isAppIconSwitchSupported() {
  return AppIcon.isSupported();
}
