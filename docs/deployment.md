# Triển khai BrewLite trên Vercel và Render

## Kiến trúc triển khai

| Môi trường | Thành phần |
|---|---|
| Local/testing | Docker Compose: Next.js web, NestJS API, PostgreSQL; integration tests dùng PostgreSQL cô lập |
| Production web | Vercel project chạy Next.js từ `apps/web` |
| Production API | Render Web Service chạy NestJS từ `apps/api` |
| Production database | Render PostgreSQL managed service; API kết nối bằng internal database URL |
| CI/CD | GitHub Actions chạy test/build; Render API triển khai backend, Vercel CLI triển khai frontend |

Production URLs do nhóm cung cấp:

- Web: <https://brew-lite2-17cf.vercel.app/>
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
- Start Command: `npm run start:prod:migrate` when the service plan does not support a Pre-Deploy Command.
- Health Check Path: `/health`
- Pre-Deploy Command: the current Render plan does not support this setting. The Start Command above applies pending migrations before starting NestJS. On a plan that supports Pre-Deploy Command, set it to `npm run migration:run:prod` and use `npm run start:prod` as the Start Command instead.
- Environment:
  - `DATABASE_URL`: internal URL của Render PostgreSQL.
  - `JWT_SECRET`: giá trị sinh riêng, tối thiểu 32 bytes.
  - `JWT_EXPIRES_IN`: ví dụ `1d`.
  - `CORS_ORIGIN`: chính xác `https://brew-lite2-17cf.vercel.app`.
  - `MOCK_PAYMENT_RESULT=success`, `MOCK_PAYMENT_TIMEOUT=false` cho demo happy path.
  - `NODE_ENV=production` nếu service chưa tự đặt.
- Tắt Render auto-deploy theo commit. Workflow gửi đúng commit SHA qua Render API; bật auto-deploy đồng thời có thể gây deploy trùng hoặc đưa code mới trở lại sau rollback.

### Vercel Web Project

- Root Directory: `apps/web`; framework: Next.js.
- Production environment variable `NEXT_PUBLIC_API_URL=https://brew-lite2-backend.onrender.com`. Biến này được dùng trong bundle public, không đặt credential nào trong đó.
- Production domain phải trỏ đúng về project đang triển khai. Production deploy phải do CD workflow điều phối, không để Git integration tạo production deploy trùng; preview deployments có thể tiếp tục dùng theo chính sách nhóm.
- Xác minh `/manifest.webmanifest` trên production sau khi deploy. URL hiện tại trả 404 trong lần kiểm tra cuối.

### GitHub Actions Environment `production`

Tạo Environment `production`; bật required reviewers nếu phù hợp. Thêm các **Variables**:

| Variable | Giá trị |
|---|---|
| `API_URL` | `https://brew-lite2-backend.onrender.com` |
| `WEB_URL` | `https://brew-lite2-17cf.vercel.app` |
| `RENDER_SERVICE_ID` | ID của Render API Web Service, dạng `srv-...` |
| `VERCEL_ORG_ID` | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID cho web |

Thêm các **Secrets**:

| Secret | Quyền dùng |
|---|---|
| `RENDER_API_KEY` | Đọc deployment hiện tại, deploy commit, và rollback Render service |
| `VERCEL_TOKEN` | Deploy/rollback đúng Vercel project/team |

Không gửi secrets qua chat, không in ra workflow logs và không commit `.env` thật. Các lệnh workflow fail rõ ràng khi thiếu biến/secrets.

## Quy trình CI/CD

`.github/workflows/cd.yml` chạy verify trước khi deploy:

1. Install, lint, unit test, PostgreSQL integration/E2E và build API/Web trên GitHub Actions.
2. Chỉ khi verify pass, workflow lưu Render deployment đang live để có thể rollback.
3. Dùng Render API tạo deployment cho đúng `GITHUB_SHA`; poll trạng thái tới `live` hoặc trạng thái lỗi. Render API health và `/products` được smoke-test.
4. Dùng Vercel CLI deploy production từ `apps/web`, sau đó smoke-test trang web, manifest, API health, products và CORS preflight.
5. Nếu lỗi sau khi Render đã nhận deploy, workflow khôi phục Vercel deployment (nếu đã deploy) và Render deployment trước đó. Cơ sở dữ liệu/migration không tự rollback; migration phải backward-compatible.

Workflow chạy khi push `main`, tag `v*`, hoặc dispatch thủ công từ `main`/tag `v*`. Deploy bị serialize để tránh hai release production chạy đồng thời. GitHub Environment, provider IDs/tokens, Render service configuration và domain settings chưa được kiểm chứng từ repository; cần cấu hình an toàn trước lần chạy đầu.

Tham khảo hướng dẫn chính thức: [Vercel CLI deploy](https://vercel.com/docs/cli/deploying-from-cli), [Vercel rollback](https://vercel.com/docs/cli/rollback), [Render deploys](https://render.com/docs/deploys), [Render deploy API](https://api-docs.render.com/reference/create-deploy), [Render rollback API](https://api-docs.render.com/reference/rollback-deploy).

## Rollback và database

- Automated rollback dùng Render API với ID của deployment live trước release; Vercel CLI rollback đưa production traffic về deployment trước. Nếu rollback lỗi, workflow giữ trạng thái thất bại để cần xử lý thủ công.
- Vercel Hobby chỉ cho rollback tới production deployment liền trước; khả năng rollback sâu hơn phụ thuộc plan Vercel.
- Có thể rollback web thủ công từ Vercel CLI/dashboard và API từ Render Dashboard → Deploys. Không restart/rollback database bằng cách thay URL tùy tiện.
- Rollback code **không** đảo schema hoặc dữ liệu. Ưu tiên migration backward-compatible; xem backup/restore theo plan của Render trước thao tác dữ liệu. Không tự động chạy `migration:revert` trên production.

## Kiểm tra production đã thực hiện

Ngày 2026-11-15:

- Render auto-deployed merge commit `a4d08ae`; `/health` trả HTTP 200 nhưng `/products` trả HTTP 500. Render logs report `relation "inventory_reservations" does not exist`, indicating the pending PostgreSQL migrations were not applied on this service.
- Vercel URL `https://brew-lite2-17cf.vercel.app` returned HTTP 200 for `/`, `/manifest.webmanifest`, and `/icon-192.svg` during this check.
- GitHub Actions CI on `main` passed. CD verification failed at API unit tests because its workflow still used Node 22; the deploy job was skipped. The workflow is being updated to Node 24 before another production release.

Do not consider the production release complete until the Render migration/start command is corrected, `/products` returns HTTP 200, and the CD workflow plus API health, web manifest, CORS, and checkout smoke tests pass.
