# Chương 3. Thiết kế kênh thời gian thực (Socket.io)

## 3.1. Kiến trúc

```mermaid
flowchart LR
    subgraph Client
      L[Laptop bác sĩ<br/>Next.js + socket.io-client]
      P[Điện thoại trên xe<br/>hàng đợi offline]
    end
    subgraph Vercel
      W[Next.js 16<br/>Server Components, Server Actions<br/>/api/realtime/ticket]
    end
    subgraph Render
      A[NestJS API<br/>REST /api]
      G[Socket.io namespace /realtime]
      E[EscalationService<br/>quét mỗi 30 giây]
    end
    D[(PostgreSQL<br/>Neon)]
    C[(Cloudinary)]

    L -- HTTPS cookie httpOnly --> W
    W -- REST + Bearer token --> A
    L <-. WebSocket vé 60 giây .-> G
    P <-. WebSocket + ack .-> G
    A --> D
    G --> D
    E --> D
    E --> G
    A --> G
    L -- ảnh có chữ ký --> C
```

| Thành phần            | Quyết định thiết kế                                                                                         | Lý do                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xác thực              | **Vé socket** JWT riêng, hạn 60 giây, audience `mevita-socket`. Web cấp vé qua route `/api/realtime/ticket` | Token đăng nhập nằm trong cookie `httpOnly` nên JavaScript không đọc được. Vé ngắn hạn không dùng được để gọi REST                                               |
| Phòng                 | `facility_<id>`, `user_<id>`, `admins`                                                                      | Ca chuyển tuyến gửi tới phòng của bệnh viện, nên mọi bác sĩ đang trực ở đó cùng nhận. Không có sự kiện "tự vào phòng", nên client không nghe lén được cơ sở khác |
| Chiều client → server | Chỉ dùng cho `vital_update` và `vehicle_location`, đều có **ack**                                           | Đây là hai luồng tần suất cao từ thiết bị di động. Ack cho thiết bị biết bản ghi nào đã lưu thì xoá khỏi hàng đợi                                                |
| Chiều server → client | Mọi thay đổi trạng thái đều đi qua REST rồi server phát sự kiện                                             | REST có kiểm tra quyền, transaction, nhật ký. Socket chỉ để thông báo                                                                                            |
| Bảo vệ                | Kiểm tra Origin (`allowRequest`), giới hạn kích thước gói tin 64 KB, khoá tài khoản thì ngắt socket         | Chống kết nối từ trang lạ, chống gói tin quá lớn                                                                                                                 |

## 3.2. Danh mục sự kiện

| Sự kiện                            | Chiều              | Phòng nhận                             | Khi nào                                                         |
| ---------------------------------- | ------------------ | -------------------------------------- | --------------------------------------------------------------- |
| `presence_update`                  | S → C              | `facility_<id>`                        | Có bác sĩ vào hoặc ra ca trực                                   |
| `channel_test`                     | S → C              | `facility_<id>`                        | Kiểm tra kênh trực                                              |
| `new_incoming_referral`            | S → C              | Bệnh viện nhận                         | Có lệnh mới, hoặc nhắc lại khi leo thang (`escalated: 1`)       |
| `referral_updated`                 | S → C              | Cơ sở gửi + cơ sở nhận                 | Tiếp nhận, chuẩn bị, đề nghị chuyển, huỷ, cử xe, đã đón, đã tới |
| `vital_update`                     | C → S (ack), S → C | Cơ sở gửi, cơ sở nhận, cơ sở có xe     | Người đi kèm nhập sinh tồn                                      |
| `vehicle_location`                 | C → S (ack), S → C | Cơ sở gửi, cơ sở nhận, cơ sở có xe     | GPS điện thoại gửi vị trí theo lô                               |
| `vehicle_arriving`                 | S → C              | Cơ sở nhận + cơ sở gửi                 | Xe vào bán kính 1 km                                            |
| `pickup_request` / `pickup_closed` | S → C              | Bệnh viện nhận và cơ sở lân cận còn xe | Trạm yêu cầu xe đón / đã có nơi nhận                            |
| `referral_escalated`               | S → C              | Cơ sở gửi (mức 1), `admins` (mức 2)    | Bệnh viện chậm phản hồi ca cấp cứu                              |
| `capacity_update`                  | S → C              | `admins`                               | Bệnh viện cập nhật số giường                                    |

