# Thống kê & quản trị (Task 5.2)

Phân hệ **Quản trị · Sở Y tế** (`/admin`, chỉ vai trò `ADMIN` — tài khoản demo `admin@mevita.vn`). Quản trị viên đăng nhập được đưa thẳng vào trang thống kê.

## Dashboard thống kê (`/admin`)

Bộ lọc một hàng phía trên: khoảng thời gian nhanh (7 ngày, 30 ngày, 90 ngày, 6 tháng, 12 tháng) hoặc từ ngày – đến ngày, và tỉnh/thành. Bộ lọc nằm trên URL (`?days=90`, `?from=&to=`, `&province=15`) nên chia sẻ được đường link. Dữ liệu được gộp theo **ngày** (≤ 45 ngày), **tuần** (≤ 400 ngày) hoặc **tháng**. Ngày tính theo giờ Việt Nam. **Địa phương = tỉnh/thành nơi đặt cơ sở y tế** (nơi khám, nơi chuyển đi).

| Khối                                 | Nội dung                                                                                                                                                                                                     | Dạng hiển thị                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Chỉ số chính                         | Lượt đặt lịch (tỉ lệ huỷ, không đến), lượt khám đã ký (tại trạm xã), phiếu chuyển tuyến (liên tỉnh), **tỉ lệ chuyển tuyến xã → trên**, trung vị thời gian tuyến trên phản hồi, trung vị thời gian vận chuyển | Ô số liệu                                         |
| Lượt đặt lịch khám                   | Theo kỳ, 3 nhóm: Đã khám (đã tiếp đón/đã khám), Chờ khám, Huỷ / không đến                                                                                                                                    | Cột chồng + tooltip + "Xem dạng bảng"             |
| Tỉ lệ chuyển tuyến từ trạm y tế xã   | Phiếu chuyển đi / lượt khám đã ký — theo tỉnh (toàn quốc) hoặc theo từng trạm (khi lọc 1 tỉnh)                                                                                                               | Thanh ngang xếp hạng, nhãn trực tiếp              |
| Phiếu chuyển tuyến                   | Theo kỳ; kết quả (đã tới / từ chối / huỷ / đang xử lý) và mức độ ưu tiên                                                                                                                                     | Đường + crosshair tooltip                         |
| **Mô hình bệnh tật theo địa phương** | Tỉ trọng (%) chẩn đoán chính theo **chương ICD-10** trong tổng lượt khám của mỗi tỉnh — 8 nhóm bệnh nhiều nhất                                                                                               | Bảng nhiệt (một màu xanh, nhạt → đậm), số trong ô |
| 10 bệnh thường gặp nhất              | Theo mã ICD-10 chẩn đoán chính                                                                                                                                                                               | Thanh ngang xếp hạng                              |
| Luồng chuyển tuyến                   | Tỉnh chuyển đi → tỉnh tiếp nhận, đánh dấu liên tỉnh                                                                                                                                                          | Bảng                                              |
| Chi tiết theo trạm y tế xã           | Lượt khám, số phiếu chuyển tuyến, tỉ lệ                                                                                                                                                                      | Bảng                                              |

Màu biểu đồ theo hướng dẫn trực quan hoá dữ liệu: 3 màu phân loại cố định (`--series-1..3` trong `globals.css`, có bộ riêng cho giao diện tối) đã chạy công cụ kiểm tra mù màu; một chuỗi số liệu dùng một màu; thang nhiệt một màu; chữ luôn dùng màu chữ, không dùng màu chuỗi. Màu thứ 3 (xanh ngọc) có độ tương phản < 3:1 trên nền sáng nên biểu đồ cột có kèm bảng số liệu.

## Tài khoản (`/admin/users`)

Tìm theo tên / email / số điện thoại, lọc vai trò và trạng thái, phân trang 30 dòng. **Khoá** tài khoản: không đăng nhập được nữa và mọi refresh token bị thu hồi (access token hiện có hết hạn trong tối đa 15 phút). Không tự khoá được tài khoản của mình. Mọi thao tác được ghi nhật ký.

## Nhật ký truy cập (`/admin/audit`)

