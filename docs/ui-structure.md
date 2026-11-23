# Cấu trúc giao diện (Task 1.4)

Frontend `apps/web` (Next.js 16 App Router) chia thành **3 phân hệ** bằng Route Groups. Mỗi phân hệ có layout riêng (sidebar trên desktop, menu trượt trên điện thoại) và màu nhận diện riêng.

```
src/app/
├── page.tsx                         # Trang giới thiệu
├── (auth)/login                     # Đăng nhập + lối vào nhanh 3 phân hệ (demo)
├── (patient)/patient/…              # Cổng Bệnh nhân          — màu xanh y tế
├── (commune)/commune/…              # Trạm Y tế Xã            — màu xanh lá
├── (commune)/escort/[referralId]    # Màn hình trên xe cứu thương (mobile, không sidebar)
└── (province)/province/…            # Bệnh viện Tuyến Tỉnh    — màu đỏ cấp cứu
```

## Sơ đồ màn hình

| Phân hệ    | Đường dẫn                   | Màn hình                                                      | Task     |
| ---------- | --------------------------- | ------------------------------------------------------------- | -------- |
| Chung      | `/login`                    | Đăng nhập                                                     | 2.1      |
| Bệnh nhân  | `/patient`                  | Tổng quan: lịch hẹn sắp tới, lần khám gần nhất                | 2.2      |
|            | `/patient/appointments/new` | Đặt lịch 3 bước: Nơi khám → Chuyên khoa & giờ → Triệu chứng   | 2.3      |
|            | `/patient/appointments`     | Lịch hẹn của tôi                                              | 2.3      |
|            | `/patient/records`          | Lịch sử khám bệnh dạng timeline                               | 2.2      |
|            | `/patient/profile`          | Hồ sơ sức khoẻ: CCCD, BHYT, địa chỉ 2 cấp, dị ứng             | 2.2      |
| Tuyến Xã   | `/commune`                  | Tổng quan ca trực                                             | —        |
|            | `/commune/appointments`     | Tiếp đón: duyệt / huỷ / tạo phiếu khám                        | 2.3      |
|            | `/commune/patients`         | Tra cứu nhanh theo CCCD / BHYT / mã lịch hẹn                  | 3.1      |
|            | `/commune/encounters/new`   | Phiếu khám: sinh tồn, ICD-10, đơn thuốc, ảnh, ký              | 3.2, 3.3 |
|            | `/commune/referrals`        | Ca đã chuyển tuyến, huỷ lệnh, chi tiết `/[id]`                | 4.2      |
|            | `/commune/referrals/new`    | Lệnh chuyển tuyến khẩn cấp (`?record=` từ phiếu khám)         | 4.2      |
|            | `/commune/vehicles`         | Xe chuyển viện của trạm                                       | C        |
|            | `/escort/[referralId]`      | Cập nhật sinh tồn trên xe (mobile, offline-first, cả 2 tuyến) | 4.3      |
| Tuyến Tỉnh | `/province`                 | Trung tâm điều phối: ca đang tới, cập nhật realtime           | 4.2, 4.4 |
|            | `/province/referrals`       | Ca chuyển tuyến tới & ca bệnh viện chuyển đi (liên tỉnh)      | 4.2      |
|            | `/province/referrals/[id]`  | Chi tiết ca, đếm ngược; xác nhận ê-kíp & biểu đồ sinh tồn     | 4.2, 4.4 |
|            | `/province/appointments`    | Lịch hẹn khám chuyên khoa                                     | 2.3      |
|            | `/province/records`         | Hồ sơ điều trị tiếp nối                                       | 5.1      |
|            | `/province/vehicles`        | Xe chuyển viện của bệnh viện, yêu cầu xe đón trên Tổng quan   | C        |
| Quản trị   | `/admin`                    | Thống kê: đặt lịch, chuyển tuyến, mô hình bệnh tật            | 5.2      |
|            | `/admin/users`              | Tài khoản: tìm kiếm, khoá / mở khoá                           | 5.2      |
|            | `/admin/audit`              | Nhật ký truy cập                                              | 5.2      |

## Ghi chú

- Mọi màn hình đều dùng **dữ liệu thật** từ API (dữ liệu mẫu wireframe của Task 1.4 đã được thay hết; `src/lib/mock-data.ts` đã xoá ở Task 5.1).
- Nhãn tiếng Việt của các enum (trạng thái lịch hẹn, mức độ ưu tiên…) nằm ở `src/lib/labels.ts`, bám theo Prisma schema.
- Thời gian hiển thị theo múi giờ `Asia/Ho_Chi_Minh` (`src/lib/format.ts`).
- Bảo vệ route theo vai trò: xem [docs/auth.md](auth.md).
