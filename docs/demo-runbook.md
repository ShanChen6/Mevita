# Kịch bản diễn tập & demo trước hội đồng (Task 6.3)

Tài liệu này dùng để diễn tập và demo trực tiếp với 2 thiết bị. Dữ liệu và tài khoản demo xem ở
[demo-data.md](demo-data.md).

## 1. Thiết bị

| Thiết bị                                                                     | Vai trò                                | Đăng nhập           |
| ---------------------------------------------------------------------------- | -------------------------------------- | ------------------- |
| **Laptop** (nối máy chiếu), Chrome cửa sổ 1                                  | Bác sĩ Trạm Y tế Xã Mường Khương       | `bs.an@mevita.vn`   |
| **Laptop**, Chrome cửa sổ 2 (**Incognito** hoặc profile khác để tách cookie) | Bác sĩ trực BVĐK Tỉnh Lào Cai          | `bs.binh@mevita.vn` |
| **Điện thoại** (Chrome Android hoặc Safari iOS)                              | Điều dưỡng đi kèm trên xe              | `dd.hoa@mevita.vn`  |
| Laptop, tab dự phòng                                                         | Điều phối Sở Y tế: thống kê, leo thang | `admin@mevita.vn`   |

Xếp 2 cửa sổ Chrome cạnh nhau (Win + ← / →) để hội đồng thấy cảnh báo bật lên **ngay khi** bấm gửi.
Màn hình điện thoại có thể chiếu qua phần mềm chia sẻ màn hình (scrcpy cho Android, QuickTime cho iPhone)
hoặc cầm giơ lên cho hội đồng xem.

### ⚠️ Điện thoại phải dùng HTTPS

Trình duyệt điện thoại **chỉ cho lấy GPS trên trang HTTPS**. Cookie đăng nhập ở production cũng chỉ gửi qua HTTPS.
Vì vậy điện thoại không dùng được `http://192.168.x.x:3000` của laptop. Chọn một trong hai cách:

1. **Bản triển khai thật (khuyến nghị):** web trên Vercel, API trên Render, xem [deployment.md](deployment.md).
   Cả laptop và điện thoại đều dùng URL `https://…vercel.app`.
2. **Chạy trên laptop kèm đường hầm HTTPS:** ví dụ `cloudflared tunnel --url http://localhost:3000`. Khi đó phải đặt
   `CORS_ORIGIN` và `API_PUBLIC_URL` của API theo URL đường hầm.

Gói Render miễn phí **ngủ sau 15 phút không dùng**. Hãy mở trang `…/api/health` khoảng 5 phút trước giờ demo để API
khởi động sẵn.

## 2. Checklist trước giờ demo

**T – 1 ngày**

- [ ] Chạy `demo:reset` trên CSDL production: Actions → Database (production) → `demo_reset`. Ở máy local thì chạy `pnpm demo:reset`.
- [ ] Diễn tập trọn kịch bản ở mục 3 ít nhất 2 lần, bấm giờ.
- [ ] Quay video dự phòng (mục 5) và chép vào laptop **và** USB.
- [ ] Sạc đầy điện thoại. Tắt chế độ tiết kiệm pin (tiết kiệm pin làm GPS cập nhật chậm).

**T – 30 phút**

- [ ] Chạy lại `demo:reset` để mốc giờ và hàng đợi là "hôm nay", và xoá dữ liệu diễn tập.
- [ ] Mở `…/api/health`, kết quả phải là `"status":"ok"`.
- [ ] Đăng nhập 3 tài khoản trên đúng thiết bị.
- [ ] Trên cửa sổ BVĐK, nút âm thanh ở đầu trang phải hiện **"Âm thanh: bật"**. Bấm vào trang một lần, vì trình duyệt chặn âm thanh tự phát khi chưa có thao tác.
- [ ] Huy hiệu "Đang trực" ở góc trên đã sáng xanh.
- [ ] Điện thoại: cho phép **Vị trí** khi được hỏi. Giữ màn hình luôn sáng.
- [ ] Tắt thông báo hệ điều hành và chế độ "Không làm phiền" trên laptop.
- [ ] Phóng to trình duyệt 110–125% cho hội đồng dễ đọc trên máy chiếu.

## 3. Kịch bản demo (8–10 phút)

