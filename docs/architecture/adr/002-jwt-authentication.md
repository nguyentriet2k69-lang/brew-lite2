# ADR 002 Xác thực JWT và mật khẩu băm

Trạng thái: Đã chấp nhận và hiện thực ở API; frontend chưa tích hợp.

## Bối cảnh và lựa chọn

FR-04 yêu cầu đăng ký, đăng nhập, cấp JWT và bảo vệ route đặt đơn; NFR-02 yêu cầu bảo vệ dữ liệu. Session phía server là phương án thông dụng nhưng không thay thế được yêu cầu JWT của bài.

## Quyết định

API băm mật khẩu bằng bcrypt, không trả hash. JWT chứa định danh người dùng, có hạn dùng, thuật toán xác minh được cấu hình rõ; key lấy từ biến môi trường. Guard xác minh JWT trước nghiệp vụ; service tiếp tục kiểm tra quyền sở hữu đơn/payment. Client không được gửi userId để tự chọn chủ đơn.

API cấp access token JWT có hạn dùng và guard xác minh request; bcrypt băm mật khẩu. Web giữ access token trong `sessionStorage` (theo tab, không tồn tại sau khi đóng tab) và gửi Bearer header. Đây là lựa chọn MVP có rủi ro XSS; production cần CSP/XSS hardening và đánh giá lại cookie HttpOnly/SameSite cùng CSRF trước khi xử lý dữ liệu nhạy cảm.

## Hệ quả và kiểm chứng

JWT đơn giản hóa xác thực request nhưng token bị lộ có thể được dùng tới khi hết hạn; thiết kế thu hồi cần bổ sung nếu nhóm yêu cầu. Lưu token phía JavaScript có rủi ro XSS; cookie cần chính sách SameSite/CSRF phù hợp.

Kiểm thử FR-04: email trùng 409, mật khẩu sai 401, JWT thiếu/sai/hết hạn 401, user không được xem hoặc thanh toán đơn của người khác. HTTPS bắt buộc cho production.

Tham chiếu: [SRS](../../requirements/srs.md), [UC-05](../../requirements/uc-checkout-spec.md).
