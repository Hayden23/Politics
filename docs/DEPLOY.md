# Deployment and recovery

## Environments

Run three fully separate environments, each with its own database, secrets and OAuth client:

| | Database | Notes |
|---|---|---|
| Local | `civic_dev` (+ `civic_test`, `civic_e2e` for tests) | `.env` |
| Staging | managed Postgres, staging project | Same build as production; editors rehearse on it. Never copy production political responses into staging. |
| Production | managed Postgres with PITR backups | |

## Recommended hosting

Any Node 22 host plus managed PostgreSQL 16 works (Railway, Render, Fly.io, AWS App Runner + RDS, etc.). Two processes from one image:

- **web**: `npm start` (port 3000), health check `GET /api/health`
- **worker**: `npm run worker` (or a cron calling `npm run worker:once` every 30 min)

Release step before each deploy: `npm run release` (applies migrations, upserts topics). Migrations are forward-only.

Required env: `DATABASE_URL`, `AUTH_SECRET` (32+ random bytes), `APP_URL`, `ADMIN_EMAILS`. Set `DATABASE_SSL=require` when your provider needs it. Optional: Google OAuth, `ANTHROPIC_API_KEY`, `INGEST_FEEDS`, `ERROR_WEBHOOK_URL`. See `.env.example`.

Database role: the app needs DML on all tables and must **not** be a superuser in staging/production. Use a separate migration role with DDL rights for `npm run release`. The append-only audit log and immutability triggers apply to every role except superusers using `session_replication_role`.

## Docker

```bash
docker build -t civic-lens .
docker run --env-file .env -p 3000:3000 civic-lens                 # web
docker run --env-file .env civic-lens npm run worker               # worker
docker run --env-file .env civic-lens npm run release              # migrations
```

## Backups and restore (test quarterly)

1. Enable the provider's automated daily backups + point-in-time recovery (≥7 days).
2. Additionally take a nightly logical dump to separate storage: `pg_dump --format=custom --no-owner "$DATABASE_URL" > civic-$(date +%F).dump`.
3. Restore drill (staging): `createdb civic_restore && pg_restore --no-owner -d civic_restore civic-YYYY-MM-DD.dump`, point a staging instance at it, run `npm run db:migrate` (should be a no-op), sign in, open a published story's results and compare the counts with `SELECT question_id, count(*) FROM ratings GROUP BY 1`.
4. Record the drill date and result.

## Incident recovery

- **Bad deploy**: redeploy the previous image; migrations are additive so the previous build keeps working.
- **Bad publication**: an editor unpublishes immediately (`Newsroom → story → Unpublish`), then corrects and republishes; every step is in the audit log.
- **Compromised staff account**: an admin sets the role to `user` (sessions are revoked), then reviews `Newsroom → Audit log` for that actor.
- **Leaked secret**: rotate `AUTH_SECRET` (signs out OAuth flows in progress only) and provider keys; rotate the DB password and redeploy.

## Pre-launch checklist (spec §14)

Security review · source-blind permission tests (`tests/e2e/a-new-user.spec.ts`) · aggregation validation (`tests/integration/ratings.test.ts`) · review every published source record · export/deletion test · moderation drill · mobile accessibility audit · editor/moderator training · legal review of privacy policy, terms, guidelines, content licensing.
