'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Building2, Loader2, MapPin, Phone, Send, Users } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createReferral } from '@/lib/actions/referrals';
import { referralFormSchema, type ReferralFormValues } from '@/lib/data/referral-schema';
import type { ReferralDestination, StaffOption } from '@/lib/data/types';
import { facilityType, referralPriority, type ReferralPriority } from '@/lib/labels';
import { cn } from '@/lib/utils';

const PRIORITIES: ReferralPriority[] = ['CRITICAL', 'URGENT', 'ROUTINE'];
const ETA_PRESETS = [15, 30, 45, 60, 90, 120];
const POSITION: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  MIDWIFE: 'Hộ sinh',
  PHYSICIAN_ASSISTANT: 'Y sĩ',
  COORDINATOR: 'Điều phối',
  RECEPTIONIST: 'Tiếp đón',
};

function DestinationCard({ d, selected }: { d: ReferralDestination; selected: boolean }) {
  return (
    <span
      className={cn(
        'flex h-full flex-col gap-2 rounded-lg border p-3 text-sm transition-colors',
        selected ? 'border-primary bg-primary/5 ring-primary/30 ring-2' : 'hover:bg-accent',
      )}
    >
      <span className="flex items-start gap-2">
        <Building2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">{d.name}</span>
          <span className="text-muted-foreground block text-xs">
            {facilityType[d.type]} · <MapPin className="inline size-3" aria-hidden />{' '}
            {d.commune.province.fullName}
          </span>
        </span>
      </span>
      {d.onDutyCount > 0 ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Users className="size-3.5" aria-hidden /> {d.onDutyCount} bác sĩ đang trực trực tuyến
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5" aria-hidden /> Chưa có ai trực trực tuyến
        </span>
      )}
      {d.emergencyPhone && (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Phone className="size-3" aria-hidden /> Đường dây nóng {d.emergencyPhone}
        </span>
      )}
      <span className="flex flex-wrap gap-1">
        {d.specialties.slice(0, 6).map((s) => (
          <Badge key={s.code} variant="outline" className="font-normal">
            {s.name}
          </Badge>
        ))}
      </span>
    </span>
  );
}

interface Props {
  portal: 'commune' | 'province';
  recordId: string;
  defaults: {
    reason: string;
    clinicalSummary: string;
    initialTreatment: string;
    priority: ReferralPriority;
  };
  destinations: ReferralDestination[];
  escorts: StaffOption[];
}

