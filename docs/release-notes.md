# BrewLite release notes

## Assignment 2 handoff (unreleased)

### Included

- Dedicated PostgreSQL test Compose service and runner for the 9 order/payment integration tests.
- Stable Unicode-aware demo seeding, explicit nullable product image column, deterministic fixture cleanup, and a checkout E2E path.
- Mobile-first Next.js menu, product customization, persistent cart, register/login, JWT-authenticated order/payment, payment retry/reconciliation, confirmation and order history UI; installable web manifest and 192/512 SVG icons.
- Same-origin service worker that caches the app shell, static assets and public menu/pricing responses for offline browsing; checkout remains online-only.
- Playwright mobile-browser E2E coverage for checkout, registration, payment, history and offline menu fallback; wired into CI and CD verification.
- Local checkout demo video at [`docs/evidence/brewlite-checkout-demo.webm`](./evidence/brewlite-checkout-demo.webm); it uses a test API double and has no narration.
- Team-provided Sprint 2 retrospective pre-read is documented in [`sprint-retrospective.md`](./sprint-retrospective.md); the meeting is scheduled for 2026-11-16 and the notes are not final outcomes.
- Local/testing Compose services for PostgreSQL, NestJS API, and Next.js web.
- CI verification for API/Web and a CD workflow that verifies, deploys the exact commit to Render, deploys web with Vercel CLI, runs public HTTPS smoke tests, and requests provider rollback on failure.
- Vercel + Render deployment/rollback runbook, team workflow documentation, and local CI evidence.

### Verification recorded (2026-11-15)

- API unit/Jest suite: **126/126 PASS**; explicit PostgreSQL integration suite: **9/9 PASS**; API E2E: **2/2 PASS**.
- API lint/build and Web lint/build: **PASS**.
- Playwright browser E2E: **2/2 PASS** (`npm run test:e2e` from `apps/web`); includes successful checkout/history and cached catalog after going offline.
- PlantUML 1.2026.10 rendered all five `.puml` sources to checked-in SVG previews.
- `docker compose --env-file .env.example up --build -d --wait --wait-timeout 240`: **PASS**; local DB, API and web healthy. Host port 5432 was already occupied, so local DB was mapped to 5434 for this run.
- The retired Ubuntu/Compose production template was configuration-checked earlier in the audit; it is no longer the selected platform and does not validate active Vercel/Render settings.
- Local HTTP smoke: `/health`, `/products`, `/pricing/options`, `/`, `/manifest.webmanifest`, `/icon-192.svg`, `/icon-512.svg`: **HTTP 200**.
- Manual browser smoke: select product/size/topping → cart → register → create order → mock payment → confirmation → history: **PASS**.
- CI evidence: [`ci-local-success.txt`](./evidence/ci-local-success.txt) and historical first-run failure/fix: [`ci-local-failure.txt`](./evidence/ci-local-failure.txt).

### Release blockers / limitations

- The team supplied a Vercel frontend URL and a Render API URL. On 2026-11-15 the frontend root returned HTTP 200, while `/manifest.webmanifest`, `/icon-192.svg`, and `/icon-512.svg` returned HTTP 404. Render `/health` and `/products` timed out on 18-second probes; a prior health probe timed out after 75 seconds. API health, CORS and checkout are **not verified**.
- GitHub Actions currently reports zero workflows on the default branch, and lookup of `cd.yml` returns 404. Workflow changes are awaiting branch review/merge; no remote CI/CD run occurred. The team reports production settings are ready after merge, but provider IDs/tokens, Render migration configuration, and Vercel settings cannot be independently verified from this workspace.
- Selected 360/390/414 px browser viewports had no horizontal overflow; this is not exhaustive device/browser coverage.
- Docker Compose is verified for local/testing only; production provider rollout remains unverified.
- Enable branch protection (`API`, `Web`) and configure the `production` Environment before relying on CI/CD.
- Offline browsing serves the cached shell/catalog, but creating orders and payments still requires a live API connection.
- Before accepting production traffic, verify API health/CORS, the Vercel manifest, Render managed-database backup/restore, and provider rollback on staging. Payments remain mock and do not process real funds.
