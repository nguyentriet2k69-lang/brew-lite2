# Thiết kế triển khai BrewLite trên server Ubuntu

BrewLite được thiết kế để triển khai trên server Ubuntu theo yêu cầu của giảng viên. Tài liệu mô tả các thành phần, kết nối và quy trình triển khai; IP, hostname và lệnh chạy cụ thể được bổ sung khi cấu hình server.

## 1. Môi trường và ánh xạ thành phần

| Môi trường | Thiết kế |
|---|---|
| Local | Docker Compose: web localhost:3000, API localhost:3001; DB nếu cần publish chỉ 127.0.0.1:5433 |
| CI | GitHub Actions; PostgreSQL test riêng cho integration/E2E |
| Server | Ubuntu 24.04 LTS, Docker Engine, Compose v2; web/API có HTTPS, DB nội bộ |

| Service | Code/image dự kiến | Kết nối |
|---|---|---|
| proxy | Caddy 2 | Public TCP 80/443; route tới web/api |
| web | apps/web, image GHCR brew-lite2-web | Network edge, cổng nội bộ 3000 |
| api | apps/api, image GHCR brew-lite2-api | Network edge/data, cổng nội bộ 3001 |
| db | PostgreSQL 16 | Network data, cổng 5432, không publish |
| migrate | Cùng image API của release, chạy one-off | Network data, migration rồi thoát |

Server có thể là máy trường cấp, máy nhóm hoặc VPS. Tài nguyên và IP được ghi nhận khi cấp server. Các đường dẫn trong bảng là cấu trúc mã nguồn dự kiến.

## 2. Network và HTTPS

Network `edge` gồm proxy/web/api; `data` có `internal: true`, gồm api/db/migrate. Chỉ proxy publish 80/443. API gọi DB bằng hostname `db:5432`; web và browser không có quyền truy cập DB. SSH chỉ cho nguồn quản trị/deploy được phép; kiểm tra cả firewall host và published ports Docker.

Hai hostname `WEB_DOMAIN`, `API_DOMAIN` có DNS trỏ về server. Caddy route HTTPS tới `web:3000` và `api:3001`, redirect HTTP sang HTTPS. Trước khi cấp certificate cần kiểm tra DNS và cổng 80/443, sau đó thử truy cập HTTPS từ bên ngoài.

Browser gọi `https://API_DOMAIN`. Nếu có SSR, web có thể gọi `http://api:3001` nội bộ. `NEXT_PUBLIC_API_URL` cần truyền ở bước build khi Next.js dùng biến public build-time; thay domain cần build lại. API bind 0.0.0.0 và CORS cho đúng `https://WEB_DOMAIN`.

## 3. Secrets và dữ liệu

- Runtime secrets (DATABASE_URL, JWT_SECRET, DB password) lưu ngoài Git, ví dụ `/opt/brewlite/secrets/`; thư mục 0700, file 0600, owner phù hợp tài khoản deploy. Dùng env-file hoặc mount tương thích với ứng dụng.
- SSH deploy key và host fingerprint đã kiểm tra nằm trong GitHub Environment secrets. Credential pull GHCR private có quyền đọc package; job publish có quyền ghi package.
- Volume `postgres_data` giữ DB; `caddy_data`/`caddy_config` giữ TLS state. Deploy/rollback không xóa volume.
- Chỉ commit ví dụ tên biến, không in token/password/DB URL ra log. Secret development không dùng làm secret server.

## 4. Quy trình CI/CD

1. PR chạy Install → Lint → Unit Test → Build; integration/E2E dùng DB test riêng. Cấu hình required checks để chặn merge khi kiểm tra thất bại.
2. Push main hoặc tag release được phép: kiểm tra, build hai image phù hợp CPU server, push `ghcr.io/nguyentriet2k69-lang/brew-lite2-web:<sha>` và `brew-lite2-api:<sha>`. Lưu cặp digest cùng release manifest.
3. Serialize deploy. SSH tới Ubuntu với fingerprint đã kiểm tra, pull image theo digest và giữ manifest release ổn định trước đó.
4. Lần đầu khởi động DB và đợi healthy. Trước migration rủi ro, tạo bản dump. Chạy migrate one-off từ image API mới với DB nội bộ; lỗi thì dừng release.
5. Cập nhật API/web bằng Compose, đợi healthy rồi smoke HTTPS: trang web, /health và GET /products. Checkout mock được kiểm tra theo test plan với dữ liệu demo.
6. Nếu deploy/smoke fail: đánh dấu pipeline fail, rollback cặp image ổn định khi schema tương thích, kiểm tra lại health/smoke. Lưu SHA/digest, kết quả và log đã loại secrets.

Compose và workflow cần dùng đúng các script migration, build và start của ứng dụng.

## 5. Migration, health và khôi phục

Migration có version, ưu tiên tương thích ngược để app cũ vẫn chạy khi đổi schema. Không dùng reset/schema push thay lịch sử. Seed chỉ chạy có kiểm soát lúc khởi tạo dữ liệu mẫu, không tự xóa dữ liệu hoặc reset mật khẩu mỗi lần app restart.

API /health kiểm tra DB: 200 khi sẵn sàng, 503 khi lỗi, không lộ cấu hình. DB dùng pg_isready; web có HTTP probe. Mốc cấu hình ban đầu: probe 30s, timeout 5s, retry 3; điều chỉnh start period theo thời gian khởi động của ứng dụng. Restart policy không tự restart chỉ vì unhealthy; pipeline cần xử lý rollout fail.

Log stdout/stderr, có timestamp/requestId/status, không chứa secret. Dùng log rotation để giới hạn dung lượng và tra cứu log theo service.

Dump DB trước migration rủi ro và trước bàn giao, lưu bản sao an toàn ngoài server, kiểm tra restore trên DB cô lập. Seed chỉ tái tạo dữ liệu mẫu, không thay thế backup dữ liệu phát sinh.

Rollback app dùng cặp image/digest cũ, không tự đảo schema. Nếu migration không tương thích, chặn ghi và chọn sửa tiến hoặc restore backup theo quy trình vận hành được duyệt; ghi nhận dữ liệu có thể mất sau thời điểm dump.

## 6. Các mục cần kiểm tra khi triển khai

| Thành phần thiết kế | Nội dung kiểm tra |
|---|---|
| Server Ubuntu + Compose, topology trên | Server/IP/hostname và cấu hình thật |
| Caddy HTTPS, DB nội bộ | DNS/TLS, network/firewall và minh chứng |
| GHCR → SSH deploy → smoke | Workflow, Dockerfile/Compose và logs |
| Secrets/volume/migration/rollback | Cấu hình runtime, dump/restore và kiểm tra rollback |

[Source PlantUML](diagrams/deployment.puml), [SVG](diagrams/deployment.svg), [overview](architecture/overview.md), [ADR-005](architecture/adr/005-deployment-platform.md) mô tả cùng kiến trúc. Kết quả triển khai được ghi nhận bằng URL truy cập, log pipeline và kết quả kiểm thử.
