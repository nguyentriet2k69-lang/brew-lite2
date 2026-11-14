# Triển khai BrewLite trên server Ubuntu

BrewLite chọn Ubuntu 24.04 LTS + Docker Compose v2 theo ADR-005. Bộ Compose, Caddy, workflow CD và script rollback đã được bổ sung. Chưa có server, DNS hay credentials trong môi trường làm việc này nên chưa thể tuyên bố đã deploy production; hãy hoàn tất các bước cấu hình bên dưới trước khi nghiệm thu.

## 1. Môi trường và ánh xạ thành phần

| Môi trường | Thiết kế |
|---|---|
| Local | Docker Compose: web localhost:3000, API localhost:3001; DB bind `127.0.0.1:5432` |
| CI | GitHub Actions; PostgreSQL test riêng cho integration/E2E |
| Server | Ubuntu 24.04 LTS, Docker Engine, Compose v2; Caddy cấp HTTPS cho web/API, DB nội bộ |

| Service | Code/image dự kiến | Kết nối |
|---|---|---|
| proxy | Caddy 2, `Caddyfile` | Public TCP 80/443; tự cấp TLS và route theo hostname |
| web | `ghcr.io/nguyentriet2k69-lang/brew-lite2-web:<sha>` | Network edge, cổng nội bộ 3000 |
| api | `ghcr.io/nguyentriet2k69-lang/brew-lite2-api:<sha>` | Network edge/data, cổng nội bộ 3001 |
| db | PostgreSQL 16, volume `postgres_data` | Network data, cổng 5432, không publish |
| migrate/seed | Cùng image API của release, chạy one-off | Network data; migration mỗi release, demo seed chỉ lần khởi tạo |

Server có thể là máy trường cấp, máy nhóm hoặc VPS. Tài nguyên và IP được ghi nhận khi cấp server. Các đường dẫn trong bảng là cấu trúc mã nguồn dự kiến.

## 2. Network và HTTPS

Network `edge` gồm proxy/web/api; `data` có `internal: true`, gồm api/db/migrate/seed. Chỉ proxy publish 80/443. API gọi DB bằng hostname `db:5432`; web và browser không có quyền truy cập DB. SSH chỉ cho nguồn quản trị/deploy được phép; kiểm tra cả firewall host và published ports Docker.

Hai hostname `WEB_DOMAIN`, `API_DOMAIN` có DNS trỏ về server. Caddy route HTTPS tới `web:3000` và `api:3001`, redirect HTTP sang HTTPS. Trước khi cấp certificate cần kiểm tra DNS và cổng 80/443, sau đó thử truy cập HTTPS từ bên ngoài.

Browser gọi `https://API_DOMAIN`. Nếu có SSR, web có thể gọi `http://api:3001` nội bộ. `NEXT_PUBLIC_API_URL` cần truyền ở bước build khi Next.js dùng biến public build-time; thay domain cần build lại. API bind 0.0.0.0 và CORS cho đúng `https://WEB_DOMAIN`.

## 3. Chuẩn bị server và secrets

- Tạo Ubuntu 24.04 server, tài khoản deploy hạn chế quyền, Docker Engine + Compose v2 và `curl`; firewall chỉ mở SSH đã giới hạn nguồn, TCP 80/443. Trỏ hai bản ghi DNS `WEB_DOMAIN`, `API_DOMAIN` về IP server.
- Tạo `/opt/brewlite`, cấp owner cho tài khoản deploy. Sao chép [`production.env.example`](./production.env.example) thành `/opt/brewlite/.env`, thay mọi placeholder bằng giá trị sinh mới và chạy `chmod 600 /opt/brewlite/.env`. Mật khẩu DB phải URL-encode trong `DATABASE_URL`; nên dùng chuỗi URL-safe. `JWT_SECRET` có tối thiểu 32 bytes.
- Runtime secrets (`DATABASE_URL`, `JWT_SECRET`, DB password) chỉ ở `.env` trên server, không commit/đưa vào chat/log. Không dùng placeholder mẫu trong production. `CORS_ORIGIN` phải là origin HTTPS chính xác của web.
- Tạo GitHub repository variables `WEB_DOMAIN`, `API_DOMAIN` (chỉ hostname, không scheme; phải khớp giá trị trong server `.env`). Tạo GitHub Environment `production`, sau đó cấu hình secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (private key), `DEPLOY_KNOWN_HOSTS` (host-key line đã kiểm tra fingerprint ngoài băng), `DEPLOY_PATH` (ví dụ `/opt/brewlite`), `GHCR_READ_USERNAME`, `GHCR_READ_TOKEN` (PAT chỉ có quyền `read:packages`).
- Package publish dùng `GITHUB_TOKEN` với `packages: write`; server dùng PAT chỉ đọc package. Bật required reviewers cho Environment nếu cần phê duyệt deploy. Workflow không dùng `ssh-keyscan` mù quáng; host key phải được kiểm tra độc lập.
- Volume `postgres_data` giữ DB; `caddy_data`/`caddy_config` giữ TLS state. Deploy/rollback không xóa volume.

