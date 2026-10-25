package de.schlachtbericht.app;

import android.content.Context;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Partial app update: only the changed web files of a newer release (js/ui/update-popup.js downloads them from the
 *  release tag on GitHub) are stored in files/web-overlay and served before the bundled app. The overlay belongs to one
 *  version; after a full update (newer APK) it is dropped. */
class WebUpdate {
    static File dir(Context ctx) { return new File(ctx.getFilesDir(), "web-overlay"); }
    /** Downloads land here first; commit() moves them into the overlay at once (an interrupted download changes nothing). */
    static File staging(Context ctx) { return new File(ctx.getFilesDir(), "web-staging"); }

    /** Allowed paths: the app's web files (same list as release/web-index.mjs), never anything else. */
    static boolean allowed(String rel) {
        if (rel == null || rel.contains("..") || rel.contains("\\") || rel.startsWith("/")) return false;
        return rel.matches("(index\\.html|engine-host\\.html|manifest\\.webmanifest|sw\\.js|web-index\\.json)")
            || rel.matches("(js|css|engine|data|vendor|icons|vr)/[A-Za-z0-9_./ '’()+,-]+");
    }

    static boolean save(Context ctx, String rel, String base64) {
        if (!allowed(rel) || rel.startsWith("data/datasheets/")) return false;
        try {
            File f = new File(staging(ctx), rel);
            if (!f.getCanonicalPath().startsWith(staging(ctx).getCanonicalPath())) return false;
            f.getParentFile().mkdirs();
            File tmp = new File(f.getPath() + ".tmp");
            try (OutputStream o = new FileOutputStream(tmp)) { o.write(android.util.Base64.decode(base64, android.util.Base64.DEFAULT)); }
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f); }
            return f.isFile();
        } catch (Exception e) { return false; }
    }

    static long version(Context ctx) {
        try (InputStream in = new FileInputStream(new File(dir(ctx), "version.txt"))) { return Long.parseLong(new String(Net.readAll(in), StandardCharsets.UTF_8).trim()); }
        catch (Exception e) { return 0; }
    }

    static void setVersion(Context ctx, long v) {
        dir(ctx).mkdirs();
        try (Writer w = new OutputStreamWriter(new FileOutputStream(new File(dir(ctx), "version.txt")), StandardCharsets.UTF_8)) { w.write(String.valueOf(v)); }
        catch (Exception ignored) {}
    }

    /** All files of the update are downloaded: move them into the overlay and record the version. */
    static void commit(Context ctx, long v) {
        File from = staging(ctx), to = dir(ctx);
        if (from.exists()) move(from, to);
        deleteTree(from);
        setVersion(ctx, v);
    }
    private static void move(File from, File to) {
        File[] k = from.listFiles();
        if (k == null) return;
        to.mkdirs();
        for (File c : k) {
            File d = new File(to, c.getName());
            if (c.isDirectory()) move(c, d);
            else { d.delete(); if (!c.renameTo(d)) try (InputStream in = new FileInputStream(c); OutputStream o = new FileOutputStream(d)) { o.write(Net.readAll(in)); } catch (IOException ignored) {} }
        }
    }

    /** At start: a full update installed this or a newer version → the old partial update is obsolete. */
    static void dropIfObsolete(Context ctx) {
        long installed = 0;
        try { installed = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).getLongVersionCode(); } catch (Exception ignored) {}
        deleteTree(staging(ctx));   // leftover of an interrupted download
        long v = version(ctx);
        if (dir(ctx).exists() && v <= installed) deleteTree(dir(ctx));
    }

    static void deleteTree(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File c : k) deleteTree(c);
        f.delete();
    }
}
