package de.schlachtbericht.app;

import android.app.*;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import org.json.JSONObject;
import java.util.*;

/** Foreground service that keeps the built-in game server alive while the app runs.
 *  Every game that is not finished is advertised on the local network via DNS-SD (_br40k._tcp),
 *  so the other devices find it automatically. A finished game is no longer advertised. */
public class HostService extends Service {
    static final int PORT = 8417;
    static final String TYPE = "_br40k._tcp";
    static final String CHANNEL = "host";
    static final String STOP = "de.schlachtbericht.app.STOP";
    static volatile HostService instance;

    private EngineHost engine;
    private GameServer server;
    private NsdManager nsd;
    private PowerManager.WakeLock wake;
    private final Map<String, NsdManager.RegistrationListener> advertised = new HashMap<>();
    private final Map<String, String> advertisedKey = new HashMap<>();

    static void start(Context ctx) {
        Intent i = new Intent(ctx, HostService.class);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        nsd = (NsdManager) getSystemService(Context.NSD_SERVICE);
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Game server", NotificationManager.IMPORTANCE_LOW));
        goForeground("Ready – no game hosted");
        wake = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "br40k:server");
        wake.acquire();
        engine = new EngineHost();
        server = new GameServer(this, PORT, engine, this::gamesChanged);
        try { server.start(); } catch (Exception e) { android.util.Log.e("HostService", "server start", e); }
        engine.start(this, PORT);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            stopSelf();
            if (MainActivity.instance != null) MainActivity.instance.finishAndRemoveTask();
        }
        return START_STICKY;
    }

    private void goForeground(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pOpen = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        PendingIntent pStop = PendingIntent.getService(this, 1, new Intent(this, HostService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("Battle Report 40k")
            .setContentText(text)
            .setContentIntent(pOpen)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "Stop server", pStop).build())
            .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(1, n);
    }

    /** Called by the server after every change: (un)advertise games, update the notification. */
    private synchronized void gamesChanged(List<JSONObject> games) {
        Set<String> active = new HashSet<>();
        for (JSONObject g : games) {
            if ("over".equals(g.optString("stage"))) continue;
            String code = g.optString("code");
            active.add(code);
            String p0 = g.optJSONArray("players") != null ? g.optJSONArray("players").optString(0, "") : "";
            String p1 = g.optJSONArray("players") != null ? g.optJSONArray("players").optString(1, "") : "";
            String key = p0 + "|" + p1 + "|" + g.optString("stage");
            if (key.equals(advertisedKey.get(code))) continue;
            unadvertise(code);
            NsdServiceInfo info = new NsdServiceInfo();
            info.setServiceName("Battle Report " + code);
            info.setServiceType(TYPE);
            info.setPort(PORT);
            info.setAttribute("code", code);
            info.setAttribute("p0", cut(p0));
            info.setAttribute("p1", cut(p1));
            info.setAttribute("stage", g.optString("stage"));
            NsdManager.RegistrationListener l = new NsdManager.RegistrationListener() {
                public void onRegistrationFailed(NsdServiceInfo s, int e) { android.util.Log.w("HostService", "NSD register failed " + e); }
                public void onUnregistrationFailed(NsdServiceInfo s, int e) {}
                public void onServiceRegistered(NsdServiceInfo s) {}
                public void onServiceUnregistered(NsdServiceInfo s) {}
            };
            try { nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, l); advertised.put(code, l); advertisedKey.put(code, key); }
            catch (Exception e) { android.util.Log.w("HostService", "NSD", e); }
        }
        for (String code : new ArrayList<>(advertised.keySet())) if (!active.contains(code)) unadvertise(code);
        String ips = String.join(", ", Net.lanIps());
        goForeground(active.isEmpty() ? "Ready – no game hosted" : "Hosting " + String.join(", ", active) + (ips.isEmpty() ? "" : " · " + ips));
    }

    private static String cut(String s) { return s.length() > 40 ? s.substring(0, 40) : s; }

    private void unadvertise(String code) {
        NsdManager.RegistrationListener l = advertised.remove(code);
        advertisedKey.remove(code);
        if (l != null) try { nsd.unregisterService(l); } catch (Exception ignored) {}
    }

    @Override public void onDestroy() {
        for (String code : new ArrayList<>(advertised.keySet())) unadvertise(code);
        if (server != null) server.stop();
        if (engine != null) engine.destroy();
        if (wake != null && wake.isHeld()) wake.release();
        instance = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
