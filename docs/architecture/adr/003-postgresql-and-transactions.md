# ADR 003 PostgreSQL và transaction nghiệp vụ

Trạng thái: Đề xuất; PostgreSQL là ràng buộc đề bài. Review TV5, TV6.

## Bối cảnh và lựa chọn

FR-05/09 yêu cầu tạo đơn và giảm tồn kho nguyên tử; NFR-06 yêu cầu tái tạo DB. PostgreSQL đáp ứng ràng buộc dữ liệu quan hệ và transaction. Prisma và TypeORM đều là phương án ORM; đề xuất Prisma vì nhóm đã có kinh nghiệm ở AS1, chờ TV5 chọn.

## Quyết định đề xuất

Đặt ràng buộc dữ liệu ở DB, dùng Decimal cho tiền và constraint unique cho khóa chống trùng sau khi chốt contract. Tạo Order/OrderItem và giảm tồn kho trong cùng transaction; update có điều kiện tồn kho đủ và kiểm tra số dòng cập nhật. Không kiểm tra tồn kho ở một request rồi tin kết quả đó cho request sau.

Schema domain kế thừa Class diagram; TV5 ánh xạ enum, thuộc tính và migration sau khi giải quyết các điểm mở. Migration versioned được commit; seed chạy được trên DB trống. Production migration là bước có kiểm soát của release, không dùng reset hay schema push thay lịch sử.

## Hệ quả và kiểm chứng

Transaction tránh bán vượt tồn kho nhưng cần xử lý tranh chấp, lỗi và retry có giới hạn. Index dựa trên truy vấn thực tế; chưa tuyên bố đã tối ưu. Test đồng thời lượng tồn cuối, rollback khi tạo đơn lỗi và migration/seed DB trống. TV6 chốt backup/restore và kiểm tra tương thích migration trước deploy.

Tham chiếu: [SRS](../../requirements/srs.md), [Class](../../diagrams/class-domain.puml).
