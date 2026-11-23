# Báo cáo đồ án Mevita — tài liệu nguồn

Thư mục này gom nội dung để đưa vào báo cáo khoá luận/đồ án. Sơ đồ viết bằng Mermaid: GitHub hiển thị trực tiếp,
còn ảnh PNG có sẵn trong [`img/`](img) để chèn vào Word.

| Chương                 | Nội dung                                                                                         | Nguồn                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Đặc tả yêu cầu      | Bối cảnh, mục tiêu, tác nhân, use case, 27 yêu cầu chức năng, 10 yêu cầu phi chức năng, giới hạn | [01-dac-ta-yeu-cau.md](01-dac-ta-yeu-cau.md)                                                                                                                                                                                                                         |
| 2. Thiết kế CSDL       | ERD 21 bảng (sinh từ schema), giải thích bảng & ràng buộc                                        | [erd.md](erd.md), [../database.md](../database.md)                                                                                                                                                                                                                   |
| 3. Kênh thời gian thực | Kiến trúc, danh mục sự kiện, 5 sơ đồ tuần tự Socket.io, kết quả kiểm thử tải                     | [03-socketio.md](03-socketio.md)                                                                                                                                                                                                                                     |
| 4. Thiết kế chức năng  | Xác thực, đặt lịch, khám & ký hồ sơ, chuyển tuyến, xe, điều phối, hành trình nhiều chặng         | [../auth.md](../auth.md), [../appointments.md](../appointments.md), [../medical-records.md](../medical-records.md), [../referrals.md](../referrals.md), [../transport.md](../transport.md), [../coordination.md](../coordination.md), [../journey.md](../journey.md) |
| 5. Giao diện           | Cấu trúc 3 phân hệ                                                                               | [../ui-structure.md](../ui-structure.md)                                                                                                                                                                                                                             |
| 6. Kiểm thử            | Bảo mật, ma trận phân quyền, kiểm thử tải                                                        | [../testing.md](../testing.md)                                                                                                                                                                                                                                       |
| 7. Triển khai          | Neon + Render + Vercel, CI                                                                       | [../deployment.md](../deployment.md)                                                                                                                                                                                                                                 |
| Phụ lục                | Dữ liệu mẫu, kịch bản demo                                                                       | [../demo-data.md](../demo-data.md), [../demo-runbook.md](../demo-runbook.md)                                                                                                                                                                                         |

## Ảnh sơ đồ

| Tệp                                    | Hình                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `01-dac-ta-yeu-cau-1-1-3-tac-nhan.png` | Sơ đồ use case                                                                    |
| `erd-1-so-do-rut-gon-chi-cot-khoa.png` | ERD rút gọn (khoá chính/ngoại), vừa 1 trang ngang                                 |
| `erd-2-so-do-day-du.png`               | ERD đầy đủ (phụ lục)                                                              |
| `03-socketio-1-3-1-kien-truc.png`      | Kiến trúc triển khai                                                              |
| `03-socketio-2-…` → `03-socketio-6-…`  | Sơ đồ tuần tự: xác thực socket, chuyển tuyến, sinh tồn offline, leo thang, xe đón |

## Cập nhật khi đổi CSDL hoặc sơ đồ

```bash
pnpm --filter @mevita/api erd   # sinh lại erd.md từ schema.prisma
```

Xuất lại ảnh PNG bằng [mermaid-cli](https://github.com/mermaid-js/mermaid-cli). Lưu mỗi khối ` ```mermaid ` thành tệp `.mmd`, rồi chạy:

```bash
npx -y @mermaid-js/mermaid-cli -i so-do.mmd -o so-do.png -s 2 -b white
```
