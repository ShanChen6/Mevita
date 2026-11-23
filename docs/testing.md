# Kiểm thử hệ thống (Task 5.3)

## Tổng quan

| Loại                             | Lệnh                                         | Số lượng                                                                      |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Unit test (API)                  | `pnpm --filter @mevita/api test`             | 94                                                                            |
| E2E API (cần PostgreSQL đã seed) | `pnpm --filter @mevita/api test:e2e`         | 82 trong 13 tệp, trong đó `security.e2e-spec.ts` là kiểm thử bảo mật tổng hợp |
| Kiểm thử tải Socket.io           | `pnpm --filter @mevita/api load:socket -- …` | 3 giai đoạn, xem bên dưới                                                     |
| Lint / kiểu                      | `pnpm lint`, `pnpm typecheck`                | Toàn monorepo                                                                 |

E2E tự tạo dữ liệu riêng (mã có hậu tố ngẫu nhiên) và dọn sạch sau khi chạy; khi không có CSDL, các test tự bỏ qua (`skip`) thay vì báo lỗi. Ngoài ra mỗi task giao diện đã được chạy thử bằng Playwright trên dữ liệu demo (máy tính + giả lập điện thoại).

## 1. Kiểm thử phân quyền & bảo mật

`apps/api/test/security.e2e-spec.ts` dựng một kịch bản đủ các bên liên quan: 2 bệnh nhân có tài khoản, 1 bệnh nhân không tài khoản, trạm y tế A (bác sĩ + điều dưỡng đi kèm xe), trạm B không liên quan, bệnh viện H nhận chuyển tuyến từ A, và quản trị viên.

### Ma trận vai trò × tài nguyên

14 tài nguyên chứa dữ liệu bệnh nhân hoặc dữ liệu quản trị × 8 chủ thể (chưa đăng nhập + 7 vai trò). Mỗi ô chỉ được phép trả đúng mã thành công cho người có quyền; mọi người khác phải nhận 401 (chưa đăng nhập) hoặc 403/404 — **không bao giờ 2xx, không bao giờ 500**.

| Tài nguyên                                   | Được phép                                                   |
| -------------------------------------------- | ----------------------------------------------------------- |
| Hồ sơ & lịch sử khám bệnh nhân P3            | Trạm A (lập hồ sơ), BV H (qua phiếu chuyển tuyến), quản trị |
| Hồ sơ bệnh nhân P1                           | Chính P1, trạm A (có lịch hẹn), quản trị                    |
| `/patients/me`                               | Bệnh nhân (dữ liệu của chính mình)                          |
| Phiếu khám đã ký                             | Trạm A, BV H, quản trị                                      |
| Phiếu khám **nháp** (đọc / sửa / vé tải ảnh) | Chỉ trạm A (quản trị được đọc) — BV H **không** thấy nháp   |
| Phiếu chuyển tuyến & sinh tồn trên xe        | Trạm A (gửi), BV H (nhận)                                   |
| Lịch hẹn của cơ sở                           | Nhân viên của chính cơ sở đó                                |
| Thống kê, tài khoản, nhật ký                 | Chỉ quản trị                                                |

### Các kiểu tấn công khác

- **IDOR / thao tác chéo**: bệnh nhân khác huỷ lịch hẹn, trạm B duyệt/tiếp đón lịch hẹn, xoá ảnh, huỷ/xác nhận/tiếp nhận/ghi sinh tồn phiếu chuyển tuyến của trạm A; cơ sở gửi tự "xác nhận" thay bệnh viện; sửa phiếu đã ký → đều bị chặn và **dữ liệu không đổi**. ID sai định dạng trả 400.
- **Token giả mạo**: `alg: none`, ký bằng khoá khác, hết hạn, sai issuer, sai audience, sửa payload giữ chữ ký cũ, dùng **vé socket** hoặc **refresh token** làm access token, chuỗi rác → 401; token ký đúng chuẩn (đối chứng) → 200. Access token không mở được kênh realtime.
- **Gán quyền qua dữ liệu gửi lên (mass assignment)**: đăng ký kèm `role: ADMIN`, `facilityId`, `patientId` → tài khoản vẫn là bệnh nhân, không liên kết hồ sơ người khác; bệnh nhân gửi `userId/id/role` khi sửa hồ sơ, nhân viên gửi `facilityId/doctorId/status` khi sửa phiếu → bị bỏ qua.
- **Tham số độc hại**: chuỗi tiêm SQL, chuỗi 5.000 ký tự ở tra cứu bệnh nhân, ICD-10, thống kê, quản trị → 200/400, không 500, không trả dữ liệu ngoài ý muốn (mọi truy vấn đều có tham số hoá; SQL tổng hợp của thống kê dùng `$queryRaw` tagged template). Đường dẫn ảnh giả lập với `../../etc/passwd` hoặc chữ ký sai → 404.
- **Cô lập kênh realtime**: trạm B và bệnh nhân không nhận `vital_update`/`referral_updated` của ca giữa A và H; không có sự kiện "tự vào phòng"; trạm B gửi `vital_update` cho ca không phải của mình bị từ chối; bệnh nhân chỉ ở phòng `user_<id>`.
- **Khoá tài khoản**: xem dưới.
- **Nhật ký truy cập**: xem lịch sử khám (cả lần bị từ chối) đều được ghi `audit_logs`.

