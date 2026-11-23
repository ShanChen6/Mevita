# Xe chuyển viện & theo dõi vị trí thời gian thực (Task C)

Bổ sung cho luồng chuyển tuyến ([referrals.md](referrals.md)): chọn phương tiện **theo tình trạng bệnh nhân**, điều xe khi trạm không có xe, và theo dõi vị trí xe trên bản đồ để bệnh viện nhận biết chính xác khi nào xe tới.

```mermaid
sequenceDiagram
    participant X as Trạm y tế xã
    participant A as API
    participant H as BV nhận / cơ sở lân cận có xe
    participant K as Điện thoại kíp xe
    X->>A: Lệnh chuyển tuyến + "Yêu cầu xe đón"
    A-->>H: pickup_request (BV nhận + cơ sở có xe cứu thương trong 150 km)
    H->>A: POST /referrals/:id/dispatch {vehicleId} — cơ sở đầu tiên được giao ca
    A-->>X: referral_updated (dispatch): xe nào, giờ dự kiến
    A-->>H: pickup_closed (các cơ sở khác)
    loop mỗi ~10 giây hoặc mỗi 50 m
        K->>A: vehicle_location (ack, idempotent theo clientId; mất sóng → lưu tạm, gửi bù)
        A-->>X: vehicle_location (vị trí, quãng đường còn lại, giờ tới tính lại)
        A-->>H: vehicle_location
    end
    K->>A: POST /referrals/:id/picked-up — đã đón bệnh nhân
    A-->>H: vehicle_arriving khi xe vào bán kính 1 km
    H->>A: POST /referrals/:id/arrive — bàn giao, xe tự về "Sẵn sàng"
```

## Chọn phương tiện theo tình trạng bệnh nhân

| Mức độ           | Khuyến nghị                                                                                 | Chọn thấp hơn (xe thường, gia đình, khác) |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Cấp cứu tối khẩn | Xe cứu thương: của trạm nếu có (ưu tiên xe hồi sức); không có → **yêu cầu xe đón** hoặc 115 | Phải ghi lý do ≥ 10 ký tự, ghi nhật ký    |
| Khẩn             | Ưu tiên xe cứu thương                                                                       | Phải ghi lý do                            |
| Thường           | Phương tiện nào cũng được, kể cả gia đình tự túc                                            | —                                         |

Form lệnh chuyển tuyến **chọn sẵn** phương án phù hợp: trạm có xe cứu thương sẵn sàng → dùng ngay; ca cấp cứu mà không có → "Xe đón", liệt kê cơ sở có xe gần nhất với khoảng cách và số phút tới đón; ca thường không có xe → gia đình tự túc. Giờ tới được **gợi ý theo khoảng cách** (đường chim bay × 1,35 hệ số đường bộ, 40 km/h). API kiểm tra lại cùng quy tắc (`apps/api/src/referrals/transport.ts`).

## Điều xe

- **Xe của cơ sở**: xe được giữ có điều kiện (`AVAILABLE → ON_MISSION`) — hai ca không lấy được cùng một xe; xe tự về **Sẵn sàng** khi ca tới nơi, bị huỷ hoặc bị từ chối.
- **Xe đón**: gửi `pickup_request` tới bệnh viện nhận và mọi cơ sở có xe cứu thương sẵn sàng trong **150 km** (kèm âm báo). Danh sách "Yêu cầu xe đón" trên trang tổng quan (cả tuyến xã và tỉnh): chọn xe → **Cử xe đi đón**. Nhiều nơi bấm cùng lúc thì chỉ **một** nơi được giao (cập nhật có điều kiện trong transaction); xe của nơi chậm hơn vẫn **Sẵn sàng**. Ca cấp cứu bắt buộc xe cứu thương. Trước khi nhận, cơ sở lân cận chỉ thấy thông tin tối thiểu (mức độ, lý do, giới/tuổi); sau khi nhận, kíp xe xem được phiếu chuyển tuyến và ghi sinh tồn.
- **Đã đón bệnh nhân**: kíp xe bấm trên điện thoại → bắt đầu chặng chở bệnh nhân, giờ tới tính lại.
- **Xe 115 / gia đình / khác**: ghi biển số, số điện thoại vào ô "Phương tiện"; người đi kèm vẫn chia sẻ vị trí được.

## Theo dõi vị trí

- **Nguồn**: điện thoại người đi kèm / kíp xe trên màn hình "Trên xe" — nút **Bật chia sẻ** (Geolocation API, độ chính xác cao). Gửi mỗi ~10 giây hoặc khi xe đi được ≥ 50 m; giữ màn hình sáng (Wake Lock) vì trình duyệt dừng GPS khi tắt màn hình; tải lại trang thì tự bật lại.
- **Mất sóng**: điểm vị trí vào hàng đợi `localStorage` (dùng chung cơ chế với sinh tồn — `lib/offline-queue.ts`), gửi bù khi có mạng; máy chủ bỏ qua bản trùng theo `clientId`.
- **Giờ tới**: tính lại ở máy chủ mỗi lần nhận vị trí = quãng đường còn lại × 1,35 / tốc độ (GPS hoặc giữa 2 điểm; loại giá trị > 150 km/h do GPS nhảy điểm; mặc định 40 km/h). Chặng xe đón: tới trạm + 5 phút bàn giao + chặng chở. Cập nhật `estimatedArrivalAt` nên mọi đồng hồ đếm ngược đều theo vị trí thật.
- **Xe sắp tới**: vào bán kính 1 km quanh bệnh viện nhận → `vehicle_arriving` (một lần) → bác sĩ trực nhận thông báo + âm báo, chuẩn bị tiếp đón.
- **Màn hình bệnh viện / trạm**: khung **Hành trình xe chuyển viện** trên chi tiết phiếu — bản đồ OpenStreetMap (Leaflet) với trạm, bệnh viện, xe và quãng đường đã đi; giờ tới, còn lại bao nhiêu km, tốc độ, lần cập nhật cuối (quá 2 phút → cảnh báo mất tín hiệu); thông tin xe, trang bị, tài xế. Thẻ ca trên bảng điều phối hiện xe nào đang chở / đang đi đón.
- **Quyền riêng tư**: chỉ gửi vị trí khi ca đang hoạt động (và gửi bù tối đa 1 giờ sau khi tới); chỉ cơ sở gửi, nhận và cơ sở có xe xem được lộ trình; người ngoài gửi vị trí bị từ chối.

