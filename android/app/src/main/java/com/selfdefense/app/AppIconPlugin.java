package com.selfdefense.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final String OYSTER_ACTIVITY = "com.selfdefense.app.MainActivity";
    private static final String MUSHROOM_ACTIVITY = "com.selfdefense.app.MainActivityMushroom";

    private static final String PREFS_NAME = "app_icon_prefs";
    private static final String KEY_CURRENT = "current_icon";

    /**
     * 获取当前图标主题
     * @return "oyster" 或 "mushroom"
     */
    private String resolveCurrentIcon() {
        PackageManager pm = getContext().getPackageManager();
        int stateMushroom = pm.getComponentEnabledSetting(
                new ComponentName(getContext(), MUSHROOM_ACTIVITY));
        int stateOyster = pm.getComponentEnabledSetting(
                new ComponentName(getContext(), OYSTER_ACTIVITY));

        // 只要蘑菇 alias 是 enabled，就当蘑菇主题（两者互斥）
        if (stateMushroom == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
            return "mushroom";
        }
        return "oyster";
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        String icon = getContext()
                .getSharedPreferences(PREFS_NAME, 0)
                .getString(KEY_CURRENT, null);
        if (icon == null) {
            icon = resolveCurrentIcon();
        }
        JSObject ret = new JSObject();
        ret.put("icon", icon);
        ret.put("supported", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void switchIcon(final PluginCall call) {
        String target = call.getString("icon");
        if (target == null) {
            call.reject("Missing required argument: icon");
            return;
        }
        if (!target.equals("oyster") && !target.equals("mushroom")) {
            call.reject("Invalid icon value. Expected 'oyster' or 'mushroom'.");
            return;
        }

        PackageManager pm = getContext().getPackageManager();
        ComponentName oyster = new ComponentName(getContext(), OYSTER_ACTIVITY);
        ComponentName mushroom = new ComponentName(getContext(), MUSHROOM_ACTIVITY);

        int oysterState = target.equals("oyster")
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        int mushroomState = target.equals("mushroom")
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

        try {
            // 先启用目标，再禁用旧的（中间短暂共存也没问题；避免全禁用导致无法启动）
            if (target.equals("mushroom")) {
                pm.setComponentEnabledSetting(mushroom, mushroomState,
                        PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(oyster, oysterState,
                        PackageManager.DONT_KILL_APP);
            } else {
                pm.setComponentEnabledSetting(oyster, oysterState,
                        PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom, mushroomState,
                        PackageManager.DONT_KILL_APP);
            }
        } catch (Exception e) {
            call.reject("Failed to switch icon: " + e.getMessage());
            return;
        }

        getContext()
                .getSharedPreferences(PREFS_NAME, 0)
                .edit()
                .putString(KEY_CURRENT, target)
                .apply();

        JSObject ret = new JSObject();
        ret.put("icon", target);
        call.resolve(ret);
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }
}
