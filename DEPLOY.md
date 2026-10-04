# Backend deployment guide (Render)

> **Do not deploy this repo on Vercel.**  
> This is a long-running Express + MongoDB server. Vercel serverless will crash with `FUNCTION_INVOCATION_FAILED`.  
> Use **Render** for the backend and **Vercel** only for the [frontend repo](https://github.com/kammari-venkatesh/system-design-todo).

## 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database user: username + password.
3. Network Access → **Allow access from anywhere** (`0.0.0.0/0`) so Render can connect.
4. Copy connection string, e.g.  
   `mongodb+srv://USER:PASS@cluster.mongodb.net/system_design?retryWrites=true&w=majority`

## 2. Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**.
2. Connect GitHub repo: `kammari-venkatesh/system-design-todobackend`.
3. Settings:
   - **Root Directory:** leave empty (repo root is the backend)
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Plan:** Free (or paid for always-on)

4. Environment variables (required):

| Key | Example |
|-----|---------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | your Atlas URI |
| `JWT_SECRET` | long random string (32+ chars) |
| `FRONTEND_URL` | `https://your-app.vercel.app` or `https://*.vercel.app` *(auto-default)* |

Optional (auto on Render):

| Key | Notes |
|-----|-------|
| `PUBLIC_URL` | Auto-set from `RENDER_EXTERNAL_URL` if omitted |

5. **Render build settings** (if not using Blueprint):
   - **Build Command:** `npm ci` (not `yarn`)
   - **Start Command:** `npm start`
6. Open **Shell** in Render and run once:
   ```bash
   npm run seed
   ```
7. Test: `https://YOUR-SERVICE.onrender.com/api/health`  
   Expected: `{"status":"ok","env":"production"}`

### Blueprint (optional)

Import `render.yaml` via Render **Blueprints** for the same setup. You still must set `MONGO_URI`, `FRONTEND_URL`, and `PUBLIC_URL` manually.

## 3. Deploy frontend on Vercel

1. Import `kammari-venkatesh/system-design-todo` on Vercel.
2. Framework: **Vite** · Output: `dist`
3. Environment variable:
   ```
   VITE_API_URL=https://da-backend-1-zvvu.onrender.com
   ```
   No trailing slash.
4. Redeploy frontend after setting the variable.

## 4. Fix CORS / login issues

- `FRONTEND_URL` on Render must **exactly** match your Vercel URL (e.g. `https://system-design-todo.vercel.app`).
- No trailing slash.
- After changing env vars on Render, trigger a **manual redeploy**.

## 5. Remove wrong Vercel backend project

If you deployed `system-design-todobackend` on Vercel:

1. Vercel dashboard → that project → **Settings** → **Delete Project**.
2. Use only the Render URL for `VITE_API_URL`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing script: "start"` on Render | Wrong repo — connect **`system-design-todobackend`**, not `system-design-todo`. Frontend goes on **Vercel** only. |
| `FUNCTION_INVOCATION_FAILED` on Vercel | Backend is on wrong platform — use Render |
| Deploy fails on Render | Check `MONGO_URI`, Atlas IP whitelist |
| CORS error in browser | Set `FRONTEND_URL` to exact Vercel origin |
| Empty study plan | Run `npm run seed` in Render Shell |
| 401 on API | Register/login again; check `JWT_SECRET` is set |
