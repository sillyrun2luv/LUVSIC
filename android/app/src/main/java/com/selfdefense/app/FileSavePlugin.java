package com.selfdefense.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * 将文件保存到系统公共 "下载" (Downloads) 目录的原生插件。
 *
 * 优势：
 * - 不依赖 @capacitor/filesystem，避免 JDK 21 / AGP 版本冲突。
 * - Android 10+ (API 29) 使用 MediaStore.Downloads，无需任何存储权限。
 * - Android 9 及以下使用 Environment.getExternalStoragePublicDirectory，
 *   仅需在 manifest 声明 WRITE_EXTERNAL_STORAGE (maxSdkVersion 28)。
 * - 任何文件管理器 / "下载" App 都能直接看到（解决 WebView 下载后用户找不到的问题）。
 *
 * 前端传值：文件名 + 文件内容的 UTF-8 bytes Base64 + MIME 类型。
 */
@CapacitorPlugin(name = "FileSavePlugin")
public class FileSavePlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String base64 = call.getString("contentBase64");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (filename == null || base64 == null) {
            call.reject("filename and contentBase64 are required");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (Exception e) {
            call.reject("Invalid base64 content: " + e.getMessage());
            return;
        }

        try {
            String savedPath = writeToDownloads(filename, mimeType, bytes);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filename", filename);
            ret.put("path", savedPath);
            ret.put("size", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save file: " + e.getMessage());
        }
    }

    private String writeToDownloads(String filename, String mimeType, byte[] bytes) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return writeViaMediaStore(filename, mimeType, bytes);
        } else {
            return writeViaLegacyPublicDir(filename, bytes);
        }
    }

    /** Android 10+：MediaStore.Downloads（无需权限）*/
    private String writeViaMediaStore(String filename, String mimeType, byte[] bytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        // 直接放在 Download 根目录（RELATIVE_PATH 不用子目录）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        }

        OutputStream os = null;
        try {
            android.net.Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("Failed to create MediaStore entry");
            os = resolver.openOutputStream(uri);
            if (os == null) throw new IOException("Failed to open output stream");
            os.write(bytes);
            os.flush();
            return uri.toString();
        } finally {
            if (os != null) {
                try { os.close(); } catch (IOException ignored) {}
            }
        }
    }

    /** Android 9 及以下：Environment.getExternalStoragePublicDirectory + WRITE_EXTERNAL_STORAGE 权限 */
    @SuppressWarnings("deprecation")
    private String writeViaLegacyPublicDir(String filename, byte[] bytes) throws IOException {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                throw new IOException("Failed to create Downloads directory");
            }
        }
        File file = new File(dir, buildUniqueFilename(dir, filename));
        FileOutputStream fos = null;
        try {
            fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.flush();
            return file.getAbsolutePath();
        } finally {
            if (fos != null) {
                try { fos.close(); } catch (IOException ignored) {}
            }
        }
    }

    /** 如果 Download 目录已存在同名文件，追加 (1)(2)... 避免覆盖 */
    private String buildUniqueFilename(File dir, String filename) {
        File f = new File(dir, filename);
        if (!f.exists()) return filename;

        String base;
        String ext;
        int dot = filename.lastIndexOf('.');
        if (dot >= 0) {
            base = filename.substring(0, dot);
            ext = filename.substring(dot);
        } else {
            base = filename;
            ext = "";
        }
        for (int i = 1; i < 1000; i++) {
            String candidate = base + " (" + i + ")" + ext;
            if (!new File(dir, candidate).exists()) return candidate;
        }
        return base + "_" + System.currentTimeMillis() + ext;
    }
}
