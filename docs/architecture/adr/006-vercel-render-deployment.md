# ADR 006: Vercel + Render production deployment

**Status:** Accepted on 2026-11-15; replaces ADR-005.

## Context

The team confirmed the production target: Next.js web on Vercel, NestJS API and managed PostgreSQL on Render. The repository's Ubuntu/Caddy deployment design did not match the deployed providers. Docker Compose is required only for local/testing.

## Decision

- Deploy `apps/web` to Vercel and set production `NEXT_PUBLIC_API_URL` to the Render API origin.
- Deploy `apps/api` as a Render Web Service and use a Render PostgreSQL internal connection URL. The database is managed separately and is not deployed by the application workflow.
- GitHub Actions is the production release coordinator: verify first, deploy the exact commit SHA to Render through the Render API, wait for a live deployment and API smoke tests, deploy the web app with Vercel CLI, then run public HTTPS smoke tests.
- Disable provider auto-deploys that would race the workflow. Store provider tokens and service/project identifiers in a protected GitHub `production` Environment.
- Configure the Render service's pre-deploy migration command before enabling production releases. Database migrations must be backward-compatible; app rollback does not reverse schema/data changes.
- On failed rollout/smoke tests, the workflow rolls Vercel back to its prior production deployment and requests a Render rollback to the captured prior live deployment. Provider plans may limit rollback history.
- Docker Compose, including its PostgreSQL, API and web services, is local/testing only. The previous Ubuntu/Caddy/GHCR assets are retired and are not called by current CI/CD.

## Consequences

- Provider configuration, managed database backup policy, production secrets and rollback depend on Vercel/Render account settings; they are not represented by local Compose.
- Initial setup requires Render service ID/API key and Vercel team/project IDs/token in the protected GitHub Environment.
- A production deployment is not considered verified until API health/products, Vercel web/manifest, CORS and checkout smoke tests pass. The last observed API probe timed out and the web manifest returned 404.

## References

- [Deployment runbook](../../deployment.md)
- [Render deploy API](https://api-docs.render.com/reference/create-deploy)
- [Render rollback API](https://api-docs.render.com/reference/rollback-deploy)
- [Vercel CLI deploy](https://vercel.com/docs/cli/deploying-from-cli)
- [Vercel rollback](https://vercel.com/docs/cli/rollback)
