package de.schlachtbericht.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

/** Installs a new APK of this app via the system installer (Android always asks the user to confirm).
 *  Used by the release app (update popup, from GitHub Releases) and the DEV app's updater. */
class AppInstaller {
    /** Downloads the APK (follows redirects, e.g. GitHub release assets) – call on a background thread. */
    static byte[] download(String url) throws IOException {
        for (int hop = 0; hop < 5; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(60000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "BattleReport40k");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) { url = new URL(new URL(url), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (code != 200) { c.disconnect(); throw new IOException("HTTP " + code + " " + url); }
            try (InputStream in = c.getInputStream()) { return Net.readAll(in); } finally { c.disconnect(); }
        }
        throw new IOException("Too many redirects");
    }

    /** Hands the APK to the system installer; the confirmation dialog arrives via MainActivity.onNewIntent. */
    static void install(Context ctx, byte[] apk) throws IOException {
        PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        p.setAppPackageName(ctx.getPackageName());
        int id = pi.createSession(p);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (OutputStream o = s.openWrite("app.apk", 0, apk.length)) { o.write(apk); s.fsync(o); }
            Intent status = new Intent(ctx, MainActivity.class).setAction(MainActivity.ACTION_INSTALL_STATUS);
            PendingIntent pend = PendingIntent.getActivity(ctx, id, status, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            s.commit(pend.getIntentSender());
        }
    }
}
