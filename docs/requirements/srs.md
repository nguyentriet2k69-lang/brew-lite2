# Tài liệu Đặc tả Yêu cầu Hệ thống (SRS rút gọn) – BrewLite

Quy ước ưu tiên MoSCoW: **Must / Should / Could / Won't**. Mã tham chiếu: FR = chức năng, NFR = phi chức năng, UC = use-case.

## 1. Yêu cầu chức năng (FR)

| Mã | Nhóm | Tên | Mô tả | MoSCoW | UC |
|:--|:--|:--|:--|:--|:--|
| FR-01 | Menu | Xem danh sách sản phẩm | Hiển thị menu gồm hình, tên, giá, trạng thái còn/hết hàng | Must | UC-01 |
| FR-02 | Chi tiết sản phẩm | Xem chi tiết, chọn size/topping | Chọn size S/M/L và topping; giá cập nhật theo tùy chọn | Must | UC-02 |
| FR-03 | Giỏ hàng | Quản lý giỏ hàng | Thêm/sửa số lượng/xóa; tự tính tổng; badge số lượng | Must | UC-03 |
| FR-04 | Xác thực | Đăng ký / Đăng nhập | Tạo tài khoản, đăng nhập, cấp JWT; bảo vệ route đặt đơn | Must | UC-04 |
| FR-05 | Đặt đơn | Tạo đơn hàng | Từ giỏ hàng tạo đơn trạng thái PENDING, trả mã đơn | Must | UC-05 |
| FR-06 | Thanh toán | Thanh toán Ví/Thẻ mô phỏng | Chọn Ví/Thẻ, gọi mock; thành công → PAID, lỗi → PAYMENT_FAILED, giữ giỏ; hỗ trợ Idempotency-Key | Must | UC-05 |
| FR-07 | Lịch sử đơn | Xem xác nhận và lịch sử đơn | Hiển thị mã đơn, trạng thái, danh sách đơn của người dùng | Must | UC-06 |
| FR-08 | Quản lý trạng thái đơn | State machine đơn hàng | PENDING→PAID→PREPARING→READY→COMPLETED; chặn chuyển trạng thái không hợp lệ; hỗ trợ PAYMENT_FAILED, CANCELLED | Should | UC-05, UC-07 |
| FR-09 | Tồn kho | Kiểm soát tồn kho khi đặt đơn | Trừ tồn kho trong transaction; không bán vượt số lượng còn lại | Should | UC-05 |
| FR-10 | Khuyến mãi / Loyalty | Áp mã giảm giá, cộng điểm | Áp mã hợp lệ; cộng điểm sau khi đơn PAID | Could | UC-08 |
| FR-11 | Cập nhật trạng thái bởi nhân viên | Barista cập nhật PREPARING/READY/COMPLETED | Giao diện nhân viên quầy | Won't (MVP) | UC-07 |

### Tiêu chí chấp nhận (AC) theo FR

| FR | Tiêu chí chấp nhận (có thể kiểm chứng) |
|:--|:--|
| FR-01 | AC1: `GET /products` trả 200 và danh sách có id, tên, giá, ảnh, tình trạng. AC2: trang menu hiển thị lưới sản phẩm; có trạng thái loading khi chờ, empty khi danh sách rỗng, error khi API lỗi. AC3: sản phẩm hết hàng được đánh dấu và không thêm được vào giỏ. |
| FR-02 | AC1: `GET /products/:id` trả 200 với chi tiết; id không tồn tại trả 404. AC2: chọn size M hoặc L thay đổi giá hiển thị theo bảng giá. AC3: chọn tối đa các topping hợp lệ, giá cộng đúng. |
| FR-03 | AC1: thêm sản phẩm làm tăng badge và tổng tiền. AC2: đổi số lượng cập nhật thành tiền; số lượng về 0 hoặc bấm xóa thì gỡ dòng. AC3: giỏ hàng rỗng hiển thị thông báo và vô hiệu nút Thanh toán. AC4: giỏ hàng giữ sau khi tải lại trang. |
| FR-04 | AC1: đăng ký email hợp lệ chưa tồn tại → 201; email trùng → 409. AC2: đăng nhập đúng → nhận JWT; sai mật khẩu → 401. AC3: mật khẩu lưu dạng băm (bcrypt), không lưu rõ. AC4: gọi `POST /orders` không có/ sai JWT → 401. |
| FR-05 | AC1: giỏ có ≥ 1 sản phẩm và đã đăng nhập → `POST /orders` tạo đơn PENDING, trả mã đơn và tổng tiền. AC2: dữ liệu không hợp lệ (số lượng ≤ 0, sản phẩm không tồn tại) → 400. AC3: tổng tiền do server tính lại, không tin giá từ client. |
| FR-06 | AC1: thanh toán thành công → đơn PAID, hiển thị xác nhận. AC2: thanh toán lỗi → đơn PAYMENT_FAILED, giỏ hàng giữ nguyên, cho phép thử lại. AC3: gửi lại 2 lần cùng Idempotency-Key chỉ tạo một giao dịch và một kết quả đơn. AC4: phương thức ngoài Ví/Thẻ bị từ chối với 400. |
| FR-07 | AC1: sau thanh toán hiển thị mã đơn và trạng thái. AC2: `GET /orders/me` chỉ trả đơn của người dùng đăng nhập, sắp xếp mới nhất trước. AC3: chưa đăng nhập → 401. |
| FR-08 | AC1: chuyển trạng thái hợp lệ được chấp nhận. AC2: chuyển không hợp lệ (ví dụ PENDING→READY) bị từ chối bằng lỗi. AC3: COMPLETED và CANCELLED là trạng thái kết thúc. |
| FR-09 | AC1: đặt số lượng vượt tồn kho bị từ chối. AC2: hai yêu cầu đồng thời cho lượng tồn cuối cùng chỉ một yêu cầu thành công. AC3: tạo đơn và trừ tồn kho trong cùng một transaction (lỗi thì rollback). |
| FR-10 | AC1: mã hợp lệ giảm đúng số tiền; mã sai/hết hạn bị từ chối. AC2: đơn PAID cộng điểm đúng quy tắc, mỗi đơn chỉ cộng một lần. |

