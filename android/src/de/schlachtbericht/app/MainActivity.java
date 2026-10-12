package de.schlachtbericht.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import java.io.File;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Full-screen WebView on the app's own built-in server (HostService, port 8417) – works without internet.
 *  Games created here are hosted by this device; games of other devices are found via Discovery (window.BR). */
public class MainActivity extends Activity {
    static final String LOCAL = "http://127.0.0.1:" + HostService.PORT + "/index.html";
    static final String ACTION_INSTALL_STATUS = "de.schlachtbericht.app.INSTALL_STATUS";
    static volatile MainActivity instance;
    private WebView web;
    private Discovery discovery;

    /** JS bridge: window.BR.nearby() → JSON list of games hosted by other devices; BR.lanIps() → this device's IPs. */
    class Bridge {
        @JavascriptInterface public String nearby() { return discovery.json(); }
        @JavascriptInterface public String lanIps() { return new org.json.JSONArray(Net.lanIps()).toString(); }
        @JavascriptInterface public int port() { return HostService.PORT; }
        /** Release app update (update popup, GitHub Releases): download the APK and open the system installer.
         *  Returns at once; errors arrive as window.__appUpdateError(message). */
        @JavascriptInterface public void installApk(String url) {
            if (url == null || !url.startsWith("https://")) return;
            new Thread(() -> {
                try { AppInstaller.install(MainActivity.this, AppInstaller.download(url)); }
                catch (Exception e) {
                    String m = org.json.JSONObject.quote(String.valueOf(e.getMessage()));
                    runOnUiThread(() -> { if (web != null) web.evaluateJavascript("window.__appUpdateError && window.__appUpdateError(" + m + ")", null); });
                }
            }, "app-update").start();
        }
        /** Content of assets/app-release.json ({ repo: "owner/name" }) or "{}" – where release updates come from. */
        @JavascriptInterface public String releaseInfo() {
            try (java.io.InputStream in = getAssets().open("app-release.json")) { return new String(Net.readAll(in), java.nio.charset.StandardCharsets.UTF_8); }
            catch (Exception e) { return "{}"; }
        }
        /** { dev, versionCode, server, lastOk, lastError } – shown in the lobby. */
        @JavascriptInterface public String devInfo() {
            try {
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("versionCode", getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode());
                HostService h = HostService.instance;
                DevHook d = h != null ? h.dev : null;
                o.put("dev", d != null);
                if (d != null) { o.put("server", d.server()); o.put("lastOk", d.lastOk()); o.put("lastError", d.lastError() == null ? org.json.JSONObject.NULL : d.lastError()); }
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }
        // Unit data update (js/data-update.js): only data/datasheets/*.json and bsdata/*.json, into files/data-overlay
        @JavascriptInterface public boolean saveData(String rel, String text) {
            if (rel == null || !rel.matches("(data/datasheets|bsdata)/[^/\\\\]+\\.json") || rel.contains("..")) return false;
            File f = new File(new File(getFilesDir(), "data-overlay"), rel);
            f.getParentFile().mkdirs();
            write(f, text);
            return f.isFile();
        }
        @JavascriptInterface public void clearData() { deleteTree(new File(getFilesDir(), "data-overlay")); }
        // Finished games on this device (js/archive.js): files/finished/<CODE>.json + <CODE>.meta.json
        @JavascriptInterface public void saveGame(String code, String meta, String full) {
            if (code == null || !code.matches("[A-Z]{4}")) return;
            File d = new File(getFilesDir(), "finished"); d.mkdirs();
            write(new File(d, code + ".json"), full); write(new File(d, code + ".meta.json"), meta);
        }
        @JavascriptInterface public String listGames() {
            File[] fs = new File(getFilesDir(), "finished").listFiles((x, n) -> n.endsWith(".meta.json"));
            org.json.JSONArray a = new org.json.JSONArray();
            if (fs != null) for (File f : fs) try { a.put(new org.json.JSONObject(read(f))); } catch (Exception ignored) {}
            java.util.List<org.json.JSONObject> l = new java.util.ArrayList<>();
            for (int i = 0; i < a.length(); i++) l.add(a.optJSONObject(i));
            l.sort((x, y) -> y.optString("savedAt").compareTo(x.optString("savedAt")));
            return new org.json.JSONArray(l).toString();
        }
        @JavascriptInterface public String loadGame(String code) {
            if (code == null || !code.matches("[A-Z]{4}")) return null;
            File f = new File(new File(getFilesDir(), "finished"), code + ".json");
            return f.isFile() ? read(f) : null;
        }
        @JavascriptInterface public void deleteGame(String code) {
            if (code == null || !code.matches("[A-Z]{4}")) return;
            File d = new File(getFilesDir(), "finished");
            new File(d, code + ".json").delete(); new File(d, code + ".meta.json").delete();
        }
    }

    private static void write(File f, String text) {
        try (java.io.Writer w = new java.io.OutputStreamWriter(new java.io.FileOutputStream(f), java.nio.charset.StandardCharsets.UTF_8)) { w.write(text == null ? "" : text); }
        catch (Exception e) { android.util.Log.e("MainActivity", "write " + f, e); }
    }
    private static void deleteTree(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File c : k) deleteTree(c);
        f.delete();
    }
    private static String read(File f) {
        try (java.io.InputStream in = new java.io.FileInputStream(f)) { return new String(Net.readAll(in), java.nio.charset.StandardCharsets.UTF_8); }
        catch (Exception e) { return null; }
    }

    @SuppressLint({ "SetJavaScriptEnabled", "AddJavascriptInterface" })
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        HostService.start(this);
        discovery = new Discovery(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setBackgroundColor(0xFF0F1216);
        web.addJavascriptInterface(new Bridge(), "BR");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onReceivedError(WebView v, android.webkit.WebResourceRequest req, android.webkit.WebResourceError err) {
                // The local server needs a moment on first start – retry the start page.
                if (req.isForMainFrame() && req.getUrl().toString().startsWith("http://127.0.0.1")) v.postDelayed(() -> v.loadUrl(LOCAL), 500);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                android.util.Log.i("BR-console", m.messageLevel() + " " + m.sourceId() + ":" + m.lineNumber() + " " + m.message());
                return true;
            }
        });
        setContentView(web);
        hideBars();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.postDelayed(() -> web.loadUrl(LOCAL), 300);
    }

    /** DEV update: show the new web files. */
    void reloadWeb() { runOnUiThread(() -> { if (web != null) web.reload(); }); }

    /** DEV update: the system installer needs the user's confirmation for the new APK. */
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(android.content.pm.PackageInstaller.EXTRA_STATUS, -999);
        if (status == android.content.pm.PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    }

    @Override protected void onResume() { super.onResume(); discovery.start(); }
    @Override protected void onPause() { discovery.stop(); super.onPause(); }

    private void hideBars() {
        View v = getWindow().getDecorView();
        v.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        instance = null;
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
