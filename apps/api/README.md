# BrewLite Backend API

NestJS and PostgreSQL API for the BrewLite menu and checkout. The backend owns product lookup, pricing, order snapshots, stock reservations, mock payments, and customer order history. The API does not accept a client-calculated final amount or real card credentials.

## Requirements

- Node.js 20.19+ or 22.12+.
- A PostgreSQL database for running the API.
- A separate disposable PostgreSQL database for integration tests.

## Configure the environment

Copy `.env.example` to `.env` in `apps/api` and set the database URL and JWT secret. `JWT_SECRET` must contain at least 32 UTF-8 bytes. Use a random secret and never commit `.env` or production credentials. `CORS_ORIGIN` is a comma-separated list of exact HTTP(S) origins; production requires an explicit value.

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |
| `PORT` | No | `3001` | HTTP listen port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL |
| `JWT_SECRET` | Yes | — | HS256 signing secret, at least 32 UTF-8 bytes |
| `JWT_EXPIRES_IN` | No | `1d` | Token lifetime such as `15m` or `1d` |
| `CORS_ORIGIN` | Production: yes | `http://localhost:3000` outside production | Comma-separated exact origins; wildcard is rejected |
| `DB_LOGGING` | No | `false` | TypeORM query logging; keep disabled in production |
| `MOCK_PAYMENT_RESULT` | No | `success` | Mock terminal result: `success` or `failure` |
| `MOCK_PAYMENT_TIMEOUT` | No | `false` | When `true`, mock payments return `UNKNOWN` for reconciliation testing |

The API connects to PostgreSQL during application startup. Schema synchronization and automatic migrations are disabled. Apply migrations explicitly before starting a fresh database.

## Run migrations and seed

Run commands from `apps/api`:

```powershell
npm install
npm run migration:show
npm run migration:run
npm run seed
npm run start:dev
```

Migration order is Product baseline, Users, Orders/Inventory, then Payment Attempts. The Product baseline preserves a compatible existing `product` table. Later migrations reject an untracked pre-existing schema where they cannot safely prove compatibility. Rollbacks for populated user, order, and payment tables are intentionally refused to protect records.

The seed inserts nine demo Products and is idempotent. It does not overwrite existing rows or remove user data. A Product with the same normalized name but a different ID is reported as a conflict and left unchanged. Demo prices and stock values are not official store values. Image source and attribution are recorded beside each seed URL in `src/products/demo-products.seed.ts`.

## Run tests and checks

```powershell
npm run lint
npm run test -- --runInBand
npm run test:cov -- --runInBand
npm run build
git diff --check
```