| #   | Thời lượng | Thiết bị                                   | Thao tác                                                                                                                                                                              | Lời dẫn gợi ý                                                                                                                                                                                                                             |
| --- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0:30       | Laptop – Xã                                | Mở **Khám bệnh**, chọn **Sùng Seo Chư**                                                                                                                                               | "Bệnh nhân tai nạn giao thông vào trạm xã, GCS 12, đồng tử phải 3,5 mm, nghi máu tụ nội sọ. Trạm không đủ khả năng."                                                                                                                      |
| 2   | 1:00       | Laptop – Xã                                | **Chuyển tuyến khẩn cấp**. Chỉ vào cảnh báo dị ứng và phần tóm tắt tự soạn. Chọn chuyên khoa **Ngoại thần kinh**                                                                      | "Tóm tắt bệnh án tự soạn từ phiếu khám. Hệ thống xếp hạng bệnh viện theo chuyên khoa, giường trống, thời gian di chuyển, bác sĩ đang trực. Bạch Mai đang quá tải nên bị xếp sau, nhưng **không bị loại**: ca cấp cứu không được từ chối." |
| 3   | 0:30       | Laptop – Xã                                | Chọn BVĐK Lào Cai. Người đi kèm: ĐD. Lý Thị Hoa. Phương tiện: **Yêu cầu xe đón** (trạm chỉ có xe bán tải). Bấm **Gửi**                                                                | "Trạm chỉ có xe bán tải, không đạt chuẩn cho ca tối khẩn, nên hệ thống đề xuất xin xe đón."                                                                                                                                               |
| 4   | 0:30       | Laptop – BVĐK                              | Popup bật lên kèm còi. Chỉ dòng "1 kết nối trực đã nhận cảnh báo" bên cửa sổ xã                                                                                                       | "Dưới 1 giây. Tuyến dưới biết chắc đã có người nhận."                                                                                                                                                                                     |
| 5   | 1:00       | Laptop – BVĐK                              | **Xem hồ sơ & tiếp nhận**. Nhấn mạnh **không có nút từ chối**. Bấm **Xác nhận tiếp nhận & Sẵn sàng ê-kíp**. Vào **Xe chuyển viện** để **cử xe 24A-115.01**                            | "Ca cấp cứu chỉ có 2 lựa chọn: sẵn sàng ê-kíp, hoặc ổn định rồi chuyển tiếp. Nếu bệnh viện im lặng quá 3 phút, hệ thống tự nhắc lại và báo tuyến dưới số đường dây nóng; quá 6 phút thì báo Sở Y tế."                                     |
| 6   | 1:30       | Điện thoại                                 | Mở **Màn hình trên xe** của ca (từ danh sách Chuyển tuyến). Khi xe tới trạm: bấm **Đã đón bệnh nhân lên xe** → **Bật chia sẻ** → nhập sinh tồn (mạch 104, HA 160/95, SpO2 93, GCS 12) | "Điều dưỡng nhập chỉ số trên điện thoại. Bệnh viện thấy ngay trên biểu đồ."                                                                                                                                                               |
| 7   | 1:30       | Điện thoại                                 | Bật **chế độ máy bay** → nhập thêm 2 lần đo (GCS 11, mạch 84, HA 175/100) → tắt chế độ máy bay                                                                                        | "Đường đèo mất sóng. Dữ liệu lưu tạm trên máy. Có sóng lại thì tự gửi bù, không mất, không trùng. Bệnh viện thấy tam chứng Cushing nên chuẩn bị phòng mổ trước khi xe tới."                                                               |
| 8   | 0:45       | Laptop – BVĐK                              | Chỉ bản đồ, quãng đường còn lại, giờ tới tính theo vị trí thật                                                                                                                        | "Vị trí lấy từ GPS điện thoại trên xe."                                                                                                                                                                                                   |
| 9   | 1:00       | Laptop – BVĐK                              | **Xe đã tới — Tiếp nhận bệnh nhân** → hồ sơ điều trị tiếp nối mở ra                                                                                                                   | "Hồ sơ kế thừa toàn bộ: bệnh sử, xử trí, thuốc, sinh tồn trên xe. Bác sĩ không phải hỏi lại."                                                                                                                                             |
| 10  | 1:00       | Laptop – BVĐK (đăng nhập `bs.duc` nếu kịp) | Mở ca có sẵn **DEMO-CT-03**                                                                                                                                                           | "Ca nhiều chặng: tỉnh nhận để ổn định rồi chuyển tiếp lên Việt Đức. Tuyến trung ương thấy cả hành trình từ trạm xã."                                                                                                                      |
| 11  | 0:30       | Tab admin                                  | `/admin`: thống kê, mô hình bệnh tật. `/admin/coordination`: năng lực bệnh viện                                                                                                       | "Sở Y tế theo dõi năng lực giường và các ca chậm phản hồi."                                                                                                                                                                               |

**Ở bước 7, nếu không muốn bật chế độ máy bay trên điện thoại:** dùng DevTools của Chrome trên laptop với
cửa sổ điện thoại giả lập (Network → Offline). Cách này kém thuyết phục hơn nhưng an toàn.

## 4. Sự cố & phương án dự phòng

