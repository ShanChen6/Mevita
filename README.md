# Mevita

Hệ thống Quản lý Hồ sơ Y tế Điện tử, Đặt lịch khám & Chuyển tuyến Thời gian thực.

Xem lộ trình triển khai chi tiết tại [docs/ROADMAP.md](docs/ROADMAP.md).

## Cấu trúc monorepo

```
mevita/
├── apps/
│   ├── web/   # @mevita/web — Next.js (App Router), TailwindCSS, Shadcn/UI
│   └── api/   # @mevita/api — NestJS
├── docs/      # Tài liệu dự án
└── docker-compose.yml  # PostgreSQL local
```

Quản lý bằng **pnpm workspaces**.

## Yêu cầu

- Node.js >= 22 (xem `.nvmrc`)
- pnpm 10 (`corepack enable`)
- Docker (để chạy PostgreSQL local)

## Bắt đầu

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api (kiểm tra: `GET /api/health`)

Điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong `apps/api/.env` để bật lưu trữ ảnh cận lâm sàng. Khi đã cấu hình đúng, `GET /api/health` trả về `"cloudinary": "connected"`.

## Lệnh thường dùng

| Lệnh             | Mô tả                                 |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Chạy song song web và api             |
| `pnpm dev:web`   | Chỉ chạy web                          |
| `pnpm dev:api`   | Chỉ chạy api                          |
| `pnpm build`     | Build toàn bộ                         |
| `pnpm lint`      | ESLint toàn bộ                        |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript              |
| `pnpm test`      | Chạy unit test                        |
| `pnpm format`    | Format code bằng Prettier             |
| `pnpm db:up`     | Khởi động PostgreSQL (Docker Compose) |
| `pnpm db:down`   | Dừng PostgreSQL                       |

## Nhánh làm việc

- `main`: nhánh ổn định, chỉ nhận code đã hoàn thiện từ `develop`.
- `develop`: nhánh phát triển chính, mọi thay đổi được commit tại đây.
