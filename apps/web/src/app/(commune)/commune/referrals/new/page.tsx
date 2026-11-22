import type { Metadata } from 'next';
import { Send } from 'lucide-react';

import { Field } from '@/components/shared/field';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { facilityType, referralPriority, type ReferralPriority } from '@/lib/labels';
import { referrals, upperLevelFacilities } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Chuyển tuyến khẩn cấp' };

const priorities: ReferralPriority[] = ['CRITICAL', 'URGENT', 'ROUTINE'];

export default function NewReferralPage() {
  const r = referrals[0]!;
  return (
    <>
      <PageHeader
        title="Lệnh chuyển tuyến khẩn cấp"
        description={`${r.patient.fullName} · ${r.diagnosis}`}
      />
      <WireframeNote task="4.2">
        khi gửi, bệnh viện nhận được cảnh báo tức thì qua Socket.io
      </WireframeNote>

      <Card>
        <CardHeader>
          <CardTitle>Nơi tiếp nhận & mức độ ưu tiên</CardTitle>
          <CardDescription>
            Có thể chọn bệnh viện trong tỉnh hoặc liên tỉnh khi vượt khả năng chuyên môn.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Bệnh viện tuyến trên" htmlFor="to">
            <NativeSelect id="to">
              {upperLevelFacilities.map((f) => (
                <option key={f.id}>
                  {f.name} — {facilityType[f.type]}, {f.provinceName}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Mức độ ưu tiên</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {priorities.map((p) => (
                <label
                  key={p}
                  className={cn(
                    'has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium',
                  )}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    defaultChecked={p === 'CRITICAL'}
                    className="accent-primary"
                  />
                  <span
                    className={cn('size-2.5 rounded-full', referralPriority[p].className)}
                    aria-hidden
                  />
                  {referralPriority[p].label}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chuyên môn</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Lý do chuyển tuyến" htmlFor="reason" className="md:col-span-2">
            <Input id="reason" defaultValue={r.reason} />
          </Field>
          <Field label="Tóm tắt bệnh án" htmlFor="summary">
            <Textarea id="summary" rows={5} defaultValue={r.clinicalSummary} />
          </Field>
          <Field label="Xử trí sơ cứu ban đầu" htmlFor="treatment">
            <Textarea id="treatment" rows={5} defaultValue={r.initialTreatment} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vận chuyển</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Phương tiện" htmlFor="vehicle">
            <Input id="vehicle" defaultValue={r.vehicleInfo} />
          </Field>
          <Field label="Nhân viên đi kèm" htmlFor="escort">
            <Input id="escort" defaultValue={r.escortName} />
          </Field>
          <Field label="Thời gian dự kiến tới (phút)" htmlFor="eta">
            <Input id="eta" type="number" inputMode="numeric" defaultValue={45} />
          </Field>
        </CardContent>
      </Card>

      <Button variant="destructive" size="lg" className="self-end">
        <Send /> Gửi lệnh chuyển tuyến
      </Button>
    </>
  );
}
