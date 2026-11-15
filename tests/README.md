# BrewLite test index

Automated tests cover the NestJS API and the Next.js browser flows:

- Unit tests: `apps/api/src/**/*.spec.ts`
- PostgreSQL integration tests: `apps/api/src/**/*.integration.spec.ts`
- HTTP E2E tests (Nest + Supertest): `apps/api/test/*.e2e-spec.ts`
- Browser E2E tests (Playwright): `apps/web/e2e/*.spec.ts`
- Run instructions and local Compose setup: [root README](../README.md)

The browser suite runs the web production build against an isolated API test double. It exercises menu customization, cart, registration, order/payment, order history, manifest delivery, and cached catalog access while offline. Checkout still requires a network connection. Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e` from `apps/web` after building with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4174`.
