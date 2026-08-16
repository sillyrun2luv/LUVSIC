package com.selfdefense.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 全局悬浮计时窗 Capacitor 插件
 * - hasPermission / requestPermission：悬浮窗（SYSTEM_ALERT_WINDOW）授权
 * - start / stop：启停 FloatingTimerService（前台服务 + 悬浮胶囊）
 */
@CapacitorPlugin(name = "FloatingTimer")
public class FloatingTimerPlugin extends Plugin {

    /** 是否已授予"显示在其他应用上层"权限 */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    /** 跳到系统"悬浮窗权限"设置页（返回后前端需再次 hasPermission 轮询确认） */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Intent i = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            // 极少数 ROM 禁止直达 → 退化为打开应用详情页
            try {
                Intent i = new Intent(
                        android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } catch (Exception e2) {
                JSObject ret = new JSObject();
                ret.put("opened", false);
                call.resolve(ret);
            }
        }
    }

    /** 启动悬浮窗服务（仅计时中调用；App 在前台，满足 FGS 启动限制） */
    @PluginMethod
    public void start(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", "no_permission");
            call.resolve(ret);
            return;
        }
        long startAt = call.getLong("startAt", 0L);
        String title = call.getString("title", "");
        String body = call.getString("body", "");

        Intent i = new Intent(getContext(), FloatingTimerService.class);
        i.setAction(FloatingTimerService.ACTION_START);
        i.putExtra(FloatingTimerService.EXTRA_START_AT, startAt);
        i.putExtra(FloatingTimerService.EXTRA_TITLE, title);
        i.putExtra(FloatingTimerService.EXTRA_BODY, body);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(i);
            } else {
                getContext().startService(i);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", e.getMessage() == null ? "start_failed" : e.getMessage());
            call.resolve(ret);
        }
    }

    /** 停止悬浮窗服务（用 stopService 直接停，规避 FGS 5 秒 startForeground 强制要求） */
    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(
                    new Intent(getContext(), FloatingTimerService.class));
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
