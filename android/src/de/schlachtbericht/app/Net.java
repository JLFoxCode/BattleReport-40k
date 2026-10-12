package de.schlachtbericht.app;

import java.net.*;
import java.util.*;

/** LAN IPv4 addresses of this device (Wi-Fi first). */
class Net {
    static byte[] readAll(java.io.InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    static List<String> lanIps() {
        List<String> wifi = new ArrayList<>(), other = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String n = ni.getName();
                    (n.startsWith("wlan") || n.startsWith("ap") || n.startsWith("swlan") ? wifi : other).add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {}
        wifi.addAll(other);
        return wifi;
    }
}
