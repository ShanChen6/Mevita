# Điều phối thay cho từ chối (Task B)

Bệnh viện quá tải là chuyện thường ngày — vì vậy Mevita **không cho phép từ chối ca cấp cứu** mà thay bằng điều phối: công khai năng lực tiếp nhận, gợi ý bệnh viện phù hợp nhất, cho phép "tiếp nhận – ổn định – chuyển tiếp", và tự leo thang khi bệnh viện chậm phản hồi. (Luật Khám bệnh, chữa bệnh 2023 nghiêm cấm từ chối hoặc cố ý chậm cấp cứu người bệnh — nên đối chiếu điều khoản cụ thể khi viết báo cáo.)

## 1. Bệnh viện phản hồi thế nào

| Mức độ ca       | Bệnh viện nhận được chọn                                                                                                                                                                                               | Không còn                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Tối khẩn / khẩn | **Tiếp nhận & sẵn sàng ê-kíp**, hoặc **Tiếp nhận – ổn định – chuyển tiếp** (thiếu chuyên khoa/thiết bị/giường hồi sức; bắt buộc ghi kế hoạch ≥ 10 ký tự, VD "Không có PTTK — đặt NKQ, chụp CT rồi chuyển BV Việt Đức") | Từ chối (API trả 409)       |
| Thường          | Tiếp nhận, hoặc **Đề nghị chuyển nơi khác** — bắt buộc **lý do chuyên môn** (không có chuyên khoa / thiết bị / chưa có chỉ định / khác) và **cơ sở đề xuất cụ thể**. _Quá tải không phải lý do hợp lệ._                | Từ chối không kèm phương án |

- Tuyến dưới nhận ngay kế hoạch chuyển tiếp hoặc đề xuất; với đề nghị chuyển có nút **"Chuyển tới {cơ sở đề xuất}"** mở sẵn form lệnh mới với bệnh viện đó.
- Sau khi tiếp nhận để ổn định, bệnh viện lập lệnh chuyển tiếp từ hồ sơ điều trị tiếp nối (Task 5.1) như một lệnh chuyển tuyến bình thường — xem [journey.md](journey.md) cho hành trình nhiều chặng.

## 2. Năng lực tiếp nhận & mức tải

Bảng điều phối của bệnh viện (`/province`) có thẻ **Năng lực tiếp nhận**: tổng giường cấp cứu, số đang trống (nút −/+), giường hồi sức trống, ghi chú. Mức tải tự tính:

| Mức           | Điều kiện                  |
| ------------- | -------------------------- |
| Bình thường   | còn ≥ 30 % giường cấp cứu  |
| Đông          | còn 10–30 %                |
| Quá tải       | còn < 10 % hoặc hết giường |
| Chưa cập nhật | chưa khai báo              |

Số liệu cũ hơn 12 giờ được đánh dấu "số liệu cũ". Mỗi lần cập nhật được báo cho điều phối viên Sở Y tế (`capacity_update`) và ghi nhật ký.

## 3. Gợi ý bệnh viện phù hợp

Form lệnh chuyển tuyến xếp **mọi** bệnh viện theo điểm (không loại bệnh viện nào), có nhãn **Gợi ý** cho bệnh viện phù hợp nhất, kèm lý do và cảnh báo trên từng thẻ. Bác sĩ chọn thêm **Chuyên khoa cần ở tuyến trên**; đổi mức độ / chuyên khoa thì danh sách xếp hạng lại ngay (nếu bác sĩ chưa tự chọn thì tự chọn theo gợi ý).

Điểm (`apps/api/src/coordination/ranking.ts`, có unit test):

| Yếu tố                               | Điểm                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Có / không có chuyên khoa cần        | +40 / −60                                                              |
| Thời gian di chuyển                  | −0,5 × phút (tối khẩn), −0,3 (khẩn), −0,1 (thường); chưa có toạ độ −30 |
| Mức tải                              | Bình thường +15, Đông 0, Quá tải −30, chưa cập nhật / số liệu cũ −5    |
| Tối khẩn mà hết giường hồi sức       | −15                                                                    |
| Có / không có bác sĩ trực trực tuyến | +15 / −10                                                              |
| Cùng tỉnh                            | +10                                                                    |

Chọn bệnh viện đang quá tải hoặc thiếu chuyên khoa → form nhắc "bệnh viện vẫn phải tiếp nhận và ổn định ca cấp cứu — cân nhắc gợi ý X".

## 4. Leo thang khi chậm phản hồi

`EscalationService` quét mỗi 30 giây (`ESCALATION_INTERVAL_MS`, 0 = tắt):

