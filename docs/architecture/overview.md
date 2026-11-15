# Kiến trúc BrewLite

Tài liệu mô tả kiến trúc BrewLite theo SRS và các sơ đồ UML. Repository hiện có Next.js tại `apps/web`, NestJS tại `apps/api`, PostgreSQL, TypeORM migrations và CI/CD GitHub Actions. Production target là Vercel (web), Render Web Service (API) và Render PostgreSQL managed; Docker Compose chỉ dùng local/testing. CD run #4 attempt 4 passed Verify, Render deploy and API smoke, then failed at Vercel because the CLI ran in `apps/web` although the Vercel project Root Directory is `apps/web`; the Render rollback API returned HTTP 500. The fix is in PR #10, and CI run #12 passed API/Web; production CD rerun is pending merge. Xem [deployment runbook](../deployment.md).

## 1. Mục tiêu và phạm vi

Hỗ trợ luồng UC-05: xem menu → chọn size/topping → giỏ hàng → đăng nhập → tạo đơn → thanh toán Ví/Thẻ mô phỏng → xác nhận và lịch sử. Công nghệ ràng buộc: Next.js, NestJS, PostgreSQL và Docker. Tham chiếu [SRS](../requirements/srs.md), [phạm vi](../requirements/context-and-scope.md) và [UC-05](../requirements/uc-checkout-spec.md).

Nhân viên cập nhật trạng thái, khuyến mãi và loyalty thuộc phần mở rộng theo SRS; không yêu cầu nhóm triển khai đầy đủ để hoàn thành MVP. Không tích hợp thanh toán thật, giao hàng hay dashboard quản trị.

## 2. Cách tiếp cận kiến trúc

Backend hiện là modular monolith theo lớp. Một NestJS API chứa các module nghiệp vụ, dùng chung PostgreSQL; frontend Next.js build và chạy riêng. Cách này giữ transaction đơn hàng trong một hệ thống và giảm công vận hành cho nhóm sinh viên.

Microservices làm tăng yêu cầu giao tiếp, quan sát và nhất quán dữ liệu trong khi MVP chưa cần triển khai độc lập từng nghiệp vụ. Dồn toàn bộ API vào Next.js không đáp ứng ràng buộc NestJS. Vì vậy, backend được tổ chức theo module trong một ứng dụng NestJS.

## 3. Thành phần và trách nhiệm

| Thành phần | Trách nhiệm | Ranh giới |
|---|---|---|
| Trình duyệt khách hàng | Hiển thị menu, giỏ, auth, checkout, confirmation, history | Dữ liệu UI không quyết định giá cuối/kết quả thanh toán |
| `apps/web` — Next.js / Vercel | Mobile-first UI; cart lưu local, auth token lưu session; gọi Nest API | Có manifest/icons, service worker cache shell/public catalog và Playwright browser E2E; hai production domains trả HTTP 200 cho root/manifest/icons trong smoke test 2026-11-15 |
| `apps/api` — NestJS / Render | Xác thực, validation, giá, đơn, tồn kho, payment, lịch sử | Quyết định nghiệp vụ và quyền truy cập; production `/health` trả HTTP 200, database connected |
| PostgreSQL / Render | Lưu dữ liệu domain, ràng buộc, transaction | Render managed database; API dùng internal URL, browser không kết nối trực tiếp |
| Payment mock trong API | Giả lập success/fail qua interface riêng | Lifeline Payment trong UML không tự động có nghĩa là một service triển khai riêng |

## 4. Phân lớp backend

Luồng phụ thuộc: controller/DTO/guard → application service → TypeORM repositories/EntityManager → PostgreSQL. Interface payment do nghiệp vụ sử dụng, mock implementation được cấp qua dependency injection. Controller xử lý HTTP; service điều phối nghiệp vụ; database bảo vệ tính toàn vẹn.

Các module hiện có: Auth, Products, Pricing, Orders, Payments, Inventory và Health. TypeORM được dùng cho entity, migration và transaction. Promotion/Loyalty chưa được triển khai (FR-10 là Could).

## 5. Luồng checkout và tính nhất quán

1. UI gửi giỏ hàng và JWT tới `POST /orders`.
2. API xác minh token, validate, lấy giá từ dữ liệu server.
3. Trong cùng transaction, API khóa Product theo thứ tự ổn định, tính giá từ server, kiểm tra và giảm tồn kho, tạo Order PENDING/OrderItems và reservation HELD. `Idempotency-Key` của order chống tạo trùng; lỗi làm rollback.
4. UI gửi `POST /payments` với order, phương thức và một `Idempotency-Key` riêng cho lần thanh toán. API kiểm tra quyền sở hữu order, lưu PaymentAttempt PROCESSING và chuyển reservation sang PAYMENT_PENDING trong transaction.
5. Payment mock xử lý ngoài transaction DB. API ghi kết quả terminal, PaymentAttempt và reservation/order nhất quán trong transaction cuối.
6. Thành công: order PAID, reservation CONSUMED. Thất bại đã được xác nhận: order PAYMENT_FAILED, reservation RELEASED và tồn kho được phục hồi. Retry sau thất bại cần reacquire tồn kho và key mới; timeout/unknown phải reconcile bằng key cũ, không release reservation.

