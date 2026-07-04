# Gabby Cathedral — 3D Board Game

A browser-based 3D implementation of the Cathedral board game, branded as Gabby Cathedral: local 2-player, an AI opponent (Easy/Medium/Hard), and online play over the internet.

## Files

- **cathedral.html** — the entire game (all logic + 3D rendering).
- **server.js** — serves the game page **and** relays moves for online play (one Node process, one port).
- **package.json** — the server's one dependency (`ws`).

## Play locally (no server needed for local / vs-computer)

Just open **cathedral.html** in a browser — Local 2-Player and vs Computer work immediately.

For online play on your own machine, or to serve the page the "real" way:

```
npm install       # installs ws
node server.js     # then open http://localhost:8090/
```

Everything (the game page and the WebSocket relay) runs on that one port.

---

## Deploy online play to the internet (Render + your GoDaddy domain)

This hosts one service that serves the game **and** runs the relay, reachable at your own domain over HTTPS/WSS. Free tier works; note Render's free service sleeps after 15 min idle and takes ~1 min to wake.

### 1. Put the project on GitHub

Create a repo containing `cathedral.html`, `server.js`, and `package.json`, and push it. (GitHub Desktop is fine if you don't use the command line.)

### 2. Create the Render web service

1. Sign up at [render.com](https://render.com) (no card needed for free tier).
2. **New → Web Service**, connect your GitHub, pick the repo.
3. Fill in:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Instance type:** Free
4. Click **Deploy**. When it finishes, you get a URL like `https://cathedral-xyz.onrender.com`. Open it — the game loads. Online Play already works at this URL with no address to type.

Render provides `process.env.PORT` automatically; `server.js` reads it, so no port config is needed.

### 3. Connect your GoDaddy domain

Decide on a hostname, e.g. `play.yourdomain.com` (a subdomain is cleanest; you can also use the root domain).

**In Render:**
1. Open your service → **Settings → Custom Domains → Add Custom Domain**.
2. Enter `play.yourdomain.com`. Render shows you a **CNAME target** (something like `cathedral-xyz.onrender.com`).

**In GoDaddy:**
1. Go to your domain → **DNS → Manage DNS**.
2. **Add** a record:
   - **Type:** CNAME
   - **Name:** `play` (just the subdomain part)
   - **Value:** the Render target (e.g. `cathedral-xyz.onrender.com`)
   - **TTL:** default (1 hour)
3. Save.

> Using the **root** domain (`yourdomain.com`) instead of a subdomain? GoDaddy doesn't allow a CNAME on the root. In that case use Render's **A record** option: Render will show an IP to put in an `A` record with **Name** `@`. Follow whichever record type Render displays for the root.

Back in Render, the domain shows **Verifying…**, then **Certificate issued** once DNS propagates (minutes to a couple hours). After that, `https://play.yourdomain.com` serves the game, and Online Play connects over `wss://play.yourdomain.com` automatically.

### 4. Play

Send your friend the link (`https://play.yourdomain.com`). Each of you opens it, clicks **Online Play**, enters the same room code — one **Create Room**, the other **Join Room**. The first to join is Light and places the Cathedral.

---

## How online play works

The browser holds all the game logic. The server only relays two message types (`move`, `capture`) between the two players in a room, so it stays tiny and can't cheat or desync the rules. Because the page and the socket share an origin, the client auto-detects the WebSocket URL — there's nothing to configure. (An "Advanced: custom server" field exists if you ever want to point at a different relay.)

## Controls

- Click/drag a piece from the side panel to select it.
- Hover the board to preview; **left-click** to lock placement (yellow), **Space** to confirm.
- **R** rotate, **F** flip, **Esc** cancel. Right-drag orbits, scroll zooms, middle-drag rotates the piece.

## AI difficulty

- **Easy** — mostly random legal moves.
- **Medium** — greedy: values placing large pieces, claiming territory, and capturing.
- **Hard** — Medium plus one-move lookahead to avoid handing you a capture.