| Ca       | Mức 1 (chưa ai xác nhận sau) | Mức 2 (sau) |
| -------- | ---------------------------- | ----------- |
| Tối khẩn | 3 phút                       | 6 phút      |
| Khẩn     | 10 phút                      | 20 phút     |
| Thường   | —                            | —           |

- **Mức 1**: bệnh viện nhận popup + còi lại ("Nhắc lại: ca chưa được phản hồi (N phút)"); tuyến dưới được báo kèm số đường dây nóng để gọi.
- **Mức 2**: thêm cảnh báo tới **điều phối viên Sở Y tế** (phòng `admins`).
- Cập nhật có điều kiện theo mức hiện tại → nhiều instance API không leo thang trùng. Mỗi lần leo thang ghi `audit_logs` (`ESCALATE`).

## 5. Trang Điều phối cho Sở Y tế (`/admin/coordination`)

- **Ca cấp cứu chờ phản hồi**: thời gian chờ, mức leo thang, số điện thoại bệnh viện & tuyến dưới (bấm để gọi).
- **Bản đồ điều phối**: bệnh viện tô màu theo mức tải, xe đang làm nhiệm vụ.
- **Năng lực các bệnh viện**: mức tải, giường cấp cứu / hồi sức trống, ca đang tới, bác sĩ đang trực, giờ cập nhật.
- **Xe đang làm nhiệm vụ**: ca, giờ dự kiến tới, vị trí cuối.
- Tự làm mới khi có leo thang / cập nhật năng lực và mỗi 60 giây.

## API

| Phương thức | Đường dẫn                 | Mô tả                                                                                                       |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET         | `/referrals/destinations` | `?priority=&specialty=` — kèm năng lực, mức tải, khoảng cách, `score`, `reasons`, `warnings`, `recommended` |
| POST        | `/referrals`              | Thêm `requiredSpecialtyCode`                                                                                |
| POST        | `/referrals/:id/accept`   | `{ acceptanceType: READY \| STABILIZE_FORWARD, forwardNote, preparationNote }`                              |
| POST        | `/referrals/:id/reject`   | Chỉ ca thường: `{ reason, category, redirectFacilityId }`                                                   |
| GET / PUT   | `/coordination/capacity`  | Năng lực của cơ sở mình (PUT: nhân viên bệnh viện nhận chuyển tuyến)                                        |
| GET         | `/coordination/overview`  | ADMIN — tổng quan điều phối                                                                                 |

Sự kiện Socket.io mới: `referral_escalated` (tuyến dưới; mức 2 thêm `admins`), `capacity_update` (`admins`); `new_incoming_referral` có thêm `escalated`, `waitedMinutes` khi là lần nhắc lại; `referral_updated` thêm `acceptanceType`, `forwardNote`, `redirectFacility`.

## Kiểm thử

- `apps/api/src/coordination/ranking.spec.ts`: mức tải, chuyên khoa thắng khoảng cách, quá tải xếp sau nhưng không bị loại, trọng số thời gian theo mức độ, hết giường hồi sức, chưa có toạ độ không được lợi thế.
- `apps/api/test/coordination.e2e-spec.ts`: cập nhật năng lực (trạm 403, dữ liệu sai 400, mức tải, báo điều phối viên); gợi ý (BV có chuyên khoa & còn giường xếp trên BV gần hơn nhưng quá tải, có lý do/cảnh báo); leo thang mức 1 (popup nhắc lại, báo tuyến dưới, ca đã nhận / ca thường không leo thang, không gửi trùng) và mức 2 (báo Sở Y tế), tổng quan chỉ ADMIN, nhật ký.
- `apps/api/test/referrals.e2e-spec.ts`: ca cấp cứu bị từ chối → 409; "ổn định – chuyển tiếp" bắt buộc kế hoạch; ca thường chỉ đề nghị chuyển với lý do chuyên môn + cơ sở hợp lệ (không phải chính mình / trạm), tuyến xã gửi lại nơi được đề xuất.
- Trình duyệt: bệnh viện cập nhật 1/20 giường → "Quá tải"; tuyến xã thấy mức tải, giường, thời gian, nhãn Gợi ý, chọn chuyên khoa → xếp hạng lại; chọn BV quá tải → nhắc nhở; ca khẩn không có nút từ chối, "ổn định – chuyển tiếp" → tuyến xã nhận kế hoạch; ca thường → đề nghị chuyển (không có lý do "quá tải") → tuyến xã bấm "Chuyển tới Việt Đức" mở form chọn sẵn; leo thang 3 phút → popup nhắc lại + tuyến xã được báo, 6 phút → điều phối viên nhận cảnh báo, trang điều phối hiện ca mức 2, bảng năng lực, bản đồ.