## Quản lý xe (`/commune/vehicles`, `/province/vehicles`)

Biển số, loại (xe cứu thương hồi sức / cơ bản / xe vận chuyển thường), trang bị, tài xế & số điện thoại, trạng thái (Sẵn sàng / Đang làm nhiệm vụ — kèm mã ca / Bảo trì), vị trí gần nhất. Xe đang làm nhiệm vụ không chuyển sang bảo trì được.

Dữ liệu demo: Trạm Mường Khương có **1 xe bán tải** (để thấy luồng khuyến nghị & xe đón), BVĐK Lào Cai có 2 xe cứu thương (24A-115.01 hồi sức, 24A-115.02 cơ bản), Việt Đức có 1 xe hồi sức. Toạ độ cơ sở là **gần đúng** theo vị trí xã/phường.

## API

| Phương thức | Đường dẫn                      | Mô tả                                                                                  |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| GET/POST    | `/vehicles`                    | Xe của cơ sở mình / thêm xe                                                            |
| PATCH       | `/vehicles/:id`                | Sửa thông tin, `status: AVAILABLE \| MAINTENANCE`, `isActive`                          |
| GET         | `/referrals/transport-options` | Khuyến nghị theo mức độ, xe của cơ sở, cơ sở có thể cử xe đón (gần nhất trước), toạ độ |
| POST        | `/referrals`                   | Thêm `transportMode`, `vehicleId`, `transportNote`; `etaMinutes` không cần khi xe đón  |
| GET         | `/referrals/pickup-requests`   | Yêu cầu xe đón cơ sở mình nhận được                                                    |
| POST        | `/referrals/:id/dispatch`      | `{ vehicleId }` — cử xe đón (409 nếu nơi khác đã nhận)                                 |
| POST        | `/referrals/:id/picked-up`     | Đã đón bệnh nhân                                                                       |
| GET/POST    | `/referrals/:id/locations`     | Lộ trình / ghi lô vị trí (dự phòng cho socket)                                         |

Sự kiện Socket.io: `pickup_request`, `pickup_closed`, `vehicle_location` (client → server có ack; server → cơ sở gửi, nhận, cơ sở có xe), `vehicle_arriving`; `referral_updated` thêm `action: dispatch | picked_up` và thông tin xe.

## Lưu ý

- Ảnh bản đồ lấy từ máy chủ OpenStreetMap — phù hợp đồ án/lưu lượng thấp (theo [chính sách sử dụng](https://operations.osmfoundation.org/policies/tiles/), có ghi nguồn). Triển khai thật nên dùng nhà cung cấp ảnh bản đồ riêng hoặc tự dựng.
- Header `Permissions-Policy` của web cho phép `geolocation=(self)` (lỗi ban đầu đặt `geolocation=()` đã chặn định vị — phát hiện nhờ kiểm thử trình duyệt).
- Khoảng cách là ước lượng (chưa tính theo tuyến đường thật); có thể thay bằng dịch vụ tính tuyến (OSRM, Vietmap) sau.

## Kiểm thử

- `apps/api/test/transport.e2e-spec.ts`: quản lý xe (biển số, trùng, chỉ cơ sở mình sửa); phương án vận chuyển (gần nhất trước, loại cơ sở xa); khuyến nghị theo mức độ (thiếu lý do → 400, có lý do → ghi nhật ký `belowRecommendation`), một xe không chở hai ca, huỷ → trả xe; xe đón tới đúng cơ sở, **hai nơi cử xe cùng lúc chỉ một nơi được giao**, cơ sở lân cận chỉ xem được phiếu sau khi nhận; vị trí qua socket (giờ tới chặng đón), gửi lại không trùng, người ngoài 403, toạ độ sai 400, đã đón (không bấm hai lần), cảnh báo "xe sắp tới" đúng một lần, lộ trình, bàn giao → trả xe.
- `apps/api/src/common/geo.spec.ts`: khoảng cách, thời gian di chuyển, quy tắc khuyến nghị.
- Trình duyệt (Playwright, giả lập GPS trên iPhone 13): trạm không có xe cứu thương → mặc định xe đón; chọn xe bán tải → cảnh báo + bắt ghi lý do; BV nhận yêu cầu, cử xe, trạm nhận thông báo; trang xe "Đang làm nhiệm vụ"; kíp xe bật chia sẻ → BV thấy xe trên bản đồ, quãng đường giảm khi xe di chuyển; mất sóng → lưu tạm → có mạng gửi bù; đã đón → chặng chở; vào 1 km → "Xe sắp tới"; bàn giao → xe "Sẵn sàng".