/** Lệnh chuyển tuyến khẩn cấp: chọn bệnh viện, mức độ, xử trí sơ cứu, phương tiện & thời gian dự kiến tới. */
export function ReferralForm({ portal, recordId, defaults, destinations, escorts }: Props) {
  const router = useRouter();
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralFormSchema),
    defaultValues: {
      sourceRecordId: recordId,
      toFacilityId: destinations.find((d) => d.sameProvince)?.id ?? '',
      priority: defaults.priority,
      reason: defaults.reason,
      clinicalSummary: defaults.clinicalSummary,
      initialTreatment: defaults.initialTreatment,
      escortId: '',
      vehicleInfo: '',
      etaMinutes: 45,
    },
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const [toFacilityId, priority, eta] = useWatch({
    control,
    name: ['toFacilityId', 'priority', 'etaMinutes'],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const err = formState.errors;
  const target = destinations.find((d) => d.id === toFacilityId);
  const groups = [
    { title: 'Trong tỉnh', items: destinations.filter((d) => d.sameProvince) },
    {
      title: 'Liên tỉnh — ca vượt khả năng chuyên môn tuyến tỉnh',
      items: destinations.filter((d) => !d.sameProvince),
    },
  ];

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const res = await createReferral(values);
      if (!res.ok) return setError(res.message);
      const qs = new URLSearchParams({
        sent: res.data.referral.code,
        delivered: String(res.data.delivered),
      });
      router.push(`/${portal}/referrals?${qs}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Bệnh viện tuyến trên</CardTitle>
          <CardDescription>
            Ưu tiên bệnh viện có bác sĩ đang trực — họ nhận cảnh báo ngay khi bạn gửi lệnh.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <fieldset key={g.title} className="flex flex-col gap-2">
                  <legend className="text-muted-foreground mb-2 text-sm font-medium">
                    {g.title}
                  </legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    {g.items.map((d) => (
                      <label key={d.id} className="cursor-pointer">
                        <input
                          type="radio"
                          value={d.id}
                          className="sr-only"
                          {...register('toFacilityId')}
                        />
                        <DestinationCard d={d} selected={toFacilityId === d.id} />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ),
          )}
          {destinations.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Không có bệnh viện nào nhận chuyển tuyến.
            </p>
          )}
          {err.toFacilityId && (
            <p className="text-destructive text-xs">{err.toFacilityId.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mức độ ưu tiên</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {PRIORITIES.map((p) => (
              <label
                key={p}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium',
                  priority === p && 'border-primary bg-primary/5 ring-primary/30 ring-2',
                )}
              >
                <input
                  type="radio"
                  value={p}
                  className="accent-primary"
                  {...register('priority')}
                />
                <span
                  className={cn('size-3 rounded-full', referralPriority[p].className)}
                  aria-hidden
                />
                {referralPriority[p].label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chuyên môn</CardTitle>
          <CardDescription>Đã soạn sẵn từ phiếu khám — kiểm tra và bổ sung.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="reason">Lý do chuyển tuyến</Label>
            <Input id="reason" aria-invalid={!!err.reason} {...register('reason')} />
            {err.reason && <p className="text-destructive text-xs">{err.reason.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clinicalSummary">Tóm tắt bệnh án</Label>
            <Textarea
              id="clinicalSummary"
              rows={9}
              aria-invalid={!!err.clinicalSummary}
              {...register('clinicalSummary')}
            />
            {err.clinicalSummary && (
              <p className="text-destructive text-xs">{err.clinicalSummary.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="initialTreatment">Xử trí sơ cứu ban đầu</Label>
            <Textarea
              id="initialTreatment"
              rows={9}
              placeholder="VD: Cố định cột sống cổ, băng ép cầm máu, thở oxy 5 lít/phút, truyền NaCl 0,9%…"
              {...register('initialTreatment')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vận chuyển</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="escortId">Nhân viên đi kèm xe</Label>
            <NativeSelect id="escortId" {...register('escortId')}>
              <option value="">— Chọn người đi kèm —</option>
              {escorts.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.academicTitle ? `${e.academicTitle}. ` : ''}
                  {e.fullName} ({POSITION[e.position] ?? e.position})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicleInfo">Phương tiện</Label>
            <Input
              id="vehicleInfo"
              placeholder="VD: Xe cứu thương 24A-123.45"
              {...register('vehicleInfo')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="etaMinutes">Dự kiến tới nơi sau (phút)</Label>
            <Input
              id="etaMinutes"
              inputMode="numeric"
              aria-invalid={!!err.etaMinutes}
              {...register('etaMinutes', { valueAsNumber: true })}
            />
            <div className="flex flex-wrap gap-1">
              {ETA_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={eta === m ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setValue('etaMinutes', m, { shouldValidate: true })}
                >
                  {m}′
                </Button>
              ))}
            </div>
            {err.etaMinutes && <p className="text-destructive text-xs">{err.etaMinutes.message}</p>}
          </div>
        </CardContent>
      </Card>

      {target && target.onDutyCount === 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {target.name} hiện chưa có bác sĩ trực trực tuyến. Lệnh vẫn được lưu và hiển thị khi họ
            mở hệ thống —{' '}
            <span className="font-semibold">
              hãy gọi đường dây nóng {target.emergencyPhone ?? 'của bệnh viện'}
            </span>{' '}
            để báo trước.
          </span>
        </div>
      )}

      <FormError message={error ?? undefined} />
      <div className="flex justify-end">
        <Button type="submit" variant="destructive" size="lg" disabled={pending || !target}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Gửi lệnh chuyển tuyến
          {target ? ` tới ${target.name}` : ''}
        </Button>
      </div>
    </form>
  );
}
