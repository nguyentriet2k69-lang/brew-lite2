# Ma trận truy vết (Traceability Matrix) – BrewLite

> Chủ sở hữu: TV1. Cập nhật trong cùng PR khi thay đổi yêu cầu, thiết kế, code hoặc test. Các mã sơ đồ/test bên dưới là **kế hoạch**; TV2–TV6 điều chỉnh tên cho khớp khi hoàn thành. Cột "Kết quả" cập nhật khi có minh chứng (Pass/Fail/Pending).

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test | Kết quả |
|:--|:--|:--|:--|:--|:--|
| FR-01 | UC-01 Xem menu | Activity-01, Class-01 (Product) | `GET /products`; `apps/web` trang Menu | API-T01, COMP-T01, E2E-01 | Pending |
| FR-02 | UC-02 Chi tiết & size/topping | Activity-01, Class-01 | `GET /products/:id`; trang Chi tiết | API-T02, COMP-T02, E2E-01 | Pending |
| FR-03 | UC-03 Giỏ hàng | Activity-01 | Cart store (Zustand/Context) | UNIT-T01, COMP-T03, E2E-01 | Pending |
| FR-04 | UC-04 Đăng ký/Đăng nhập | Activity-01, Class-01 (User) | `POST /auth/register`, `POST /auth/login`; JWT guard | UNIT-T02, INT-T01, E2E-01 | Pending |
| FR-05 | UC-05 Đặt & thanh toán | Activity-01, Sequence-01, Class-01 (Order, OrderItem) | `POST /orders` | INT-T02, E2E-01 | Pending |
| FR-06 | UC-05 Đặt & thanh toán | Activity-01, Sequence-01, Class-01 (Payment) | `POST /payments` (Idempotency-Key) | UNIT-T03, INT-T03, E2E-01 | Pending |
| FR-07 | UC-06 Xác nhận & lịch sử | Activity-01, Class-01 | `GET /orders/me`; trang Xác nhận/Lịch sử | INT-T04, E2E-01 | Pending |
| FR-08 | UC-05, UC-07 | Class-01 (enum OrderStatus) | `assertTransition` / Order state machine | UNIT-T04 | Pending |
| FR-09 | UC-05 | Sequence-01 (transaction) | Order service (transaction + tồn kho) | INT-T05 | Pending |
| FR-10 | UC-08 (Could) | Class-01 (Promotion, LoyaltyTransaction) | Promotion/Loyalty module | UNIT-T05 | Pending |
| NFR-01 | – | Deployment-01 | `GET /products` | API-T01 (đo thời gian) | Pending |
| NFR-02 | – | ADR-002 (JWT) | bcrypt, JWT guard, class-validator | UNIT-T02, INT-T01 | Pending |
| NFR-03 | – | Architecture overview | Next.js PWA manifest, responsive UI | COMP-T01, kiểm tra thủ công viewport | Pending |
| NFR-04 | – | Deployment-01 | `docker-compose.yml`, `.github/workflows/ci.yml`, `cd.yml` | Pipeline CI/CD + smoke test | Pending |
| NFR-05 | – | Deployment-01 | `GET /health`, logging | INT-T06 | Pending |
| NFR-06 | – | Class-01 / data model | Migration + seed | Chạy migration trên DB trống | Pending |
| NFR-07 | – | – | `tests/` | Unit, Integration, E2E | Pending |

## Quy tắc duy trì
- Mỗi FR Must có ≥ 1 test.
- Sequence/Activity/Class tham chiếu mã FR tương ứng.
- Thay đổi code → cập nhật ma trận trong cùng PR; TV1 chịu trách nhiệm kiểm tra cuối.
