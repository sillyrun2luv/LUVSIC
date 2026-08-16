package com.selfdefense.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 深链 scheme：与前端 emailRedirectTo 保持一致 */
    private static final String DEEPLINK_SCHEME = "com.selfdefense.app";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconSwitchPlugin.class);
        registerPlugin(FileSavePlugin.class);
        registerPlugin(BackgroundKeepAlivePlugin.class);
        registerPlugin(FloatingTimerPlugin.class);
        super.onCreate(savedInstanceState);
        applySavedIcon();
        // 冷启动若由邮件深链拉起，launch intent 里带 data
        handleDeepLinkIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // App 已在后台运行时，点邮件链接会走这里
        handleDeepLinkIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // 兜底：若 onCreate 时 WebView 尚未加载完成，onResume 再注入一次
        handleDeepLinkIntent(getIntent());
    }

    /**
     * 捕获深链 intent，把完整 URL 注入 WebView 交给 JS 处理。
     * 邮件验证回跳形如：com.selfdefense.app://auth/callback#access_token=...&type=signup
     */
    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = intent.getData();
        if (uri == null) return;
        if (!DEEPLINK_SCHEME.equals(uri.getScheme())) return;
        final String url = uri.toString();
        // 多次尝试注入：覆盖 WebView 页面尚未加载完成的时序窗口
        injectDeepLink(url);
        if (getWindow() != null && getWindow().getDecorView() != null) {
            getWindow().getDecorView().postDelayed(() -> injectDeepLink(url), 250);
            getWindow().getDecorView().postDelayed(() -> injectDeepLink(url), 700);
        }
    }

    private void injectDeepLink(String url) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            // JSONObject.quote 会产出带双引号的 JSON 字符串，避免 URL 中的特殊字符破坏 JS
            String safe = org.json.JSONObject.quote(url);
            String js = "(function(){try{window.__ZIWEIBA_DEEPLINK__=" + safe
                    + ";window.dispatchEvent(new CustomEvent('ziweiba-deeplink',{detail:"
                    + safe + "}));}catch(e){}})();";
            final WebView wv = getBridge().getWebView();
            wv.post(() -> wv.evaluateJavascript(js, null));
        } catch (Exception ignored) {
            // WebView 尚未就绪等情况，交给后续重试
        }
    }


    private void applySavedIcon() {
        Context ctx = this;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(
                    "icon_switch_prefs", Context.MODE_PRIVATE);
            // 1) 优先用 PackageManager 里实际的 alias enabled 状态反推当前图标，
            //    用于升级/覆盖安装后 SharedPrefs 为空或过期时正确对齐，避免 UI
            //    永远显示"蘑菇战士"。
            String byPm = IconSwitchPlugin.resolveCurrentIconByPm(ctx);
            String saved = prefs.getString("current_icon", null);
            if (saved == null || !saved.equals(byPm)) {
                prefs.edit().putString("current_icon", byPm).apply();
                saved = byPm;
            }
            String currentIcon = (saved != null) ? saved : "mushroom";

            PackageManager pm = ctx.getPackageManager();
            ComponentName mushroom = new ComponentName(ctx,
                    "com.selfdefense.app.MushroomAlias");
            ComponentName abalone = new ComponentName(ctx,
                    "com.selfdefense.app.AbaloneAlias");
            ComponentName defaultAlias = new ComponentName(ctx,
                    "com.selfdefense.app.DefaultAlias");
            final int DISABLED = PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            final int ENABLED = PackageManager.COMPONENT_ENABLED_STATE_ENABLED;

            // 先启用目标 alias（至少有一个 LAUNCHER 入口始终可用），再禁用其他两个，
            // 避免中间 0 入口导致 Launcher 图标消失或重启失败。
            if ("abalone".equals(currentIcon)) {
                pm.setComponentEnabledSetting(abalone, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(defaultAlias, DISABLED, PackageManager.DONT_KILL_APP);
            } else if ("default".equals(currentIcon)) {
                pm.setComponentEnabledSetting(defaultAlias, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(mushroom, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(abalone, DISABLED, PackageManager.DONT_KILL_APP);
            } else {
                pm.setComponentEnabledSetting(mushroom, ENABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(abalone, DISABLED, PackageManager.DONT_KILL_APP);
                pm.setComponentEnabledSetting(defaultAlias, DISABLED, PackageManager.DONT_KILL_APP);
            }
        } catch (Exception ignored) {
        }
    }
}
