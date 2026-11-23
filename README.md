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
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000 (đăng nhập bằng tài khoản demo, xem bên dưới)
- API: http://localhost:4000/api (kiểm tra: `GET /api/health`)

`JWT_ACCESS_SECRET` trong `apps/api/.env` và `apps/web/.env.local` **phải giống nhau** (web dùng nó để kiểm tra phiên).

Tài khoản demo (mật khẩu `SEED_DEMO_PASSWORD`, mặc định `Mevita@2026`, chỉ tạo khi không phải production):

| Vai trò                  | Email               |
| ------------------------ | ------------------- |
| Bệnh nhân                | `cuong@mevita.vn`   |
| Bác sĩ Trạm Y tế Xã      | `bs.an@mevita.vn`   |
| Điều dưỡng đi xe         | `dd.hoa@mevita.vn`  |
| Bác sĩ BVĐK Tỉnh Lào Cai | `bs.binh@mevita.vn` |
| Bác sĩ BVĐK Tỉnh Lào Cai | `bs.minh@mevita.vn` |
| Bác sĩ BV Việt Đức       | `bs.duc@mevita.vn`  |
| Quản trị                 | `admin@mevita.vn`   |

Ảnh cận lâm sàng: chưa điền `CLOUDINARY_*` thì API dùng **kho ảnh giả lập** (chỉ khi phát triển); điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong `apps/api/.env` để dùng Cloudinary thật ([chi tiết](docs/clinical-images.md)). Khi đã cấu hình đúng, `GET /api/health` trả về `"cloudinary": "connected"`.

## Lệnh thường dùng

| Lệnh                                                | Mô tả                                           |
| --------------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                          | Chạy song song web và api                       |
| `pnpm dev:web`                                      | Chỉ chạy web                                    |
| `pnpm dev:api`                                      | Chỉ chạy api                                    |
| `pnpm build`                                        | Build toàn bộ                                   |
| `pnpm lint`                                         | ESLint toàn bộ                                  |
| `pnpm typecheck`                                    | Kiểm tra kiểu TypeScript                        |
| `pnpm test`                                         | Chạy unit test                                  |
| `pnpm format`                                       | Format code bằng Prettier                       |
| `pnpm db:up`                                        | Khởi động PostgreSQL (Docker Compose)           |
| `pnpm db:down`                                      | Dừng PostgreSQL                                 |
| `pnpm db:migrate`                                   | Chạy migration (Prisma)                         |
| `pnpm db:seed`                                      | Nạp danh mục: 34 tỉnh, 3.321 xã, 25 chuyên khoa |
| `pnpm db:studio`                                    | Mở Prisma Studio                                |
| `pnpm --filter @mevita/api icd10:import <file.csv>` | Nhập bảng ICD-10 chính thức                     |

## Tài liệu

- [Lộ trình triển khai](docs/ROADMAP.md)
- [Thiết kế CSDL & ERD](docs/database.md)
- [Danh mục hành chính 2 cấp](docs/administrative-units.md)
- [Cấu trúc giao diện 3 phân hệ](docs/ui-structure.md)
- [Xác thực & phân quyền](docs/auth.md)
- [Cổng bệnh nhân](docs/patient-portal.md)
- [Đặt lịch khám](docs/appointments.md)
- [Tra cứu & tiếp nhận bệnh nhân](docs/patient-lookup.md)
- [Khám bệnh, ICD-10 & ký hồ sơ](docs/medical-records.md)
- [Ảnh cận lâm sàng (Cloudinary)](docs/clinical-images.md)
- [Kiến trúc real-time (Socket.io)](docs/realtime.md)
- [Lệnh chuyển tuyến khẩn cấp](docs/referrals.md)
- [Sinh tồn trên xe chuyển viện (offline-first)](docs/escort-vitals.md)

## Nhánh làm việc

- `main`: nhánh ổn định, chỉ nhận code đã hoàn thiện từ `develop`.
- `develop`: nhánh phát triển chính, mọi thay đổi được commit tại đây.
