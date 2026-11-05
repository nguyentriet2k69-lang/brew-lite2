# Kiến trúc BrewLite

Trạng thái: Thiết kế Task 3.1 do TV3 bàn giao để review và hiện thực Task 4–5. Căn cứ: SRS và UML Task 1–2 trong repository. Repository hiện có tài liệu; các đường dẫn `apps/web`, `apps/api` và cấu hình triển khai dưới đây là mục tiêu thiết kế, chưa phải bằng chứng đã triển khai.

## 1. Mục tiêu và phạm vi

Hỗ trợ luồng UC-05: xem menu → chọn size/topping → giỏ hàng → đăng nhập → tạo đơn → thanh toán Ví/Thẻ mô phỏng → xác nhận và lịch sử. Công nghệ ràng buộc: Next.js, NestJS, PostgreSQL và Docker. Tham chiếu [SRS](../requirements/srs.md), [phạm vi](../requirements/context-and-scope.md) và [UC-05](../requirements/uc-checkout-spec.md).

Nhân viên cập nhật trạng thái, khuyến mãi và loyalty thuộc phần mở rộng theo SRS; không yêu cầu nhóm triển khai đầy đủ để hoàn thành MVP. Không tích hợp thanh toán thật, giao hàng hay dashboard quản trị.

## 2. Cách tiếp cận kiến trúc

Đề xuất backend modular monolith theo lớp. Một NestJS API chứa các module nghiệp vụ, dùng chung PostgreSQL; frontend triển khai riêng. Cách này giữ transaction đơn hàng trong một hệ thống và giảm công vận hành cho nhóm sinh viên.

Microservices làm tăng yêu cầu giao tiếp, quan sát và nhất quán dữ liệu trong khi MVP chưa cần triển khai độc lập từng nghiệp vụ. Dồn toàn bộ API vào Next.js không đáp ứng ràng buộc NestJS. Đây là đánh giá thiết kế của TV3, chờ review nhóm.

## 3. Thành phần và trách nhiệm

| Thành phần dự kiến | Trách nhiệm | Ranh giới |
|---|---|---|
| Trình duyệt khách hàng | Hiển thị UI, giỏ hàng, gửi yêu cầu | Không được quyết định giá cuối cùng hay kết quả payment |
| `apps/web` — Next.js | Menu mobile-first/PWA, chi tiết, auth, checkout, xác nhận, lịch sử | Gọi API; không truy cập trực tiếp PostgreSQL |
| `apps/api` — NestJS | Xác thực, validation, giá, đơn, tồn kho, payment, lịch sử | Quyết định nghiệp vụ và quyền truy cập |
| PostgreSQL | Lưu dữ liệu domain, ràng buộc, transaction | Chỉ API và tác vụ migration được truy cập |
| Payment mock trong API — đề xuất | Giả lập success/fail qua interface riêng | Lifeline Payment trong UML không tự động có nghĩa là một service triển khai riêng |

## 4. Phân lớp backend

Luồng phụ thuộc đề xuất: controller/DTO/guard → application service → persistence adapter/Prisma → PostgreSQL. Interface payment do nghiệp vụ sử dụng, implementation mock được cấp qua dependency injection. Controller xử lý HTTP; service điều phối nghiệp vụ; database bảo vệ tính toàn vẹn.

Các module dự kiến: Auth, Products, Orders, Payments và Health. Phần Promotion/Loyalty chỉ bổ sung khi nhóm chọn FR-10. ORM Prisma là đề xuất cần TV5 review, không phải ràng buộc đã có trong đề.

## 5. Luồng checkout và tính nhất quán

