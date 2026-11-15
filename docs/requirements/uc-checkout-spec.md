# Đặc tả Use-case UC-05: Đặt và thanh toán đơn hàng (Task 1.3)

## 1. Thông tin chung

| Mục | Nội dung |
|:--|:--|
| Mã / Tên | UC-05 – Đặt và thanh toán đơn hàng |
| Actor chính | Khách hàng (Customer) |
| Actor phụ | Payment Gateway (mock) |
| Mục tiêu | Khách chuyển giỏ hàng thành đơn hợp lệ và thanh toán không tiền mặt |
| Trigger | Khách bấm "Thanh toán" trong màn hình giỏ hàng |
| Yêu cầu liên quan | FR-03, FR-04, FR-05, FR-06, FR-08, FR-09, NFR-02, NFR-07 (FR-10 nếu hiện thực) |

## 2. Tiền điều kiện
1. Giỏ hàng có ít nhất 1 sản phẩm hợp lệ.
2. Khách đã đăng nhập (có JWT hợp lệ); nếu chưa, xem luồng thay thế A1.
3. Hệ thống và dịch vụ thanh toán mock đang hoạt động.

## 3. Hậu điều kiện
- **Thành công:** đơn ở trạng thái PAID, có mã đơn; reservation CONSUMED; PaymentAttempt SUCCESS lưu với payment Idempotency-Key; giỏ hàng được làm trống; hiển thị màn hình xác nhận.
- **Thất bại thanh toán đã xác nhận:** đơn ở trạng thái PAYMENT_FAILED; reservation RELEASED và tồn kho phục hồi; giỏ hàng giữ nguyên; retry cần payment key mới.
- **Kết quả chưa rõ:** payment attempt UNKNOWN, reservation PAYMENT_PENDING được giữ; khách reconcile bằng payment key cũ.
- **Thất bại khác (hết hàng, dữ liệu sai):** không tạo đơn, không trừ tồn kho, giỏ hàng giữ nguyên.

## 4. Luồng chính (Main flow)
1. Khách bấm "Thanh toán" tại giỏ hàng; UI hiển thị tổng tiền và các phương thức (Ví điện tử / Thẻ ngân hàng).
2. Khách chọn phương thức và xác nhận.
3. UI sinh **order Idempotency-Key** và gọi `POST /orders` kèm JWT và nội dung giỏ hàng.
4. API kiểm tra JWT và validate dữ liệu.
5. API mở transaction, khóa Product, kiểm tra tồn kho, tính lại giá phía server, giảm tồn kho, tạo Order (PENDING), OrderItem và reservation HELD; commit và trả mã đơn.
6. UI sinh **payment Idempotency-Key riêng** và gọi `POST /payments` với mã đơn, phương thức, JWT và key đó.
7. API xác minh quyền sở hữu đơn; trong transaction tạo PaymentAttempt PROCESSING và chuyển reservation sang PAYMENT_PENDING; sau commit mới gọi Payment Gateway (mock).
8. Payment Gateway trả kết quả thành công, thất bại đã xác nhận, hoặc kết quả chưa rõ (timeout/processing).
9. Thành công: API lưu PaymentAttempt SUCCESS, chuyển đơn PAID và reservation CONSUMED trong transaction.
10. Thất bại đã xác nhận: API lưu PaymentAttempt FAILED, chuyển đơn PAYMENT_FAILED, phục hồi tồn kho và release reservation trong transaction. UI giữ cart; lần thử mới cần payment key mới và reservation mới nếu còn hàng.
11. Timeout/kết quả chưa rõ: API lưu UNKNOWN, giữ reservation PAYMENT_PENDING và trả HTTP 202. UI tra cứu `GET /payments/:id` hoặc gửi lại `POST /payments` với cùng payment key để reconcile; không tạo charge mới khi chưa có kết quả cuối.
12. Sau khi xác nhận thành công, UI hiển thị mã đơn/trạng thái và xóa cart.

## 5. Luồng thay thế (Alternative flows)
- **A1 – Chưa đăng nhập (tại bước 1/3):** UI chuyển hướng tới đăng nhập/đăng ký (UC-04); sau khi đăng nhập quay lại giỏ hàng, giữ nội dung giỏ và tiếp tục từ bước 1.
- **A2 – Khách đổi phương thức/hủy (tại bước 2):** khách quay lại giỏ hàng; không tạo đơn.
- **A3 – Gửi lại request do mất response/timeout:** dùng lại payment Idempotency-Key cũ; API tra cứu/replay attempt, không tạo charge mới. Order key và payment key thuộc hai request khác nhau.
- **A4 – Thử lại sau khi payment thất bại đã xác nhận:** tạo payment key mới; API reacquire tồn kho trong transaction. Nếu hàng không còn, trả lỗi và khách cần tạo order mới.
- **A5 – Áp mã khuyến mãi (nếu hiện thực, trước bước 3):** mã hợp lệ làm giảm tổng tiền; mã sai bị từ chối nhưng khách vẫn tiếp tục thanh toán không có mã.

