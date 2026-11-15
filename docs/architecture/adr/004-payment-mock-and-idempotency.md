# ADR 004 Payment mock và chống xử lý trùng

Trạng thái: Đã chấp nhận và hiện thực ở API; gateway là mock.

## Bối cảnh và lựa chọn

FR-06 và UC-05 yêu cầu Ví/Thẻ mô phỏng, success/fail và Idempotency-Key. Tích hợp gateway thật nằm ngoài scope. Mock service riêng tăng công triển khai; mock adapter trong NestJS đáp ứng mục tiêu học phần với ít thành phần hơn.

## Quyết định

Payments service phụ thuộc interface gateway; implementation local mô phỏng success/fail theo cấu hình server. Không nhận kết quả giao dịch hoặc số tiền quyết định bởi client. Mock không xử lý thẻ thật và không lưu PAN/CVV.

`POST /orders` dùng key theo user và fingerprint của cart để replay cùng yêu cầu, từ chối cùng key với nội dung khác. `POST /payments` dùng key riêng theo order và fingerprint của order/method; unique constraint và khóa order bảo vệ cạnh tranh đồng thời. Mọi lần đọc/replay đều kiểm tra quyền sở hữu order.

Retry sau FAILED đã xác nhận là thao tác mới: cần key mới và reacquire stock. Khi gateway timeout hoặc kết quả chưa rõ, payment attempt ở trạng thái UNKNOWN, giữ reservation PAYMENT_PENDING và phải reconcile bằng key cũ qua gateway lookup; không tạo charge mới cho tới khi xác định kết quả.

## Hệ quả

Mock cho phép test ổn định nhưng không chứng minh xử lý đối soát, webhook hay hoàn tiền của gateway thật. Test success, fail, retry mất response, key xung đột và hai request đồng thời.

Tham chiếu: [UC-05](../../requirements/uc-checkout-spec.md), [Sequence](../../diagrams/sequence-checkout.puml).
