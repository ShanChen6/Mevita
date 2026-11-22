# Tra cứu nhanh & Tiếp nhận bệnh nhân (Task 3.1)

Màn hình: `/commune/patients`, `/province/patients` — một ô tìm kiếm duy nhất, tự nhận diện loại từ khoá:

| Từ khoá                          | Ví dụ             | Phạm vi tìm                                                                              |
| -------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| 12 chữ số → **CCCD**             | `0100 9000 1234`  | Toàn hệ thống, khớp chính xác                                                            |
| 2 chữ + 13 số → **mã thẻ BHYT**  | `DN4010090001234` | Toàn hệ thống, khớp chính xác                                                            |
| 10 chữ số → **SĐT / mã BHXH**    | `0912 345 678`    | Toàn hệ thống, khớp chính xác                                                            |
| `LH` + 6 ký tự → **mã lịch hẹn** | `LH8K2Q7M`        | Lịch hẹn **của cơ sở mình**                                                              |
| Còn lại → **họ tên**             | `Lò Văn`          | Chỉ bệnh nhân **đã liên hệ với cơ sở** (có lịch hẹn, hồ sơ khám hoặc phiếu chuyển tuyến) |

## Kết quả hiển thị

- Định danh: họ tên, tuổi, CCCD, BHYT (cảnh báo nếu thẻ **hết hạn**), SĐT, địa chỉ, có tài khoản Mevita hay không.
- **Cảnh báo dị ứng** (khung đỏ), nhóm máu, bệnh mạn tính, liên hệ khẩn cấp.
- **5 lần khám gần nhất ở mọi cơ sở** (đánh dấu "Cơ sở khác"): ngày, cơ sở, bác sĩ, chuyên khoa, lý do khám, chẩn đoán chính ICD-10; tổng số lần khám.
- **Lịch hẹn hôm nay** tại cơ sở → nút **Tiếp đón** (tạo phiếu khám).
- **Phiếu khám đang mở** (nháp chưa ký) → nút **Tiếp tục khám**.
- Không có lịch hẹn → **Tiếp nhận khám trực tiếp**: nhập lý do, chọn khám thường / cấp cứu → mở phiếu khám nháp.
- **Xem toàn bộ lịch sử khám** → `/{commune|province}/patients/:id` (dòng thời gian đầy đủ, tải thêm theo trang).

Không tìm thấy → **Tạo hồ sơ bệnh nhân mới** (điền sẵn CCCD/BHYT/SĐT vừa tra) → mở phiếu khám ngay.

## Vì sao tra mã định danh được trên toàn hệ thống?

Bệnh nhân đang có mặt và xuất trình CCCD/thẻ BHYT; bác sĩ cần thấy tiền sử dị ứng và các lần khám ở nơi khác để khám an toàn (đúng yêu cầu roadmap). Để hạn chế lạm dụng:

- Phải nhập **đầy đủ, chính xác** mã — không tìm gần đúng, không liệt kê được.
- Tìm theo **tên** chỉ trong bệnh nhân của cơ sở → không duyệt được danh sách bệnh nhân toàn quốc.
- Mọi lượt tra cứu ghi `audit_logs` (`LOOKUP`: loại từ khoá, số kết quả, id bệnh nhân).
- Giới hạn 60 lượt/phút mỗi người dùng.
- Xem **toàn bộ** lịch sử vẫn theo chính sách truy cập (docs/auth.md); **mở phiếu khám** (khi bệnh nhân thực sự đến khám) mới xác lập liên hệ bệnh nhân – cơ sở và được ghi audit.

## API

| Method | Endpoint                  | Quyền          | Mô tả                                                                                                                    |
| ------ | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/patients/lookup?q=` | Nhân viên y tế | Tra cứu, trả `{ kind, patients[] }`                                                                                      |
| POST   | `/api/patients`           | Nhân viên y tế | Tạo hồ sơ bệnh nhân vãng lai                                                                                             |
| POST   | `/api/encounters`         | Nhân viên y tế | `{ patientId, chiefComplaint, encounterType }` — mở phiếu khám nháp; nếu đã có phiếu nháp tại cơ sở thì trả lại phiếu đó |

Phiếu khám nháp sẽ được hoàn thiện (sinh tồn, ICD-10, đơn thuốc, ảnh, ký) ở Task 3.2–3.3.
