# ADR 005 Nền tảng triển khai

Trạng thái: Chờ quyết định cùng TV6. Chưa chọn nhà cung cấp, domain hoặc registry.

## Bối cảnh

NFR-04–06 yêu cầu Compose, CI/CD, HTTPS, health, log và DB tái tạo được. README còn placeholder platform/URL. Repo chưa có Dockerfile hoặc workflow để xác nhận triển khai thực tế.

## Phương án cần đánh giá

| Phương án | Lợi ích | Đánh đổi cần TV6 xác minh |
|---|---|---|
| Web/API container và PostgreSQL managed trên PaaS | Giảm công vận hành host/TLS/DB | Chi phí, hỗ trợ mạng riêng, migration job, quota và backup |
| VPS chạy container và reverse proxy | Kiểm soát mạng, runtime và cách deploy | Nhóm tự quản TLS, cập nhật, backup, tài nguyên và rollback |

Ưu tiên đánh giá PaaS có DB managed để giảm vận hành nếu phù hợp ngân sách. Đây là đề xuất TV3; chưa có nghiên cứu giá, quota hay xác nhận nhà cung cấp.

## Điều kiện chốt

TV3 và TV6 ghi tên platform, region, domain/HTTPS, registry/image tag, mạng riêng DB/storage, quản lý secrets, health/log, backup/restore, migration và rollback. Ghi ngày, người review và bằng chứng cấu hình sau khi thống nhất.

## Hệ quả

Deployment production và sơ đồ chỉ được nghiệm thu khi phản ánh lựa chọn thật. Local/CI/prod có cấu hình riêng; không đưa secret local hoặc cổng DB public thành cấu hình production.

Tham chiếu: [deployment](../../deployment.md), [SRS](../../requirements/srs.md).
