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

- API unit/Jest suite with `TEST_DATABASE_URL`: **126/126 PASS**; CI-style unit run without DB: **117 PASS, 9 integration tests skipped**; explicit PostgreSQL integration suite: **9/9 PASS**; API E2E: **2/2 PASS**.
- API lint/build and Web lint/build: **PASS**.
- Playwright browser E2E: **2/2 PASS** (`npm run test:e2e` from `apps/web`); includes successful checkout/history and cached catalog after going offline.
- PlantUML 1.2026.10 rendered all five `.puml` sources to checked-in SVG previews.
- Local Compose audit run `docker compose --env-file .env.example -p brew-lite2-audit up --build --wait --wait-timeout 300 -d`: **PASS**; DB/API/Web healthy on host ports 5444/3111/3210. `/health`, `/products` (9 items), web root, manifest and icon returned HTTP 200.
- The retired Ubuntu/Compose production template was configuration-checked earlier in the audit; it is no longer the selected platform and does not validate active Vercel/Render settings.
- Local HTTP smoke: `/health`, `/products`, `/pricing/options`, `/`, `/manifest.webmanifest`, `/icon-192.svg`, `/icon-512.svg`: **HTTP 200**.
- Manual browser smoke: select product/size/topping → cart → register → create order → mock payment → confirmation → history: **PASS**.
- CI evidence: [`ci-local-success.txt`](./evidence/ci-local-success.txt) and historical first-run failure/fix: [`ci-local-failure.txt`](./evidence/ci-local-failure.txt).

### Production verification and remaining blockers

- Production smoke on 2026-11-15: both Vercel domains returned HTTP 200 for root, manifest and 192/512 icons; the alias browser page displayed 9 products. Render `/health` returned HTTP 200 with database connected, `/products` returned 9 products, and CORS preflight passed for both exact origins.
- [GitHub Actions CI run #9](https://github.com/nguyentriet2k69-lang/brew-lite2/actions/runs/43697256916) on `main` passed API/Web verification. [CD run #4, attempt 4](https://github.com/nguyentriet2k69-lang/brew-lite2/actions/runs/43715225746) used the corrected Vercel project ID; Verify, Render deploy and API smoke passed. Vercel failed because the CLI ran in `apps/web` while the Vercel project Root Directory is `apps/web`, resolving `apps/web/apps/web`. The subsequent Render rollback request returned HTTP 500.
- [PR #10](https://github.com/nguyentriet2k69-lang/brew-lite2/pull/10) runs Vercel deploy/rollback from repository root so the configured project root is applied once, and records the Render rollback HTTP status/error response. Its [CI run #12](https://github.com/nguyentriet2k69-lang/brew-lite2/actions/runs/43720931848) passed API and Web jobs. A fresh successful CD run is still required to verify production deployment and rollback. Production checkout was not exercised to avoid creating orders in the live database.
- Selected 360/390/414 px browser viewports had no horizontal overflow; this is not exhaustive device/browser coverage.
- Docker Compose is verified for local/testing only; production provider rollout remains unverified.
- Enable branch protection (`API`, `Web`) and configure the `production` Environment before relying on CI/CD.
- Offline browsing serves the cached shell/catalog, but creating orders and payments still requires a live API connection.
- Before relying on automated releases, confirm the `production` Environment contains the correct `prj_...` for the production web project and complete a controlled CD run. Verify Render managed-database backup/restore on staging. Payments remain mock and do not process real funds.
