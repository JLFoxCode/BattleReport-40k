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
        /** { host, port, name, at } once the game was handed over to another device – read-only here from then on. */
        JSONObject movedTo;
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
                g.movedTo = raw.optJSONObject("movedTo");
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
        JSONArray names = new JSONArray(), colors = new JSONArray(), ps = state.optJSONArray("players");
        if (ps != null) for (int i = 0; i < ps.length(); i++) {
            JSONObject p = ps.optJSONObject(i);
            names.put(p == null ? "" : p.optString("name", ""));
            Object c = p == null ? null : p.opt("color");   // player colours for the join list (integer or null)
            double d = c instanceof Number ? ((Number) c).doubleValue() : Double.NaN;
            colors.put(!Double.isNaN(d) && !Double.isInfinite(d) && d == Math.rint(d) ? (Object) (long) d : JSONObject.NULL);
        }
        s.put("players", names);
        s.put("colors", colors);
        s.put("round", state.optInt("round", 0));
        s.put("seq", g.actions.size());
        s.put("movedTo", g.movedTo != null ? g.movedTo : JSONObject.NULL);
        g.summary = s;
    }

    /** One write per game at a time (two devices acting at once must not race on the same .tmp file); each write takes
     *  the current action log, so the last write always holds the newest state. A removed game is not written again. */
    private void persist(Game g) {
        synchronized (g) {
            persistLocked(g);
        }
    }
    private void persistLocked(Game g) {
        try {
            if (games.get(g.code) != g) return;
            File tmp = new File(dir, g.code + ".json.tmp");
            JSONObject o = new JSONObject();
            o.put("code", g.code);
            JSONArray actions;
            synchronized (this) { actions = new JSONArray(g.actions); }   // apply/undo change the list under this lock
            o.put("actions", actions);
            if (g.movedTo != null) o.put("movedTo", g.movedTo);
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

    /** How many trailing actions one undo takes back: all trailing actions sharing the last action's "group" (one tablet
     *  "End turn" / "Next phase" press with its automatic phase steps and scoring), else just the last one (old games have
     *  no groups). Never the game.init action at index 0. Same rule as server/game-server.js undoSpan(). */
    static int undoSpan(List<JSONObject> actions) {
        int n = actions.size();
        Object grp = n > 1 ? actions.get(n - 1).opt("group") : null;
        if (!(grp instanceof String) || ((String) grp).isEmpty()) return 1;
        int k = 1;
        while (k < n - 1 && grp.equals(actions.get(n - 1 - k).opt("group"))) k++;
        return k;
    }

    /** A game taken over from another host: replays its log (actions keep their timestamps). Replaces a local copy only if
     *  that one was moved away earlier (the game comes back). Not persisted yet. */
    private synchronized Game installImport(String code, JSONArray actions) throws Exception {
        Game previous = games.get(code);
        if (previous != null && previous.movedTo == null) throw new HttpErr(409, "A game with this code already exists on this device");
        JSONObject first = actions == null ? null : actions.optJSONObject(0);
        if (first == null || !"game.init".equals(first.optString("type"))) throw new HttpErr(400, "Action log missing");
        JSONObject res = engine.call("H.load(" + EngineHost.q(code) + "," + EngineHost.q(actions.toString()) + ")");
        if (res.has("error")) throw new HttpErr(400, "Import failed: " + res.getString("error"));
        Game g = new Game(code);
        for (int i = 0; i < actions.length(); i++) g.actions.add(actions.getJSONObject(i));
        setState(g, res.getJSONObject("state"));
        if (previous != null) {
            if (previous.closeTimer != null) { previous.closeTimer.cancel(false); previous.closeTimer = null; }
            for (OutputStream o : previous.clients) try { o.close(); } catch (Exception ignored) {}
        }
        games.put(code, g);
        return g;
    }

    private static String movedMessage(JSONObject to) {
        String n = to.optString("name", "");
        return "This game was moved to " + (n.isEmpty() ? to.optString("host", "another device") : n) + " – continue there.";
    }
    private static JSONObject movedSignal(String code, JSONObject to) throws Exception {
        JSONObject s = new JSONObject().put("type", "game.moved").put("code", code).put("ts", System.currentTimeMillis());
        for (Iterator<String> it = to.keys(); it.hasNext(); ) { String k = it.next(); s.put(k, to.get(k)); }
        return s;
    }

    private static class Resp { final int status; final JSONObject data; Resp(int s, JSONObject d) { status = s; data = d; } }
    /** JSON request to another game server on the LAN (handover); unreachable → HTTP error 502. */
    private static Resp remoteJson(String method, String url, JSONObject body) throws HttpErr {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            c.setRequestMethod(method);
            if (body != null) {
                byte[] b = body.toString().getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setFixedLengthStreamingMode(b.length);
                try (OutputStream o = c.getOutputStream()) { o.write(b); }
            }
            int status = c.getResponseCode();
            InputStream in = status < 400 ? c.getInputStream() : c.getErrorStream();
            String t = in == null ? "" : new String(readAll(in), StandardCharsets.UTF_8);
            JSONObject data;
            try { data = new JSONObject(t); } catch (Exception e) { data = new JSONObject(); }
            return new Resp(status, data);
        } catch (IOException e) {
            throw new HttpErr(502, "The other device could not be reached (" + e.getMessage() + ")");
        } finally { if (c != null) c.disconnect(); }
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
        synchronized (g) { new File(dir, code + ".json").delete(); }
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
            // CORS preflight: the VR module on the headset (served by the Quest's own app at 127.0.0.1) talks to this
            // host's API from another origin (vr/net.js)
            if (r.method.equals("OPTIONS")) {
                out.write(("HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE\r\n"
                    + "Access-Control-Allow-Headers: Content-Type\r\nAccess-Control-Max-Age: 600\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                out.flush(); s.close(); return;
            }
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
        h.append("Content-Type: ").append(type).append("\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\n");
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

        // /api/rules-page?p=core-rules – the free 11th-edition rules page from Wahapedia for the tutorial originals
        // (js/rules-orig.js; the page sends no CORS headers). Only these fixed pages are fetched.
        if (parts.length == 2 && parts[1].equals("rules-page") && m.equals("GET")) {
            String p = "";
            if (r.query != null) for (String kv : r.query.split("&")) if (kv.startsWith("p=")) p = java.net.URLDecoder.decode(kv.substring(2), "UTF-8");
            if (!p.equals("core-rules") && !p.equals("rules-appendix")) throw new HttpErr(400, "Unknown rules page");
            try {
                byte[] page = AppInstaller.download("https://wahapedia.ru/wh40k11ed/the-rules/" + p + "/");
                json(out, 200, new JSONObject().put("html", new String(page, StandardCharsets.UTF_8)));
            } catch (IOException e) { throw new HttpErr(502, "Download failed: " + e.getMessage()); }
            return false;
        }

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

        // /api/games/import – take over a game hosted by another device (only from this device itself = loopback):
        //   { code, actions } → create it here from this log; { code, from: { host, port } } → handover: fetch the log from
        //   the old host, create the game here, then tell the old host (POST …/moved). Same as server/game-server.js.
        if (parts.length == 3 && parts[1].equals("games") && parts[2].equals("import")) {
            if (!m.equals("POST")) throw new HttpErr(405, "Method not allowed");
            if (!sock.getInetAddress().isLoopbackAddress()) throw new HttpErr(403, "Only this device itself can take over a game");
            JSONObject b = bodyJson(r);
            String code = b.optString("code", "").toUpperCase(Locale.ROOT);
            if (!code.matches("[A-Z]{4}")) throw new HttpErr(400, "Invalid game code");
            JSONObject from = b.optJSONObject("from");
            if (from == null) {
                Game g = installImport(code, b.optJSONArray("actions"));
                persist(g);
                checkClose(g);
                notifyListener();
                json(out, 201, "{\"code\":\"" + code + "\",\"state\":" + g.stateJson + "}");
                return false;
            }
            String fromHost = from.optString("host", "");
            int fromPort = from.optInt("port", 0);
            if (!fromHost.matches("[\\w.:-]+") || fromPort < 1 || fromPort > 65535) throw new HttpErr(400, "Invalid address of the old host");
            String remote = "http://" + (fromHost.contains(":") ? "[" + fromHost + "]" : fromHost) + ":" + fromPort + "/api/games/" + code;
            // the old host checks that nothing happened between reading the log and the move; then simply read it again
            for (int attempt = 0; attempt < 3; attempt++) {
                Resp got = remoteJson("GET", remote + "/log", null);
                if (got.status >= 300) throw new HttpErr(502, "The old host did not hand over the game: " + got.data.optString("error", "HTTP " + got.status));
                Game previous = games.get(code);
                Game g = installImport(code, got.data.optJSONArray("actions"));
                JSONObject last = g.actions.get(g.actions.size() - 1);
                Resp mv;
                try {
                    mv = remoteJson("POST", remote + "/moved", new JSONObject().put("port", port).put("name", android.os.Build.MODEL)
                        .put("seq", g.actions.size()).put("lastTs", last.has("ts") ? last.get("ts") : JSONObject.NULL));
                } catch (HttpErr e) { mv = new Resp(502, err(e.getMessage())); }
                if (mv.status < 300) {
                    persist(g);
                    checkClose(g);
                    notifyListener();
                    json(out, 201, "{\"code\":\"" + code + "\",\"state\":" + g.stateJson + "}");
                    return false;
                }
                synchronized (this) {   // undo the local import
                    if (previous != null) {
                        games.put(code, previous);
                        engine.call("H.load(" + EngineHost.q(code) + "," + EngineHost.q(new JSONArray(previous.actions).toString()) + ")");
                    } else { games.remove(code); engine.call("H.drop(" + EngineHost.q(code) + ")"); }
                }
                if (!(mv.status == 409 && mv.data.optBoolean("changed"))) throw new HttpErr(502, "The old host did not hand over the game: " + mv.data.optString("error", "HTTP " + mv.status));
            }
            throw new HttpErr(409, "The game kept changing during the handover – try again");
        }

        if (parts.length >= 3 && parts[1].equals("games")) {
            String code = parts[2].toUpperCase(Locale.ROOT);
            String sub = parts.length > 3 ? parts[3] : null;
            // The game was handed over to another device: the old host only keeps a read-only copy
            if (sub != null && !sub.equals("moved") && !m.equals("GET") && !m.equals("HEAD")) {
                Game mg = games.get(code);
                if (mg != null && mg.movedTo != null) { json(out, 409, err(movedMessage(mg.movedTo)).put("movedTo", mg.movedTo)); return false; }
            }
            // /api/games/:code/moved { port, name, seq, lastTs } – called by the new host after it imported the game. The new
            // address is the caller's own (a device can only move a game to itself); seq/lastTs must still match this log.
            if ("moved".equals(sub) && m.equals("POST")) {
                Game g = game(code);
                JSONObject b = bodyJson(r);
                int newPort = b.optInt("port", 0);
                if (newPort < 1 || newPort > 65535) throw new HttpErr(400, "Port of the new host missing");
                String host = sock.getInetAddress().getHostAddress();
                JSONObject sig;
                synchronized (this) {
                    if (g.movedTo != null && !(host.equals(g.movedTo.optString("host")) && g.movedTo.optInt("port") == newPort)) {
                        json(out, 409, err(movedMessage(g.movedTo)).put("movedTo", g.movedTo));
                        return false;
                    }
                    JSONObject last = g.actions.isEmpty() ? null : g.actions.get(g.actions.size() - 1);
                    Object lastTs = b.opt("lastTs");
                    if (g.movedTo == null && (b.optInt("seq", -1) != g.actions.size()
                            || (lastTs instanceof String && last != null && !lastTs.equals(last.optString("ts", null))))) {
                        json(out, 409, err("The game changed meanwhile – try again").put("changed", true));
                        return false;
                    }
                    String name = b.optString("name", "").trim();
                    if (name.length() > 60) name = name.substring(0, 60);
                    g.movedTo = new JSONObject().put("host", host).put("port", newPort).put("name", name.isEmpty() ? host : name).put("at", iso());
                    g.summary.put("movedTo", g.movedTo);
                    sig = movedSignal(code, g.movedTo);
                }
                persist(g);
                send(g, "event: signal\ndata: " + sig + "\n\n");
                notifyListener();
                json(out, 200, new JSONObject().put("ok", true).put("movedTo", g.movedTo));
                return false;
            }
            if (sub == null) {
                if (m.equals("GET")) { json(out, 200, game(code).stateJson); return false; }
                if (m.equals("DELETE")) {
                    // only the device hosting the game (its own app = loopback) may delete it – not a guest phone on the Wi-Fi
                    if (!sock.getInetAddress().isLoopbackAddress()) throw new HttpErr(403, "Only the device hosting the game can delete it");
                    Game g = game(code);
                    send(g, "event: signal\ndata: " + new JSONObject().put("type", "game.deleted").put("code", code).put("ts", System.currentTimeMillis()) + "\n\n");
                    for (OutputStream o : g.clients) try { o.close(); } catch (Exception ignored) {}
                    synchronized (this) { if (g.closeTimer != null) { g.closeTimer.cancel(false); g.closeTimer = null; } }
                    games.remove(code);
                    engine.call("H.drop(" + EngineHost.q(code) + ")");
                    synchronized (g) { new File(dir, code + ".json").delete(); }
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
                // A player's phone ({ by: 0 | 1 }) only undoes its own last action; the scoreboard / setup (no player) undoes any
                JSONObject b = bodyJson(r);
                Object bo = b.opt("by");
                double bd = bo instanceof Number ? ((Number) bo).doubleValue() : -1;
                Integer by = bd == 0 ? Integer.valueOf(0) : bd == 1 ? Integer.valueOf(1) : null;
                int undone;
                synchronized (this) {
                    if (g.actions.size() <= 1) { json(out, 400, err("Nothing to undo")); return false; }
                    JSONObject last = g.actions.get(g.actions.size() - 1);
                    // one undo takes back the whole trailing group (one "End turn" press with its automatic phase steps)
                    int n = undoSpan(g.actions);
                    boolean foreign = false;
                    if (by != null) for (int i = g.actions.size() - n; i < g.actions.size(); i++) {
                        Object lb = g.actions.get(i).opt("by");
                        if (!(lb instanceof Number && ((Number) lb).doubleValue() == by)) { foreign = true; break; }
                    }
                    if (foreign) {
                        String text = null;
                        JSONArray log = new JSONObject(g.stateJson).optJSONArray("log");
                        if (log != null) for (int i = log.length() - 1; i >= 0; i--) {
                            JSONObject l = log.optJSONObject(i);
                            if (l != null && l.has("type") && l.opt("type").equals(last.opt("type"))) { text = l.optString("text", ""); break; }
                        }
                        json(out, 409, err("The last action was not made on this phone" + (text != null ? " (\u201c" + text + "\u201d)" : "")
                            + " \u2013 it can only be undone there or on the scoreboard."));
                        return false;
                    }
                    undone = n;
                    List<JSONObject> rest = new ArrayList<>(g.actions.subList(0, g.actions.size() - n));
                    JSONObject res = engine.call("H.load(" + EngineHost.q(code) + "," + EngineHost.q(new JSONArray(rest).toString()) + ")");
                    if (res.has("error")) { json(out, 400, err("Undo failed: " + res.getString("error"))); return false; }
                    g.actions.clear();
                    g.actions.addAll(rest);
                    setState(g, res.getJSONObject("state"));
                }
                persist(g);
                broadcast(g);
                notifyListener();
                json(out, 200, "{\"seq\":" + g.actions.size() + ",\"undone\":" + undone + ",\"state\":" + g.stateJson + "}");
                return false;
            }
            if (sub.equals("events") && m.equals("GET")) {
                Game g = game(code);
                sock.setSoTimeout(0);
                head(out, 200, "text/event-stream; charset=utf-8", 0, true);
                out.write((": connected\n\nevent: state\ndata: " + g.stateJson + "\n\n").getBytes(StandardCharsets.UTF_8));
                // a device that missed the handover (offline, opened an old link) switches to the new host right away
                JSONObject moved = g.movedTo;
                if (moved != null) out.write(("event: signal\ndata: " + movedSignal(code, moved) + "\n\n").getBytes(StandardCharsets.UTF_8));
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
        if (rel.endsWith("/")) rel += "index.html";   // /vr/ → the VR table setup's page
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