## 2. Yêu cầu phi chức năng (NFR)

| Mã | Nhóm | Mô tả | MoSCoW | Tiêu chí chấp nhận |
|:--|:--|:--|:--|:--|
| NFR-01 | Hiệu năng | API phản hồi nhanh; menu tải nhanh | Must | AC1: API đọc (`GET /products`) < 500 ms với dữ liệu mẫu (đo bằng test/curl). AC2: menu hiển thị nội dung < 2 giây trong mạng bình thường. |
| NFR-02 | Bảo mật | Bảo vệ tài khoản và dữ liệu | Must | AC1: mật khẩu băm trước khi lưu. AC2: API nhạy cảm yêu cầu JWT hợp lệ. AC3: input được validate (class-validator). AC4: không có secret trong repo/log. |
| NFR-03 | Tính khả dụng / Khả dụng giao diện | Giao diện mobile-first/PWA, chạy trên trình duyệt phổ biến | Must | AC1: hiển thị đúng ở viewport 360–414 px. AC2: có manifest PWA hợp lệ. AC3: chạy được trên Chrome/Safari/Firefox bản mới. |
| NFR-04 | Khả năng triển khai | Đóng gói Docker, tự động hóa CI/CD | Must | AC1: `docker compose up` chạy web + api + db. AC2: CI chạy Install→Lint→Test→Build khi mở PR và chặn merge nếu fail. AC3: CD triển khai, chạy smoke test, có cách rollback. |
| NFR-05 | Độ tin cậy / Quan sát | Health check và log | Should | AC1: `GET /health` trả 200 khi hệ thống sẵn sàng. AC2: lỗi nghiệp vụ được log không chứa thông tin nhạy cảm. |
| NFR-06 | Bảo trì / Dữ liệu | Migration và seed tái tạo DB | Must | AC1: chạy migration + seed trên DB trống tạo lại được dữ liệu mẫu. |
| NFR-07 | Khả năng kiểm thử | Có unit, integration, E2E | Must | AC1: unit test cho nghiệp vụ quan trọng. AC2: integration test cho tạo đơn/thanh toán. AC3: ≥ 1 E2E từ menu đến xác nhận. |

## 3. Tiêu chí chấp nhận chung
- Mỗi FR Must có ít nhất một test case tương ứng, được ghi trong ma trận truy vết.
- Dữ liệu đầu vào được validate ở cả frontend và backend.
- Lỗi hiển thị thông báo thân thiện ở UI; API trả mã lỗi HTTP đúng ngữ nghĩa.

## 4. Sơ đồ use-case tổng quát
Xem `docs/diagrams/use-case-overview.puml` (xuất `.svg`).

## 5. Độ phủ nhóm yêu cầu tối thiểu theo đề

| Nhóm theo đề | Mã yêu cầu |
|:--|:--|
| Menu | FR-01 |
| Chi tiết sản phẩm | FR-02 |
| Giỏ hàng | FR-03 |
| Xác thực | FR-04 |
| Đặt đơn | FR-05 |
| Thanh toán | FR-06 |
| Lịch sử đơn | FR-07 |
| Quản lý trạng thái đơn | FR-08 |
| Hiệu năng | NFR-01 |
| Bảo mật | NFR-02 |
| Tính khả dụng | NFR-03 (giao diện), NFR-05 (health/độ sẵn sàng) |
| Khả năng triển khai | NFR-04, NFR-06 |
