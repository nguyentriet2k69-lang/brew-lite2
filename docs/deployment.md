# Thiết kế triển khai BrewLite trên Render

Task 3.2 — TV3. Kiến trúc mục tiêu để TV6 hiện thực Task 4–5 theo [ADR-005](architecture/adr/005-deployment-platform.md). Đây là tài liệu thiết kế, chưa phải minh chứng hệ thống đã chạy.

## 1. Môi trường và thành phần

| Môi trường | Thành phần và mục đích |
|---|---|
| Local | Docker Compose web/api/db; web localhost:3000, API localhost:3001; DB nếu publish chỉ 127.0.0.1:5433 |
| CI | GitHub Actions chạy lint/unit/build và DB test riêng cho integration/E2E; không dùng DB production |
| Demo/production đồ án | Hai Render Web Services image-backed (Next.js, NestJS) và Render Postgres; TLS do Render quản lý |

| Workload | Nguồn code dự kiến | Vị trí chạy |
|---|---|---|
| Web | apps/web và Dockerfile Next.js | Render Web Service, URL HTTPS riêng |
| API/payment mock | apps/api và Dockerfile NestJS | Render Web Service, URL HTTPS riêng |
| Database | Schema/migrations/seed từ apps/api | Render Postgres cùng workspace/region API |
| CI/CD | Workflow do TV6 tạo | GitHub Actions → GHCR → Render deploy hooks |

Không yêu cầu VPS, Ubuntu, Caddy, SSH, domain mua riêng hoặc CDN riêng. Các đường dẫn code là thiết kế AS2, chưa phải file đang tồn tại.

## 2. Kết nối và cấu hình

Browser gọi web/API qua các hostname onrender.com được Render cấp. Next.js giữ các chức năng server-side cần thiết, không tự ép static export. API bind 0.0.0.0 và lấy cổng từ PORT của platform; không cố định port local cho Render.

API dùng internal DATABASE_URL do Render cung cấp, cùng region/workspace với DB. Xóa toàn bộ IP allow list external của Postgres để tắt public DB; giữ mặc định 0.0.0.0/0 là không đạt yêu cầu. Web không nhận credential DB và không gọi DB trực tiếp. CI cũng không kết nối DB demo.

Browser dùng NEXT_PUBLIC_API_URL=https://<api-service>.onrender.com; cấp khi build image frontend nếu biến được Next.js nhúng build-time. SSR nếu có dùng URL API phù hợp; không dùng hostname Compose `api` trên Render. Backend FRONTEND_ORIGIN trỏ đúng URL web. TV4/TV5 hiện thực contract, TV6 truyền cấu hình.

Secrets runtime (JWT_SECRET, DATABASE_URL, thông tin khởi tạo cần thiết) đặt trong Render environment. Hook URL và Render API token để kiểm tra deploy đặt trong GitHub Environment secrets; không in URL hook/token ra log. GHCR private image cần credential pull được Render hỗ trợ, quyền chỉ đọc package. Workflow publish có contents:read/packages:write theo job.

## 3. Hợp đồng CI/CD qua image

1. PR: Install → Lint → Unit Test → Build; integration/E2E dùng Postgres test với migration/seed. TV6 cấu hình required checks/branch protection.
2. Push main hoặc tag release được phép: chạy kiểm tra, build hai image linux/amd64, push `ghcr.io/nguyentriet2k69-lang/brew-lite2-web:<sha>` và `brew-lite2-api:<sha>`; ghi digest và cấu hình build web trong manifest release.
3. TV6 tạo image-backed web/API trên Render. Tắt đường auto-deploy bỏ qua kiểm tra nếu có; image-backed không tự deploy chỉ vì push registry.
4. Serialize pipeline deploy. Gọi hook API với imgURL được URL-encode trỏ đúng tag/digest, giữ nguyên registry/repository đã cấu hình. Theo dõi deploy ID/trạng thái bằng Render API đến live hoặc failed trong timeout hữu hạn; 200/202 từ hook không chứng minh rollout thành công.
5. Migration phải thành công trước khi API mới sẵn sàng (mục 4). API live thì deploy web, đợi web live, chạy smoke HTTPS: trang web, API /health và GET /products. Luồng menu→confirm kiểm tra bằng dữ liệu demo/mock, có cleanup.
6. Nếu bước kiểm tra/publish/migration/deploy/smoke lỗi, dừng pipeline, không báo Pass. Rollback theo mục 6. Lưu SHA/digest/deploy ID, kết quả và log đã loại secrets.

Chỉ kết nối repo rồi bật auto-deploy không thay thế chuỗi Image → Registry → Deploy → Smoke mà đề yêu cầu.

## 4. Migration và seed theo gói

API dùng migration versioned, script migration/seed cụ thể do TV5 cung cấp. Không dùng reset/schema push trên DB demo.