1. UI gửi giỏ hàng và JWT tới `POST /orders`.
2. API xác minh token, validate, lấy giá từ dữ liệu server.
3. Trong cùng transaction, API kiểm tra và giảm tồn kho bằng thao tác có điều kiện, tạo Order PENDING và các OrderItem; nếu bất kỳ bước nào lỗi thì rollback.
4. UI gửi `POST /payments` với đơn, phương thức và Idempotency-Key.
5. API kiểm tra quyền sở hữu đơn, lấy số tiền từ Order và thực hiện mock. Lưu Payment và cập nhật trạng thái Order phải nhất quán trong transaction.
6. Thành công: PAID và xóa giỏ sau xác nhận từ API. Thất bại: PAYMENT_FAILED, giữ giỏ để thử lại trên đơn hiện có.

Không coi hai request HTTP tạo đơn và thanh toán là một transaction DB kéo dài. Cơ chế chống trùng payment và chống tạo đơn trùng cần được định nghĩa riêng; xem [ADR-004](adr/004-payment-mock-and-idempotency.md).

## 6. Bảo mật và phi chức năng

- FR-04/NFR-02: bcrypt, JWT, kiểm tra quyền sở hữu đơn và payment; validate tại biên API. Chính sách lưu JWT còn chờ TV4/TV5 chốt.
- FR-09: transaction và giảm tồn kho có điều kiện; test hai request cạnh tranh lượng tồn cuối.
- NFR-01: mục tiêu API menu dưới 500 ms và UI dưới 2 giây cần đo theo điều kiện SRS, chưa có kết quả đo trong repo này.
- NFR-03: PWA manifest và UI mobile-first thuộc TV4; chưa có implementation để xác nhận.
- NFR-04–06: Docker, CI/CD, health có kiểm tra DB, log không chứa secret, migration/seed và backup là yêu cầu bàn giao cho TV6/TV5.
- NFR-07: unit nghiệp vụ, integration DB/order/payment và E2E menu→confirm; TV5/TV6 cung cấp minh chứng.

## 7. Truy vết thiết kế

| Yêu cầu | Thiết kế TV3 | Vị trí code dự kiến — chưa tồn tại |
|---|---|---|
| FR-01–03, NFR-03 | Web riêng, API làm nguồn dữ liệu | `apps/web`, Products trong `apps/api` |
| FR-04, NFR-02 | ADR-002 | Auth và guard trong `apps/api` |
| FR-05, FR-09, NFR-06 | ADR-003 | Orders, persistence, migrations trong `apps/api` |
| FR-06 | ADR-004 | Payments, mock adapter trong `apps/api` |
| NFR-04–05 | ADR-005, deployment.md | Compose, workflow, Health — TV6/TV5 |

## 8. Điểm cần phối hợp trước khi chốt

| Vấn đề | Cần người phụ trách xác nhận |
|---|---|
| Sequence đặt Idempotency-Key ở cả orders và payments; Class đặt key ở Order | TV1/TV2/TV5: phạm vi chống trùng và vị trí lưu key |
| UC-05 yêu cầu thử lại payment nhưng Class có Order–Payment `0..1` | TV2/TV5: một payment cập nhật kết quả hay nhiều lần thử được lưu riêng |
| Sequence mô tả payment fail trả 400, chưa có contract response thống nhất | TV1/TV2/TV5: phân biệt kết quả nghiệp vụ thất bại với request không hợp lệ |
| Activity kiểm tra tồn kho trước transaction, Sequence kiểm tra trong transaction | TV2/TV5: bảo đảm kiểm tra và giảm tồn kho nguyên tử |
| TV3 chọn Render web/API/Postgres, HTTPS được quản lý và GHCR; Compose dùng local | TV6 hiện thực ADR-005, tắt DB external access, chọn plan theo quota/ngày chấm và cung cấp minh chứng Task 4–5 |

TV3 ghi nhận các điểm này, không thay đổi SRS/UML của TV1/TV2. Các tài liệu liên quan: [Sequence](../diagrams/sequence-checkout.puml), [Class](../diagrams/class-domain.puml), [Activity](../diagrams/activity-order-to-payment.puml), [Deployment nháp](../diagrams/deployment.svg), [Thiết kế triển khai](../deployment.md).
