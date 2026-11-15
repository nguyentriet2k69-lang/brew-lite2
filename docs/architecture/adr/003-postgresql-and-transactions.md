# ADR 003 PostgreSQL và transaction nghiệp vụ

Trạng thái: Đã chấp nhận và hiện thực bằng PostgreSQL + TypeORM.

## Bối cảnh và lựa chọn

FR-05/09 yêu cầu tạo đơn và giảm tồn kho nguyên tử; NFR-06 yêu cầu tái tạo DB. PostgreSQL đáp ứng ràng buộc dữ liệu quan hệ và transaction; TypeORM là ORM hiện được sử dụng trong NestJS API.

## Quyết định

Dùng TypeORM entities/migrations, PostgreSQL constraints/indexes, numeric nguyên VND an toàn và unique constraint cho idempotency. Tạo Order/OrderItem và reservation, giảm stock trong cùng transaction với khóa Product; payment success/failure cập nhật attempt/order/reservation trong transaction riêng. Không kéo transaction DB qua lời gọi gateway.

Schema domain dùng các entity hiện hành; migration versioned được commit; seed chạy trên DB trống. Production migration là bước có kiểm soát của release, không dùng reset hay schema push thay lịch sử.

## Hệ quả và kiểm chứng

Transaction tránh bán vượt tồn kho nhưng cần xử lý tranh chấp, lỗi và retry có giới hạn. Index dựa trên truy vấn thực tế; chưa tuyên bố đã tối ưu. Test đồng thời lượng tồn cuối, rollback khi tạo đơn lỗi và migration/seed DB trống. Trước deploy cần kiểm tra tính tương thích của migration và khả năng khôi phục DB.

Tham chiếu: [SRS](../../requirements/srs.md), [Class](../../diagrams/class-domain.puml).