- Nếu gói hỗ trợ pre-deploy command: chạy migration trong Render trước rollout, fail thì dừng.
- Với Free không có one-off job/shell: entrypoint API chạy migration có tính lặp an toàn rồi mới start server; migration lỗi thì process thoát, không start API. Chỉ một instance API, serialize release và dùng khóa migration của ORM để tránh đồng thời. Startup migration chạy lại khi cold start nên không được tạo migration mới hoặc seed mỗi lần.
- Đổi schema theo expand/contract, giữ tương thích app cũ trong lúc app mới migrate; migration phá tương thích cần maintenance và review riêng.
- Seed dữ liệu mẫu là thao tác khởi tạo có kiểm soát, không xóa dữ liệu phát sinh hoặc reset mật khẩu mỗi lần restart.
- Export/restore DB dùng tác vụ trong Render có internal URL; Free có thể dùng chế độ bảo trì của image API chạy một tác vụ có kiểm soát và xuất tệp mã hóa tới nơi lưu riêng. Tệp không nằm trên filesystem tạm hoặc log. TV5/TV6 phải kiểm thử chế độ này trước nghiệm thu; đây là phần cần hiện thực, không phải tính năng backup mặc định của Render.
- Nếu Free không đủ khả năng vận hành migration/export an toàn, nhóm chọn gói phù hợp trước deploy; không mở public DB để né giới hạn.

## 5. Health, log và giới hạn Free

API /health probe DB, trả 200 khi sẵn sàng và 503 khi lỗi, không trả secret. TV6 đặt đường healthcheck API; web dùng HTTP path sẵn có. Log stdout/stderr có timestamp/requestId/route/status/duration; xem qua Render logs, không log password/JWT/DB URL.

Free web có cold start sau 15 phút không traffic, workspace có 750 free instance hours/tháng dùng chung, không có persistent disk/one-off job/shell. Free Postgres hết hạn 30 ngày, không managed backup. DB lưu ở Render Postgres; filesystem web/API là tạm, không lưu dữ liệu nghiệp vụ tại đó.

TV6 ghi ngày tạo/hết hạn DB và theo dõi quota đến khi chấm. Warm-up trước demo và đo hiệu năng warm/cold riêng; không tuyên bố đạt NFR-01 khi chưa đo. Nếu cold start, thời hạn hoặc quota không đáp ứng tiêu chí chấm, cần gói khác/được duyệt ngân sách; tài liệu không giả định miễn phí vô hạn.

## 6. Rollback và phục hồi mức đồ án

Giữ cặp image/digest của release ổn định trong GHCR. Nếu deploy mới lỗi và schema còn tương thích, trigger lại digest cũ cho API/web theo thứ tự phù hợp, chờ live rồi health/smoke; ghi kết quả. Không xóa image mà Render còn cần pull khi restart/rollback.

Rollback image không tự đảo schema. Migration không tương thích cần chặn ghi, đánh giá forward-fix hoặc restore bản export đã kiểm tra. Không tự chạy migration revert. Export DB trước migration rủi ro và trước bàn giao, cất an toàn, restore thử trên DB cô lập; Free không có PITR. Dữ liệu seed có thể tái tạo, dữ liệu phát sinh cần export riêng.

Không cam kết HA, zero downtime hoặc SLA cho đồ án. Mục tiêu là tái tạo được môi trường và có quy trình xử lý lỗi kiểm chứng được.

## 7. Bàn giao TV3 → TV6

| TV3 chốt thiết kế | TV6 hiện thực Task 4–5 |
|---|---|
| Render web + API + Postgres | Account/workspace, cùng region; plan phù hợp ngân sách/ngày chấm |
| HTTPS onrender.com | Ghi URL web/API/health thực |
| DB internal, external access tắt | Cấu hình networking và minh chứng |
| GHCR + hooks theo digest | Workflow, image credentials, deploy ID và log smoke |
| Migration/seed/export có kiểm soát | Script TV5, cấu hình Render và restore thử |
| Health/log/rollback | Thu kết quả success/fail, cập nhật runbook lệnh thật |

[Deployment source](diagrams/deployment.puml), [SVG](diagrams/deployment.svg), [overview](architecture/overview.md) và [ADR-005](architecture/adr/005-deployment-platform.md) mô tả cùng topology. Task 3 không chờ có code/live URL mới bàn giao; TV6 review thiết kế rồi hiện thực.

## Nguồn chính thức

Kiểm tra ngày 06/11/2026: [Image deployment](https://render.com/docs/deploying-an-image), [deploy hooks](https://render.com/docs/deploy-hooks), [Postgres networking](https://render.com/docs/postgresql-creating-connecting), [giới hạn Free](https://render.com/docs/free). TV6 kiểm tra lại plan/tính năng trước cấp phát.
