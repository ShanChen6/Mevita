# Dữ liệu mẫu & kịch bản demo (Task 6.2)

## Các lớp dữ liệu

| Lớp              | Lệnh                                              | Nội dung                                                                               |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Danh mục         | `pnpm db:seed`                                    | 34 tỉnh/thành và 3.321 xã/phường (sau sáp nhập 2025), 25 chuyên khoa, ICD-10           |
| Mạng lưới demo   | `pnpm db:seed`                                    | 5 cơ sở y tế, 9 tài khoản, 4 xe, số giường, lịch sử khám của bệnh nhân demo            |
| Kịch bản ca bệnh | `pnpm db:seed` (lần đầu), `demo:reset` (dựng lại) | 7 bệnh nhân, 5 phiếu chuyển tuyến, 9 hồ sơ, 5 lịch hẹn, sinh tồn trên xe, lộ trình GPS |
| Số liệu thống kê | `pnpm --filter @mevita/api sim:stats`             | 180 ngày giả lập ở 7 tỉnh (mã `SIM…`), chỉ dùng cho dashboard `/admin`                 |

Ở production, mạng lưới demo và kịch bản ca bệnh chỉ tạo khi đặt `SEED_DEMO=true` kèm `SEED_DEMO_PASSWORD`
(xem [deployment.md](deployment.md)). Lệnh `sim:stats` bị chặn ở production. Bệnh viện giả lập của `sim:stats`
không nhận chuyển tuyến (`acceptsReferrals = false`), nên không lẫn vào danh sách gợi ý khi demo.

## Mạng lưới

```
TYT Xã Mường Khương (Lào Cai) ─┐                    ┌─▶ BV Hữu nghị Việt Đức (Hà Nội) — ngoại thần kinh, chấn thương
TYT Xã Bát Xát (Lào Cai) ──────┴─▶ BVĐK Tỉnh Lào Cai ┤
                                                    └─▶ BV Bạch Mai (Hà Nội) — tim mạch, hồi sức; đang quá tải
```

### Số giường

| Cơ sở        | Giường cấp cứu còn trống | Mức tải     |
| ------------ | ------------------------ | ----------- |
| BVĐK Lào Cai | 6/24                     | Đông        |
| BV Việt Đức  | 14/60                    | Bình thường |
| BV Bạch Mai  | 4/80                     | Quá tải     |

### Xe

| Biển số    | Cơ sở            | Loại                  |
| ---------- | ---------------- | --------------------- |
| 24C-008.88 | TYT Mường Khương | Xe bán tải            |
| 24A-115.01 | BVĐK Lào Cai     | Xe cứu thương hồi sức |
| 24A-115.02 | BVĐK Lào Cai     | Xe cứu thương cơ bản  |
| 29A-115.68 | BV Việt Đức      | Xe cứu thương hồi sức |

## Tài khoản

Mật khẩu mặc định khi phát triển là `Mevita@2026`. Ở production, mật khẩu lấy từ `SEED_DEMO_PASSWORD`.

| Email               | Vai trò                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `admin@mevita.vn`   | Quản trị (thống kê, điều phối Sở Y tế)                                  |
| `bs.an@mevita.vn`   | BS. Nguyễn Văn An — TYT Mường Khương                                    |
| `dd.hoa@mevita.vn`  | ĐD. Lý Thị Hoa — TYT Mường Khương, đi kèm trên xe (màn hình điện thoại) |
| `bs.lan@mevita.vn`  | BS. Phạm Thị Lan — TYT Bát Xát                                          |
| `bs.binh@mevita.vn` | BSCKII. Trần Thị Bình — BVĐK Lào Cai, hồi sức cấp cứu                   |
| `bs.minh@mevita.vn` | BSCKI. Lê Văn Minh — BVĐK Lào Cai, ngoại thần kinh                      |
| `bs.duc@mevita.vn`  | TS.BS Hoàng Minh Đức — BV Việt Đức                                      |
| `bs.hai@mevita.vn`  | PGS.TS Đỗ Thanh Hải — BV Bạch Mai                                       |
| `cuong@mevita.vn`   | Bệnh nhân Lò Văn Cường (cổng bệnh nhân)                                 |

## Kịch bản ca bệnh

Mốc thời gian tính theo lúc chạy lệnh, nên dữ liệu luôn trông như vừa xảy ra.