Danh sách mới nhất trước: thời điểm, người thao tác, hành động (xem, tạo, sửa, đăng nhập…), đối tượng (Patient, MedicalRecord, Referral, User…), chi tiết (metadata, IP). Lọc theo người thao tác, hành động, loại đối tượng; phân trang theo con trỏ ("Cũ hơn").

## API (chỉ `ADMIN`)

| Phương thức | Đường dẫn                  | Mô tả                                                                                     |
| ----------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| GET         | `/stats/provinces`         | Tỉnh/thành có cơ sở y tế (cho bộ lọc)                                                     |
| GET         | `/stats/overview`          | `?from=YYYY-MM-DD&to=YYYY-MM-DD[&province=15]` (tối đa 2 năm) — toàn bộ số liệu dashboard |
| GET         | `/admin/users`             | `?q&role&status=active\|inactive&page`                                                    |
| PATCH       | `/admin/users/:id`         | `{ isActive }`                                                                            |
| GET         | `/admin/audit-logs`        | `?action&entityType&q&cursor&limit`                                                       |
| GET         | `/admin/audit-logs/facets` | Các giá trị hành động / loại đối tượng có trong nhật ký                                   |

Số liệu được tổng hợp bằng SQL trên PostgreSQL (`StatsService`, `$queryRaw` có tham số): đếm theo `date_trunc` giờ Việt Nam, trung vị bằng `percentile_cont`. Chỉ tính hồ sơ khám **đã ký**; tỉ lệ chuyển tuyến chỉ tính trạm y tế xã.

## Dữ liệu giả lập cho thống kê

Để dashboard có số liệu khi phát triển/demo:

```bash
pnpm --filter @mevita/api sim:stats          # xoá bản cũ rồi tạo mới
pnpm --filter @mevita/api sim:stats --clear  # chỉ xoá
```

Tạo dữ liệu **180 ngày gần nhất** ở 7 tỉnh (Lào Cai, Điện Biên, Lai Châu, Sơn La — miền núi; Hà Nội, TP. Hồ Chí Minh — đô thị; Cần Thơ — đồng bằng): mỗi tỉnh 5 trạm y tế xã + bệnh viện tỉnh (Lào Cai dùng BVĐK demo), ~630 bệnh nhân, ~13 nghìn lịch hẹn, ~20 nghìn lượt khám đã ký, ~1,7 nghìn phiếu chuyển tuyến (một phần liên tỉnh về BV Việt Đức demo). Mô hình bệnh theo vùng: miền núi nhiều bệnh hô hấp, nhiễm trùng, chấn thương và tỉ lệ chuyển tuyến cao (8–14%); đô thị nhiều tăng huyết áp, đái tháo đường, cơ xương khớp, tỉ lệ chuyển tuyến thấp (3–6%). Bộ sinh số có hạt giống cố định → chạy lại cho cùng bộ dữ liệu (khác nhau theo ngày chạy). Mọi bản ghi được đánh dấu (`SIM…`, `@mevita.sim`, bệnh nhân `[SIM]`), tài khoản giả lập bị khoá; lệnh từ chối chạy khi `NODE_ENV=production`.

## Kiểm thử

- `apps/api/test/stats.e2e-spec.ts`: dữ liệu riêng ở tháng 1/2001 → kiểm tra chính xác từng con số (lượt đặt lịch, tỉ lệ huỷ/không đến, lượt khám chỉ tính bản đã ký, tỉ lệ chuyển tuyến 33,3%, trung vị phản hồi 4 phút / vận chuyển 90 phút, ưu tiên, theo trạm, theo tỉnh, top bệnh, tỉ trọng hô hấp 75%, luồng liên tỉnh, lọc tỉnh, gộp theo tháng); chỉ ADMIN (401/403), tham số sai (400); khoá tài khoản → không đăng nhập được, refresh token bị thu hồi, mở khoá, không tự khoá; nhật ký ghi thao tác.
- Trình duyệt (dữ liệu giả lập): KPI, biểu đồ, tooltip, heatmap 7 tỉnh khác nhau giữa miền núi và đô thị, đổi khoảng 30 ngày (gộp theo ngày), lọc Lào Cai (theo trạm), khoá/mở khoá tài khoản, nhật ký & phân trang, bác sĩ tuyến tỉnh bị chuyển hướng khỏi `/admin`, không tràn ngang trên điện thoại.
