package de.schlachtbericht.app;

import android.content.Context;
import java.io.File;
import java.util.function.Consumer;

/** Optional development hook: the DEV app's auto-update from the developer's PC (class DevUpdater) is a dev tool and not
 *  part of the public source. If the class is absent (release/public build) or the build is not a DEV build,
 *  create() returns null and the app works on its own. */
interface DevHook {
    /** Web file synced from the PC (served before the bundled one), or null. */
    File file(String rel);
    void start();
    void stop();
    String server();
    long lastOk();
    String lastError();

    /** onWebChanged.accept(engineChanged) after new files arrived. */
    static DevHook create(Context ctx, Consumer<Boolean> onWebChanged) {
        try {
            Class<?> c = Class.forName("de.schlachtbericht.app.DevUpdater");
            return (DevHook) c.getMethod("create", Context.class, Consumer.class).invoke(null, ctx, onWebChanged);
        } catch (ClassNotFoundException e) {
            return null;
        } catch (Exception e) {
            android.util.Log.w("DevHook", "dev updater not available", e);
            return null;
        }
    }
}
