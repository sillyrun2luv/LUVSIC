package com.selfdefense.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconSwitchPlugin.class);
        super.onCreate(savedInstanceState);
        applySavedIcon();
    }

    private void applySavedIcon() {
        Context ctx = this;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(
                    "icon_switch_prefs", Context.MODE_PRIVATE);
            String currentIcon = prefs.getString("current_icon", "mushroom");

            PackageManager pm = ctx.getPackageManager();
            ComponentName mushroom = new ComponentName(ctx,
                    "com.selfdefense.app.MushroomAlias");
            ComponentName abalone = new ComponentName(ctx,
                    "com.selfdefense.app.AbaloneAlias");

            if ("abalone".equals(currentIcon)) {
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
        } catch (Exception ignored) {
        }
    }
}
