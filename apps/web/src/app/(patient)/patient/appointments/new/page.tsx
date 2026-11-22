import type { Metadata } from 'next';
import { Check } from 'lucide-react';

import { Field } from '@/components/shared/field';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Đặt lịch khám' };

const steps = ['Cơ sở y tế', 'Chuyên khoa & Giờ khám', 'Triệu chứng & Xác nhận'];
const slots = [
  '07:30',
  '07:45',
  '08:00',
  '08:15',
  '08:30',
  '09:00',
  '09:15',
  '09:30',
  '14:00',
  '14:15',
  '14:30',
  '15:00',
];
const busy = new Set(['08:00', '08:30', '14:15']);

/** Wireframe luồng đặt lịch 3 bước — cả 3 bước hiển thị cùng lúc để duyệt bố cục. */
export default function BookAppointmentPage() {
  return (
    <>
      <PageHeader title="Đặt lịch khám" description="3 bước đơn giản, xác nhận qua SMS." />
      <WireframeNote task="2.3">khung giờ trống lấy từ API theo cơ sở & chuyên khoa</WireframeNote>

      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Các bước đặt lịch">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              i === 0 && 'border-primary bg-primary/5',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>Bước 1 · Chọn nơi khám</CardTitle>
          <CardDescription>
            Theo danh mục hành chính 2 cấp: 34 tỉnh/thành, 3.321 xã/phường.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Tỉnh / Thành phố" htmlFor="province">
            <NativeSelect id="province" defaultValue="15">
              <option value="15">Tỉnh Lào Cai</option>
              <option value="01">Thành phố Hà Nội</option>
            </NativeSelect>
          </Field>
          <Field label="Xã / Phường" htmlFor="commune">
            <NativeSelect id="commune" defaultValue="02761">
              <option value="02761">Xã Mường Khương</option>
              <option value="">Phường Lào Cai</option>
            </NativeSelect>
          </Field>
          <Field label="Cơ sở y tế" htmlFor="facility">
            <NativeSelect id="facility" defaultValue="tyt">
              <option value="tyt">Trạm Y tế Xã Mường Khương</option>
              <option value="bv">Bệnh viện Đa khoa Tỉnh Lào Cai</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bước 2 · Chuyên khoa, bác sĩ & giờ khám</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chuyên khoa" htmlFor="specialty">
              <NativeSelect id="specialty">
                <option>Nội tổng quát</option>
                <option>Nhi khoa</option>
              </NativeSelect>
            </Field>
            <Field label="Bác sĩ (không bắt buộc)" htmlFor="doctor">
              <NativeSelect id="doctor">
                <option>Bất kỳ bác sĩ nào</option>
                <option>BS. Nguyễn Văn An</option>
              </NativeSelect>
            </Field>
            <Field label="Ngày khám" htmlFor="date">
              <NativeSelect id="date">
                <option>Thứ Tư, 02/12/2026</option>
                <option>Thứ Năm, 03/12/2026</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Khung giờ trống</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  variant={slot === '09:15' ? 'default' : 'outline'}
                  disabled={busy.has(slot)}
                  className="tabular-nums"
                >
                  {slot}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">Khung giờ mờ đã có người đặt.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bước 3 · Triệu chứng ban đầu & xác nhận</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Lý do khám / triệu chứng"
            htmlFor="symptoms"
            hint="Giúp bác sĩ chuẩn bị trước khi bạn đến."
          >
            <Textarea id="symptoms" placeholder="VD: Sốt 38,5°C, ho khan 3 ngày, đau họng…" />
          </Field>
          <div className="bg-muted rounded-lg p-4 text-sm">
            <p className="mb-2 font-medium">Tóm tắt lịch hẹn</p>
            <ul className="text-muted-foreground grid gap-1 sm:grid-cols-2">
              <li>Cơ sở: Trạm Y tế Xã Mường Khương</li>
              <li>Chuyên khoa: Nội tổng quát</li>
              <li>Thời gian: 09:15 · 02/12/2026</li>
              <li>Bác sĩ: Bất kỳ</li>
            </ul>
          </div>
          <Button className="self-end" disabled>
            <Check /> Xác nhận đặt lịch
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
