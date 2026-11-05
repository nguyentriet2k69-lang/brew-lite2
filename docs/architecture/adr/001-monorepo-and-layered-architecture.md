# ADR 001 Monorepo và backend phân lớp

Trạng thái: Đề xuất. Chủ trì TV3; review TV4, TV5, TV6.

## Bối cảnh

Assignment 2 yêu cầu Next.js, NestJS, PostgreSQL, truy vết thiết kế và tích hợp theo PR. README dự kiến `apps/web` và `apps/api`; hiện chưa có code.

## Lựa chọn

Monorepo giúp thay đổi contract và tài liệu trong cùng PR. Nhiều repository tách quyền phát hành tốt hơn nhưng tăng công đồng bộ. Microservices tăng độ phức tạp transaction và vận hành so với quy mô MVP.

## Quyết định đề xuất

Dùng monorepo `apps/web`, `apps/api`, `docs`; backend modular monolith, phân lớp HTTP → service → persistence. Web và API có thể build và triển khai riêng. TV6 quyết định workspace/package manager khi setup repo.

## Hệ quả và kiểm chứng

Giảm công phối hợp nhưng cần tránh module phụ thuộc vòng và chia sẻ tùy tiện chi tiết DB với UI. TV4/TV5 ánh xạ module vào code; TV6 cung cấp CI cho hai ứng dụng. Chưa có code để nghiệm thu quyết định này.

Tham chiếu: [overview](../overview.md), NFR-04 và NFR-07 trong [SRS](../../requirements/srs.md).
