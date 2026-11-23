# Lệnh chuyển tuyến khẩn cấp & điều phối tiếp nhận (Task 4.2, 4.4)

Bác sĩ tuyến dưới (trạm y tế xã, hoặc bệnh viện tỉnh chuyển lên tuyến trung ương) tạo **lệnh chuyển tuyến** từ phiếu khám của bệnh nhân. Bác sĩ đang trực tại bệnh viện nhận được cảnh báo qua Socket.io ngay khi lệnh được gửi (đo trên máy phát triển: ~80–120 ms tính từ lúc bấm gửi).

```mermaid
sequenceDiagram
    participant X as Bác sĩ xã
    participant W as Next.js (Server Action)
    participant A as API /referrals
    participant G as Socket.io facility_<BV nhận>
    participant T as Bác sĩ trực BV tỉnh

    X->>W: Gửi form (bệnh viện, mức độ, tóm tắt, xử trí, xe, ETA)
    W->>A: POST /api/referrals
    A->>A: Kiểm tra phiếu khám thuộc cơ sở mình,<br/>BV nhận chuyển tuyến, không trùng lệnh đang chạy
    A->>G: new_incoming_referral (tóm tắt ca)
    G-->>T: Toast cảnh báo + bảng điều phối tự tải lại
    A-->>W: { referral, delivered }
    W-->>X: /commune/referrals?sent=CT…&delivered=N
    Note over X: delivered = 0 → nhắc gọi đường dây nóng của BV
```

## Giao diện

| Màn hình                                            | Nội dung                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phiếu khám → **Chuyển tuyến khẩn cấp**              | Nút đỏ ở đầu phiếu khám (cả tuyến xã và tỉnh), mở `/…/referrals/new?record=<id>`.                                                                                                                                                                                                                                                                                              |
| `/commune/referrals/new`, `/province/referrals/new` | Chọn bệnh viện (nhóm **Trong tỉnh** / **Liên tỉnh**, số bác sĩ đang trực trực tuyến, đường dây nóng, chuyên khoa), mức độ ưu tiên, lý do, **tóm tắt bệnh án soạn sẵn** từ phiếu khám (tuổi, giới, lý do vào, bệnh sử, sinh tồn, chẩn đoán ICD-10, dị ứng, tiền sử), xử trí sơ cứu (gợi ý từ đơn thuốc), người đi kèm, phương tiện, thời gian dự kiến tới (nút nhanh 15′–120′). |
| `/commune/referrals`                                | Danh sách lệnh đã gửi, thông báo kết quả gửi, huỷ lệnh (kèm lý do).                                                                                                                                                                                                                                                                                                            |
| `/province`                                         | Bảng điều phối: ca đang tới (chờ tiếp nhận / đã nhận), sắp theo mức độ rồi thời gian xe tới, đếm ngược, dị ứng, sinh tồn lúc khám. Tự cập nhật khi có ca mới hoặc ca bị huỷ.                                                                                                                                                                                                   |
| `/province/referrals`, `/[id]`                      | Danh sách ca tới và ca bệnh viện chuyển đi; chi tiết ca: thông tin chuyên môn, sinh tồn, thuốc đã dùng, liên lạc (cơ sở gửi, bác sĩ chuyển, người đi kèm, người nhà).                                                                                                                                                                                                          |

Cảnh báo ca mới là **popup toàn màn hình kèm âm thanh** (Task 4.4, xem bên dưới). Màn hình trên xe và sinh tồn trực tiếp: xem [docs/escort-vitals.md](escort-vitals.md).

## API

Chỉ `COMMUNE_STAFF` và `PROVINCE_STAFF`.

