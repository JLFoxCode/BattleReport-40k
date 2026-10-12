package de.schlachtbericht.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Headless WebView that runs the shared JS engine (engine-host.html, served by our own GameServer).
 *  call(js) blocks the calling (server) thread until the engine answered; never call it on the main thread. */
class EngineHost {
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private volatile boolean ready;

    @SuppressLint("SetJavaScriptEnabled")
    void start(Context ctx, int port) {
        main.post(() -> {
            web = new WebView(ctx.getApplicationContext());
            web.getSettings().setJavaScriptEnabled(true);
            web.setWebViewClient(new WebViewClient());
            web.loadUrl("http://127.0.0.1:" + port + "/engine-host.html");
            web.resumeTimers();
        });
    }

    /** DEV update: load the new engine; the next call() waits until it is ready again. */
    void reload() {
        ready = false;
        // Clear the flag first, otherwise awaitReady() could still see the old page and load the games into it.
        main.post(() -> { if (web != null) { web.evaluateJavascript("window.H_READY = false", null); web.reload(); } });
    }

    void destroy() { main.post(() -> { if (web != null) { web.destroy(); web = null; } }); }

    /** Waits until window.H is available (max ~20 s). */
    private void awaitReady() throws Exception {
        for (int i = 0; !ready && i < 200; i++) {
            String r = eval("window.H_READY === true");
            if ("true".equals(r)) { ready = true; break; }
            Thread.sleep(100);
        }
        if (!ready) throw new Exception("Engine not ready");
    }

    private String eval(String js) throws Exception {
        final String[] out = { null };
        final CountDownLatch latch = new CountDownLatch(1);
        main.post(() -> {
            if (web == null) { latch.countDown(); return; }
            web.evaluateJavascript(js, v -> { out[0] = v; latch.countDown(); });
        });
        if (!latch.await(20, TimeUnit.SECONDS)) throw new Exception("Engine timeout");
        return out[0];
    }

    /** Runs an expression that returns { state } or { error }; returns the parsed object. */
    synchronized JSONObject call(String js) throws Exception {
        awaitReady();
        String r = eval("JSON.stringify(" + js + ")");
        if (r == null || "null".equals(r)) throw new Exception("Engine returned nothing");
        return new JSONObject(new org.json.JSONTokener(r).nextValue().toString());
    }

    static String q(String s) { return JSONObject.quote(s); }
}
