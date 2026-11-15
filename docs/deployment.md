# Triển khai BrewLite trên Vercel và Render

## Kiến trúc triển khai

| Môi trường | Thành phần |
|---|---|
| Local/testing | Docker Compose: Next.js web, NestJS API, PostgreSQL; integration tests dùng PostgreSQL cô lập |
| Production web | Vercel project chạy Next.js từ `apps/web` |
| Production API | Render Web Service chạy NestJS từ `apps/api` |
| Production database | Render PostgreSQL managed service; API kết nối bằng internal database URL |
| CI/CD | GitHub Actions chạy test/build; Render API triển khai backend, Vercel CLI triển khai frontend |

Production URLs hiện đang sử dụng:

- Web chính: <https://brew-lite2-9bg7.vercel.app/>
- Web alias cũ: <https://brew-lite2-17cf.vercel.app/>
- API: <https://brew-lite2-backend.onrender.com>
- Health: <https://brew-lite2-backend.onrender.com/health>

Compose/Caddy/GHCR/SSH không còn là production topology. Các cấu hình Ubuntu cũ (`docker-compose.prod.yml`, `Caddyfile`, `scripts/deploy-production.sh`, `scripts/rollback-production.sh`, `docs/production.env.example`) được giữ để tham khảo nhưng **retired**, không được workflow mới sử dụng. Compose hiện hành chỉ dành cho local/testing.

## Cấu hình provider trước khi bật CD

### Render PostgreSQL

1. Dùng Render PostgreSQL instance của nhóm; không tạo database mới khi service hiện có đang dùng.
2. Cấu hình API bằng internal connection string trong Render Environment dưới tên `DATABASE_URL`; không đưa chuỗi này vào repository hoặc GitHub Actions logs.
3. Xác nhận plan có backup/restore phù hợp dữ liệu đồ án. Backup/restore thực tế chưa được kiểm chứng trong audit.

### Render API Web Service

- Connect the service to this GitHub repository and the `main` branch so the Render API can build a requested commit SHA.
- Root Directory: `apps/api`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start:prod:prepare` when the service plan does not support a Pre-Deploy Command.
- Health Check Path: `/health`
- Pre-Deploy Command: the current Render plan does not support this setting. The Start Command above applies pending migrations, runs the idempotent demo seed, then starts NestJS. On a plan that supports Pre-Deploy Command, set it to `npm run migration:run:prod && npm run seed:prod` and use `npm run start:prod` as the Start Command instead.
- Environment:
  - `DATABASE_URL`: internal URL của Render PostgreSQL.
  - `JWT_SECRET`: giá trị sinh riêng, tối thiểu 32 bytes.
  - `JWT_EXPIRES_IN`: ví dụ `1d`.
  - `CORS_ORIGIN`: comma-separated exact origins `https://brew-lite2-9bg7.vercel.app,https://brew-lite2-17cf.vercel.app`.
  - `MOCK_PAYMENT_RESULT=success`, `MOCK_PAYMENT_TIMEOUT=false` cho demo happy path.
  - `NODE_ENV=production` nếu service chưa tự đặt.
- Tắt Render auto-deploy theo commit. Workflow gửi đúng commit SHA qua Render API; bật auto-deploy đồng thời có thể gây deploy trùng hoặc đưa code mới trở lại sau rollback.

### Vercel Web Project

- Root Directory: `apps/web`; framework: Next.js.
- Production environment variable `NEXT_PUBLIC_API_URL=https://brew-lite2-backend.onrender.com`. Biến này được dùng trong bundle public, không đặt credential nào trong đó. Frontend cũng dự phòng API production nếu biến bị thiếu hoặc vẫn trỏ tới `localhost:3001`.
- Production domain phải trỏ đúng về project đang triển khai. Production deploy phải do CD workflow điều phối, không để Git integration tạo production deploy trùng; preview deployments có thể tiếp tục dùng theo chính sách nhóm.
- Xác minh `/manifest.webmanifest` và icons sau khi deploy. Kiểm tra ngày 2026-11-15 xác nhận cả hai Vercel domains trả HTTP 200 cho root, manifest, `/icon-192.svg` và `/icon-512.svg`.

### GitHub Actions Environment `production`

Tạo Environment `production`; bật required reviewers nếu phù hợp. Thêm các **Variables**:

| Variable | Giá trị |
|---|---|
| `API_URL` | `https://brew-lite2-backend.onrender.com` |
| `WEB_URL` | `https://brew-lite2-9bg7.vercel.app` |
| `RENDER_SERVICE_ID` | `srv-dbs94fjl550s73fqrqs0` (Render dashboard service `brew-lite2-backend`; verify before saving) |
| `VERCEL_ORG_ID` | Vercel account hoặc team ID sở hữu project |
| `VERCEL_PROJECT_ID` | `prj_RZiZ1V47fQ0tYKsQbHrImw4xLfkU` — project `brew-lite2-9bg7`, xác nhận trong Vercel Project Settings; không dùng ID của alias `brew-lite2-17cf` |

Thêm các **Secrets**:

| Secret | Quyền dùng |
|---|---|
| `RENDER_API_KEY` | Đọc deployment hiện tại, deploy commit, và rollback Render service |
| `VERCEL_TOKEN` | Deploy/rollback đúng Vercel project/team |

