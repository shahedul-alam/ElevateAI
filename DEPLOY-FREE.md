# Free-tier deploy (Neon + Render + Vercel)

Vercel serves `client/` and rewrites `/api/*` to the Render server, so the session cookie stays on one origin.

1. Neon: create a project. Run once locally with the **direct** URL: `cd server && DATABASE_URL=<direct> bun run db:deploy && bun run db:seed-catalog` (and `db:seed-admin` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
2. Render: create a free Key Value (Redis) in the same region as the server, then a Blueprint from this repo (`render.yaml`). Set the `sync: false` vars. `DATABASE_URL` is the Neon **pooled** URL, `REDIS_URL` the Key Value internal URL.
3. Put the Render host into `client/vercel.json`.
4. Vercel: root directory `client`, build `bun run build`, output `dist`.
5. Set `BETTER_AUTH_URL` and `CLIENT_ORIGIN` on Render to the Vercel URL, redeploy.

Check: `/api/health` through Vercel, register/login/reload, 6th bad login answers 429 (else adjust `TRUST_PROXY`), 5 MB resume upload through the rewrite.
Google sign-in redirect URI: `https://<vercel-host>/api/auth/callback/google`.
