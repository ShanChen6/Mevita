# Danh mục Hành chính 2 cấp (Task 1.2)

Mevita dùng mô hình chính quyền địa phương **2 cấp** (Tỉnh → Xã, không qua cấp Huyện).

## Số liệu hiện tại

| Cấp  | Loại                            | Số lượng  |
| ---- | ------------------------------- | --------- |
| Tỉnh | Thành phố trực thuộc Trung ương | 9         |
| Tỉnh | Tỉnh                            | 25        |
|      | **Tổng cấp Tỉnh**               | **34**    |
| Xã   | Phường                          | 709       |
| Xã   | Xã                              | 2.599     |
| Xã   | Đặc khu                         | 13        |
|      | **Tổng cấp Xã**                 | **3.321** |

9 thành phố trực thuộc Trung ương: Hà Nội, Quảng Ninh, Bắc Ninh, Hải Phòng, Huế, Đà Nẵng, Đồng Nai, TP. Hồ Chí Minh, Cần Thơ.

> Roadmap ban đầu ghi "6 TP + 28 Tỉnh" theo thời điểm 01/07/2025. Sau đó Đồng Nai, Quảng Ninh
> (NQ 36/2026/QH16) và Bắc Ninh (NQ 39/2026/QH16) đã được nâng lên thành phố trực thuộc Trung ương.
> Tổng số 34 tỉnh/thành và 3.321 xã không đổi.

## Nguồn dữ liệu

- Repo: [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database) — giấy phép **MIT** (bản sao tại `apps/api/prisma/data/LICENSE`).
- Phiên bản: **v5.2.0**, cập nhật đến **Nghị quyết 388/NQ-UBTVQH16** (20/09/2026).
- Nền tảng: **Quyết định 19/2025/QĐ-TTg** — Bảng danh mục và mã số các đơn vị hành chính Việt Nam (Tổng cục Thống kê), hiệu lực 01/07/2025.
- Mã tỉnh (2 chữ số) và mã xã (5 chữ số) là **mã chính thức** của Nhà nước.

Chi tiết phiên bản và commit nguồn: `apps/api/prisma/data/metadata.json`.

## Cấu trúc dữ liệu

```
Province (provinces)              Commune (communes)
──────────────────────            ─────────────────────────────
code        VARCHAR(2)  PK  1───N  code          VARCHAR(5)  PK
name, nameEn                       name, nameEn
fullName, fullNameEn               fullName, fullNameEn
codeName (không dấu, unique)       codeName (không dấu, index)
type  MUNICIPALITY | PROVINCE      type  WARD | COMMUNE | SPECIAL_ZONE
                                   provinceCode  FK -> provinces.code (index)
```

`HealthFacilities` và địa chỉ bệnh nhân (Task 1.3) sẽ tham chiếu `communes.code` (từ đó suy ra tỉnh).

## Nạp dữ liệu

```bash
pnpm db:up        # khởi động PostgreSQL
pnpm db:migrate   # tạo bảng
pnpm db:seed      # nạp 34 tỉnh + 3.321 xã (chạy lại an toàn)
```

Seed chỉ **thêm mới** và **cập nhật** bản ghi thay đổi; không xoá xã đã có trong DB (để không phá liên kết với cơ sở y tế, bệnh nhân) mà chỉ cảnh báo.

## API tra cứu

| Endpoint                                          | Mô tả                                              |
| ------------------------------------------------- | -------------------------------------------------- |
| `GET /api/provinces?q=&type=`                     | Danh sách tỉnh/thành, kèm số xã                    |
| `GET /api/provinces/:code`                        | Chi tiết một tỉnh/thành                            |
| `GET /api/provinces/:code/communes?q=&type=`      | Toàn bộ xã/phường của một tỉnh (dùng cho dropdown) |
| `GET /api/communes?q=&provinceCode=&type=&limit=` | Tìm xã/phường toàn quốc (mặc định 50 kết quả)      |
| `GET /api/communes/:code`                         | Chi tiết xã/phường kèm tỉnh/thành                  |

Tìm kiếm chấp nhận có dấu (`Mường Khương`), không dấu (`muong khuong`) hoặc kèm loại (`xã mường khương`).

## Cập nhật khi có Nghị quyết mới

1. Tải `postgresql/postgres_ImportData_vn_units.sql` bản mới từ repo nguồn.
2. Nạp vào một PostgreSQL tạm, xuất lại `provinces.json` / `communes.json` theo đúng định dạng hiện có.
3. Cập nhật `metadata.json`, chạy `pnpm db:seed`.
