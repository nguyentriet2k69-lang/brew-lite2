# BrewLite – Bối cảnh, Stakeholder và Phạm vi (Task 1.1)

## 1. Vấn đề nghiệp vụ

Khách hàng tại quầy cà phê thường phải xếp hàng để gọi món và thanh toán bằng tiền mặt, làm tăng thời gian chờ và dễ sai sót khi ghi đơn. **BrewLite** là web app mobile-first/PWA cho phép khách xem menu, chọn size/topping, quản lý giỏ hàng, đặt đơn và thanh toán không dùng tiền mặt (mô phỏng), sau đó theo dõi trạng thái đơn.

**Product Vision:** BrewLite giúp khách hàng đặt và thanh toán đồ uống không dùng tiền mặt chỉ trong vài chạm, giảm thời gian xếp hàng và nhận đơn nhanh tại quầy.

**Luồng nghiệp vụ tối thiểu:** Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn.

## 2. Stakeholder

| Stakeholder | Vai trò | Mục tiêu / Kỳ vọng | Mức ảnh hưởng |
|:--|:--|:--|:--|
| Khách hàng (Customer) | Người dùng cuối | Đặt đồ uống nhanh, tùy chọn size/topping, thanh toán không tiền mặt, theo dõi trạng thái đơn | Cao |
| Nhân viên quầy / Barista | Người xử lý đơn | Tiếp nhận đơn và cập nhật trạng thái pha chế (**ngoài MVP**, phần mở rộng) | Trung bình |
| Quản lý cửa hàng / Product Owner | Chủ sản phẩm | Xác định yêu cầu, ưu tiên backlog, nghiệm thu Increment sau mỗi Sprint | Cao |
| Giảng viên / Khách hàng nghiệm thu | Người chấm | Đánh giá quy trình, sản phẩm, mức đáp ứng tiêu chí Assignment 2 | Cao |
| Nhóm phát triển (Development Team) | Sinh viên thực hiện | Phân tích, thiết kế, lập trình, kiểm thử, triển khai và bàn giao | Cao |
| Đơn vị thanh toán (Payment Provider) | Dịch vụ bên ngoài | Xử lý giao dịch Ví/Thẻ; trong bài được **mô phỏng bằng mock** | Trung bình |

## 3. Phạm vi

### 3.1 Trong phạm vi MVP (In-scope)
- Đăng ký, đăng nhập (JWT, mật khẩu băm).
- Xem menu, xem chi tiết sản phẩm, chọn size (S/M/L) và topping.
- Quản lý giỏ hàng (thêm/sửa số lượng/xóa, tự tính tổng).
- Tạo đơn hàng (PENDING) và thanh toán Ví/Thẻ mô phỏng, có Idempotency-Key.
- Hiển thị xác nhận đơn, trạng thái đơn và lịch sử đơn.
- Validate dữ liệu ở frontend và backend; xử lý loading/empty/error.
- Docker Compose, CI/CD, triển khai production qua HTTPS, health check.

### 3.2 Phạm vi mở rộng (Could / sau MVP)
- Barista/nhân viên quầy cập nhật trạng thái pha chế (PREPARING, READY, COMPLETED).
- Khuyến mãi (Promotion) và điểm thưởng (Loyalty) – có thể hiện thực một phần, đề không bắt buộc đầy đủ trong Assignment 2.
- Kiểm soát tồn kho đồng thời nâng cao (optimistic locking).

### 3.3 Ngoài phạm vi (Out-of-scope / Won't)
- Admin Dashboard quản trị cửa hàng.
- Tích hợp cổng thanh toán thật (VNPay/MoMo/Stripe thật); chỉ dùng mock.
- Ứng dụng native iOS/Android (chỉ web mobile-first/PWA).
- Giao hàng tận nơi, quản lý nhiều chi nhánh.

## 4. Giả định
- Người dùng có thiết bị di động hoặc trình duyệt hiện đại và kết nối Internet ổn định.
- Cổng thanh toán là mock, luôn phản hồi trong thời gian hợp lý (có thể giả lập lỗi để kiểm thử).
- Dữ liệu menu và tồn kho được nạp qua seed/migration.
- Nền tảng triển khai miễn phí/giá thấp có thể thay đổi; nhóm tự chốt nền tảng (chưa mặc định free tier khả dụng).

## 5. Ràng buộc
- Công nghệ bắt buộc: **Next.js** (mobile-first/PWA), **NestJS**, **PostgreSQL**, **Docker**; được bổ sung công nghệ khác nhưng không thay thế ba thành phần đầu.
- Thực hiện tuần tự 5 task; task sau chỉ được nghiệm thu khi tạo phẩm task trước đã có trên repository kèm lịch sử commit rõ ràng.
- Mọi thay đổi tài liệu/sơ đồ đi qua commit/pull request; secret không được nằm trong repository hoặc log CI.
- Phải có URL production HTTPS hoạt động tại thời điểm chấm.

## 6. Rủi ro ban đầu

| Mã | Rủi ro | Khả năng | Tác động | Biện pháp giảm thiểu |
|:--|:--|:--|:--|:--|
| R-01 | Nền tảng deploy miễn phí hết hạn/ngừng dịch vụ | Trung bình | Cao | Chốt platform sớm, có phương án dự phòng (VPS) |
| R-02 | Chậm tiến độ do task phụ thuộc tuần tự | Cao | Cao | Chốt SRS/UC-05 sớm, review chéo, họp ngắn hằng tuần |
| R-03 | Tài liệu, sơ đồ và code mâu thuẫn nhau | Trung bình | Trung bình | Ma trận truy vết cập nhật trong cùng PR |
| R-04 | Lỗi thanh toán lặp/đơn trùng | Trung bình | Cao | Idempotency-Key + integration test |
| R-05 | Lỗi tích hợp FE–BE cuối kỳ | Trung bình | Cao | Chốt API contract sớm, docker-compose chạy local thường xuyên |
| R-06 | Lộ secret trong repo/log | Thấp | Cao | Chỉ commit `.env.example`, dùng GitHub Secrets |
