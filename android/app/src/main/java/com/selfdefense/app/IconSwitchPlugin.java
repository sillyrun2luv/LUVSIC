package com.selfdefense.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IconSwitch")
public class IconSwitchPlugin extends Plugin {

    private static final String PREFS_NAME = "icon_switch_prefs";
    private static final String KEY_CURRENT_ICON = "current_icon";
    private static final String ICON_MUSHROOM = "mushroom";
    private static final String ICON_ABALONE = "abalone";
    private static final String ICON_DEFAULT = "default";

    private static final String MUSHROOM_ALIAS = "com.selfdefense.app.MushroomAlias";
    private static final String ABALONE_ALIAS = "com.selfdefense.app.AbaloneAlias";
    private static final String DEFAULT_ALIAS = "com.selfdefense.app.DefaultAlias";

    /**
     * 按 PackageManager 实际的 alias enabled 状态反推当前图标，
     * 这是"最权威"的判断来源；用于 SharedPrefs 为空/升级/回写时对齐。
     */
    public static String resolveCurrentIconByPm(Context ctx) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ComponentName mushroom = new ComponentName(ctx, MUSHROOM_ALIAS);
            ComponentName abalone = new ComponentName(ctx, ABALONE_ALIAS);
            ComponentName defaultAlias = new ComponentName(ctx, DEFAULT_ALIAS);
            final int ENABLED = PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
            int m = pm.getComponentEnabledSetting(mushroom);
            int a = pm.getComponentEnabledSetting(abalone);
            int d = pm.getComponentEnabledSetting(defaultAlias);
            // 哪个 alias 处于 ENABLED 就以谁为准
            if (a == ENABLED) return ICON_ABALONE;
            if (d == ENABLED) return ICON_DEFAULT;
            if (m == ENABLED) return ICON_MUSHROOM;
            // 三个都没显式 ENABLED（新装或默认）：
            //   DefaultAlias 默认为 enabled（Manifest android:enabled="true"）
            //   但如果 manifest 里的 MushroomAlias 默认是 enabled 的话就是 mushroom。
            //   这里保持"兼容旧版本：若三个都无显式 ENABLED 状态返回 mushroom"，
            //   因为旧用户升级上来图标不会被重置。
            return ICON_MUSHROOM;
        } catch (Exception ignored) {
            return ICON_MUSHROOM;
        }
    }

    @PluginMethod
    public void switchIcon(PluginCall call) {
        String iconType = call.getString("icon", ICON_MUSHROOM);
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        ComponentName mushroom = new ComponentName(ctx, MUSHROOM_ALIAS);
        ComponentName abalone = new ComponentName(ctx, ABALONE_ALIAS);
        ComponentName defaultAlias = new ComponentName(ctx, DEFAULT_ALIAS);
        final int DISABLED = PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        final int ENABLED = PackageManager.COMPONENT_ENABLED_STATE_ENABLED;

        try {
            // 先启用目标 alias（保证系统任何时刻都有至少一个 LAUNCHER 入口），
            // 然后再禁用另外两个别名，避免切换中途 Launcher 找不到入口导致失败。
            if (ICON_ABALONE.equals(iconType)) {
                pm.setComponentEnabledSetting(abalone, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(defaultAlias, DISABLED, PackageManager.DONT_KILL_APP);
            } else if (ICON_DEFAULT.equals(iconType)) {
                pm.setComponentEnabledSetting(defaultAlias, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(abalone, DISABLED, PackageManager.DONT_KILL_APP);
            } else {
                pm.setComponentEnabledSetting(mushroom, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(abalone, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(defaultAlias, DISABLED, PackageManager.DONT_KILL_APP);
            }
            String normalized = (ICON_ABALONE.equals(iconType)) ? ICON_ABALONE
                    : (ICON_DEFAULT.equals(iconType)) ? ICON_DEFAULT : ICON_MUSHROOM;

            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_CURRENT_ICON, normalized).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("icon", iconType);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to switch icon: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCurrentIcon(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String icon = prefs.getString(KEY_CURRENT_ICON, null);

        // 以 PackageManager 真实 alias 状态为准（权威）：
        //   - 避免覆盖安装/旧版本升级时 SharedPrefs 为空或过期仍显示"蘑菇战士"
        //   - 如果解析结果和 SharedPrefs 不一致，同步写回去下次直接命中
        String byPm = resolveCurrentIconByPm(ctx);
        if (!byPm.equals(icon)) {
            prefs.edit().putString(KEY_CURRENT_ICON, byPm).apply();
            icon = byPm;
        }
        if (icon == null) icon = ICON_MUSHROOM;

        JSObject ret = new JSObject();
        ret.put("icon", icon);
        call.resolve(ret);
    }

    @PluginMethod
    public void restartApp(PluginCall call) {
        Context ctx = getContext();
        Intent intent = ctx.getPackageManager()
                .getLaunchIntentForPackage(ctx.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
        }
        call.resolve();
    }
}