Hai request HTTP tạo đơn và thanh toán không nằm trong một transaction DB kéo dài. Các transaction ngắn, unique constraints và khóa hàng/advisory bảo vệ tính nhất quán; xem [ADR-004](adr/004-payment-mock-and-idempotency.md).

## 6. Bảo mật và phi chức năng

- FR-04/NFR-02: bcrypt, JWT, kiểm tra quyền sở hữu đơn/payment và validate ở API đã triển khai; web giữ token trong sessionStorage, cần XSS hardening trước production.
- FR-09: transaction và giảm tồn kho có điều kiện; test hai request cạnh tranh lượng tồn cuối.
- NFR-01: mục tiêu API menu dưới 500 ms và UI dưới 2 giây cần đo theo điều kiện SRS, chưa có kết quả đo trong repo này.
- NFR-03: UI mobile-first, manifest/icons và offline cache cho shell/menu đã có; manual viewport smoke tại 360/390/414 px và Playwright offline test pass. Checkout cần mạng; PWA trên thiết bị thật chưa xác minh.
- NFR-04–06: local Docker Compose, migration/seed, health và provider CD workflow có. CD run #4 attempt 4 deployed Render and passed API smoke but failed at Vercel due to duplicated project root path; the Render rollback request returned HTTP 500. Production migration history và Render database backup/restore chưa được kiểm chứng.
- NFR-07: API unit, PostgreSQL integration, API E2E và browser E2E từ menu đến xác nhận đã chạy pass locally.

## 7. Truy vết thiết kế

| Yêu cầu | Tài liệu thiết kế | Vị trí mã nguồn dự kiến |
|---|---|---|
| FR-01–03, NFR-03 | Web riêng, API làm nguồn dữ liệu | `apps/web`, Products trong `apps/api` |
| FR-04, NFR-02 | ADR-002 | Auth và guard trong `apps/api` |
| FR-05, FR-09, NFR-06 | ADR-003 | Orders, persistence, migrations trong `apps/api` |
| FR-06 | ADR-004 | Payments, mock adapter trong `apps/api` |
| NFR-04–05 | ADR-006, deployment.md | GitHub Actions, Render API/DB, Vercel, Health |

## 8. Các điểm cần thống nhất

| Gap còn lại | Tác động / việc cần làm |
|---|---|
| Production CD chưa hoàn tất | GitHub CI run #9 trên `main` pass; CD run #4 attempt 4 Verify/Render/API smoke pass, Vercel deploy fail do CLI chạy từ `apps/web` trong khi project Root Directory cũng là `apps/web`; Render rollback API trả HTTP 500. PR #10 runs CLI from repository root, and CI run #12 passed; a successful production CD run remains pending merge. |
| Web lưu JWT trong sessionStorage, chưa có CSP/XSS hardening | Rà soát trước production; cân nhắc cookie HttpOnly/SameSite và CSRF nếu frontend/API contract hỗ trợ. |
| Offline checkout không hỗ trợ | Service worker chỉ cache shell/static và public catalog/pricing; không cache token, đơn hàng hay thanh toán. |
| FR-08 chỉ có trạng thái payment/order hiện hành; staff transitions chưa triển khai | Xác nhận giữ UC-07 ngoài MVP hay bổ sung staff workflow; SRS hiện ghi Should. |
| Promotion/Loyalty mới là lớp mô hình yêu cầu, chưa có implementation | FR-10 là Could; không mô tả là chức năng đã có. |
| Cấu hình Vercel project ID còn cần xác nhận; Render migrations/backups chưa được xác minh | Chưa thể xác nhận production CD thành công hoặc production checkout; xem [deployment runbook](../deployment.md). |

Production web manifest/icons, API health/catalog và CORS đã được smoke-test ngày 2026-11-15. Production checkout, automated rollback, backup/restore và PWA trên thiết bị thật vẫn chưa được xác minh; xem [deployment runbook](../deployment.md). Tài liệu sơ đồ: [Sequence](../diagrams/sequence-checkout.puml), [Class](../diagrams/class-domain.puml), [Activity](../diagrams/activity-order-to-payment.puml), [Deployment](../diagrams/deployment.svg).