## 6. Luồng ngoại lệ (Exception flows)
- **E1 – Sản phẩm hết hàng / không đủ tồn kho (bước 5):** transaction rollback; API trả lỗi; UI báo sản phẩm hết hàng và đề nghị chỉnh giỏ hàng; không tạo đơn.
- **E2 – Dữ liệu không hợp lệ (bước 4):** API trả 400 kèm chi tiết; UI hiển thị lỗi cạnh trường liên quan.
- **E3 – JWT thiếu/hết hạn (bước 4):** API trả 401; UI chuyển tới đăng nhập (như A1).
- **E4 – Thanh toán thất bại có xác nhận (bước 8):** API trả kết quả terminal FAILED, chuyển đơn PAYMENT_FAILED và release reservation/khôi phục tồn kho; UI báo lỗi, giữ giỏ. Retry là payment attempt mới với key mới.
- **E5 – Payment Gateway không phản hồi/timeout (bước 7):** kết quả là UNKNOWN, không coi là FAILED, không release reservation. API trả 202; khách tra cứu/retry cùng key tới khi gateway có kết quả cuối.
- **E6 – Lỗi hệ thống (DB/API):** API trả 5xx; transaction rollback; UI hiển thị lỗi chung và cho phép thử lại.

## 7. Hệ thống làm gì / không làm gì
**Làm:** xác thực người dùng, validate, tính giá phía server, tạo đơn và trừ tồn kho trong transaction, gọi cổng mock, bảo đảm idempotent, cập nhật trạng thái đơn, hiển thị xác nhận.
**Không làm:** thanh toán bằng tiền thật/cổng thật, hoàn tiền, giao hàng, xử lý pha chế (PREPARING/READY/COMPLETED thuộc phần mở rộng), quản trị cửa hàng.

## 8. Sơ đồ use-case phạm vi UC-05
```plantuml
@startuml
left to right direction
actor "Khách hàng" as Customer
actor "Payment Gateway (Mock)" as Pay
rectangle "UC-05: Đặt và thanh toán đơn hàng" {
  usecase "Xác nhận giỏ hàng & chọn phương thức" as P1
  usecase "Tạo đơn (PENDING) & trừ tồn kho" as P2
  usecase "Thanh toán Ví/Thẻ" as P3
  usecase "Xem xác nhận đơn" as P4
  usecase "Đăng nhập" as L
  usecase "Áp mã khuyến mãi" as Promo
}
Customer --> P1
P1 ..> P2 : <<include>>
P1 ..> P3 : <<include>>
P1 ..> P4 : <<include>>
P1 ..> L : <<include>>
Promo ..> P1 : <<extend>>
P3 --> Pay
@enduml
```

## 9. Tiêu chí chấp nhận và gợi ý test
| Mã | Kịch bản | Kết quả mong đợi | Loại test |
|:--|:--|:--|:--|
| T-UC05-01 | Happy path: giỏ hợp lệ, đã đăng nhập, thanh toán thành công | Đơn PAID, hiển thị mã đơn, giỏ trống | E2E |
| T-UC05-02 | Chưa đăng nhập bấm Thanh toán | Chuyển tới đăng nhập, giỏ giữ nguyên | E2E/component |
| T-UC05-03 | Sản phẩm hết hàng | Không tạo đơn, báo lỗi, giỏ giữ nguyên | Integration |
| T-UC05-04 | Cổng mock trả lỗi | Đơn PAYMENT_FAILED, giỏ giữ nguyên, cho thử lại | Integration |
| T-UC05-05 | Gửi 2 lần cùng Idempotency-Key | Chỉ một Payment/đơn | Integration |
| T-UC05-06 | Hai yêu cầu đồng thời cho lượng tồn cuối | Chỉ một thành công | Integration |
| T-UC05-07 | Dữ liệu sai (qty ≤ 0) | 400, không tạo đơn | Unit/Integration |
| T-UC05-08 | Giá do client gửi bị sửa | Server tính lại, dùng giá đúng | Unit |
| T-UC05-09 | Gateway timeout/kết quả chưa rõ | Attempt UNKNOWN, giữ reservation, reconcile bằng cùng payment key; không charge mới | Integration |

**Lưu ý idempotency cho các kịch bản trên:** order key và payment key thuộc hai request khác nhau. Gửi lại cùng payment key chỉ replay/reconcile attempt; sau FAILED đã xác nhận, retry nghiệp vụ cần payment key mới và reservation mới. Timeout/UNKNOWN không được coi là thất bại đã xác nhận, nên reservation vẫn được giữ.
