# ADR 005 Triển khai đồ án trên Render

Trạng thái: Thiết kế TV3 để review và bàn giao Task 4–5. Chọn Render; chưa cấp dịch vụ hay chọn gói trả phí.

## Bối cảnh và lựa chọn

Đồ án yêu cầu Next.js, NestJS, PostgreSQL, Docker local, CI/CD qua image/registry và URL HTTPS. TV3 thiết kế trước, TV6 hiện thực sau.

| Phương án | Lợi ích | Đánh đổi |
|---|---|---|
| Render web/API/Postgres | Cùng dashboard, TLS được quản lý, API–DB có đường nội bộ | Free có cold start, quota và DB hết hạn; tính năng phụ thuộc gói |
| Railway web/API/Postgres | Tập trung dịch vụ, cấu hình thuận tiện | Chi phí theo sử dụng; trial không bảo đảm kéo dài tới nghiệm thu |
| VPS + Compose | Kiểm soát toàn bộ runtime/mạng | Nhóm tự quản hệ điều hành, reverse proxy, TLS, storage và backup |

Chọn Render để giảm việc quản trị máy chủ cho đồ án. Không yêu cầu VPS Ubuntu, Caddy, SSH deploy hay mua domain riêng. Docker Compose dùng để tái tạo môi trường local; production không chạy nguyên Compose mà tách thành các dịch vụ Render.

## Quyết định thiết kế

- Một Render Web Service cho Next.js và một Render Web Service cho NestJS/payment mock, nguồn là Docker image từ GHCR.
- Một Render Postgres cùng workspace/region với API; API dùng internal database URL. Tắt hoàn toàn external access bằng IP allow list rỗng. Chỉ có mật khẩu là chưa đủ để coi DB không public.
- Dùng URL HTTPS `onrender.com` do Render cấp cho web/API, TLS do nền tảng quản lý; không cần thêm Caddy/CDN riêng.
- Image GHCR `brew-lite2-web` và `brew-lite2-api`, tag theo commit SHA, lưu digest cặp image. Build `linux/amd64`; giữ image cũ để rollback.
- GitHub Actions thực hiện kiểm tra và push GHCR, sau đó trigger deploy hook với `imgURL` trỏ đúng tag/digest đã kiểm tra. Đợi trạng thái deploy hoàn tất rồi smoke; HTTP 200 từ deploy hook chỉ có nghĩa đã khởi động deploy.
- Secrets app lưu trong Render environment; hook/API token ở GitHub Environment secrets; quyền publish GHCR và quyền pull image riêng theo nhu cầu. Không commit credential.
- API bind `0.0.0.0` và dùng `PORT` do Render cấp. Browser gọi API public qua HTTPS; CORS chỉ cho web URL.
- Migration chạy trong Render bằng kết nối DB nội bộ, không mở DB cho GitHub runner. Gói có pre-deploy command dùng migration trước deploy; Free dùng startup migration có chặn lỗi, một instance và release tuần tự. Chi tiết và giới hạn tại deployment.md.

## Giới hạn gói và điều kiện nghiệm thu

Theo tài liệu Render được kiểm tra ngày 06/11/2026:
- Free web ngủ sau 15 phút không có traffic, khởi động lại có thể khoảng một phút; không coi lần cold start là bằng chứng đạt NFR hiệu năng.
- Workspace có 750 free instance hours/tháng dùng chung; hai web service có thể vượt nếu đều chạy liên tục.
- Free Postgres hết hạn sau 30 ngày và không có managed backup. Free web không có one-off jobs hoặc shell.
- Chưa chọn Free hay paid khi chưa biết ngày chấm/ngân sách. TV6 kiểm tra quota và thời hạn DB trước cấp phát, chọn phương án phù hợp; không mặc định Free đáp ứng uptime/performance tới ngày nghiệm thu.
- Export DB mẫu trước bàn giao bằng tác vụ trong Render dùng internal URL, lưu an toàn để phục hồi; không tuyên bố có PITR ở Free. Có migration/seed để tái tạo dữ liệu mẫu, nhưng seed không thay thế backup dữ liệu phát sinh.

Các URL/service ID/region và plan được TV6 ghi khi triển khai. Task 3 bàn giao topology và contract, không cần chờ URL live. Nếu plan không đáp ứng cần thiết, review lại trước cấp dịch vụ.

## Nguồn

- [Render image deployment](https://render.com/docs/deploying-an-image)
- [Deploy hooks và imgURL](https://render.com/docs/deploy-hooks)
- [Postgres internal URL và external access](https://render.com/docs/postgresql-creating-connecting)
- [Free limitations](https://render.com/docs/free)

Tham chiếu: [deployment](../../deployment.md), [SRS](../../requirements/srs.md).
