# LỘ TRÌNH TRIỂN KHAI DỰ ÁN: MEVITA
**Hệ thống Quản lý Hồ sơ Y tế Điện tử, Đặt lịch khám & Chuyển tuyến Thời gian thực**

---

## 1. Tổng quan & Kiến trúc hệ thống
- **Tên dự án:** Mevita
- **Mục tiêu cốt lõi:** Xây dựng nền tảng quản lý hồ sơ bệnh án điện tử tập trung trên quy mô lớn, cho phép bệnh nhân đặt trước lịch khám, lưu vết đầy đủ thông tin bác sĩ đã khám và chẩn đoán bệnh, đồng thời tối ưu quy trình **chuyển tuyến khẩn cấp thời gian thực** từ Trạm y tế cấp Xã lên Bệnh viện cấp Tỉnh/Liên tỉnh trong thời gian bệnh nhân đang di chuyển.
- **Chuẩn dữ liệu hành chính:** Tuân thủ mô hình chính quyền địa phương **2 cấp** hiện hành của Việt Nam (gồm **34 đơn vị hành chính cấp Tỉnh/Thành phố** trực thuộc Trung ương và **3.321 đơn vị hành chính cấp Xã/Phường/Đặc khu**, không qua cấp Huyện).
- **Công nghệ sử dụng (Tech Stack):**
  - **Frontend:** Next.js (App Router), TailwindCSS, Shadcn/UI, Recharts, React Hook Form + Zod.
  - **Backend:** Node.js (NestJS), Prisma ORM, JWT Authentication & RBAC.
  - **Real-time:** Socket.io (WebSockets).
  - **Database & Storage:** PostgreSQL, Cloudinary (lưu trữ hình ảnh cận lâm sàng, kết quả xét nghiệm, X-quang).

---

## 2. Lộ trình triển khai chi tiết (16 Tuần - Solo Developer)

### GIAI ĐOẠN 1: Phân tích nghiệp vụ, Chuẩn hóa dữ liệu hành chính & Thiết kế (Tuần 1 – Tuần 2)
*Mục tiêu: Hoàn thiện kiến trúc cơ sở dữ liệu chuẩn 34 tỉnh/thành, phân quyền 3 đối tượng (Bệnh nhân, Bác sĩ Xã, Bác sĩ Tỉnh) và khung giao diện.*

- [ ] **Task 1.1: Khởi tạo dự án & Môi trường phát triển**
  - Khởi tạo repository cho Frontend (`mevita-web` với Next.js + Shadcn/UI) và Backend (`mevita-api` với NestJS).
  - Cấu hình ESLint, Prettier, Docker Compose chạy PostgreSQL local và kết nối Cloudinary API.
- [ ] **Task 1.2: Chuẩn hóa dữ liệu Danh mục Hành chính (34 Tỉnh/Thành - 2 Cấp)**
  - Thu thập và làm sạch bộ dữ liệu JSON/CSV danh sách **34 Tỉnh/Thành phố** (6 TP trực thuộc TW, 28 Tỉnh) và **3.321 Xã/Phường/Đặc khu** theo quy hoạch hành chính hiện tại.
  - Thiết kế bảng `Provinces` và `Communes` trong PostgreSQL (quan hệ `1 Province - N Communes`, bỏ cấp huyện) để gắn định danh cho từng Cơ sở y tế (`HealthFacilities`) và địa chỉ Bệnh nhân.
