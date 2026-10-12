package de.schlachtbericht.app;

import android.content.Context;
import android.content.res.AssetManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** Built-in game server of the app (same API as server.js): static files from the APK assets (www/),
 *  JSON API, SSE live stream, action log persisted in the app's files dir. The engine runs in EngineHost. */
class GameServer {
    interface Listener { void gamesChanged(List<JSONObject> summaries); }

    static class Game {
        final String code;
        final List<JSONObject> actions = new ArrayList<>();
        String stateJson = "{}";
        JSONObject summary = new JSONObject();
        final Set<OutputStream> clients = ConcurrentHashMap.newKeySet();
        ScheduledFuture<?> closeTimer;
        Game(String code) { this.code = code; }
    }

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html; charset=utf-8"); MIME.put("js", "text/javascript; charset=utf-8");
        MIME.put("mjs", "text/javascript; charset=utf-8"); MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8"); MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg"); MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon"); MIME.put("woff2", "font/woff2"); MIME.put("woff", "font/woff");
        MIME.put("ttf", "font/ttf"); MIME.put("txt", "text/plain; charset=utf-8"); MIME.put("md", "text/markdown; charset=utf-8");
        MIME.put("webmanifest", "application/manifest+json"); MIME.put("apk", "application/vnd.android.package-archive");
    }

    final int port;
    private final AssetManager assets;
    private final File dir;
    /** Unit data updated on the device (BSData from GitHub, js/data-update.js) – served before the bundled data. */
    private final File dataOverlay;
    /** App files from a partial update (only the changed files of a newer release, see WebUpdate). */
    private final File webOverlay;
    private final EngineHost engine;
    private final Listener listener;
    private final Map<String, Game> games = new ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final ScheduledExecutorService timers = Executors.newSingleThreadScheduledExecutor();
    /** Finished game: devices store their own copy; after this grace period (undo possible) the game is closed. */
    static final long CLOSE_AFTER_MS = 2 * 60 * 1000;
    private final SecureRandom rnd = new SecureRandom();
    private ServerSocket socket;
    private volatile boolean running;

    GameServer(Context ctx, int port, EngineHost engine, Listener listener) {
        this.port = port; this.assets = ctx.getAssets(); this.engine = engine; this.listener = listener;
        this.dir = new File(ctx.getFilesDir(), "games"); dir.mkdirs();
        this.dataOverlay = new File(ctx.getFilesDir(), "data-overlay");
        this.webOverlay = WebUpdate.dir(ctx);
    }

    void start() throws IOException {
        socket = new ServerSocket();
        socket.setReuseAddress(true);
        socket.bind(new InetSocketAddress(port));
        running = true;
        pool.execute(() -> {
            while (running) {
                try { Socket s = socket.accept(); pool.execute(() -> handle(s)); }
                catch (IOException e) { if (!running) break; }
            }
        });
        pool.execute(this::loadGames);
        pool.execute(() -> {
            while (running) {
                try { Thread.sleep(15000); } catch (InterruptedException e) { break; }
                for (Game g : games.values()) send(g, ": hb\n\n");
            }
        });
    }

    void stop() {
        running = false;
        try { socket.close(); } catch (Exception ignored) {}
        for (Game g : games.values()) for (OutputStream o : g.clients) try { o.close(); } catch (Exception ignored) {}
        pool.shutdownNow();
        timers.shutdownNow();
    }

    List<JSONObject> summaries() {
        List<JSONObject> l = new ArrayList<>();
        for (Game g : games.values()) l.add(g.summary);
        l.sort((a, b) -> b.optString("createdAt").compareTo(a.optString("createdAt")));
        return l;
    }

    // ------------------------------------------------------------ games
    private void loadGames() {
        File[] files = dir.listFiles((d, n) -> n.matches("[A-Z]{4}\\.json"));
        if (files != null) for (File f : files) {
            try {
                JSONObject raw = new JSONObject(readFile(f));
                Game g = new Game(f.getName().substring(0, 4));
                JSONArray a = raw.optJSONArray("actions");
                if (a != null) for (int i = 0; i < a.length(); i++) g.actions.add(a.getJSONObject(i));
                JSONObject r = engine.call("H.load(" + EngineHost.q(g.code) + "," + EngineHost.q(new JSONArray(g.actions).toString()) + ")");
                if (r.has("error")) throw new Exception(r.getString("error"));
                setState(g, r.getJSONObject("state"));
                games.put(g.code, g);
                checkClose(g);
            } catch (Exception e) { android.util.Log.e("GameServer", "load " + f, e); }
        }
        notifyListener();
    }

    private void setState(Game g, JSONObject state) throws Exception {
        g.stateJson = state.toString();
        JSONObject s = new JSONObject();
        s.put("code", g.code);
        s.put("createdAt", state.has("createdAt") ? state.get("createdAt") : JSONObject.NULL);
        s.put("stage", state.has("stage") ? state.get("stage") : JSONObject.NULL);
        JSONArray names = new JSONArray(), ps = state.optJSONArray("players");
        if (ps != null) for (int i = 0; i < ps.length(); i++) {
            JSONObject p = ps.optJSONObject(i);
            names.put(p == null ? "" : p.optString("name", ""));
        }
        s.put("players", names);
        s.put("round", state.optInt("round", 0));
        s.put("seq", g.actions.size());
        g.summary = s;
    }

    private void persist(Game g) {
        try {
            File tmp = new File(dir, g.code + ".json.tmp");
            JSONObject o = new JSONObject();
            o.put("code", g.code);
            o.put("actions", new JSONArray(g.actions));
            try (Writer w = new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.UTF_8)) { w.write(o.toString()); }
            File dst = new File(dir, g.code + ".json");
            if (!tmp.renameTo(dst)) { dst.delete(); tmp.renameTo(dst); }
        } catch (Exception e) { android.util.Log.e("GameServer", "persist", e); }
    }

    private void notifyListener() { if (listener != null) listener.gamesChanged(summaries()); }

    private String newCode() {
        for (int t = 0; t < 1000; t++) {
            StringBuilder c = new StringBuilder();
            for (int i = 0; i < 4; i++) c.append(CODE_CHARS.charAt(rnd.nextInt(CODE_CHARS.length())));
            if (!games.containsKey(c.toString())) return c.toString();
        }
        throw new RuntimeException("No free game code");
    }

    /** Applies one action; returns null on success, else the engine's error message. */
    private synchronized String apply(Game g, JSONObject action) throws Exception {
        action.put("ts", iso());
        JSONObject r = engine.call("H.apply(" + EngineHost.q(g.code) + "," + EngineHost.q(action.toString()) + "," + (g.actions.size() + 1) + ")");
        if (r.has("error")) return r.getString("error");
        g.actions.add(action);
        setState(g, r.getJSONObject("state"));
        return null;
    }

    private static String iso() {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }

    private void send(Game g, String payload) {
        byte[] b = payload.getBytes(StandardCharsets.UTF_8);
        for (OutputStream o : g.clients) {
            try { synchronized (o) { o.write(b); o.flush(); } } catch (IOException e) { g.clients.remove(o); }
        }
    }
    private void broadcast(Game g) { send(g, "event: state\ndata: " + g.stateJson + "\n\n"); checkClose(g); }

    private static boolean isOver(Game g) { try { return "over".equals(new JSONObject(g.stateJson).optString("stage")); } catch (Exception e) { return false; } }
    private synchronized void checkClose(Game g) {
        boolean over = isOver(g);
        if (over && g.closeTimer == null) g.closeTimer = timers.schedule(() -> closeGame(g.code), CLOSE_AFTER_MS, TimeUnit.MILLISECONDS);
        if (!over && g.closeTimer != null) { g.closeTimer.cancel(false); g.closeTimer = null; }
    }
    /** The battle is over: tell every device (signal "game.closed" → they continue with their own copy), disconnect, remove. */
    private void closeGame(String code) {
        Game g = games.get(code);
        if (g == null || !isOver(g)) return;
        send(g, "event: signal\ndata: {\"type\":\"game.closed\",\"code\":\"" + code + "\",\"ts\":" + System.currentTimeMillis() + "}\n\n");
        for (OutputStream o : g.clients) try { o.close(); } catch (Exception ignored) {}
        games.remove(code);
        try { engine.call("H.drop(" + EngineHost.q(code) + ")"); } catch (Exception ignored) {}
        new File(dir, code + ".json").delete();
        notifyListener();
    }

    // ------------------------------------------------------------ HTTP
    private static class Req { String method, path, query; final Map<String, String> headers = new HashMap<>(); byte[] body = new byte[0]; }
    private static class HttpErr extends Exception { final int status; HttpErr(int s, String m) { super(m); status = s; } }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(30000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = new BufferedOutputStream(s.getOutputStream());
            Req r = parse(in);
            if (r == null) { s.close(); return; }
            try {
                if (r.path.equals("/api") || r.path.startsWith("/api/")) {
                    if (api(r, out, s)) return; // SSE keeps the socket open
                } else serveStatic(r, out);
            } catch (HttpErr e) {
                json(out, e.status, err(e.getMessage()));
            } catch (Exception e) {
                android.util.Log.e("GameServer", r.method + " " + r.path, e);
                json(out, 500, err(e.getMessage() == null ? "Internal error" : e.getMessage()));
            }
            out.flush();
            s.close();
        } catch (Exception e) { try { s.close(); } catch (IOException ignored) {} }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) { if (c == '\n') break; if (c != '\r') b.write(c); }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static Req parse(InputStream in) throws IOException {
        String line = readLine(in);
        if (line == null || line.isEmpty()) return null;
        String[] p = line.split(" ");
        if (p.length < 2) return null;
        Req r = new Req();
        r.method = p[0];
        String target = p[1];
        int qi = target.indexOf('?');
        r.path = qi >= 0 ? target.substring(0, qi) : target;
        r.query = qi >= 0 ? target.substring(qi + 1) : "";
        String h;
        while ((h = readLine(in)) != null && !h.isEmpty()) {
            int c = h.indexOf(':');
            if (c > 0) r.headers.put(h.substring(0, c).trim().toLowerCase(Locale.ROOT), h.substring(c + 1).trim());
        }
        int len = 0;
        try { len = Integer.parseInt(r.headers.getOrDefault("content-length", "0")); } catch (NumberFormatException ignored) {}
        if (len > 4 * 1024 * 1024) throw new IOException("Request too large");
        if (len > 0) {
            r.body = new byte[len];
            int off = 0;
            while (off < len) { int n = in.read(r.body, off, len - off); if (n < 0) break; off += n; }
        }
        return r;
    }

    private static void head(OutputStream out, int status, String type, long len, boolean sse) throws IOException {
        StringBuilder h = new StringBuilder("HTTP/1.1 ").append(status).append(status < 300 ? " OK" : " Error").append("\r\n");
        h.append("Content-Type: ").append(type).append("\r\nCache-Control: no-store\r\n");
        if (sse) h.append("Connection: keep-alive\r\nX-Accel-Buffering: no\r\n");
        else h.append("Content-Length: ").append(len).append("\r\nConnection: close\r\n");
        h.append("\r\n");
        out.write(h.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void json(OutputStream out, int status, Object body) throws IOException {
        byte[] b = body.toString().getBytes(StandardCharsets.UTF_8);
        head(out, status, "application/json; charset=utf-8", b.length, false);
        out.write(b);
    }
    private static JSONObject err(String m) { try { return new JSONObject().put("error", m); } catch (Exception e) { return new JSONObject(); } }
    private static JSONObject bodyJson(Req r) throws HttpErr {
        String t = new String(r.body, StandardCharsets.UTF_8).trim();
        if (t.isEmpty()) return new JSONObject();
        try { return new JSONObject(t); } catch (Exception e) { throw new HttpErr(400, "Invalid JSON"); }
    }

    private Game game(String code) throws HttpErr {
        if (!code.matches("[A-Z]{4}")) throw new HttpErr(400, "Invalid game code");
        Game g = games.get(code);
        if (g == null) throw new HttpErr(404, "Game not found");
        return g;
    }

    /** Returns true if the socket must stay open (SSE). */
    private boolean api(Req r, OutputStream out, Socket sock) throws Exception {
        List<String> pl = new ArrayList<>();
        for (String x : r.path.split("/")) if (!x.isEmpty()) pl.add(x);
        String[] parts = pl.toArray(new String[0]);
        String m = r.method;

        if (parts.length == 2 && parts[1].equals("info") && m.equals("GET")) {
            JSONArray lan = new JSONArray();
            for (String ip : Net.lanIps()) lan.put(ip);
            json(out, 200, new JSONObject().put("port", port).put("lan", lan).put("app", true));
            return false;
        }

        if (parts.length == 2 && parts[1].equals("games")) {
            if (m.equals("GET")) { json(out, 200, new JSONArray(summaries())); return false; }
            if (m.equals("POST")) {
                JSONObject b = bodyJson(r);
                Game g;
                synchronized (this) {
                    g = new Game(newCode());
                    int seed = rnd.nextInt(0x7fffffff);
                    if (seed == 0) seed = 1;
                    JSONObject init = engine.call("H.init(" + EngineHost.q(g.code) + "," + seed + ")");
                    if (init.has("error")) throw new HttpErr(400, init.getString("error"));
                    String e = apply(g, new JSONObject().put("type", "game.init").put("code", g.code).put("seed", seed).put("by", JSONObject.NULL));
                    if (e != null) throw new HttpErr(400, e);
                    JSONArray names = b.optJSONArray("names");
                    if (names != null) for (int i = 0; i < Math.min(2, names.length()); i++) {
                        String n = names.optString(i, "").trim();
                        if (n.isEmpty()) continue;
                        e = apply(g, new JSONObject().put("type", "player.set").put("player", i).put("name", n).put("by", JSONObject.NULL));
                        if (e != null) throw new HttpErr(400, e);
                    }
                    games.put(g.code, g);
                }
                persist(g);
                notifyListener();
                json(out, 201, "{\"code\":\"" + g.code + "\",\"state\":" + g.stateJson + "}");
                return false;
            }
            throw new HttpErr(405, "Method not allowed");
        }

        if (parts.length >= 3 && parts[1].equals("games")) {
            String code = parts[2].toUpperCase(Locale.ROOT);
            String sub = parts.length > 3 ? parts[3] : null;
            if (sub == null) {
                if (m.equals("GET")) { json(out, 200, game(code).stateJson); return false; }
                if (m.equals("DELETE")) {
                    Game g = game(code);
                    for (OutputStream o : g.clients) try { o.close(); } catch (Exception ignored) {}
                    games.remove(code);
                    engine.call("H.drop(" + EngineHost.q(code) + ")");
                    new File(dir, code + ".json").delete();
                    notifyListener();
                    json(out, 200, new JSONObject().put("ok", true).put("code", code));
                    return false;
                }
                throw new HttpErr(405, "Method not allowed");
            }
            if (sub.equals("actions") && m.equals("POST")) {
                Game g = game(code);
                JSONObject b = bodyJson(r);
                JSONObject action = b.optJSONObject("action") != null ? b.getJSONObject("action") : b;
                if (!(action.opt("type") instanceof String)) throw new HttpErr(400, "Action without type");
                String e = apply(g, action);
                if (e != null) { json(out, 400, err(e)); return false; }
                persist(g);
                broadcast(g);
                notifyListener();
                json(out, 200, "{\"seq\":" + g.actions.size() + ",\"state\":" + g.stateJson + "}");
                return false;
            }
            if (sub.equals("undo") && m.equals("POST")) {
                Game g = game(code);
                synchronized (this) {
                    if (g.actions.size() <= 1) { json(out, 400, err("Nothing to undo")); return false; }
                    List<JSONObject> rest = new ArrayList<>(g.actions.subList(0, g.actions.size() - 1));
                    JSONObject res = engine.call("H.load(" + EngineHost.q(code) + "," + EngineHost.q(new JSONArray(rest).toString()) + ")");
                    if (res.has("error")) { json(out, 400, err("Undo failed: " + res.getString("error"))); return false; }
                    g.actions.clear();
                    g.actions.addAll(rest);
                    setState(g, res.getJSONObject("state"));
                }
                persist(g);
                broadcast(g);
                notifyListener();
                json(out, 200, "{\"seq\":" + g.actions.size() + ",\"state\":" + g.stateJson + "}");
                return false;
            }
            if (sub.equals("events") && m.equals("GET")) {
                Game g = game(code);
                sock.setSoTimeout(0);
                head(out, 200, "text/event-stream; charset=utf-8", 0, true);
                out.write((": connected\n\nevent: state\ndata: " + g.stateJson + "\n\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
                g.clients.add(out);
                return true;
            }
            if (sub.equals("log") && m.equals("GET")) {
                Game g = game(code);
                int since = 0;
                for (String kv : r.query.split("&")) {
                    if (kv.startsWith("since=")) try { since = Math.max(0, Integer.parseInt(kv.substring(6))); } catch (NumberFormatException ignored) {}
                }
                JSONArray a = new JSONArray();
                for (int i = Math.min(since, g.actions.size()); i < g.actions.size(); i++) a.put(g.actions.get(i));
                json(out, 200, new JSONObject().put("code", code).put("seq", g.actions.size()).put("actions", a));
                return false;
            }
            if (sub.equals("signal") && m.equals("POST")) {
                Game g = game(code);
                JSONObject b = bodyJson(r);
                if (!(b.opt("type") instanceof String)) throw new HttpErr(400, "type missing");
                b.put("ts", System.currentTimeMillis());
                send(g, "event: signal\ndata: " + b + "\n\n");
                json(out, 200, new JSONObject().put("ok", true));
                return false;
            }
            if (sub.equals("photos") && m.equals("GET")) { json(out, 200, "[]"); return false; }
        }
        throw new HttpErr(404, "Not found");
    }

    private void serveStatic(Req r, OutputStream out) throws Exception {
        String rel = URLDecoder.decode(r.path, "UTF-8");
        if (rel.equals("/") || rel.isEmpty()) rel = "/index.html";
        if (rel.contains("..") || rel.indexOf('\0') >= 0) throw new HttpErr(404, "Not found");
        String asset = "www" + rel;
        byte[] data;
        // Order: unit data updated on the device, then app files of a partial update (web-overlay), then the bundled app
        File ovFile = new File(dataOverlay, rel.substring(1));
        File webFile = new File(webOverlay, rel.substring(1));
        if (ovFile.isFile() && ovFile.getCanonicalPath().startsWith(dataOverlay.getCanonicalPath())) data = readBytes(ovFile);
        else if (webFile.isFile() && webFile.getCanonicalPath().startsWith(webOverlay.getCanonicalPath())) data = readBytes(webFile);
        else try (InputStream in = assets.open(asset)) { data = readAll(in); }
        catch (IOException e) { throw new HttpErr(404, "Not found"); }
        String ext = asset.substring(asset.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        head(out, 200, MIME.getOrDefault(ext, "application/octet-stream"), data.length, false);
        if (!r.method.equals("HEAD")) out.write(data);
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }
    private static byte[] readBytes(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return readAll(in); }
    }

    /** After the engine page was reloaded (DEV update): replay every game into the fresh engine. */
    synchronized void reloadEngine() {
        for (Game g : games.values()) {
            try {
                JSONObject r = engine.call("H.load(" + EngineHost.q(g.code) + "," + EngineHost.q(new JSONArray(g.actions).toString()) + ")");
                if (!r.has("error")) { setState(g, r.getJSONObject("state")); broadcast(g); }
            } catch (Exception e) { android.util.Log.e("GameServer", "reload " + g.code, e); }
        }
        notifyListener();
    }

    private static String readFile(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return new String(readAll(in), StandardCharsets.UTF_8); }
    }
}