## 3.3. Kết nối và xác thực

```mermaid
sequenceDiagram
    autonumber
    participant B as Trình duyệt
    participant W as Next.js
    participant A as API REST
    participant G as Socket.io /realtime
    B->>W: POST /api/realtime/ticket (cookie httpOnly)
    W->>A: POST /api/realtime/ticket (Bearer access token)
    A-->>W: { ticket (JWT 60 giây, aud mevita-socket) }
    W-->>B: ticket
    B->>G: connect(auth.token = ticket)
    G->>G: allowRequest: kiểm tra Origin
    G->>G: middleware: xác minh vé, gắn user
    alt vé sai hoặc hết hạn
      G-->>B: connect_error "unauthorized"
    else hợp lệ
      G->>G: join user_<id>, facility_<id> (admins nếu ADMIN)
      G-->>B: presence_update { onDuty: [...] } tới cả phòng cơ sở
    end
    Note over B,G: Mất kết nối thì tự kết nối lại với vé mới.<br/>Trạng thái "Đang trực" chỉ là bác sĩ có socket mở.
```

## 3.4. Luồng chuyển tuyến cấp cứu

```mermaid
sequenceDiagram
    autonumber
    actor X as Bác sĩ xã
    participant W as Next.js (Server Action)
    participant A as API /referrals
    participant D as PostgreSQL
    participant G as Socket.io
    actor T as Bác sĩ trực tỉnh (n người)

    X->>W: Gửi lệnh (bệnh viện đã chọn theo gợi ý)
    W->>A: POST /referrals
    A->>A: Kiểm tra quyền, phiếu khám, chưa có lệnh đang chạy
    A->>D: INSERT referral (transaction) + audit log
    A->>G: emit facility_<BV> new_incoming_referral
    G-->>T: popup + còi báo (mọi bác sĩ đang trực)
    A-->>W: { referral, delivered: n }
    W-->>X: "n kết nối trực đã nhận cảnh báo"<br/>(n = 0 thì hiện số đường dây nóng)

    T->>A: POST /referrals/:id/accept { READY | STABILIZE_FORWARD }
    A->>D: UPDATE có điều kiện status = PENDING
    alt người khác đã xử lý
      A-->>T: 409 Conflict
    else
      A->>G: referral_updated → facility_<xã>, facility_<BV>
      G-->>X: "BV đã sẵn sàng ê-kíp"
      G-->>T: các bác sĩ trực khác tắt popup
    end
```

Không có nút "Từ chối" cho ca tối khẩn/khẩn: API trả `409` nếu cố gọi. Xem [coordination.md](../coordination.md).

## 3.5. Sinh tồn trên xe: offline-first với ack

```mermaid
sequenceDiagram
    autonumber
    actor E as Người đi kèm (điện thoại)
    participant Q as Hàng đợi localStorage
    participant G as Socket.io
    participant S as ReferralVitalsService
    participant D as PostgreSQL
    actor T as Bệnh viện nhận

    E->>Q: Lưu bản ghi { clientId: uuid, recordedAt, mạch, HA, SpO2, GCS… }
    Note over E,Q: Mất sóng: bản ghi nằm trong hàng đợi,<br/>giao diện hiện "Chờ gửi (n)"
    loop Khi kết nối, khi có sự kiện online, mỗi 10 giây
      Q->>G: emit vital_update { referralId, entries[] } (chờ ack)
      G->>S: Kiểm tra quyền (cơ sở gửi / người đi kèm), giờ không lệch quá 5 phút
      S->>D: createMany ... skipDuplicates (clientId UNIQUE)
      S->>G: Chỉ bản mới → vital_update tới cơ sở gửi, nhận, cơ sở có xe
      G-->>T: Biểu đồ và bảng cập nhật
      G-->>Q: ack { ok, accepted: [mọi clientId đã có trong CSDL] }
      Q->>Q: Xoá các bản đã accepted
    end
    alt lỗi tạm thời (retry: true)
      Q->>Q: Giữ lại, thử ở lần sau
    else dữ liệu sai (retry: false)
      Q->>Q: Bỏ và báo lỗi
    end
```

