# Kiến trúc BrewLite

Tài liệu trình bày kiến trúc BrewLite dựa trên SRS và các sơ đồ UML. Hệ thống được thiết kế với Next.js, NestJS và PostgreSQL, triển khai bằng Docker Compose trên server Ubuntu. Cấu trúc `apps/web` và `apps/api` được dùng để tổ chức mã nguồn khi hiện thực.

## 1. Mục tiêu và phạm vi

Hỗ trợ luồng UC-05: xem menu → chọn size/topping → giỏ hàng → đăng nhập → tạo đơn → thanh toán Ví/Thẻ mô phỏng → xác nhận và lịch sử. Công nghệ ràng buộc: Next.js, NestJS, PostgreSQL và Docker. Tham chiếu [SRS](../requirements/srs.md), [phạm vi](../requirements/context-and-scope.md) và [UC-05](../requirements/uc-checkout-spec.md).

Nhân viên cập nhật trạng thái, khuyến mãi và loyalty thuộc phần mở rộng theo SRS; không yêu cầu nhóm triển khai đầy đủ để hoàn thành MVP. Không tích hợp thanh toán thật, giao hàng hay dashboard quản trị.

## 2. Cách tiếp cận kiến trúc

Đề xuất backend modular monolith theo lớp. Một NestJS API chứa các module nghiệp vụ, dùng chung PostgreSQL; frontend triển khai riêng. Cách này giữ transaction đơn hàng trong một hệ thống và giảm công vận hành cho nhóm sinh viên.

Microservices làm tăng yêu cầu giao tiếp, quan sát và nhất quán dữ liệu trong khi MVP chưa cần triển khai độc lập từng nghiệp vụ. Dồn toàn bộ API vào Next.js không đáp ứng ràng buộc NestJS. Vì vậy, backend được tổ chức theo module trong một ứng dụng NestJS.

## 3. Thành phần và trách nhiệm

| Thành phần dự kiến | Trách nhiệm | Ranh giới |
|---|---|---|
| Trình duyệt khách hàng | Hiển thị UI, giỏ hàng, gửi yêu cầu | Không được quyết định giá cuối cùng hay kết quả payment |
| `apps/web` — Next.js | Menu mobile-first/PWA, chi tiết, auth, checkout, xác nhận, lịch sử | Gọi API; không truy cập trực tiếp PostgreSQL |
| `apps/api` — NestJS | Xác thực, validation, giá, đơn, tồn kho, payment, lịch sử | Quyết định nghiệp vụ và quyền truy cập |
| PostgreSQL | Lưu dữ liệu domain, ràng buộc, transaction | Chỉ API và tác vụ migration được truy cập |
| Payment mock trong API | Giả lập success/fail qua interface riêng | Lifeline Payment trong UML không tự động có nghĩa là một service triển khai riêng |

## 4. Phân lớp backend

Luồng phụ thuộc: controller/DTO/guard → application service → persistence adapter/Prisma → PostgreSQL. Interface payment do nghiệp vụ sử dụng, implementation mock được cấp qua dependency injection. Controller xử lý HTTP; service điều phối nghiệp vụ; database bảo vệ tính toàn vẹn.

Các module dự kiến: Auth, Products, Orders, Payments và Health. Phần Promotion/Loyalty chỉ bổ sung khi nhóm chọn FR-10. Đề xuất dùng Prisma cho lớp truy cập dữ liệu; lựa chọn này cần thống nhất khi triển khai backend.

## 5. Luồng checkout và tính nhất quán

1. UI gửi giỏ hàng và JWT tới `POST /orders`.
2. API xác minh token, validate, lấy giá từ dữ liệu server.
3. Trong cùng transaction, API kiểm tra và giảm tồn kho bằng thao tác có điều kiện, tạo Order PENDING và các OrderItem; nếu bất kỳ bước nào lỗi thì rollback.
4. UI gửi `POST /payments` với đơn, phương thức và Idempotency-Key.
5. API kiểm tra quyền sở hữu đơn, lấy số tiền từ Order và thực hiện mock. Lưu Payment và cập nhật trạng thái Order phải nhất quán trong transaction.
6. Thành công: PAID và xóa giỏ sau xác nhận từ API. Thất bại: PAYMENT_FAILED, giữ giỏ để thử lại trên đơn hiện có.

Không coi hai request HTTP tạo đơn và thanh toán là một transaction DB kéo dài. Cơ chế chống trùng payment và chống tạo đơn trùng cần được định nghĩa riêng; xem [ADR-004](adr/004-payment-mock-and-idempotency.md).

## 6. Bảo mật và phi chức năng

- FR-04/NFR-02: bcrypt, JWT, kiểm tra quyền sở hữu đơn và payment; validate tại biên API. Cách lưu JWT và xử lý đăng xuất cần thống nhất giữa frontend và backend.
- FR-09: transaction và giảm tồn kho có điều kiện; test hai request cạnh tranh lượng tồn cuối.
- NFR-01: mục tiêu API menu dưới 500 ms và UI dưới 2 giây cần đo theo điều kiện SRS, chưa có kết quả đo trong repo này.
- NFR-03: Frontend cần có PWA manifest và giao diện mobile-first.
- NFR-04–06: Docker, CI/CD, health có kiểm tra DB, log không chứa secret, migration/seed và backup cần được cấu hình và kiểm tra khi triển khai.
- NFR-07: unit nghiệp vụ, integration DB/order/payment và E2E menu→confirm; kết quả được ghi nhận trong giai đoạn kiểm thử.

## 7. Truy vết thiết kế

| Yêu cầu | Tài liệu thiết kế | Vị trí mã nguồn dự kiến |
|---|---|---|
| FR-01–03, NFR-03 | Web riêng, API làm nguồn dữ liệu | `apps/web`, Products trong `apps/api` |
| FR-04, NFR-02 | ADR-002 | Auth và guard trong `apps/api` |
| FR-05, FR-09, NFR-06 | ADR-003 | Orders, persistence, migrations trong `apps/api` |
| FR-06 | ADR-004 | Payments, mock adapter trong `apps/api` |
| NFR-04–05 | ADR-005, deployment.md | Compose, workflow, Health |

## 8. Các điểm cần thống nhất

| Nội dung hiện tại | Điểm cần thống nhất |
|---|---|
| Sequence đặt Idempotency-Key ở cả orders và payments; Class đặt key ở Order | phạm vi chống trùng và vị trí lưu key |
| UC-05 yêu cầu thử lại payment nhưng Class có Order–Payment `0..1` | một payment cập nhật kết quả hay nhiều lần thử được lưu riêng |
| Sequence mô tả payment fail trả 400, chưa có contract response thống nhất | phân biệt kết quả nghiệp vụ thất bại với request không hợp lệ |
| Activity kiểm tra tồn kho trước transaction, Sequence kiểm tra trong transaction | bảo đảm kiểm tra và giảm tồn kho nguyên tử |
| Triển khai trên server Ubuntu theo yêu cầu của giảng viên | Cấu hình theo ADR-005; bổ sung IP và hostname khi có server |

Các điểm trên cần được thống nhất với tài liệu yêu cầu và mô hình nghiệp vụ trước khi triển khai. Tài liệu liên quan: [Sequence](../diagrams/sequence-checkout.puml), [Class](../diagrams/class-domain.puml), [Activity](../diagrams/activity-order-to-payment.puml), [Deployment](../diagrams/deployment.svg), [Thiết kế triển khai](../deployment.md).