| Sự cố                        | Dấu hiệu                                     | Xử lý                                                                                                   |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| API đang "ngủ" (Render free) | Trang tải lâu ~30–60 giây, đăng nhập báo lỗi | Mở `…/api/health` trước, chờ `ok`. Đã checklist T–30                                                    |
| Mất Internet phòng bảo vệ    | Không tải được trang                         | Phát hotspot từ điện thoại thứ hai. Nếu vẫn không được thì **chiếu video dự phòng**                     |
| Không nghe còi               | Popup có nhưng im lặng                       | Chuyển nút thành "Âm thanh: bật" và bấm vào trang một lần. Kiểm tra âm lượng laptop                     |
| Không có popup               | Cửa sổ xã báo "0 kết nối trực"               | Cửa sổ BVĐK chưa "Đang trực": tải lại trang. Lệnh vẫn được lưu, mở **Ca chuyển tuyến** để tiếp nhận     |
| GPS không lên                | Điện thoại báo không có quyền vị trí         | Cài đặt trình duyệt → Quyền vị trí → Cho phép, rồi tải lại. Bỏ qua bước 8 nếu cần, vì sinh tồn vẫn chạy |
| Dữ liệu lộn xộn sau diễn tập | Hàng đợi có ca lạ                            | `demo:reset` (khoảng 10 giây)                                                                           |
| Bản đồ xám                   | Không tải được ảnh nền OSM                   | Mạng chặn `tile.openstreetmap.org`. Đường đi và vị trí xe vẫn hiện                                      |

## 5. Video dự phòng

Script tự chạy trọn ca demo trên 3 "thiết bị" giả lập: laptop xã, laptop tỉnh, iPhone. Script ghi hình từng thiết bị,
rồi dùng ffmpeg ghép thành một video 1920×1080 có nhãn và phụ đề tiếng Việt. Thời lượng khoảng 80 giây.

```bash
pnpm install
npx playwright install chromium   # lần đầu
pnpm demo:reset
pnpm demo:video -- --web http://localhost:3000 --api http://localhost:4000/api --out demo-video
```

- Cần cài **ffmpeg** (`winget install ffmpeg`, `brew install ffmpeg`, hoặc `apt install ffmpeg`).
- Kết quả gồm:
  - `demo-video/mevita-demo.mp4`
  - `mevita-demo.srt` (phụ đề rời, dùng khi muốn tự dựng lại)
  - `xa.webm`, `tinh.webm`, `xe.webm` (video gốc của từng thiết bị)
- Có thể quay trên bản production: `--web https://…vercel.app --api https://…onrender.com/api --password <SEED_DEMO_PASSWORD>`.
- Script dùng ca **Sùng Seo Chư**, nên phải `demo:reset` trước mỗi lần quay.
- Video do script quay không có âm thanh và không có bước cử xe. Nên quay thêm một video **thật** bằng điện thoại,
  quay cả laptop và điện thoại trong cùng khung hình khi diễn tập. Video này thuyết phục hơn khi hội đồng hỏi
  "có chạy thật không".

## 6. Câu hỏi hội đồng có thể hỏi

| Câu hỏi                                      | Ý trả lời                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nếu bệnh viện quá tải thật thì sao?          | Không từ chối ca cấp cứu (Luật KCB 2023). Có 3 tầng xử lý: xếp hạng gợi ý nơi phù hợp hơn, "ổn định rồi chuyển tiếp", và leo thang tới Sở Y tế. Ca thường mới được đề nghị chuyển, phải nêu lý do chuyên môn và nơi đề xuất. Xem [coordination.md](coordination.md) |
| Mất sóng thì có mất dữ liệu không?           | Không. Mỗi lần đo có `clientId` duy nhất, được lưu trong `localStorage`, và máy chủ ack theo lô. Đã kiểm thử: đóng trình duyệt khi mất sóng rồi mở lại vẫn đồng bộ đủ ([escort-vitals.md](escort-vitals.md))                                                        |
| Độ trễ thực tế?                              | Trên giao diện ~80–150 ms. Kiểm thử tải: 1.000 lệnh đồng thời, p99 0,72 giây ([testing.md](testing.md))                                                                                                                                                             |
| Ai xem được hồ sơ bệnh nhân?                 | Theo quan hệ khám chữa bệnh. Có ma trận 14 tài nguyên × 8 chủ thể được kiểm thử tự động. Mọi lượt xem được ghi nhật ký ([auth.md](auth.md))                                                                                                                         |
| Chữ ký hồ sơ có giá trị pháp lý?             | Hiện tại là xác thực lại mật khẩu cộng mã băm SHA-256 để phát hiện sửa đổi. Triển khai thật cần chữ ký số PKI theo quy định về bệnh án điện tử ([01-dac-ta-yeu-cau.md](report/01-dac-ta-yeu-cau.md) §1.6)                                                           |
| Vì sao dùng Socket.io mà không dùng polling? | Polling mỗi vài giây với hàng trăm bác sĩ trực gây tải lớn mà vẫn trễ. Socket.io đẩy ngay, tự kết nối lại, và hỗ trợ ack ([03-socketio.md](report/03-socketio.md))                                                                                                  |
| Tại sao tách vé socket khỏi access token?    | Access token nằm trong cookie `httpOnly`, JavaScript không đọc được (chống XSS lấy token). Vé socket hạn 60 giây, audience riêng, không dùng được để gọi REST                                                                                                       |
| Dữ liệu thống kê có thật không?              | Là dữ liệu giả lập 180 ngày ở 7 tỉnh (`sim:stats`), có đánh dấu riêng, dùng để minh hoạ dashboard                                                                                                                                                                   |
