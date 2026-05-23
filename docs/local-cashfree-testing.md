# Test Cashfree locally (production merchant keys)

Cashfree **production** requires `order_meta.return_url` to be **HTTPS**.

You also need **one browser origin**: after payment Cashfree redirects to `/payments/cashfree-complete` on that same origin — your JWT/localStorage lives there — so plain `localhost` HTTP + HTTPS return URL elsewhere will usually fail verification.

## Option A — HTTPS Vite dev (recommended on your laptop)

1. **Install frontend deps once** (`@vitejs/plugin-basic-ssl` is required):

   ```bash
   cd frontend && npm install
   ```

2. **Backend `.env`** (same origin everywhere):

   ```env
   PUBLIC_APP_URL=https://localhost:5173
   CASHFREE_RETURN_URL_ORIGIN=https://localhost:5173
   ```

   `CORS_ORIGINS` defaults in development now include those HTTPS localhost origins.

3. **Start API** as usual (`python run.py` from `backend/` on port **5001**).

4. **Start frontend**:

   ```bash
   cd frontend && npm run dev:https
   ```

   This enables **HTTPS** on port 5173 and **proxies** `/api` → `http://127.0.0.1:5001`, so there is no mixed‑content blocking.

5. Open **`https://localhost:5173`** (accept the self‑signed certificate warning once).

**Note:** Backend `order_meta.return_url` must include Cashfree's `{order_id}` placeholder so the browser receives `order_id` on `/payments/cashfree-complete` (handled automatically by this repo).

---

## Option B — ngrok

If Cashfree rejects `localhost` for your merchant (possible on some setups):

1. Run `ngrok http 5173` and copy the **HTTPS** forwarding URL (`https://…ngrok-free.app`).
2. Set `CORS_ORIGINS` on the backend to include that HTTPS origin (comma-separated).
3. Tunnel the API too (**second** ngrok `http 5001`) so the SPA can stay fully HTTPS → set `VITE_API_URL=https://YOUR-API.ngrok-url` **or** use `npm run dev:https` and point Vite proxy at localhost (only works when you open ngrok HTTPS that forwards **to Vite**, not bare Flask).

Minimal ngrok+Vite combo: **`ngrok http 5173`**, use **`npm run dev:https`**, **`CASHFREE_RETURN_URL_ORIGIN=https://YOUR-NGROK-URL`**, **`VITE_API_RELATIVE`** not needed if you tunnel only the SPA and proxy `/api` to localhost (same machine).

---

## Production / live site (Amplify + Lambda)

1. Set **`PUBLIC_APP_URL=https://YOUR_LIVE_ORIGIN`** (no path, no trailing slash) in **`backend/.env`**, then run **`serverless deploy`** so Lambda gets it (`useDotenv: true`). Example: `https://www.xpertintern.com`.
2. Put the same origin in **`CORS_ORIGINS`** if it is missing.
3. If **`PUBLIC_APP_URL`** was blank on deploy, the API fell back to the **first** CORS origin—which used to default to **`http://localhost`**, breaking Cashfree. The backend now prefers **HTTPS** and **non-localhost** CORS origins as a fallback—but you should **always set `PUBLIC_APP_URL` explicitly**.

Use the exact origin visitors use (Amplify hostname or custom www vs apex). Optional: **`CASHFREE_RETURN_URL_ORIGIN`** to the same HTTPS value only if needed.