Không gửi secrets qua chat, không in ra workflow logs và không commit `.env` thật. Workflow kiểm tra `VERCEL_PROJECT_ID` có dạng `prj_...` trước khi deploy Render. Trong lệnh Vercel CLI không truyền `--scope`: `VERCEL_ORG_ID` chỉ được ghi vào `.vercel/project.json`, nhờ đó tránh dùng Personal Account ID như một scope CLI.

## Quy trình CI/CD

`.github/workflows/cd.yml` chạy verify trước khi deploy:

1. Install, lint, unit test, PostgreSQL integration/E2E và build API/Web trên GitHub Actions.
2. Chỉ khi verify pass, workflow lưu Render deployment đang live để có thể rollback.
3. Dùng Render API tạo deployment cho đúng `GITHUB_SHA`; poll trạng thái tới `live` hoặc trạng thái lỗi. Render API health và `/products` được smoke-test.
4. Dùng Vercel CLI từ repository root. Project đã đặt Root Directory là `apps/web`, nên không chạy CLI bên trong `apps/web` (nếu không Vercel ghép đường dẫn thành `apps/web/apps/web`). Sau đó smoke-test trang web, manifest, API health, products và CORS preflight.
5. Nếu lỗi sau khi Render đã nhận deploy, workflow khôi phục Vercel deployment (nếu đã deploy) và Render deployment trước đó. Cơ sở dữ liệu/migration không tự rollback; migration phải backward-compatible.

Workflow chạy khi push `main`, tag `v*`, hoặc dispatch thủ công từ `main`/tag `v*`. Deploy bị serialize để tránh hai release production chạy đồng thời. CI run #9 trên `main` đã pass. CD run #4, attempt 4 ngày 2026-11-15: Verify pass; Render deploy và API smoke pass; Vercel xác nhận đúng project ID nhưng deploy fail vì CLI chạy từ `apps/web` trong khi project Root Directory đã là `apps/web`, tạo đường dẫn không tồn tại `apps/web/apps/web`. Rollback API của Render tiếp đó trả HTTP 500; không có rollback thành công được xác nhận. Follow-up probe trong cùng phiên trả HTTP 200 cho `/health` và `/products`; điều này chỉ xác nhận API hiện phản hồi, không chứng minh rollback đã chạy. Root-path fix nằm trong PR #10; CI run #12 (API và Web) đã pass. Automated production release chỉ được xác nhận sau khi merge và CD mới pass public HTTPS/CORS smoke tests; nếu Render rollback tiếp tục lỗi, dùng Render Dashboard → Deploys để khôi phục deployment trước.

Tham khảo hướng dẫn chính thức: [Vercel CLI deploy](https://vercel.com/docs/cli/deploying-from-cli), [Vercel rollback](https://vercel.com/docs/cli/rollback), [Render deploys](https://render.com/docs/deploys), [Render deploy API](https://api-docs.render.com/reference/create-deploy), [Render rollback API](https://api-docs.render.com/reference/rollback-deploy).

## Rollback và database

- Automated rollback dùng Render API với ID của deployment live trước release; Vercel CLI rollback đưa production traffic về deployment trước từ repository root. Nếu provider trả lỗi, workflow giữ trạng thái thất bại, in mã HTTP/chi tiết lỗi và cần xử lý thủ công trong dashboard. Không retry mù một POST rollback sau HTTP 500 vì provider có thể đã nhận request dù trả lỗi.
- Vercel Hobby chỉ cho rollback tới production deployment liền trước; khả năng rollback sâu hơn phụ thuộc plan Vercel.
- Có thể rollback web thủ công từ Vercel CLI/dashboard và API từ Render Dashboard → Deploys. Không restart/rollback database bằng cách thay URL tùy tiện.
- Rollback code **không** đảo schema hoặc dữ liệu. Ưu tiên migration backward-compatible; xem backup/restore theo plan của Render trước thao tác dữ liệu. Không tự động chạy `migration:revert` trên production.

## Kiểm tra production đã thực hiện

Ngày 2026-11-15:

- Production `GET /health` returned HTTP 200 with `database: connected`; `GET /products` returned HTTP 200 with 9 products.
- Both Vercel domains returned HTTP 200 for `/`, `/manifest.webmanifest`, `/icon-192.svg` and `/icon-512.svg`. Browser smoke on the alias displayed all 9 product cards.
- CORS preflight to `POST /orders` returned HTTP 204 and the exact `Access-Control-Allow-Origin` for both Vercel domains, with authorization/content-type/idempotency-key allowed.
- The production `NEXT_PUBLIC_API_URL` configuration and fallback are live; PR #8 is merged. Production checkout was not exercised to avoid creating test orders in the live database.
- GitHub Actions CI run #9 on `main` passed. CD run #4 attempt 4 accepted the correct Vercel project ID, deployed Render and passed API smoke, but Vercel failed because the CLI working directory duplicated the configured `apps/web` root. Render rollback returned HTTP 500, so rollback is not confirmed. The root-directory workflow fix is pending a new CI/CD run.

Render's production migration history, managed-database backup/restore and real rollback behavior remain unverified. Do not treat successful public health/catalog smoke tests as proof of end-to-end production checkout.
