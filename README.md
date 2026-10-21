# BrewLite – Ứng dụng đặt cà phê không dùng tiền mặt

Web app mobile-first/PWA cho phép khách hàng xem menu, chọn size/topping, quản lý giỏ hàng, đặt đơn, thanh toán mô phỏng (Ví/Thẻ) và theo dõi đơn hàng.

> Môn Công nghệ Phần mềm – Assignment 2 – Nhóm 6.

## Liên kết nhanh

| Mục | Liên kết |
|:--|:--|
| Frontend (production, HTTPS) | `https://<TODO-frontend-url>` |
| API (production) | `https://<TODO-api-url>` |
| Health check | `https://<TODO-api-url>/health` |
| Video demo | `<TODO>` |
| Release notes | `docs/release-notes.md` |

## Công nghệ

| Thành phần | Công nghệ |
|:--|:--|
| Frontend | Next.js (mobile-first/PWA) |
| Backend | NestJS |
| Cơ sở dữ liệu | PostgreSQL |
| Đóng gói | Docker, Docker Compose |
| CI/CD | GitHub Actions |

## Luồng nghiệp vụ

Xem menu → Chọn size/topping → Giỏ hàng → Đặt đơn → Thanh toán (mock) → Theo dõi đơn.

## Cấu trúc repository

```
brewlite/
├── apps/
│   ├── web/                  # Next.js
│   └── api/                  # NestJS
├── docs/
│   ├── requirements/         # context-and-scope, srs, uc-checkout-spec
│   ├── diagrams/             # .puml + .svg (use-case, activity, sequence, class, deployment)
│   ├── architecture/         # overview.md, adr/
│   ├── traceability-matrix.md
│   └── deployment.md
├── tests/                    # integration + E2E
├── .github/workflows/        # ci.yml, cd.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

## Yêu cầu môi trường

- Node.js >= 20 và npm (hoặc pnpm)
- Docker và Docker Compose v2
- Git

## Chạy local

### Cách 1: Docker Compose (khuyến nghị)

```bash
git clone https://github.com/<TODO-org>/brewlite.git
cd brewlite
cp .env.example .env          # chỉnh giá trị nếu cần
docker compose up --build
```

Sau khi chạy:

| Dịch vụ | Địa chỉ |
|:--|:--|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Health | http://localhost:3001/health |

Migration và seed dữ liệu mẫu: `docker compose exec api npm run migration:run && docker compose exec api npm run seed`
(đổi tên script cho khớp `apps/api/package.json`).

### Cách 2: Chạy từng phần

```bash
# Database
docker compose up -d db

# Backend
cd apps/api
npm install
npm run migration:run
npm run seed
npm run start:dev

# Frontend (terminal khác)
cd apps/web
npm install
npm run dev
```

## Biến môi trường

Chỉ commit `.env.example`; **không** commit `.env` hoặc secret thật.

| Biến | Mô tả | Ví dụ |
|:--|:--|:--|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | `postgresql://brewlite:brewlite@db:5432/brewlite` |
| `JWT_SECRET` | Khóa ký JWT | `change-me` |
| `JWT_EXPIRES_IN` | Thời hạn token | `1d` |
| `NEXT_PUBLIC_API_URL` | URL API cho frontend | `http://localhost:3001` |
| `PORT` | Cổng API | `3001` |

(Cập nhật bảng này cho khớp `.env.example` thực tế.)

## API chính

| Method | Endpoint | Mô tả | Xác thực |
|:--|:--|:--|:--|
| GET | `/products` | Danh sách sản phẩm | Không |
| GET | `/products/:id` | Chi tiết sản phẩm | Không |
| POST | `/auth/register` | Đăng ký | Không |
| POST | `/auth/login` | Đăng nhập, trả JWT | Không |
| POST | `/orders` | Tạo đơn (PENDING) | JWT |
| POST | `/payments` | Thanh toán mock, header `Idempotency-Key` | JWT |
| GET | `/orders/me` | Lịch sử đơn của tôi | JWT |
| GET | `/health` | Kiểm tra sức khỏe hệ thống | Không |

## Kiểm thử

```bash
# Unit test
cd apps/api && npm test
cd apps/web && npm test

# Integration test (cần DB test chạy)
npm run test:integration

# E2E (menu -> xác nhận đơn)
npm run test:e2e

# Lint và build
npm run lint
npm run build
```