- [ ] **Task 1.3: Thiết kế Cơ sở dữ liệu (Prisma Schema)**
  - Thiết kế các bảng cốt lõi:
    - `Users` & `Roles` (Bệnh nhân, Bác sĩ/Nhân viên y tế Xã, Bác sĩ/Điều phối viên Tỉnh, Admin).
    - `HealthFacilities` (Trạm y tế xã, Bệnh viện đa khoa tỉnh, Bệnh viện tuyến trung ương/liên tỉnh).
    - `Appointments` (Lịch hẹn khám của bệnh nhân: thời gian, cơ sở khám, chuyên khoa, lý do khám, trạng thái).
    - `MedicalRecords` (Hồ sơ khám bệnh: `patientId`, `doctorId` - lưu thông tin bác sĩ trực tiếp khám, `facilityId`, triệu chứng, chỉ số sinh tồn, mã bệnh ICD-10, chẩn đoán chi tiết, đơn thuốc).
    - `ClinicalImages` (Liên kết URL ảnh xét nghiệm, X-quang, siêu âm lưu trên Cloudinary).
    - `Referrals` (Phiếu chuyển tuyến: cơ sở gửi, cơ sở nhận, mức độ khẩn cấp, tóm tắt bệnh án, thời gian dự kiến tới nơi, trạng thái di chuyển).
    - `ReferralVitalLogs` (Nhật ký chỉ số sinh tồn cập nhật liên tục trong lúc xe chuyển viện đang chạy).
- [ ] **Task 1.4: Thiết kế UI/UX Wireframe**
  - Thiết kế 3 phân hệ giao diện tách biệt trên Next.js Route Groups: `(patient)` cho Bệnh nhân, `(commune)` cho Trạm y tế xã, `(province)` cho Bệnh viện tuyến tỉnh.

---

### GIAI ĐOẠN 2: Xác thực, Cổng Bệnh nhân & Đặt lịch khám (Tuần 3 – Tuần 5)
*Mục tiêu: Hoàn thiện luồng đăng ký, quản lý hồ sơ sức khỏe cá nhân và tính năng đặt trước lịch khám cho bệnh nhân.*

- [ ] **Task 2.1: Hệ thống Xác thực & Phân quyền (Auth & RBAC)**
  - Xây dựng API đăng ký/đăng nhập bằng JWT (Access Token & Refresh Token).
  - Tạo Guard phân quyền chặt chẽ trong NestJS: Bác sĩ chỉ xem được hồ sơ bệnh nhân thuộc cơ sở mình hoặc hồ sơ được chuyển tuyến tới cơ sở mình.
- [ ] **Task 2.2: Cổng thông tin & Hồ sơ sức khỏe Bệnh nhân**
  - Xây dựng giao diện cho bệnh nhân cập nhật thông tin định danh (CCCD, mã BHYT, địa chỉ theo 34 tỉnh/xã mới, tiền sử dị ứng, nhóm máu).
  - Xây dựng trang **"Lịch sử khám bệnh"**: Hiển thị dòng thời gian (Timeline) các lần đi khám, xem rõ **tên bác sĩ đã khám, chuyên khoa, cơ sở y tế, chẩn đoán bệnh, đơn thuốc** và hình ảnh xét nghiệm.
- [ ] **Task 2.3: Phân hệ Đặt trước lịch khám (Appointment Booking)**
  - Xây dựng API kiểm tra khung giờ trống (Time-slots) theo từng cơ sở y tế (Trạm y tế xã hoặc Bệnh viện tỉnh) và chuyên khoa.
  - Xây dựng giao diện đặt lịch khám 3 bước cho bệnh nhân: *Chọn Tỉnh/Xã & Cơ sở y tế -> Chọn Chuyên khoa/Bác sĩ & Ngày giờ -> Nhập triệu chứng ban đầu & Xác nhận*.
  - Xây dựng màn hình quản lý lịch hẹn cho bộ phận tiếp đón/bác sĩ tại cơ sở y tế (Duyệt lịch, Hủy lịch, Chuyển thành phiếu khám).

---

### GIAI ĐOẠN 3: Nghiệp vụ Khám chữa bệnh & Lưu trữ Hồ sơ tại Tuyến Xã (Tuần 6 – Tuần 8)
*Mục tiêu: Bác sĩ tiếp nhận bệnh nhân từ lịch hẹn (hoặc khám trực tiếp), thực hiện khám, chẩn đoán và lưu trữ bệnh án điện tử.*