### Phát hiện & khắc phục trong task này

| Vấn đề                                                                                                                                                                                                                                                        | Mức độ          | Khắc phục                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khoá tài khoản chỉ thu hồi refresh token: **access token còn hạn (≤ 15 phút) vẫn gọi được API** và kết nối Socket.io vẫn mở                                                                                                                                   | Trung bình      | `UserStatusService`: guard kiểm tra `isActive` ở mỗi request (cache 30 giây, cập nhật ngay khi khoá qua quản trị); khoá thì ngắt mọi socket của người đó (`disconnectUser`) |
| Kết nối Socket.io qua **WebSocket không kiểm tra Origin** (CORS của Socket.io chỉ áp cho polling) — trang ở origin lạ vẫn bắt tay được nếu có vé (rủi ro thấp: vé chỉ lấy qua BFF bằng cookie SameSite=Lax). Phát hiện khi chạy thử bản production ở Task 6.1 | Thấp            | `allowRequest` trong `RealtimeIoAdapter` từ chối Origin không thuộc `CORS_ORIGIN` (403) cho cả WebSocket; test trong `security.e2e-spec.ts`                                 |
| Header `Permissions-Policy: geolocation=()` (đặt ở Task 6.1) **chặn định vị trên toàn web** — chia sẻ vị trí xe không chạy được. Phát hiện khi kiểm thử trình duyệt Task C                                                                                    | Cao (chức năng) | Đổi thành `geolocation=(self)`                                                                                                                                              |
| `/admin` chưa có trong `matcher` của proxy web: bác sĩ mở `/admin` thấy trang lỗi thay vì bị chuyển hướng (API vẫn chặn 403, dữ liệu không lộ) — phát hiện khi kiểm thử Task 5.2                                                                              | Thấp            | Thêm `/admin/:path*` vào `proxy.ts`                                                                                                                                         |

### Giới hạn đã biết (theo thiết kế)

- **Mở phiếu khám tạo liên hệ**: nhân viên y tế mở phiếu khám (`POST /encounters`) cho một bệnh nhân là có quyền xem lịch sử của bệnh nhân đó — cần cho ca vãng lai/cấp cứu. Để có mã bệnh nhân phải tra cứu bằng CCCD/BHYT/mã lịch hẹn (có giới hạn tần suất); việc mở phiếu và mọi lần xem đều ghi nhật ký để hậu kiểm.
- **Đăng xuất** thu hồi refresh token; access token đang dùng hết hạn sau tối đa 15 phút (cookie bị xoá ngay ở trình duyệt).
- **Khoá trực tiếp trong CSDL** (không qua trang quản trị) có hiệu lực sau tối đa 30 giây (thời gian cache); nhiều instance API cũng vậy.
- **Giới hạn tần suất** (đăng nhập, tra cứu, cấp vé socket, ký) tắt khi `NODE_ENV=test` nên không nằm trong e2e — đã kiểm tra thủ công (đăng nhập quá 5 lần/phút trả 429).
- **Quản trị viên** xem được mọi hồ sơ (vai trò Sở Y tế) — mọi lượt xem đều ghi nhật ký.

## 2. Kiểm thử chịu tải Socket.io

`apps/api/test/load/socket-load.ts` chạy với API đang hoạt động:

```bash
pnpm --filter @mevita/api load:socket -- --hospitals 50 --doctors 20 --stations 5 --duration 30 --pid <pid API> --out ket-qua.json
```

| Tham số       | Ý nghĩa                                                     | Mặc định |
| ------------- | ----------------------------------------------------------- | -------- |
| `--hospitals` | Số bệnh viện tuyến trên                                     | 20       |
| `--doctors`   | Bác sĩ trực mỗi bệnh viện (mỗi người 1 kết nối)             | 10       |
| `--stations`  | Trạm y tế xã mỗi bệnh viện = số xe đang chạy (1 kết nối/xe) | 5        |
| `--duration`  | Thời gian giai đoạn gửi sinh tồn (giây)                     | 30       |
| `--interval`  | Mỗi xe gửi sinh tồn cách nhau (ms)                          | 2000     |
| `--pid`       | PID tiến trình API để đo CPU/RAM (Linux)                    | —        |

