# Hành trình chuyển tuyến nhiều chặng (Xã → Tỉnh → Trung ương)

Một người bệnh có thể đi qua nhiều cơ sở: khám ở trạm y tế xã, chuyển lên bệnh viện tỉnh để ổn định,
rồi tỉnh chuyển tiếp lên bệnh viện trung ương ở Hà Nội. Mevita nối các chặng này thành **một hành trình**
để mọi nơi tham gia đều thấy toàn bộ diễn biến. Bác sĩ tuyến trung ương không phải hỏi lại tuyến xã.

## Mô hình dữ liệu

Không có bảng mới. Chuỗi được suy ra từ hai liên kết đã có:

```
Phiếu khám xã ──(sourceRecordId)── Lệnh 1 ──(arrive)──▶ Hồ sơ tiếp nối tại tỉnh
                                                         │ sourceReferralId = Lệnh 1
Hồ sơ tiếp nối tại tỉnh ──(sourceRecordId)── Lệnh 2 ──(arrive)──▶ Hồ sơ tiếp nối tại TW
```

`JourneyService.chain()` (`apps/api/src/referrals/journey.service.ts`) lần theo các liên kết này:

- **Lùi về trước:** phiếu khám nguồn của lệnh là hồ sơ tiếp nối của lệnh nào (`sourceRecord.sourceReferralId`).
- **Tiến về sau:** tìm các lệnh lập từ hồ sơ tiếp nối (`continuationRecord`).
  - Nếu một hồ sơ có nhiều lệnh (ví dụ lệnh đầu bị huỷ vì chọn nhầm bệnh viện rồi lập lại), lệnh còn hiệu lực được ưu tiên theo thứ tự ARRIVED > ACCEPTED > PENDING > REJECTED > CANCELLED.
- Chuỗi dài tối đa 10 chặng, và mỗi phiếu chỉ đi qua một lần. Hai giới hạn này chặn vòng lặp khi dữ liệu lỗi.

## API

`GET /api/referrals/:id/journey` trả về cùng một hành trình, dù gọi từ chặng nào.

| Trường         | Ý nghĩa                                                           |
| -------------- | ----------------------------------------------------------------- |
| `origin`       | Nơi khám đầu tiên: cơ sở, phiếu khám, lý do khám, chẩn đoán chính |
| `current`      | Id phiếu đang xem                                                 |
| `completed`    | Chặng cuối đã tới nơi                                             |
| `totalMinutes` | Thời gian từ lúc gửi lệnh đầu tiên tới khi chặng cuối tới nơi     |
| `hops[]`       | Thông tin từng chặng (xem dưới)                                   |

Mỗi phần tử của `hops[]` gồm:

- Cơ sở gửi và cơ sở nhận, kèm tỉnh, và cờ `interProvincial`.
- Trạng thái, mức ưu tiên, các mốc thời gian.
- `acceptanceType`, `forwardNote`, phương tiện.
- Hồ sơ nguồn và hồ sơ tiếp nối.
- Toàn bộ sinh tồn đo trên xe.

### Quyền xem

Mọi cơ sở tham gia **bất kỳ** chặng nào của hành trình được xem toàn bộ hành trình. Cơ sở tham gia là
cơ sở gửi, cơ sở nhận, hoặc cơ sở có xe chở. Quyền này áp dụng cho:

- `GET /referrals/:id`
- `/vitals`
- `/locations`
- `/journey`

Nhờ vậy tuyến trung ương mở được phiếu xã → tỉnh, và trạm xã theo dõi được ca đã lên tới trung ương.

Quyền **xem** không đi kèm quyền **thao tác**. Chỉ bệnh viện nhận của chính chặng đó mới tiếp nhận hoặc
đánh dấu "xe đã tới". Chỉ cơ sở gửi của chặng đó mới huỷ lệnh. Cơ sở ngoài chuỗi vẫn nhận 404.

## Ổn định rồi chuyển tiếp

Khi tuyến tỉnh **"Tiếp nhận – ổn định – chuyển tiếp"** (`acceptanceType = STABILIZE_FORWARD`, xem
[coordination.md](coordination.md)):

1. Xe tới → bệnh viện mở hồ sơ tiếp nối như thường lệ.
2. Hồ sơ tiếp nối hiện ô nhắc **"Lập lệnh chuyển tiếp"** kèm kế hoạch đã báo cho tuyến dưới.
3. Bấm nút để mở form lập lệnh từ hồ sơ tiếp nối:
   - Có banner "Chặng chuyển tiếp của lệnh …".
   - Lý do được điền sẵn từ `forwardNote`.
   - Danh sách bệnh viện vẫn được xếp hạng theo chuyên khoa, giường trống và thời gian di chuyển.
4. Sau khi lập chặng tiếp theo, ô nhắc biến mất ở mọi nơi.

## Giao diện

`JourneyTimeline` (`apps/web/src/components/referrals/journey-timeline.tsx`) hiện các mốc sau:

- Nơi khám đầu tiên.
- Từng chặng, gồm bệnh viện, trạng thái, nhãn liên tỉnh, nhãn "Ổn định rồi chuyển tiếp", các mốc giờ, phương tiện, sinh tồn trên xe (lần đầu → lần cuối) và kế hoạch chuyển tiếp.
- Bước "Chờ chuyển tiếp" nếu còn dở.

Chặng đang xem được viền nổi bật. Các chặng khác có link "Xem phiếu chặng N".

Timeline hiện ở hai nơi:

- **Trang chi tiết phiếu chuyển tuyến**, khi hành trình có từ 2 chặng hoặc đang chờ chuyển tiếp.
- **Hồ sơ điều trị tiếp nối**, phía trên khung "Hồ sơ chuyển tuyến".

## Thống kê

`GET /api/stats/overview` có thêm ba KPI, hiển thị trong thẻ "Phiếu chuyển tuyến" ở `/admin`:

- `onwardReferrals`: chặng chuyển tiếp, tức lệnh lập từ hồ sơ tiếp nối.
- `stabilizeForward`: số ca tuyến trên nhận để ổn định thay vì từ chối.
- `hospitalReferrals`: số lệnh do bệnh viện lập, không phải trạm xã.

## Kiểm thử

- e2e (`test/referrals.e2e-spec.ts`, mục "hành trình nhiều chặng"):
  - Ca xã → tỉnh được nhận với STABILIZE_FORWARD, xe tới, rồi tỉnh lập chặng 2 lên trung ương, và trung ương tiếp nhận.
  - Hành trình giống nhau khi xem từ chặng 1 hay chặng 2.
  - Quyền xem chéo đúng, cơ sở ngoài chuỗi bị chặn.
  - Lệnh huỷ ở chặng sau không che lệnh đang hiệu lực.
- e2e (`test/stats.e2e-spec.ts`): đếm chặng chuyển tiếp và số ca nhận để ổn định.
