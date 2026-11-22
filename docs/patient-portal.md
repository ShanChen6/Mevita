# Cổng Bệnh nhân (Task 2.2)

## Màn hình

| Đường dẫn          | Nội dung                                                                                                   | Dữ liệu |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------- |
| `/patient`         | Lời chào, nhắc bổ sung hồ sơ còn thiếu, dị ứng, bệnh mạn tính, lần khám gần nhất                           | Thật    |
| `/patient/records` | Lịch sử khám dạng dòng thời gian, tải thêm theo trang                                                      | Thật    |
| `/patient/profile` | Hồ sơ sức khoẻ: CCCD, BHYT, địa chỉ 2 cấp (Tỉnh → Xã), nhóm máu, dị ứng, liên hệ khẩn cấp                  | Thật    |
| Lịch hẹn           | Thẻ "Lịch hẹn sắp tới", `/patient/appointments`, `/patient/appointments/new` ([chi tiết](appointments.md)) | Thật    |

Mỗi lần khám hiển thị: thời gian, **bác sĩ khám** (học hàm/học vị), **chuyên khoa**, **cơ sở y tế**, chẩn đoán ICD-10 (bệnh chính + kèm theo), kết luận, **đơn thuốc**, chỉ số sinh tồn, lời dặn/ngày tái khám, ảnh cận lâm sàng (ảnh thu nhỏ, bấm để phóng to) và dấu xác nhận chữ ký của bác sĩ.

## Quy tắc

- Lịch sử chỉ gồm hồ sơ **đã ký xác nhận** (`FINALIZED`); hồ sơ nháp đang khám không hiển thị cho bệnh nhân.
- Chuyên khoa được lưu vào hồ sơ tại thời điểm khám (`medical_records.specialty_id`), không đổi khi bác sĩ chuyển khoa.
- Ảnh thu nhỏ tạo bằng biến đổi URL của Cloudinary (`c_fill,w_240,h_240,q_auto,f_auto`) — không tải ảnh gốc khi xem danh sách.
- Bệnh nhân sửa CCCD/BHYT trùng với hồ sơ khác → `409`, hướng dẫn liên hệ cơ sở y tế.
- Đổi họ tên trên hồ sơ cũng cập nhật tên tài khoản.
- Mọi lần xem/cập nhật hồ sơ được ghi `audit_logs` (`VIEW`, `UPDATE`).

## API

| Method | Endpoint                    | Quyền                                                     |
| ------ | --------------------------- | --------------------------------------------------------- |
| GET    | `/api/patients/me`          | `PATIENT`                                                 |
| PATCH  | `/api/patients/me`          | `PATIENT` — chỉ cập nhật trường gửi lên; chuỗi rỗng = xoá |
| GET    | `/api/patients/me/records`  | `PATIENT` — `?limit=10&cursor=<id>`                       |
| GET    | `/api/patients/:id/records` | Theo chính sách truy cập (docs/auth.md)                   |

Phân trang theo con trỏ: phản hồi `{ items, nextCursor }`; gửi `cursor=nextCursor` để lấy trang kế.

## Web

- Dữ liệu đọc phía server qua `src/lib/data/patient.ts` (token trong cookie, không lộ ra trình duyệt); phiên hết hạn → `/login`.
- Form hồ sơ: React Hook Form + Zod (kiểm tra ngay trên form), lưu bằng Server Action rồi `refresh()`; API kiểm tra lại toàn bộ.
- Danh sách xã của tỉnh lấy qua route `GET /api/provinces/:code/communes` của web (cache trình duyệt 1 ngày).