Gửi lại cùng một lô sẽ không tạo bản trùng và không phát lại sự kiện, nhờ ràng buộc `UNIQUE (client_id)`.
Vị trí xe (`vehicle_location`) dùng đúng giao ước này. Ngoài ra, server tính lại giờ tới từ vị trí thật và phát
`vehicle_arriving` khi xe còn cách đích 1 km.

## 3.6. Leo thang khi bệnh viện chậm phản hồi

```mermaid
sequenceDiagram
    autonumber
    participant E as EscalationService (30 giây/lần)
    participant D as PostgreSQL
    participant G as Socket.io
    actor T as Bác sĩ trực BV nhận
    actor X as Tuyến xã
    actor S as Điều phối Sở Y tế

    E->>D: Ca PENDING tối khẩn ≥ 3 phút (khẩn ≥ 10 phút), escalation_level < mức
    E->>D: UPDATE escalation_level = 1 (có điều kiện, tránh gửi trùng) + audit ESCALATE
    E->>G: new_incoming_referral { escalated: 1 } → facility_<BV>
    G-->>T: popup "Nhắc lại" + còi
    E->>G: referral_escalated { level: 1, số đường dây nóng } → facility_<xã>
    G-->>X: "BV chậm phản hồi — gọi 0900 111 115"
    Note over E,D: Sau 6 phút (khẩn: 20 phút) vẫn PENDING
    E->>D: UPDATE escalation_level = 2
    E->>G: referral_escalated { level: 2 } → admins
    G-->>S: Cảnh báo trên bảng điều phối
```

## 3.7. Xe đón và tiếp nhận

```mermaid
sequenceDiagram
    autonumber
    actor X as Trạm xã
    participant A as API
    participant G as Socket.io
    actor H as BV nhận / cơ sở lân cận có xe
    actor E as Điện thoại trên xe
    X->>A: POST /referrals (transportMode = PICKUP)
    A->>G: pickup_request → BV nhận + các cơ sở gần còn xe AVAILABLE
    H->>A: POST /referrals/:id/dispatch { vehicleId }
    A->>A: Khoá điều kiện: chỉ một cơ sở cử được, xe → ON_MISSION
    A->>G: pickup_closed (cơ sở khác) + referral_updated (dispatch)
    H->>A: POST /referrals/:id/picked-up → departedAt, giờ tới dự kiến
    loop Trên đường
      E->>G: vehicle_location (ack) → bản đồ, giờ tới thật
    end
    G-->>H: vehicle_arriving (còn 1 km) → chuẩn bị đón ở cổng cấp cứu
    H->>A: POST /referrals/:id/arrive
    A->>A: ARRIVED, xe → AVAILABLE, mở hồ sơ tiếp nối (kế thừa dữ liệu)
    A->>G: referral_updated (arrive) → tuyến xã và màn hình trên xe "Đã bàn giao"
```

## 3.8. Kết quả kiểm thử tải

Môi trường: 1 container 4 vCPU, 1 tiến trình Node, công cụ tạo tải chạy cùng máy. Số liệu đầy đủ ở [testing.md](../testing.md).

| Chỉ số                                                 | Kết quả                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| Cảnh báo ca mới, 1.000 lệnh đồng thời                  | p50 281 ms, p95 381 ms, **p99 716 ms** (mục tiêu < 1 giây)           |
| Sinh tồn, 250 xe gửi mỗi 2 giây (2.500 lượt giao/giây) | **p99 < 30 ms**                                                      |
| Sinh tồn, 1.000 xe đồng thời                           | CPU 91%, p95 ~0,9 giây, **không mất bản nào**                        |
| Tính đúng                                              | 0 kết nối lỗi, 0 bản mất, 0 bản trùng, 0 lần lọt sang bệnh viện khác |
