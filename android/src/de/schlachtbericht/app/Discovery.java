package de.schlachtbericht.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Finds games hosted by other devices on the local network (DNS-SD _br40k._tcp). Own games are skipped. */
class Discovery {
    private final NsdManager nsd;
    private final WifiManager.MulticastLock lock;
    private final Map<String, JSONObject> found = new LinkedHashMap<>();
    private final Deque<NsdServiceInfo> queue = new ArrayDeque<>();
    private boolean resolving;
    private NsdManager.DiscoveryListener listener;

    Discovery(Context ctx) {
        nsd = (NsdManager) ctx.getSystemService(Context.NSD_SERVICE);
        WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        lock = wm.createMulticastLock("br40k");
        lock.setReferenceCounted(false);
    }

    synchronized void start() {
        if (listener != null) return;
        lock.acquire();
        listener = new NsdManager.DiscoveryListener() {
            public void onStartDiscoveryFailed(String t, int e) { synchronized (Discovery.this) { listener = null; } }
            public void onStopDiscoveryFailed(String t, int e) {}
            public void onDiscoveryStarted(String t) {}
            public void onDiscoveryStopped(String t) {}
            public void onServiceFound(NsdServiceInfo s) { synchronized (Discovery.this) { queue.add(s); next(); } }
            public void onServiceLost(NsdServiceInfo s) { synchronized (Discovery.this) { found.remove(s.getServiceName()); } }
        };
        try { nsd.discoverServices(HostService.TYPE, NsdManager.PROTOCOL_DNS_SD, listener); } catch (Exception e) { listener = null; }
    }

    synchronized void stop() {
        if (listener != null) try { nsd.stopServiceDiscovery(listener); } catch (Exception ignored) {}
        listener = null;
        found.clear();
        queue.clear();
        if (lock.isHeld()) lock.release();
    }

    /** One resolve at a time (older NsdManager versions reject parallel resolves). */
    @SuppressWarnings("deprecation")
    private void next() {
        if (resolving || queue.isEmpty()) return;
        resolving = true;
        NsdServiceInfo s = queue.poll();
        nsd.resolveService(s, new NsdManager.ResolveListener() {
            public void onResolveFailed(NsdServiceInfo i, int e) { synchronized (Discovery.this) { resolving = false; next(); } }
            public void onServiceResolved(NsdServiceInfo i) {
                synchronized (Discovery.this) {
                    resolving = false;
                    try {
                        String host = i.getHost() != null ? i.getHost().getHostAddress() : null;
                        if (host != null && !Net.lanIps().contains(host)) {
                            JSONObject o = new JSONObject();
                            o.put("name", i.getServiceName());
                            o.put("host", host);
                            o.put("port", i.getPort());
                            Map<String, byte[]> a = i.getAttributes();
                            for (String k : new String[] { "code", "p0", "p1", "stage", "dev" }) {
                                byte[] v = a.get(k);
                                o.put(k, v == null ? "" : new String(v, StandardCharsets.UTF_8));
                            }
                            // c0 / c1 = the players' colour indices (missing from older hosts → null), like server/mdns.js list()
                            for (String k : new String[] { "c0", "c1" }) {
                                byte[] v = a.get(k);
                                String t = v == null ? "" : new String(v, StandardCharsets.UTF_8);
                                o.put(k, t.matches("\\d{1,3}") ? (Object) Integer.parseInt(t) : JSONObject.NULL);
                            }
                            found.put(i.getServiceName(), o);
                        }
                    } catch (Exception ignored) {}
                    next();
                }
            }
        });
    }

    synchronized String json() { return new JSONArray(found.values()).toString(); }
}
