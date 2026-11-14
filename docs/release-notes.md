# BrewLite release notes

## Assignment 2 handoff (unreleased)

### Included

- Dedicated PostgreSQL test Compose service and runner for the 9 order/payment integration tests.
- Stable Unicode-aware demo seeding, explicit nullable product image column, deterministic fixture cleanup, and a checkout E2E path.
- Local Compose services for PostgreSQL, NestJS API, and Next.js web; production Compose topology with private database network, Caddy HTTPS routing, migration/seed jobs, and health checks.
- CI verification for API/Web and a CD workflow that verifies, builds SHA/version-tagged GHCR images, deploys to Ubuntu over host-key-verified SSH, runs HTTPS smoke tests, and restores the previous application SHA on failure.
- Backup-before-migration, one-time idempotent demo seed, manual image rollback, team workflow documentation, and local CI evidence.

### Verification recorded

- PostgreSQL 16.15: integration suite **9/9 PASS**; full API suite **126/126 PASS**; E2E suite **2/2 PASS**.
- Migrations and idempotent seed ran successfully against PostgreSQL; test fixtures were removed afterward.
- API and Web lint/build passed in local verification.
- CI evidence: [`ci-local-success.txt`](./evidence/ci-local-success.txt) and [`ci-local-failure.txt`](./evidence/ci-local-failure.txt).

### Release blockers / limitations

- No Ubuntu server, DNS names, or GitHub production secrets were provided. The workflow and deployment target are configured, but production is **not deployed** and no production URL is claimed.
- Docker Engine was unavailable locally, so actual Compose container startup and production image rollout remain unverified. Compose configuration validation is not a substitute for a live deployment.
- GitHub Actions has not run remotely from the repository. Enable branch protection (`API`, `Web`) and configure the `production` Environment before relying on CI/CD.
- Before accepting production traffic, verify TLS from outside the host, firewall rules, encrypted/off-host backup retention, database restore, and rollback on a staging server. Payments remain mock and do not process real funds.
