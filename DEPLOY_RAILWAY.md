# Deploy 7RFP on Railway

Railway hosts the complete Express application: UI, authentication, API, SQLite, and Claude integration. GitHub Pages cannot run this server-backed application.

## Required service settings

Railway detects `railway.json` and runs `npm run build` followed by `npm start`.

Create a persistent Volume mounted at `/data`, then set:

```text
NODE_ENV=production
DATA_DB_PATH=/data/data.db
JWT_SECRET=<a new random 32+ byte secret>
ANTHROPIC_API_KEY=<a newly rotated Anthropic key>
AI_MAX_REQUESTS_PER_HOUR=8
AI_MAX_REQUESTS_PER_DAY=30
AI_MAX_OUTPUT_TOKENS=2800
```

Do not set any secret with a `VITE_` prefix. Generate a Railway public domain after deployment. The health check is `/api/health`.

## Persistence

The Railway volume is required. Without it, SQLite users, sources, RFPs, and AI audit records disappear when the service restarts or redeploys.
