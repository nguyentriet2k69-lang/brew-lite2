# ADR 001 Monorepo và backend phân lớp

Trạng thái: Đã chấp nhận và hiện thực.

## Bối cảnh

Assignment 2 yêu cầu Next.js, NestJS, PostgreSQL, truy vết thiết kế và tích hợp theo PR. Repository hiện có `apps/web`, `apps/api` và `docs`.

## Lựa chọn

Monorepo giúp thay đổi contract và tài liệu trong cùng PR. Nhiều repository tách quyền phát hành tốt hơn nhưng tăng công đồng bộ. Microservices tăng độ phức tạp transaction và vận hành so với quy mô MVP.

## Quyết định

Dùng monorepo `apps/web`, `apps/api`, `docs`; backend modular monolith, phân lớp HTTP → service → TypeORM persistence. Web và API có thể build và triển khai riêng; mỗi ứng dụng có package-lock riêng.

## Hệ quả và kiểm chứng

Giảm công phối hợp nhưng cần tránh module phụ thuộc vòng và chia sẻ tùy tiện chi tiết DB với UI. CI kiểm tra API và web. Cart/auth/checkout UI chưa hoàn thiện; quyết định kiến trúc không đồng nghĩa chức năng đã bàn giao.

Tham chiếu: [overview](../overview.md), NFR-04 và NFR-07 trong [SRS](../../requirements/srs.md).
