# 7RFP — Deploying to Render + custom domain

This is the canonical deployment path for 7RFP. The pplx.app version
(https://7rfp.pplx.app) was a preview; production lives on Render at
https://7rfp.com.

## One-time setup

### 1. Create the Render service from the blueprint

1. Go to https://dashboard.render.com → **New** → **Blueprint**.
2. Connect your GitHub account, pick `lawschool102/7rfp`.
3. Render reads `render.yaml` and proposes the service. Click **Apply**.
4. The starter plan ($7/mo) is required because:
   - Persistent disks are not available on the free plan
   - Free plan apps sleep after 15 min of idle (kills weekly cron consistency)

### 2. Seed the database (first deploy only)

After the first deploy is healthy:

1. Open the Render dashboard for the `7rfp` service → **Shell** tab.
2. Run the seed script (idempotent, won't double-seed):
   ```bash
   bash seed-demos.sh
   ```
3. Verify the demo accounts work at the `*.onrender.com` URL Render gives you
   before adding the custom domain.

### 3. Wire up 7rfp.com

In Render dashboard:
1. **Settings** → **Custom Domains** → **Add Custom Domain**
2. Enter `7rfp.com` → Render shows you the DNS target (a CNAME or A records)
3. Repeat for `www.7rfp.com`

In Cloudflare (the 7rfp.com zone):
1. Delete any existing `@` and `www` records pointing at pplx.app.
2. Add the records Render gave you. **Set proxy status to DNS only (gray cloud)**
   on first issue — Render handles SSL itself; orange-cloud proxying through
   Cloudflare on top of Render's SSL can cause cert loops.
3. Once issued, you can flip Cloudflare back to proxied if you want CDN/WAF.

### 4. Verify

- `https://7rfp.com` returns the landing page
- `https://7rfp.com/#/login` works
- Demo logins (`demo@nucleos.com` / `demo@it1.com`) succeed
- Posting a Team Note works (writes to the persistent disk)

## Environment variables

Set in `render.yaml` already, but listed here for reference:

| Var | Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Express + Vite production mode |
| `PORT` | `5000` | Render passes this through |
| `DATA_DB_PATH` | `/var/data/data.db` | SQLite on the persistent disk |

## Updates after first deploy

Push to `main` → Render auto-deploys. The persistent disk + `data.db` survive
across deploys.

## If you ever need to roll back

Render keeps every previous build. Dashboard → **Deploys** → pick a prior
green build → **Rollback to this deploy**.
