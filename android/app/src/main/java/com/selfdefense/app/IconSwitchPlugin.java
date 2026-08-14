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

    private static final String MUSHROOM_ALIAS = "com.selfdefense.app.MushroomAlias";
    private static final String ABALONE_ALIAS = "com.selfdefense.app.AbaloneAlias";

    @PluginMethod
    public void switchIcon(PluginCall call) {
        String iconType = call.getString("icon", ICON_MUSHROOM);
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        ComponentName mushroom = new ComponentName(ctx, MUSHROOM_ALIAS);
        ComponentName abalone = new ComponentName(ctx, ABALONE_ALIAS);

        try {
            if (ICON_ABALONE.equals(iconType)) {
                pm.setComponentEnabledSetting(mushroom,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(abalone,
                        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                        PackageManager.DONT_KILL_APP);
            } else {
                pm.setComponentEnabledSetting(abalone,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom,
                        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                        PackageManager.DONT_KILL_APP);
            }

            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_CURRENT_ICON, iconType).apply();

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
        String icon = prefs.getString(KEY_CURRENT_ICON, ICON_MUSHROOM);

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
