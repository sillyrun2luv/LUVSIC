package com.selfdefense.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundKeepAlive")
public class BackgroundKeepAlivePlugin extends Plugin {

    /**
     * 当前应用是否已加入电池优化忽略白名单
     * - Android < 6 (API < 23)：没有该机制 → 直接返回 true
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean ignored;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } else {
            ignored = true;
        }
        JSObject ret = new JSObject();
        ret.put("ignored", ignored);
        call.resolve(ret);
    }

    /**
     * 尝试弹系统「忽略电池优化」确认弹窗：
     * - 已加白 → {ignored:true, opened:false}
     * - 弹窗成功打开 → {ignored:false, opened:true}（前端稍后应再次 isIgnoring... 轮询）
     * - 部分 ROM 禁止 ACTION_REQUEST → 自动降级为打开应用详情页，opened=true
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(final PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            JSObject ret = new JSObject();
            ret.put("ignored", true);
            ret.put("opened", false);
            call.resolve(ret);
            return;
        }
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        String pkg = getContext().getPackageName();
        if (pm != null && pm.isIgnoringBatteryOptimizations(pkg)) {
            JSObject ret = new JSObject();
            ret.put("ignored", true);
            ret.put("opened", false);
            call.resolve(ret);
            return;
        }
        boolean opened = false;
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            opened = true;
        } catch (Exception e) {
            // 部分 ROM 拒绝弹 ACTION_REQUEST，退化为打开应用详情
            opened = openAppDetails();
        }
        JSObject ret = new JSObject();
        ret.put("ignored", false);
        ret.put("opened", opened);
        call.resolve(ret);
    }

    /**
     * 打开应用详情页：权限 / 自启动 / 后台电池策略 / 后台弹出界面 都在这个入口。
     * 国内 ROM（小米/华为/OPPO/vivo）建议引导用户点这里手动设置。
     */
    @PluginMethod
    public void openAppInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("opened", openAppDetails());
        call.resolve(ret);
    }

    /**
     * 打开系统「电池优化」白名单列表（用户可以手动找到本应用并切换为「不优化」）
     */
    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        boolean opened = false;
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent = new Intent(Settings.ACTION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            opened = true;
        } catch (Exception ignored) {
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    // ============== internal ==============

    private boolean openAppDetails() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