- [ ] **Task 3.1: Tiếp nhận & Tra cứu nhanh bệnh nhân**
  - Tích hợp thanh tìm kiếm bệnh nhân tức thì theo số CCCD, mã BHYT hoặc mã đặt lịch hẹn.
  - Hiển thị tóm tắt tiền sử dị ứng và các lần khám trước đó (kể cả ở cơ sở khác) để bác sĩ nắm bắt.
- [ ] **Task 3.2: Biểu mẫu Khám lâm sàng & Chẩn đoán bệnh**
  - Xây dựng form nhập chỉ số sinh tồn (Mạch, Nhiệt độ, Huyết áp, Nhịp thở, SpO2).
  - Tích hợp danh mục tra cứu nhanh **Mã bệnh quốc tế ICD-10** giúp bác sĩ chọn chẩn đoán chính và bệnh kèm theo chuẩn xác.
  - Tự động gắn `doctorId` (thông tin bác sĩ đang đăng nhập) và chữ ký xác nhận vào `MedicalRecord` khi hoàn tất khám.
- [ ] **Task 3.3: Tích hợp lưu trữ Cận lâm sàng (Cloudinary)**
  - Xây dựng cơ chế *Signed Upload* từ Next.js lên Cloudinary cho phép tải lên ảnh chụp phiếu xét nghiệm, kết quả siêu âm, phim X-quang.
  - Tối ưu hiển thị ảnh thu nhỏ (thumbnail) và trình xem phóng to chi tiết hình ảnh y khoa cho bác sĩ.

---

### GIAI ĐOẠN 4: Lõi Chuyển tuyến Khẩn cấp Thời gian thực (Tuần 9 – Tuần 12)
*Mục tiêu: Xây dựng tính năng trọng tâm của đồ án — truyền tải dữ liệu bệnh án tức thì từ Xã lên Tỉnh/Liên tỉnh trong thời gian bệnh nhân di chuyển.*

- [ ] **Task 4.1: Thiết lập Kiến trúc Real-time (NestJS + Socket.io)**
  - Xây dựng `ReferralGateway` trên NestJS.
  - Thiết lập cơ chế **Socket Rooms** theo mã từng bệnh viện (`facility_${hospitalId}`). Khi bác sĩ tuyến tỉnh trực ca, client tự động kết nối vào Room của bệnh viện đó.
- [ ] **Task 4.2: Luồng Khởi tạo Lệnh Chuyển tuyến (Tại Tuyến Xã)**
  - Trên giao diện bệnh án của bác sĩ xã, xây dựng nút kích hoạt **"Chuyển tuyến khẩn cấp"**.
  - Cho phép chọn Bệnh viện tuyến trên (trong cùng Tỉnh hoặc **Liên tỉnh** đối với ca vượt khả năng chuyên môn), chọn mức độ ưu tiên (Cấp cứu tối khẩn / Khẩn / Thường), nhập xử trí sơ cứu ban đầu và thời gian dự kiến xe tới.
  - Khi bấm gửi: Lưu `Referral` vào PostgreSQL và bắn sự kiện `new_incoming_referral` qua Socket.io tới bệnh viện đích.
- [ ] **Task 4.3: Giao diện Cập nhật Diễn biến trên Xe Cứu thương (Mobile Responsive)**
  - Xây dựng giao diện tối giản trên điện thoại cho nhân viên y tế đi kèm xe chuyển viện.
  - Cho phép cập nhật liên tục chỉ số sinh tồn (Huyết áp, SpO2, tri giác) trên đường đi; dữ liệu đẩy trực tiếp qua Socket.io (`vital_update`) lên màn hình bệnh viện tuyến trên.
  - **Cơ chế chống mất mạng (Offline-first):** Lưu tạm vào `localStorage` nếu xe đi qua vùng mất sóng (miền núi/vùng sâu) và tự động đồng bộ ngay khi có Internet.
