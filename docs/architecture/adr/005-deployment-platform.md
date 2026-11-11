# ADR 005 Triển khai trên server Ubuntu

Trạng thái: Chọn server Ubuntu theo yêu cầu của giảng viên.

## Bối cảnh

BrewLite phải triển khai trên server Ubuntu, cung cấp web/API qua HTTPS và giữ database không public. Server có thể do trường cấp, nhóm có sẵn hoặc thuê VPS; thiết kế không bắt buộc mua VPS.

## Quyết định

- Server Ubuntu 24.04 LTS chạy Docker Engine và Docker Compose v2.
- Bốn service: Caddy 2 (`proxy`), Next.js (`web:3000`), NestJS/payment mock (`api:3001`), PostgreSQL 16 (`db:5432`).
- Caddy publish TCP 80/443, quản lý TLS và route hai hostname web/API. Hostname cần có DNS trỏ về server và truy cập được từ môi trường nghiệm thu.
- Network `edge` có proxy/web/api; `data` đặt `internal: true` có api/db và migration job. Không publish cổng web/API/DB ở production.
- PostgreSQL dùng volume `postgres_data`; Caddy dùng `caddy_data` và `caddy_config`. Secrets nằm ngoài Git trên server.
- GitHub Actions chạy kiểm tra, build image và push GHCR với SHA tag/digest; deploy tới Ubuntu qua SSH bằng tài khoản được giới hạn. Giữ image release cũ để rollback.
- Migration one-off bằng image API mới, phải thành công trước khi cập nhật app. Health/smoke kiểm tra sau deploy; lỗi thì dừng và phục hồi release tương thích.

## Bàn giao và kiểm chứng

Khi triển khai cần bổ sung IP/hostname, Compose/Dockerfile, CI/CD và script migration/seed theo thiết kế này. Kiểm tra HTTPS, healthcheck và rollback để xác nhận hệ thống hoạt động.

Giải pháp Compose đơn giản, phù hợp đồ án; một server có thể gián đoạn khi lỗi hoặc deploy. Nhóm chịu trách nhiệm giữ dữ liệu và kiểm tra khôi phục, không cam kết HA.

Tham chiếu: [deployment](../../deployment.md), [SRS](../../requirements/srs.md).