Ánh xạ yêu cầu – test: xem `docs/traceability-matrix.md`.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): chạy khi mở/cập nhật PR: Install → Lint → Unit Test → Build. PR không được merge nếu CI fail.
- **CD** (`.github/workflows/cd.yml`): chạy khi push `main` hoặc tag: Lint/Test → Build → Build image → Push registry → Deploy → Smoke test. Pipeline dừng nếu bất kỳ bước nào fail.
- Secret lưu trong GitHub Secrets/biến môi trường của nền tảng, không nằm trong repo hoặc log.

## Triển khai và Rollback

Chi tiết: `docs/deployment.md`. Nền tảng triển khai: `<TODO: Render / Railway / Fly.io / VPS>`.

**Rollback (tóm tắt):**
1. Xác định phiên bản ổn định gần nhất (tag hoặc image tag).
2. Triển khai lại image/tag đó trên nền tảng (hoặc `git revert` rồi chạy CD).
3. Nếu migration gây lỗi, chạy migration đảo (`migration:revert`) trước khi chạy lại app. Ưu tiên migration tương thích ngược.
4. Chạy smoke test: `/health` trả 200 và luồng menu hoạt động.

## Tài liệu

| Tài liệu | Đường dẫn |
|:--|:--|
| Bối cảnh, stakeholder, phạm vi | `docs/requirements/context-and-scope.md` |
| SRS rút gọn (FR/NFR/MoSCoW/AC) | `docs/requirements/srs.md` |
| Đặc tả UC-05 | `docs/requirements/uc-checkout-spec.md` |
| Sơ đồ UML, deployment | `docs/diagrams/` |
| Kiến trúc và ADR | `docs/architecture/` |
| Ma trận truy vết | `docs/traceability-matrix.md` |

## Quy trình làm việc nhóm

- **Nhánh:** `main` (production) ← `develop` ← `feature/*` hoặc `fix/*`. Không push trực tiếp vào `main`/`develop`.
- **Commit:** `type(scope): message`, ví dụ `feat(api): add GET /products`. Các type: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`.
- **Pull request:** mô tả, liên kết issue, checklist DoD, ảnh minh họa nếu có UI; cần ít nhất 1 người review (không phải tác giả).
- **Definition of Done:** code chạy, test pass, lint pass, tài liệu và ma trận truy vết cập nhật, đạt AC, đã review.

## Nhóm thực hiện

| TV | Họ tên | Vai trò |
|:--|:--|:--|
| TV1 | `<TODO>` | Requirements Owner |
| TV2 | `<TODO>` | Modeling Owner |
| TV3 | `<TODO>` | Architecture Owner |
| TV4 | `<TODO>` | Frontend Owner |
| TV5 | `<TODO>` | Backend Owner |
| TV6 | `<TODO>` | DevOps & Quality Owner |

## Checklist nộp bài

- [ ] Requirements + SRS
- [ ] Use-case diagram + đặc tả UC-05
- [ ] Activity diagram (hết hàng, chưa đăng nhập, thanh toán thất bại)
- [ ] Sequence diagram (JWT, transaction, alt, Idempotency-Key)
- [ ] Class diagram domain
- [ ] Kiến trúc + ADR
- [ ] Deployment diagram khớp nền tảng thực tế
- [ ] Repository đúng cấu trúc + tài liệu
- [ ] MVP Sprint 1 (menu chạy được)
- [ ] CI + minh chứng success/fail
- [ ] MVP Sprint 2 end-to-end
- [ ] Unit + Integration + ≥ 1 E2E
- [ ] `docker compose up` chạy được
- [ ] Migration/seed tái tạo DB + `/health`
- [ ] CD pipeline đầy đủ
- [ ] URL frontend production HTTPS
- [ ] URL API + health check
- [ ] Database không public trực tiếp
- [ ] Secret không nằm trong repo/log
- [ ] Release notes + README + rollback
- [ ] Video demo end-to-end
- [ ] Sprint Review + Retrospective
- [ ] Ma trận truy vết đầy đủ
- [ ] Lịch sử Git rõ ràng + cấp quyền truy cập cho giảng viên