| Phương thức | Đường dẫn                 | Mô tả                                                                                                                                |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET         | `/referrals/destinations` | Bệnh viện nhận chuyển tuyến (trừ cơ sở mình), cùng tỉnh trước, kèm `onDutyCount`, `emergencyPhone`, chuyên khoa. `?q=` lọc theo tên. |
| GET         | `/referrals/escorts`      | Nhân viên cơ sở mình có thể đi kèm xe.                                                                                               |
| POST        | `/referrals`              | Tạo lệnh. Trả `{ referral, delivered }` — `delivered` là số kết nối trực đã nhận cảnh báo.                                           |
| GET         | `/referrals`              | `?direction=incoming\|outgoing` (bắt buộc), `&status=`, `&active=true` (chỉ PENDING/ACCEPTED, sắp theo ưu tiên → ETA).               |
| GET         | `/referrals/:id`          | Chi tiết — chỉ nhân viên cơ sở gửi/nhận (hoặc ADMIN); ghi nhật ký truy cập.                                                          |
| POST        | `/referrals/:id/cancel`   | `{ reason }` — chỉ cơ sở gửi, khi lệnh còn PENDING/ACCEPTED. Phát `referral_updated` tới bệnh viện nhận.                             |

Body `POST /referrals`:

```json
{
  "sourceRecordId": "uuid phiếu khám của cơ sở mình",
  "toFacilityId": "uuid bệnh viện nhận",
  "priority": "CRITICAL | URGENT | ROUTINE",
  "reason": "5–1000 ký tự",
  "clinicalSummary": "10–5000 ký tự",
  "initialTreatment": "tuỳ chọn",
  "escortId": "uuid nhân viên cùng cơ sở, tuỳ chọn",
  "vehicleInfo": "tuỳ chọn",
  "etaMinutes": 45
}
```

Quy tắc: phiếu khám phải thuộc cơ sở người gửi; bệnh viện nhận phải bật `acceptsReferrals` và khác cơ sở mình; người đi kèm phải cùng cơ sở; một phiếu khám chỉ có **một** lệnh đang thực hiện (409 nếu gửi trùng). Mã lệnh dạng `CT` + 6 ký tự; `estimatedArrivalAt = now + etaMinutes`.

### Sự kiện Socket.io

| Sự kiện                 | Phòng                | Nội dung                                                                                                                                                                                     |
| ----------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new_incoming_referral` | `facility_<BV nhận>` | `id, code, priority, createdAt, estimatedArrivalAt, reason, patient{fullName, dateOfBirth, gender, allergies, bloodType}, diagnosis{icdCode,name}, fromFacility{name, province}, referredBy` |
| `referral_updated`      | `facility_<BV nhận>` | `id, code, status, cancellationReason` (hiện dùng cho huỷ lệnh; tiếp nhận/từ chối ở Task 4.4)                                                                                                |

## Điều phối tiếp nhận tại tuyến trên (Task 4.4)

```mermaid
sequenceDiagram
    participant X as Tuyến xã / người đi kèm
    participant A as API
    participant T1 as Bác sĩ trực 1
    participant T2 as Bác sĩ trực 2

    A-->>T1: new_incoming_referral → popup + còi
    A-->>T2: new_incoming_referral → popup + còi
    T1->>A: POST /referrals/:id/accept { preparationNote }
    A-->>X: referral_updated (outgoing, accept) → "ê-kíp sẵn sàng" + ghi chú
    A-->>T2: referral_updated (incoming) → popup tự đóng, "BS … đã tiếp nhận"