The PostgreSQL integration suites are enabled by `TEST_DATABASE_URL`. Point it only at a separate disposable test database; the tests run migrations and create/delete fixtures there.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://tester:password@localhost:5432/brewlite_test'
npm run test -- --runInBand
```

With no `TEST_DATABASE_URL`, Jest marks the integration suites skipped. Unit tests with repositories or gateways mocked do not verify PostgreSQL transactions, row locks, migrations, or concurrency.

## API overview

JSON request and response bodies are used unless otherwise stated. Validation failures use HTTP 400. Errors share this envelope:

```json
{
  "statusCode": 409,
  "code": "OUT_OF_STOCK",
  "message": "There is not enough stock.",
  "timestamp": "2026-11-14T00:00:00.000Z",
  "path": "/orders"
}
```

| Method and path | Authentication | Request | Success and important errors |
|---|---|---|---|
| `POST /auth/register` | Public | `{ "fullName": "Nguyen Van A", "email": "user@example.com", "password": "at-least-8-characters" }` | `201 { user: { id, fullName, email }, accessToken }`; `409 EMAIL_ALREADY_REGISTERED`; validation `400` |
| `POST /auth/login` | Public | `{ "email": "user@example.com", "password": "…" }` | `200 { user, accessToken }`; `401 INVALID_CREDENTIALS`; validation `400` |
| `GET /products` | Public | — | `200 Product[]` with `id`, `name`, `basePrice`, `stock`, `imageUrl` |
| `GET /products/:id` | Public | Product UUID | `200 Product`; `400` invalid UUID; `404 PRODUCT_NOT_FOUND` |
| `GET /pricing/options` | Public | — | `200 { currency, sizes, toppings }`; prices are configured integer VND adjustments |
| `POST /orders` | Bearer JWT; `Idempotency-Key` header | `{ "items": [{ "productId": "uuid", "quantity": 1, "sizeCode": "M", "toppingIds": [] }] }` | `201 Order` with `totalAmount`, immutable item price snapshots, and reservation; `400` validation; `404 PRODUCT_NOT_FOUND`; `409 OUT_OF_STOCK`, `IDEMPOTENCY_KEY_REUSED`, or price errors |
| `GET /orders/me?page=1&pageSize=20` | Bearer JWT | Optional pagination | `200 { items, page, pageSize, total }`; only the signed-in user's Orders |
| `GET /orders/:id` | Bearer JWT | Order UUID | `200 Order` with item snapshots and reservation statuses; `400` invalid UUID; `404 ORDER_NOT_FOUND` for missing or unowned Orders |
| `POST /payments` | Bearer JWT; `Idempotency-Key` header | `{ "orderId": "uuid", "method": "CARD" }` or `WALLET` | `200` terminal result or `202` `PROCESSING`/`UNKNOWN`; returns `paymentAttemptId`, `reservationId`, `status`, `amount`, `currency`, timestamps, and `orderStatus` |
| `GET /payments/:id` | Bearer JWT | Payment attempt UUID | `200` persisted attempt plus Order and reservation states, amount/currency, and timestamps; `404 PAYMENT_ATTEMPT_NOT_FOUND` for missing or unowned attempts |
| `GET /health` | Public | — | `200` when PostgreSQL responds to `SELECT 1`; otherwise `503 DATABASE_UNAVAILABLE` |

Private endpoints require `Authorization: Bearer <accessToken>`. Ownership failures are returned as 404 so another user's resource is not disclosed. Public Product endpoints are read-only; there are no Product write routes.

Swagger UI is served at `/api-docs` when the API is running.

## Pricing, idempotency, and payments

- Send Product IDs, quantity, size code, and topping IDs to `POST /orders`. The backend validates options, calculates prices, snapshots the applied prices/names, and reserves stock transactionally. Do not send or calculate `amount` on the client.
- Repeating an Order request requires the same user, key, and payload. Reusing that key with a different payload returns `IDEMPOTENCY_KEY_REUSED`.
- `POST /payments` requires an Order owned by the caller and a currently payable reservation. It reads the authoritative Order total; client-supplied amount is rejected.
- On `SUCCESS`, the Order becomes `PAID` and stock stays consumed. On confirmed `FAILED`, the Order becomes `PAYMENT_FAILED` and the reservation is released once.
- For timeout or `UNKNOWN`/`PROCESSING`, keep the Order pending and stock reserved. Poll `GET /payments/:paymentAttemptId` or reconcile via `POST /payments` using the **same** `Idempotency-Key`.
- Use a new payment key only after a confirmed `FAILED` result. Retry on the same Order ID; the backend creates a new reservation. A retry with insufficient stock returns `OUT_OF_STOCK` and rolls back.
- The mock gateway stores no card number, CVV, wallet credentials, or real payment credentials. Changing mock configuration is for development/test scenarios only.

Important error codes include `VALIDATION_ERROR`, `INVALID_ACCESS_TOKEN`, `EMAIL_ALREADY_REGISTERED`, `INVALID_CREDENTIALS`, `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `ORDER_NOT_FOUND`, `ORDER_NOT_PAYABLE`, `ORDER_NOT_RETRYABLE`, `PAYMENT_IN_PROGRESS`, `PAYMENT_ATTEMPT_NOT_FOUND`, `RESERVATION_EXPIRED`, `INVALID_RESERVATION_STATE`, and `DATABASE_UNAVAILABLE`.
