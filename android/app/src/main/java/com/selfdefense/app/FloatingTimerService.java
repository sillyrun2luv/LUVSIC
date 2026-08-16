package com.selfdefense.app;

import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

/**
 * 全局悬浮计时窗（应用外可见）
 * ---------------------------------------------------------------------------
 * 设计要点（针对旧版 bug 的修正）：
 * 1. 时间由【原生服务自己按墙钟计算】（startAt 一次性传入），JS 不再每秒推送文本
 *    —— 解决 JS/Native 不同步、WebView 休眠后悬浮窗卡死不走的 bug。
 * 2. 前台服务 + specialUse 类型 —— 解决退出 App 后悬浮窗秒被系统杀掉的 bug；
 *    前台服务的常驻通知同时充当"计时中"兜底入口（点按 = 结束计时并回 App）。
 * 3. 所有交互只做一件事：拉起 MainActivity 并带上 deep link
 *    （com.selfdefense.app://floating/open|stop），数据操作全部交回 JS 处理，
 *    原生层零业务逻辑，杜绝状态不一致。
 * ---------------------------------------------------------------------------
 * 交互：
 *   - 拖动胶囊 → 移动位置（进程存活期内记忆位置）
 *   - 点胶囊本体 → 打开 App（floating/open）
 *   - 点右侧方块 → 结束计时：打开 App 并直接进入「记录感受」页（floating/stop）
 */
public class FloatingTimerService extends Service {

    public static final String ACTION_START = "com.selfdefense.app.FLOATING_TIMER_START";
    public static final String ACTION_STOP = "com.selfdefense.app.FLOATING_TIMER_STOP";
    public static final String EXTRA_START_AT = "startAt";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";

    public static final String URI_OPEN = "com.selfdefense.app://floating/open";
    public static final String URI_STOP = "com.selfdefense.app://floating/stop";

    private static final String CHANNEL_ID = "ziweiba_timer_overlay";
    private static final int NOTIF_ID = 900002;

    /** 进程存活期内记忆的悬浮窗位置（退出 App 再进来不漂移） */
    private static int savedX = -1;
    private static int savedY = -1;