```

- **Popup toàn màn hình** (mọi trang của phân hệ tỉnh): mức độ, mã phiếu, đếm ngược xe tới, bệnh nhân, nhóm máu, chẩn đoán ICD-10, lý do, **dị ứng**, nơi gửi, bác sĩ chuyển. Nhiều ca cùng lúc xếp hàng theo mức độ (hiện "+N ca khác"). Nút **Xem hồ sơ & tiếp nhận** / **Để sau**. Đo trên máy phát triển: popup hiện ~150 ms sau khi tuyến xã bấm gửi.
- **Âm thanh** tạo bằng Web Audio API (không cần tệp): tối khẩn = còi hai âm lặp tới khi đóng popup (tối đa 2 phút), khẩn = 3 tiếng bíp × 3, thường = 1 tiếng. Nút **Âm thanh: bật/tắt** trên bảng điều phối (lưu trên máy). Trình duyệt chỉ cho phát sau khi người dùng đã chạm vào trang — nếu bị chặn, popup có nút "Bật âm thanh cảnh báo".
- **Hồ sơ ca** (`/province/referrals/[id]`): khung phản hồi ở đầu trang — ghi chú chuẩn bị (có gợi ý nhanh: phòng mổ, dự trù máu, hồi sức, kíp PTTK, chụp CT) và nút **Xác nhận tiếp nhận & Sẵn sàng ê-kíp**, hoặc **Không thể tiếp nhận** (kèm lý do). Sau khi tiếp nhận có thể **cập nhật** ghi chú chuẩn bị. Kèm hồ sơ tuyến xã, **ảnh cận lâm sàng** (URL có chữ ký), bác sĩ chuyển & liên lạc, biểu đồ sinh tồn trên xe theo thời gian thực ([escort-vitals.md](escort-vitals.md)), đếm ngược.
- **Tuyến xã & người đi kèm** nhận thông báo ngay: "đã tiếp nhận — ê-kíp sẵn sàng" kèm ghi chú chuẩn bị (màn hình trên xe hiện mục "Tuyến trên: …"); bị từ chối thì thông báo không tự tắt, có nút **Chuyển nơi khác** mở lại form chuyển tuyến của bệnh nhân đó.
- Chỉ một bác sĩ xác nhận được (cập nhật có điều kiện trong CSDL); popup của các bác sĩ trực khác tự đóng kèm thông báo ai đã xử lý. `acceptedBy`/`acceptedAt` lưu người và thời điểm phản hồi (cả khi từ chối).

## Khi không ai trực trực tuyến

Lệnh vẫn được lưu và hiện trên bảng điều phối khi bác sĩ bệnh viện mở hệ thống. Form cảnh báo trước khi gửi, và sau khi gửi (`delivered = 0`) màn hình nhắc **gọi đường dây nóng** (`emergencyPhone` của cơ sở, dữ liệu mẫu: BVĐK Lào Cai `0900 111 115`, Việt Đức `0900 222 115`).

## Kiểm thử

- E2E Task 4.4: xác nhận tiếp nhận → cơ sở gửi, người đi kèm và bác sĩ trực khác nhận `referral_updated` dưới 1 giây; chi tiết có ảnh cận lâm sàng; không xác nhận/từ chối hai lần (409); cập nhật ghi chú; tuyến xã/BV khác không phản hồi thay; từ chối → lập lệnh mới tới BV khác.
- Trình duyệt Task 4.4: popup + âm thanh ở cả trang khác, mở hồ sơ (ảnh tải được), xác nhận kèm ghi chú → tuyến xã & điện thoại trên xe nhận ngay, popup bác sĩ thứ hai tự đóng; cập nhật ghi chú; tắt âm thanh; từ chối → "Chuyển nơi khác".

- `apps/api/test/referrals.e2e-spec.ts`: thứ tự bệnh viện đích & số người trực, tạo lệnh → cảnh báo tới đúng phòng dưới 1 giây, `delivered`, chặn lệnh trùng (409), quyền xem chi tiết, danh sách tới/đi, huỷ → `referral_updated`, ca liên tỉnh không ai trực (`delivered = 0`), dữ liệu sai (400/404).
- Kiểm thử trình duyệt (Playwright, dữ liệu demo): bác sĩ xã gửi lệnh từ phiếu khám → 2 bác sĩ BVĐK nhận toast và thẻ ca mới không cần tải lại; chi tiết ca; chặn gửi trùng; gửi liên tỉnh tới Việt Đức → cảnh báo đường dây nóng; huỷ lệnh → bệnh viện nhận thông báo và thẻ ca biến mất; form không tràn ngang ở màn hình 390 px.
