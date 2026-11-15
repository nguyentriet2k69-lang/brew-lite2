# Ma trận truy vết BrewLite (TV1 Nguyễn Minh Triết – Requirements Owner)

Ma trận này là trách nhiệm của **TV1 Nguyễn Minh Triết (Requirements Owner)**. Phạm vi task TV1 gồm: thu thập stakeholder/phạm vi và giả định tại `docs/requirements/context-and-scope.md`; quản lý FR/NFR, MoSCoW và Acceptance Criteria trong `docs/requirements/srs.md`; đặc tả UC-05 tại `docs/requirements/uc-checkout-spec.md`; duy trì use-case diagram và ma trận truy vết này. TV1 phải nối từng FR/NFR với UC/User Story → thiết kế/sơ đồ → code/API → test, cập nhật kết quả theo bằng chứng (không đánh dấu kế hoạch là kết quả), và review truy vết của TV2–TV6 trong cùng PR thay đổi yêu cầu, sơ đồ, API/UI hoặc test.

## Trạng thái triển khai

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test | Kết quả |
|:--|:--|:--|:--|:--|:--|
| FR-01 | UC-01 – Xem menu | Use-case, Activity, Product trong Class | `GET /products`; `apps/web/src/app/page.tsx` | `apps/api/src/products/products.controller.spec.ts`; `apps/web/e2e/checkout.spec.ts`; local Compose và production `GET /products` | API/controller tests và browser E2E pass. Local và production API trả 9 products; production browser smoke xác nhận menu có 9 món trên alias. |
| FR-02 | UC-02 – Chi tiết, size/topping | Product, OrderItem trong Class; UC-05 | `GET /products/:id`, `GET /pricing/options`; UI tùy chỉnh size/topping, giá ước tính | `apps/api/src/products/products.controller.spec.ts`; `apps/api/src/pricing/pricing.service.spec.ts`; browser E2E | UI/API đã hiện thực; API tests và browser E2E local pass với API test double. |
| FR-03 | UC-03 – Quản lý giỏ hàng | Activity; UC-05 | Cart state + `localStorage` trong `apps/web/src/app/page.tsx`; số lượng/xóa; `POST /orders` gửi items | `apps/web/e2e/checkout.spec.ts` | UI và browser flow menu→cart pass; API order được xác minh riêng qua integration/API E2E. |
| FR-04 | UC-04 – Đăng ký/đăng nhập | Use-case, Activity, Sequence, User trong Class; ADR-002 | Auth forms; `sessionStorage` access token; `POST /auth/register`, `/auth/login`; JWT guard | `apps/api/src/auth/*.spec.ts`; `apps/api/test/app.e2e-spec.ts`; `apps/web/e2e/checkout.spec.ts` | Backend/API E2E và browser UI flow pass locally; browser test dùng API test double. Token storage có XSS risk, xem ADR-002. |
| FR-05 | UC-05 – Tạo đơn | Activity, Sequence, Order/OrderItem/InventoryReservation trong Class | JWT-protected `POST /orders`, server-side pricing, DB transaction, order idempotency key | `apps/api/src/orders/orders.service.spec.ts`; `apps/api/src/orders/orders.integration.spec.ts`; API E2E; `apps/web/e2e/checkout.spec.ts` | API tests và UI checkout browser E2E pass; browser test dùng API test double, production checkout chưa xác minh. |
| FR-06 | UC-05 – Thanh toán | Sequence, Payment/PaymentAttempt trong Class; ADR-004 | JWT-protected `POST /payments`; payment idempotency key; mock gateway; retry/reconcile UI | `apps/api/src/payments/*.spec.ts`; `apps/api/src/payments/payments.integration.spec.ts`; API E2E; `apps/web/e2e/checkout.spec.ts` | API tests và browser mock-payment flow pass. Confirmed failure cần key mới; kết quả không rõ reconcile bằng key cũ. |
| FR-07 | UC-06 – Xác nhận/lịch sử | Order trong Class; UC-05 | `GET /orders/:id`, `GET /orders/me`; confirmation/history UI | `apps/api/src/orders/orders.controller.spec.ts`; API E2E; `apps/web/e2e/checkout.spec.ts` | API tests và browser confirmation/history flow pass locally; production history chưa xác minh. |
| FR-08 | UC-05, UC-07 – Trạng thái đơn | OrderStatus trong Class | Trạng thái API hiện có: `PENDING`, `PAID`, `PAYMENT_FAILED`, `CANCELLED`; chưa có luồng nhân viên chuyển trạng thái | Payment/order unit và integration tests | Một phần. `PREPARING`, `READY`, `COMPLETED` và state machine cho nhân viên chưa triển khai. |
| FR-09 | UC-05 – Kiểm soát tồn kho | Activity, Sequence, Order/InventoryReservation trong Class; ADR-003 | `OrdersService` khóa Product và tạo order/reservation trong transaction; `InventoryService` consume/release/reacquire | `apps/api/src/orders/orders.integration.spec.ts`; `apps/api/src/payments/payments.integration.spec.ts` | Pass: concurrency, không oversell và payment retry được bao phủ trong PostgreSQL integration tests. |
| FR-10 | UC-08 – Promotion/Loyalty (Could) | Promotion/LoyaltyTransaction trong Class (mô hình mục tiêu) | Chưa có module/API/entity | Chưa có | Chưa triển khai; Could, không phải MVP gate. |
| FR-11 | UC-07 – Barista cập nhật trạng thái (Won't MVP) | SRS | Không có staff UI/API | Không áp dụng | Ngoài phạm vi MVP theo SRS. |
| NFR-01 | Hiệu năng | SRS; deployment diagram | `GET /products` | Local smoke test chỉ xác nhận HTTP 200 | Chưa đo mục tiêu <500 ms / <2 giây; cần benchmark có điều kiện đo được. |
| NFR-02 | Bảo mật | ADR-002, Sequence, Deployment | Bcrypt, JWT guard, validation, kiểm tra quyền sở hữu order/payment, cấu hình secrets ngoài Git | Auth/order/payment unit, integration và API E2E | Backend tests pass; production secrets/deployment chưa được kiểm chứng. |
| NFR-03 | Mobile-first/PWA | Architecture overview, Deployment | Next.js mobile-first UI, manifest/icons; `apps/web/public/sw.js` caches shell/static assets and public catalog/pricing API | Web lint/build; `apps/web/e2e/checkout.spec.ts`; manual viewport 360/390/414 px | Browser test confirms cached catalog remains visible offline. Checkout needs network; installability on physical devices is not verified. |
| NFR-04 | Docker, CI/CD | Deployment diagram, ADR-006, `docs/deployment.md` | Local/testing `docker-compose.yml`; GitHub Actions CI and Render/Vercel CD; API health/products/CORS + web/manifest smoke and provider rollback | Local Compose; GitHub CI run #9; CD run #3 attempt 7; production API/web/CORS smoke | Local Compose healthy and CI run #9 passed. CD Verify, Render deployment/API smoke passed; Vercel deploy failed because Personal Account ID was passed as CLI `--scope`; rollback job passed. Workflow now omits `--scope` and validates `VERCEL_PROJECT_ID` (`prj_...`) before any provider deploy. Project Settings confirmed `prj_RZiZ1V47fQ0tYKsQbHrImw4xLfkU` for `brew-lite2-9bg7`; GitHub Environment must be checked/updated, then CI and CD rerun. Ubuntu Compose pipeline is retired. |
| NFR-05 | Health/quan sát | Deployment diagram | `GET /health` kiểm tra DB; Compose API healthcheck | `apps/api/src/health.controller.spec.ts`; local Compose and Render `/health` | Local and production health pass; Render reports database connected. |
| NFR-06 | Migration/seed | Class, ADR-003, Deployment | TypeORM migrations and idempotent demo seed | Local Compose startup; production `/products` smoke | Local migration/seed pass; production API currently returns 9 products. Production migration history and database backup/restore have not been independently verified. |
| NFR-07 | Testability | SRS, UC-05; test index tại `tests/README.md` | API unit/integration/Nest HTTP E2E tại `apps/api`; Playwright browser E2E tại `apps/web/e2e/` | CI-style unit 26 suites/117 pass/9 skipped; full unit run with DB URL 28 suites/126 pass; PostgreSQL integration 2 suites/9 tests; API E2E 1 suite/2 tests; browser E2E 2 tests | All local checks pass. GitHub CI run #9 passed. Browser E2E uses an isolated API test double; production checkout is not verified. |

## Test evidence hiện tại

Đã chạy trong phiên audit ngày 2026-11-15:

- API lint/build: pass.
- CI-style API unit run without `TEST_DATABASE_URL`: 26 suites, 117 tests pass and 9 integration tests are skipped.
- API Jest suite with `TEST_DATABASE_URL`: 28 suites, 126 tests pass (bao gồm integration specs).
- PostgreSQL integration command riêng: 2 suites, 9 tests pass.
- API E2E: 1 suite, 2 tests pass; đây là E2E qua Nest HTTP API/Supertest, không phải browser E2E.
- Web lint/build: pass; Next build outputs `/manifest.webmanifest`.
- Playwright: 2 browser E2E pass in mobile Chromium; checkout/history uses an isolated API test double, and offline test verifies cached catalog fallback.
- All five PlantUML SVG previews regenerated from source using PlantUML 1.2026.10.
- Local Docker Compose: PostgreSQL, API và web healthy on isolated ports 5444/3111/3210; `/health`, `/products` (9 items), web root, manifest and icon return HTTP 200.
- Manual browser checkout smoke: chọn món/size/topping, thêm giỏ, đăng ký JWT, tạo đơn, thanh toán mock, xem xác nhận và lịch sử — pass.
- Manual responsive check ở viewport 360, 390 và 414 px — không có horizontal overflow.
- GitHub Actions: [CI run #9](https://github.com/nguyentriet2k69-lang/brew-lite2/actions/runs/43697256916) on `main` passed all API/Web lint, test, build and browser E2E jobs. [CD run #3, attempt 7](https://github.com/nguyentriet2k69-lang/brew-lite2/actions/runs/43697256946): Verify, Render deploy and API smoke passed; Vercel deploy failed on Personal Account `--scope`; rollback job passed. Project Settings confirms the production project ID; the workflow fix and Environment update have not yet been deployed.
- Production check 2026-11-15: Render `/health` returned HTTP 200 with database connected; `/products` returned HTTP 200 with 9 products. CORS preflight returned HTTP 204 with the matching allow-origin for both Vercel domains. Both Vercel domains returned HTTP 200 for root, manifest and 192/512 icons; browser smoke on the alias showed all 9 product cards. Production checkout and automated rollback have not been verified.

Các lệnh và giới hạn được ghi tại [README](../README.md), [test index](../tests/README.md) và [release notes](release-notes.md).

## Công việc TV1 và quy tắc duy trì

1. Với mỗi FR/NFR, ghi rõ mã yêu cầu, UC/User Story, sơ đồ/ADR liên quan, code/API thực tế, test cụ thể và kết quả có bằng chứng.
2. Đồng bộ Acceptance Criteria trong [SRS](requirements/srs.md) với API/UI đã triển khai; ghi rõ phần chưa có thay vì gán test kế hoạch.
3. Rà soát ma trận trong PR của các thành viên TV2–TV6 trước merge; mọi thay đổi yêu cầu/thiết kế/code/test phải cập nhật truy vết cùng PR.
4. Chỉ đổi kết quả sang Pass sau khi chạy test liên quan; phân biệt API E2E với E2E giao diện và local verification với production deployment.
5. FR Must cần test phù hợp; các luồng web/PWA đã có browser test local. Production health/CORS/API catalog đã smoke-test; production checkout, automated CD release, PWA trên thiết bị thật, và xác nhận backup/migration vẫn cần bằng chứng trước nghiệm thu.