    private WindowManager wm;
    private View overlayRoot;
    private TextView timeText;
    private WindowManager.LayoutParams params;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long startAt = 0L;
    private ObjectAnimator pulseAnim;
    private String notifTitle = "自卫吧 · 计时中";
    private String notifBody = "点击结束计时并记录感受";
    private boolean overlayAdded = false;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (timeText != null) {
                long elapsed = System.currentTimeMillis() - startAt;
                if (elapsed < 0) elapsed = 0;
                long totalSec = elapsed / 1000;
                timeText.setText(String.format(java.util.Locale.US,
                        "%02d:%02d", totalSec / 60, totalSec % 60));
            }
            handler.postDelayed(this, 500);
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            teardown();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            long sa = intent.getLongExtra(EXTRA_START_AT, 0L);
            if (sa > 0) startAt = sa;
            String t = intent.getStringExtra(EXTRA_TITLE);
            if (t != null && !t.isEmpty()) notifTitle = t;
            String b = intent.getStringExtra(EXTRA_BODY);
            if (b != null && !b.isEmpty()) notifBody = b;
        }

        // 未授权悬浮窗 → 直接退出，不 crash
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // 1. 先升级为前台服务（5 秒内必须调用，否则 ANR/崩溃）
        startAsForeground();

        // 2. 再添加/更新悬浮窗
        try {
            if (overlayRoot == null) {
                buildOverlay();
                wm.addView(overlayRoot, params);
                overlayAdded = true;
            }
        } catch (Exception e) {
            // WindowManager 异常（极端 ROM 情况）→ 退化为纯前台服务（只剩通知入口）
            overlayRoot = null;
            overlayAdded = false;
        }

        handler.removeCallbacks(tick);
        handler.post(tick);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        teardown();
        super.onDestroy();
    }

    private void teardown() {
        handler.removeCallbacks(tick);
        if (pulseAnim != null) {
            pulseAnim.cancel();
            pulseAnim = null;
        }
        if (overlayRoot != null && overlayAdded) {
            try {
                wm.removeView(overlayRoot);
            } catch (Exception ignored) {
            }
        }
        overlayRoot = null;
        overlayAdded = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    /* ------------------------- 前台通知 ------------------------- */

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "计时悬浮窗", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private Notification buildNotification() {
        Intent i = new Intent(this, MainActivity.class);
        i.setData(Uri.parse(URI_STOP));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flag = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, NOTIF_ID, i, flag);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(notifTitle)
                .setContentText(notifBody)
                .setOngoing(true)
                .setSilent(true)
                .setContentIntent(pi)
                .setOnlyAlertOnce(true)
                .build();
    }

    private void openApp(String uri) {
        try {
            Intent i = new Intent(this, MainActivity.class);
            i.setData(Uri.parse(uri));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
        } catch (Exception ignored) {
        }
    }

    /* ------------------------- 悬浮窗 UI ------------------------- */

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics()));
    }

    private void buildOverlay() {
        Context ctx = this;

        // ---- 胶囊容器 ----
        LinearLayout capsule = new LinearLayout(ctx);
        capsule.setOrientation(LinearLayout.HORIZONTAL);
        int pad = dp(14);
        capsule.setPadding(pad, dp(9), dp(9), dp(9));
        capsule.setGravity(Gravity.CENTER_VERTICAL);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xE6261214);            // 暗红底
        bg.setStroke(Math.max(1, dp(1)), 0x80F87171); // 红描边
        bg.setCornerRadius(dp(36));
        capsule.setBackground(bg);

        // ---- 脉动红点 ----
        View dot = new View(ctx);
        int dotSize = dp(10);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dotSize, dotSize);
        dotLp.rightMargin = dp(10);
        dot.setLayoutParams(dotLp);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor(0xFFF87171);
        dot.setBackground(dotBg);
        pulseAnim = ObjectAnimator.ofFloat(dot, View.ALPHA, 1f, 0.25f, 1f);
        pulseAnim.setDuration(1400);
        pulseAnim.setRepeatCount(ObjectAnimator.INFINITE);
        pulseAnim.start();

        // ---- 时间文本 ----
        timeText = new TextView(ctx);
        timeText.setText("00:00");
        timeText.setTextColor(Color.WHITE);
        timeText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        timeText.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        timeText.setLetterSpacing(0.05f);
        LinearLayout.LayoutParams textLp = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textLp.rightMargin = dp(10);
        timeText.setLayoutParams(textLp);

        // ---- 方形停止按钮 ----
        TextView square = new TextView(ctx);
        square.setText("■");
        square.setTextColor(0xFF450A0A);
        square.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        int sq = dp(34);
        LinearLayout.LayoutParams sqLp = new LinearLayout.LayoutParams(sq, sq);
        square.setLayoutParams(sqLp);
        square.setGravity(Gravity.CENTER);
        GradientDrawable sqBg = new GradientDrawable();
        sqBg.setColor(0xCCFECACA);
        sqBg.setCornerRadius(dp(9));
        square.setBackground(sqBg);

        capsule.addView(dot);
        capsule.addView(timeText);
        capsule.addView(square);

        // ---- WindowManager 参数 ----
        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;

        Point size = new Point();
        wm.getDefaultDisplay().getSize(size);
        if (savedX < 0 || savedY < 0) {
            // 初始位置：屏幕右侧偏上
            savedX = Math.max(0, size.x - dp(170));
            savedY = dp(110);
        }
        params.x = savedX;
        params.y = savedY;

        // ---- 胶囊拖动 / 点按 ----
        final int[] downRaw = new int[2];
        final int[] downPos = new int[2];
        final boolean[] moved = {false};
        capsule.setOnTouchListener((v, ev) -> {
            switch (ev.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downRaw[0] = (int) ev.getRawX();
                    downRaw[1] = (int) ev.getRawY();
                    downPos[0] = params.x;
                    downPos[1] = params.y;
                    moved[0] = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    int dx = (int) ev.getRawX() - downRaw[0];
                    int dy = (int) ev.getRawY() - downRaw[1];
                    if (!moved[0] && Math.abs(dx) + Math.abs(dy) > dp(8)) moved[0] = true;
                    if (moved[0]) {
                        params.x = downPos[0] + dx;
                        params.y = downPos[1] + dy;
                        try {
                            wm.updateViewLayout(overlayRoot, params);
                        } catch (Exception ignored) {
                        }
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (moved[0]) {
                        savedX = params.x;
                        savedY = params.y;
                    } else if (ev.getActionMasked() == MotionEvent.ACTION_UP) {
                        openApp(URI_OPEN);
                    }
                    return true;
                default:
                    return false;
            }
        });

        // ---- 方块按钮：结束计时 → 回 App 打开记录感受页 ----
        square.setOnTouchListener((v, ev) -> {
            if (ev.getActionMasked() == MotionEvent.ACTION_UP) {
                // 松手位置仍在按钮内才算点击（避免拖动误触）
                int[] loc = new int[2];
                v.getLocationOnScreen(loc);
                if (ev.getRawX() >= loc[0] && ev.getRawX() <= loc[0] + v.getWidth()
                        && ev.getRawY() >= loc[1] && ev.getRawY() <= loc[1] + v.getHeight()) {
                    openApp(URI_STOP);
                }
            }
            return true;
        });

        overlayRoot = capsule;
    }
}
