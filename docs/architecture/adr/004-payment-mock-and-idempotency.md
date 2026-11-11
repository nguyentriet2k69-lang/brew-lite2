# ADR 004 Payment mock và chống xử lý trùng

Trạng thái: Đề xuất thiết kế; cần thống nhất contract thanh toán.

## Bối cảnh và lựa chọn

FR-06 và UC-05 yêu cầu Ví/Thẻ mô phỏng, success/fail và Idempotency-Key. Tích hợp gateway thật nằm ngoài scope. Mock service riêng tăng công triển khai; mock adapter trong NestJS đáp ứng mục tiêu học phần với ít thành phần hơn.

## Quyết định đề xuất

Payments service phụ thuộc interface gateway; implementation local mô phỏng success/fail theo cấu hình server. Không nhận kết quả giao dịch hoặc số tiền quyết định bởi client. Mock không xử lý thẻ thật và không lưu PAN/CVV.

Với `POST /payments`, cùng key và cùng nội dung nghiệp vụ trả lại kết quả đã có; cùng key với order/phương thức khác bị từ chối theo API contract. Unique constraint bảo vệ cạnh tranh đồng thời, kết hợp transaction lưu payment và cập nhật Order. Kiểm tra quyền sở hữu phải được thực hiện cả khi trả kết quả cache theo key.

Một lần thử lại sau kết quả FAILED đã được ghi nhận là thao tác nghiệp vụ mới, cần chính sách key mới; retry do mất response dùng lại key cũ. Timeout có thể có kết quả chưa rõ, không được mặc định tạo giao dịch mới.

## Điểm mở và hệ quả

UC-05 đang mô tả retry cùng key cho cả timeout và thất bại; Class có `Order.idempotencyKey` và quan hệ Payment `0..1`. Cần phân biệt chống tạo đơn trùng với chống payment trùng và thống nhất cách lưu các lần thanh toán lại trong đặc tả use-case và class diagram.

Mock cho phép test ổn định nhưng không chứng minh xử lý đối soát, webhook hay hoàn tiền của gateway thật. Test success, fail, retry mất response, key xung đột và hai request đồng thời.

Tham chiếu: [UC-05](../../requirements/uc-checkout-spec.md), [Sequence](../../diagrams/sequence-checkout.puml).