Ba giai đoạn: (1) **kết nối đồng loạt**; (2) **cảnh báo ca mới** — mỗi trạm gửi một lệnh chuyển tuyến qua HTTP cùng lúc (50 request song song), đo độ trễ từ lúc bắt đầu gửi đến lúc **từng** bác sĩ trực của đúng bệnh viện nhận `new_incoming_referral`; (3) **sinh tồn trên xe** — mỗi xe gửi `vital_update` (có ack, có ghi CSDL) định kỳ, đo độ trễ ack và độ trễ tới màn hình bệnh viện. Kiểm tra **không mất, không trùng, không lọt sang bệnh viện khác**. Dữ liệu tạm (`LOAD-…`, `@mevita.load`) tự xoá.

### Kết quả (23/11/2026)

Môi trường: 1 container Linux 4 vCPU / 16 GB, PostgreSQL 17 (Docker) và **công cụ tạo tải chạy cùng máy** với API (1 tiến trình Node 24, chưa cụm). Độ trễ tính bằng ms.

| Mức                            | Vừa             | Lớn             | Rất lớn           |
| ------------------------------ | --------------- | --------------- | ----------------- |
| Bệnh viện × bác sĩ trực        | 20 × 10         | 50 × 20         | 100 × 20          |
| Xe đang chạy                   | 100             | 250             | 1.000             |
| **Kết nối đồng thời**          | **300**         | **1.250**       | **3.000**         |
| Kết nối lỗi                    | 0               | 0               | 0                 |
| Bắt tay p50 / p95              | 143 / 165       | 56 / 109        | 66 / 119          |
| Lệnh chuyển tuyến gửi cùng lúc | 100             | 250             | 1.000             |
| Cảnh báo cần giao / đã giao    | 1.000 / 1.000   | 5.000 / 5.000   | 20.000 / 20.000   |
| **Cảnh báo p50 / p95 / p99**   | 486 / 700 / 753 | 266 / 610 / 705 | 281 / 381 / 716   |
| Sinh tồn gửi (bản/giây)        | 1.497 (50/s)    | 3.736 (125/s)   | 13.219 (441/s)    |
| Lượt giao tới bác sĩ / mất     | 14.970 / 0      | 74.720 / 0      | 264.380 / 0       |
| **Sinh tồn p50 / p95 / p99**   | 4,7 / 7,6 / 12  | 4,6 / 15 / 28   | 160 / 890 / 1.119 |
| Lọt sai bệnh viện              | 0               | 0               | 0                 |
| CPU API khi gửi sinh tồn       | 17%             | 31%             | 91% (1 nhân)      |
| RAM API trước → sau            | 138 → 308 MB    | 140 → 534 MB    | 137 → 765 MB      |

Nhận xét:

- **Đúng & đủ ở mọi mức**: 0 kết nối lỗi, 0 bản tin mất, 0 bản trùng trong CSDL (`clientId` duy nhất), 0 lần lọt sang bệnh viện khác.
- **Mục tiêu "cảnh báo < 1 giây" đạt ở mọi mức**, kể cả khi 1.000 lệnh chuyển tuyến tới cùng lúc (p99 0,72 giây). Phần lớn độ trễ là xử lý HTTP (kiểm tra, ghi CSDL, nhật ký); bản thân việc phát qua Socket.io chỉ vài ms. Thực tế một tỉnh chỉ có vài ca/giờ, độ trễ đo trên giao diện ~80–150 ms.
- **Sinh tồn**: tới ~125 bản/giây (250 xe gửi mỗi 2 giây, mỗi bản giao tới 20 bác sĩ = 2.500 lượt/giây) độ trễ p99 < 30 ms. Ở 441 bản/giây (1.000 xe đồng thời — vượt xa nhu cầu một tỉnh), **một tiến trình Node chạm trần CPU** (91%): vẫn không mất bản nào nhưng độ trễ p95 tăng lên ~0,9 giây.
- Tăng `DATABASE_POOL_MAX` (10 → 20 → 40) không giảm độ trễ cảnh báo khi dồn dập — nút cổ chai là CPU của tiến trình API (Prisma 7 chạy bộ thực thi truy vấn trong tiến trình), không phải số kết nối CSDL. Biến `DATABASE_POOL_MAX` (mặc định 10) vẫn giữ để điều chỉnh khi triển khai.
- Cảnh báo `pg` "client.query() when the client is already executing a query" phát sinh bên trong Prisma adapter (lệnh tạo lồng nhau chạy trong transaction ngầm), không ảnh hưởng kết quả; sẽ hết khi nâng cấp Prisma.

### Hướng mở rộng khi vượt ~1 nhân CPU

1. Chạy **nhiều instance API** + `@socket.io/redis-adapter` để phát sự kiện giữa các instance, **sticky session** ở load balancer; chuyển `PresenceService` (đang trong bộ nhớ) và cache `UserStatusService` sang Redis.
2. Gộp ghi sinh tồn theo lô ngắn (VD 200 ms) thay vì mỗi bản một lệnh `createMany`.
3. Tách phát sự kiện realtime khỏi luồng HTTP (hàng đợi) nếu lượng lệnh chuyển tuyến lớn.