| #   | Bệnh nhân                | Diễn biến                                                                                                                                                                                                                                                                                     | Màn hình nên mở                                                       |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Giàng A Pháo, 38 tuổi    | **3 ngày trước.** Chấn thương sọ não do tai nạn xe máy (S06.5). Trạm chỉ có xe bán tải nên yêu cầu xe đón, BVĐK cử xe 24A-115.01. Có 5 lần đo trên xe (GCS 13 → 11, đồng tử phải giãn), lộ trình GPS theo QL4D. BVĐK mổ lấy máu tụ, hồ sơ tiếp nối đã ký.                                     | `bs.minh` → Ca chuyển tuyến → `DEMO-CT-01`                            |
| 2   | Vàng Thị Mỷ, 30 tuổi     | **Hôm qua.** Ngã cao 4 m, đa chấn thương (T07, tràn khí màng phổi, xuất huyết dưới nhện). BVĐK hết giường hồi sức ngoại thần kinh nên nhận theo hướng **ổn định rồi chuyển tiếp**: dẫn lưu màng phổi, đặt nội khí quản, rồi chuyển xe 24A-115.01 theo cao tốc Nội Bài – Lào Cai lên Việt Đức. | `bs.duc` → `DEMO-CT-03` (dòng thời gian hành trình 2 chặng)           |
| 3   | Hoàng Văn Thắng, 70 tuổi | **5 ngày trước.** Gãy cổ xương đùi, ca thường (ROUTINE). BVĐK chưa triển khai thay khớp nên đề nghị chuyển Việt Đức (không từ chối với lý do "quá tải"). TYT Bát Xát lập lệnh mới, gia đình tự chở.                                                                                           | `bs.binh` → `DEMO-CT-04`; `bs.lan` → danh sách chuyển đi              |
| 4   | Sùng Seo Chư, 32 tuổi    | **Hôm nay, đang chờ.** Tai nạn giao thông, GCS 12, dị ứng Cephalosporin. Phiếu cấp cứu nháp trong hàng đợi TYT Mường Khương.                                                                                                                                                                  | Demo trực tiếp: `bs.an` → Khám bệnh → Chư → **Chuyển tuyến khẩn cấp** |
| 5   | Bé Lù Thị Dung, 6 tuổi   | **Hôm nay.** Viêm phổi (J18.9), SpO2 92%, đã tiếp đón từ lịch hẹn.                                                                                                                                                                                                                            | `bs.an` → Khám bệnh                                                   |
| —   | Lò Văn Cường             | Lịch sử khám 2026 (`DEMO-BA-*`). Có lịch tái khám hôm nay ở TYT và lịch tim mạch ngày mai ở BVĐK.                                                                                                                                                                                             | `cuong` → cổng bệnh nhân                                              |
| —   | Thào Thị Sinh            | Lịch khám thai đang chờ duyệt ở TYT Bát Xát                                                                                                                                                                                                                                                   | `bs.lan` → Lịch hẹn                                                   |

### Gợi ý demo trực tiếp với ca 4

Chuẩn bị 2 thiết bị: laptop đăng nhập `bs.an` và `bs.binh`, điện thoại đăng nhập `dd.hoa`.

1. Mở form chuyển tuyến. Form xếp hạng 3 bệnh viện: BVĐK được gợi ý; Bạch Mai mang nhãn "Quá tải" nhưng vẫn chọn được.
2. Chọn chuyên khoa "Ngoại thần kinh", chọn **Yêu cầu xe đón**, rồi gửi lệnh.
3. BVĐK nhận popup kèm còi báo, cử xe 24A-115.01.
4. Điện thoại `dd.hoa` mở màn hình trên xe, chia sẻ vị trí và nhập sinh tồn. Tắt mạng để minh hoạ hàng đợi offline.
5. BVĐK chọn "Xe đã tới — Tiếp nhận" để mở hồ sơ điều trị tiếp nối.

## Dựng lại trước buổi bảo vệ

```bash
pnpm --filter @mevita/api demo:reset
```

Lệnh này:

- Xoá mọi phiếu chuyển tuyến, hồ sơ và lịch hẹn phát sinh ở các cơ sở `DEMO-*` và của các bệnh nhân demo. Giữ lịch sử gốc `DEMO-BA-*` và dữ liệu `SIM…`.
- Chạy lại seed demo: tài khoản được kích hoạt lại, mật khẩu, số giường, xe.
- Dựng lại kịch bản với mốc giờ mới.

Ở production, chạy qua **Actions → Database (production)** với tuỳ chọn `demo_reset`.

Mã bản ghi kịch bản:

| Loại               | Mã              |
| ------------------ | --------------- |
| Hồ sơ              | `DEMO-KB-01…09` |
| Phiếu chuyển tuyến | `DEMO-CT-01…05` |
| Lịch hẹn           | `DEMO-LH-01…05` |

`pnpm db:seed` chỉ dựng kịch bản khi chưa có `DEMO-KB-01`, nên chạy lại không nhân bản dữ liệu.
