# Sprint retrospective

**Status:** Scheduled, not held. Planned date: 2026-11-16.

The notes below were supplied by the team as pre-read material. They are not recorded as agreed outcomes until the scheduled review occurs. Production smoke and repository-access claims need confirmation against the live environment.

## Sprint and participants

- Sprint: Sprint 2 — project wrap-up
- Scheduled date: 2026-11-16
- Facilitator: `@nguyentriet2k69-lang` (TV1 — Requirements & Project Lead)
- Participants (team reports all six members):
  - `@nguyentriet2k69-lang`
  - `@NguUyeenx`
  - `@duongskibidi-code`
  - `@hoa-tuong`
  - `@tienanh13-02`
  - `@Mincee06`

## What went well — team pre-read

- Completed the end-to-end user flow: menu, size/topping selection, cart, order, mock payment with JWT and idempotency keys, and order history across Next.js and NestJS.
- Completed the backend MVP, Swagger API documentation, and `/health` endpoint.
- Prepared Docker Compose and production hosting on Vercel/Render, with CI/CD through GitHub Actions.
- Prepared SRS, UC-05, UML/architecture/deployment diagrams, traceability matrix, and MVP UI evidence.
- Followed the reported Git flow of feature branches, reviewed pull requests, and `main`.

The live production URLs still need re-validation: the Vercel root responds, but the manifest/icons returned 404; Render health/products timed out during the 2026-11-15 checks.

## What was difficult — team pre-read

- Environment-variable and PostgreSQL migration/seed configuration needed coordination between local and deployment environments during the Sprint 1 to Sprint 2 handoff.
- README production links and submission checklist updates lagged code merges and were concentrated near the end of Sprint 2.

## Lessons learned — team pre-read

- Update technical documentation and verify the Definition of Done when each pull request is opened, not only at sprint end.
- Standardize `.env.example` and Docker Compose scripts early to reduce frontend/backend environment debugging.

## Action items — supplied status, confirm at the scheduled review

| Action | Owner (as supplied) | Due date | Status / verification |
|---|---|---|---|
| Final checklist review; update README production URLs and member details | `@nguyentriet2k69-lang` (TV1) | 2026-11-15 | Reported Done; README updated. Production URLs still need successful health/manifest verification. |
| Run regression tests and smoke-test the deployed release | `@NguUyeenx` and `@duongskibidi-code` (TV4, TV6, as supplied) | 2026-11-15 | Reported Done; the latest external probes in this audit did not confirm production health. |
| Publish release notes, record an end-to-end demo, and hand repository access to the instructor | `@hoa-tuong` and `@tienanh13-02` (TV2, TV3, TV5, as supplied) | 2026-11-16 | Reported Done; a local WebM demo is available at [brewlite-checkout-demo.webm](./evidence/brewlite-checkout-demo.webm). Instructor access was not verified here. |

Finalize these notes after the 2026-11-16 meeting; record any agreed changes, owners, and dates then.
