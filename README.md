# Civic Lens (working name)

A nonpartisan political opinion platform. People read a neutral, **source-blind** briefing, answer one question on a seven-point scale (or say they don't know enough), and only then see how other participants answered, read their reasons, and inspect the original reporting.

Core loop: **Discover → Read → Rate → Reveal → Discuss → Explore → Return.**

This repository implements the P0 scope of the product spec: responsive web app, accounts and optional onboarding, Discover feed, AI-assisted / human-approved editorial pipeline, source-blind briefings, duplicate-safe ratings, results, source reveal, explanations and replies, reporting and moderation with appeals, My Views history, privacy controls (export + deletion), analytics, error monitoring, and automated tests.

## Quick start

Requirements: Node 22, PostgreSQL 16.

```bash
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS
npm install
npm run db:migrate              # apply migrations
npm run seed                    # topics only — no stories, votes or comments are ever seeded
npm run dev                     # http://localhost:3000
npm run worker                  # optional: feed ingestion, link checks, maintenance
```

Sign up with an email listed in `ADMIN_EMAILS` to become an admin, then open **Newsroom** (`/admin`) to create, review, approve and publish the first story. Promote other staff with `npm run set-role -- someone@example.com editor` (roles: `user`, `moderator`, `editor`, `admin`) or from **Newsroom → Users**.

## Tests

```bash
npm run typecheck
npm test                        # unit + integration (needs TEST_DATABASE_URL, migrated)
npm run build && npm run test:e2e   # Playwright E2E tests A–E against a production build
```

Integration tests run against a real PostgreSQL database (`TEST_DATABASE_URL`, default `postgresql://civic:civic@localhost/civic_test`). E2E tests recreate the schema in `E2E_DATABASE_URL` (default `civic_e2e`) on every run and create all data through the app.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): modules, request flow, and how the rules are enforced
- [Database schema](docs/SCHEMA.md)
- [API reference](docs/API.md)
- [Deployment and recovery](docs/DEPLOY.md)
- [Decisions, substitutions and open items](docs/DECISIONS.md)