- [ ] **Task 4.4: Trung tâm Điều phối Tiếp nhận Chuyển tuyến (Tại Tuyến Tỉnh/Liên tỉnh)**
  - Xây dựng Dashboard trực cấp cứu cho bác sĩ tuyến trên: Phát âm thanh cảnh báo và bật Popup thông báo ngay khi có ca chuyển viện mới (< 1 giây).
  - Hiển thị đầy đủ: Hồ sơ bệnh án từ tuyến xã, thông tin bác sĩ tuyến dưới đã sơ cứu, hình ảnh cận lâm sàng, **biểu đồ biến thiên sinh tồn (Recharts) theo thời gian thực** và đếm ngược thời gian xe tới.
  - Cho phép bác sĩ tuyến trên bấm **"Xác nhận tiếp nhận & Sẵn sàng ê-kíp"** (phản hồi ngược lại cho tuyến xã yên tâm) và ghi chú chuẩn bị (VD: *Đã chuẩn bị phòng mổ số 2, dự trù 2 đơn vị máu O*).

---

### GIAI ĐOẠN 5: Hoàn thiện Vòng đời Điều trị, Báo cáo & Kiểm thử (Tuần 13 – Tuần 14)
*Mục tiêu: Khép kín quy trình từ lúc bệnh nhân nhập viện tuyến trên đến khi ra viện và tổng hợp số liệu thống kê.*

- [ ] **Task 5.1: Tiếp nhận & Điều trị tiếp nối tại Tuyến Tỉnh**
  - Khi xe tới nơi, bác sĩ tuyến tỉnh chuyển trạng thái phiếu chuyển tuyến thành `ARRIVED` (Đã tiếp nhận) và kế thừa toàn bộ dữ liệu từ tuyến xã để viết tiếp bệnh án điều trị chuyên sâu mà không cần hỏi lại bệnh sử từ đầu.
- [ ] **Task 5.2: Dashboard Thống kê & Quản trị**
  - Xây dựng biểu đồ thống kê cho quản trị viên/Sở Y tế: Số lượt đặt lịch khám, tỷ lệ chuyển tuyến từ các xã lên tỉnh, mô hình bệnh tật phổ biến theo từng địa phương.
- [ ] **Task 5.3: Kiểm thử Hệ thống (Testing)**
  - Kiểm thử luồng phân quyền bảo mật (đảm bảo không truy cập trái phép dữ liệu bệnh nhân).
  - Kiểm thử chịu tải kết nối Socket.io đồng thời nhiều bệnh viện.

---

### GIAI ĐOẠN 6: Triển khai Cloud (Deploy), Tạo Dữ liệu mẫu & Bảo vệ Đồ án (Tuần 15 – Tuần 16)
*Mục tiêu: Đưa hệ thống lên môi trường Internet thực tế và chuẩn bị kịch bản thuyết trình ấn tượng.*

- [ ] **Task 6.1: Triển khai hạ tầng (Deployment)**
  - Deploy PostgreSQL lên **Supabase** hoặc **Neon**.
  - Deploy Backend NestJS (hỗ trợ WebSockets) lên **Render** hoặc **Railway**.
  - Deploy Frontend Next.js lên **Vercel**.
- [ ] **Task 6.2: Tạo bộ Dữ liệu mẫu thực tế (Database Seeding)**
  - Import đầy đủ **34 Tỉnh/Thành và 3.321 Xã/Phường**.
  - Tạo sẵn kịch bản dữ liệu mẫu sinh động: VD *Trạm Y tế Xã Mường Khương (Tỉnh Lào Cai)* chuyển tuyến khẩn cấp bệnh nhân chấn thương sọ não lên *Bệnh viện Đa khoa Tỉnh Lào Cai*, hoặc chuyển liên tỉnh về *Bệnh viện Việt Đức (TP. Hà Nội)*.
- [ ] **Task 6.3: Viết Tài liệu & Diễn tập Demo**
  - Hoàn thiện báo cáo khóa luận/đồ án (đặc tả yêu cầu, sơ đồ ERD, sơ đồ tuần tự luồng Socket.io).
  - Quay video dự phòng và chuẩn bị 2 thiết bị (1 Laptop đóng vai Bác sĩ Xã/Tỉnh, 1 Điện thoại đóng vai Nhân viên trên xe cứu thương) để Demo trực tiếp trước hội đồng.

---