## 4. Quy trình CI/CD

1. CI (`.github/workflows/ci.yml`) chạy Install → Lint → Unit + PostgreSQL integration/E2E → Build. Bật branch protection cho `main`, yêu cầu checks `API` và `Web`; YAML không tự thay đổi GitHub Settings.
2. CD (`.github/workflows/cd.yml`) chạy cùng verification khi push `main` hoặc tag `v*`; nếu verify fail thì không build/push image hoặc deploy.
3. API/web image được push GHCR theo commit SHA bất biến; tag release có thêm semantic-version tag. URL API public của Web được bake lúc build. Deploy được serialize và SSH chỉ tin host key đã cấu hình.
4. `deploy-production.sh` khởi động PostgreSQL, đợi healthy và lưu `pg_dump` quyền hạn chế trước migration; sau đó chạy migration từ image API mới. Migration/seed lỗi sẽ dừng trước rollout app. Demo seed idempotent và chỉ chạy một lần, ghi nhận bằng `.seed-complete`.
5. Compose đợi API/web healthy, Caddy phục vụ hai hostname HTTPS. Script server và GitHub runner đều smoke-test trang web, `/health`, `/products`.
6. Nếu rollout hoặc server-side smoke lỗi, script khôi phục application SHA trước đó. Nếu public smoke lỗi, workflow gọi `rollback-production.sh` và vẫn giữ trạng thái thất bại. `.release-sha` và `.previous-release-sha` lưu cặp phiên bản.

## 5. Migration, health và khôi phục

Migration có version, ưu tiên tương thích ngược để app cũ vẫn chạy khi đổi schema. Không dùng reset/schema push thay lịch sử. Seed chỉ chạy có kiểm soát lúc khởi tạo dữ liệu mẫu, không tự xóa dữ liệu hoặc reset mật khẩu mỗi lần app restart. Trước mỗi migration, script lưu dump custom-format vào `/opt/brewlite/backups/`; giới hạn quyền thư mục là `0700`. Sao chép backup mã hóa ra khỏi server theo chính sách lưu giữ và kiểm tra restore trên DB cô lập.

API /health kiểm tra DB: 200 khi sẵn sàng, 503 khi lỗi, không lộ cấu hình. DB dùng `pg_isready` (5s interval, 12 retries); API probe mỗi 10s (start period 30s), Web mỗi 15s (start period 30s). Script đợi DB tối đa 120s và app tối đa 180s. Caddy được xác minh bằng HTTPS smoke test. Restart policy không tự restart chỉ vì unhealthy; pipeline cần xử lý rollout fail.

Log stdout/stderr, không chứa secret. Cấu hình log rotation trên Docker host để giới hạn dung lượng và tra cứu log theo service. Đảm bảo host backup filesystem đã mã hóa hoặc mã hóa dump trước khi chuyển ra ngoài server.

Rollback tự động chỉ khôi phục **application images**, không đảo schema và không xóa volume. Thao tác thủ công: chạy `bash ./rollback-production.sh` trong `/opt/brewlite`; script chọn SHA thành công trước đó, chạy migration tương thích (nếu có) rồi smoke-test. Không chạy `migration:revert` tự động, vì có thể xóa/đổi dữ liệu người dùng. Khi cần khôi phục schema, phải có kế hoạch tương thích hoặc quyết định restore backup được duyệt; restore có thể làm mất dữ liệu phát sinh sau dump.

Chỉ migration backward-compatible mới được deploy tự động. Nếu schema mới không tương thích app cũ, dừng rollout và khôi phục tiến/restore DB theo quy trình được duyệt; không giả định rollback image đồng nghĩa rollback dữ liệu.

## 6. Các mục cần kiểm tra khi triển khai

| Thành phần thiết kế | Nội dung kiểm tra |
|---|---|
| Ubuntu + Docker Compose, topology trên | Đã có cấu hình; cần IP/server thực và chạy compose trên host |
| Caddy HTTPS, DB nội bộ | Đã cấu hình; DNS/TLS/firewall và xác minh từ Internet còn chờ |
| GHCR → SSH deploy → smoke | Workflow/script đã tạo; cần GitHub secrets/variables và một lần chạy thành công |
| Backup/rollback | Script tạo dump trước migration và khôi phục SHA; cần kiểm tra thực tế trên host |

[Source PlantUML](diagrams/deployment.puml), [SVG](diagrams/deployment.svg), [overview](architecture/overview.md), [ADR-005](architecture/adr/005-deployment-platform.md) mô tả cùng kiến trúc. Kết quả triển khai được ghi nhận bằng URL truy cập, log pipeline và kết quả kiểm thử.
