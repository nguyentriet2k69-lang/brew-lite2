# Thiết kế triển khai BrewLite

Trạng thái: Bản nháp Task 3.2 của TV3; cần phối hợp TV6. Tài liệu mô tả mục tiêu và thông tin cần bàn giao, chưa phải runbook đã chạy thành công. Repo hiện chưa có code, Compose, Dockerfile, workflow hoặc URL production.

## 1. Ranh giới môi trường

| Môi trường | Thành phần dự kiến | Dữ liệu và quyền truy cập |
|---|---|---|
| Local | Next.js, NestJS, PostgreSQL qua Compose | DB phát triển riêng; nếu publish cổng DB thì bind loopback |
| CI | Runner build/lint/test; DB test tạm cho integration | Dữ liệu test tách production; secrets tối thiểu |
| Production | Web, API, DB và storage trên platform chờ chọn | HTTPS public cho web/API; DB qua mạng riêng |

Các cổng local trong README là kế hoạch, cần TV6 xác nhận khi tạo Compose. Không áp dụng nguyên cổng hoặc hostname từ repo AS1.

## 2. Kết nối và bảo mật đề xuất

Trình duyệt truy cập web/API qua HTTPS. Điểm kết thúc TLS, CDN/reverse proxy và DNS sẽ được chỉ rõ sau khi chọn platform. API kết nối PostgreSQL qua mạng riêng; web không truy cập DB. Volume hoặc managed storage giữ dữ liệu qua lần triển khai lại.

Frontend cần URL API public đúng thời điểm build/runtime theo cách TV4 triển khai. Backend giữ DATABASE_URL và JWT_SECRET trong secret store của platform. Chỉ commit ví dụ tên biến; không log token, mật khẩu, chuỗi kết nối hoặc dữ liệu thẻ. Nếu dùng SSR gọi API nội bộ, TV4/TV6 phải thống nhất URL nội bộ và public riêng.

## 3. Luồng CI/CD mục tiêu để TV6 hiện thực

1. PR chạy Install → Lint → Unit Test → Build; integration dùng DB test riêng. Branch protection chặn merge khi check bắt buộc fail.
2. Release chạy các kiểm tra bắt buộc, build image gắn commit/tag bất biến, push registry đã chọn.
3. Migration production chạy có kiểm soát trước chuyển traffic; dừng release nếu thất bại. Kiểm tra tương thích phiên bản app cũ/mới và có backup trước thay đổi rủi ro.
4. Deploy web/API, kiểm tra health và smoke menu; kiểm tra luồng checkout bằng môi trường/tài khoản thử phù hợp.
5. Ghi image digest, release, kết quả smoke và liên kết log để truy vết.

Đây là contract bàn giao kiến trúc. Workflow và cấu hình triển khai thuộc TV6; chưa có pipeline để báo Pass.

## 4. Health, log, backup và rollback

`GET /health` dự kiến kiểm tra API và khả năng truy cập DB; endpoint không tiết lộ secret. TV6 chốt lịch probe, thời gian chờ, log tập trung và cách truy log theo request/release.

Backup DB cần lịch, thời gian giữ, nơi lưu và bằng chứng restore thử. Rollback app ưu tiên image ổn định đã ghi nhận. Rollback app không tự đảo migration; migration không tương thích cần kế hoạch phục hồi hoặc sửa tiến, không mặc định chạy lệnh migration revert khi chưa có cơ chế được kiểm chứng. Seed production không được tự xóa dữ liệu nghiệp vụ hay reset mật khẩu mỗi lần app khởi động.

## 5. Thông tin chờ TV6 xác nhận

| Thông tin | Trạng thái |
|---|---|
| Platform và region cho web/API/DB | Chưa chốt |
| Domain web, API và TLS/CDN/reverse proxy | Chưa chốt |
| Registry, image naming/tag/digest | Chưa chốt |
| Mạng riêng DB, persistent storage, backup/restore | Chưa chốt |
| Secret store và quyền CI deploy | Chưa chốt |
| Migration job, health, logs, smoke và rollback | Chưa chốt |

## 6. Deployment diagram và điều kiện bàn giao

Đã có sơ đồ nháp: [PlantUML source](diagrams/deployment.puml) và [SVG](diagrams/deployment.svg), mô tả local/CI/prod, thiết bị người dùng, ingress/TLS/CDN, NestJS container, PostgreSQL/storage, registry, secrets, health và logs. Toàn bộ kết nối thể hiện thiết kế đề xuất; platform/region/domain và chính sách vận hành chưa chốt. Sơ đồ chưa chứng minh hệ thống đã được triển khai.

Task 3.2 chưa hoàn thành nghiệm thu tới khi lựa chọn platform được xác nhận, sơ đồ có source/bản xuất và được TV6 review. Sau khi có code, cập nhật liên kết container → Dockerfile → module và lệnh chạy theo script thực tế.

Tham chiếu: [overview](architecture/overview.md), [ADR-005](architecture/adr/005-deployment-platform.md), [SRS](requirements/srs.md).
