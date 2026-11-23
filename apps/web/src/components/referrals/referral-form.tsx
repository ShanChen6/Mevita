'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Building2,
  Loader2,
  MapPin,
  Phone,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createReferral, rankDestinations } from '@/lib/actions/referrals';
import { NativeSelect } from '@/components/ui/native-select';
import { TransportSection } from './transport-section';
import { referralFormSchema, type ReferralFormValues } from '@/lib/data/referral-schema';
import type { ReferralDestination, StaffOption, TransportOptions } from '@/lib/data/types';
import { facilityType, loadLevel, referralPriority, type ReferralPriority } from '@/lib/labels';
import { cn } from '@/lib/utils';

const PRIORITIES: ReferralPriority[] = ['CRITICAL', 'URGENT', 'ROUTINE'];

function DestinationCard({
  d,
  selected,
  specialty,
}: {
  d: ReferralDestination;
  selected: boolean;
  specialty: string;
}) {
  const beds =
    d.erBedsAvailable != null && d.erBedsTotal != null
      ? `Còn ${d.erBedsAvailable}/${d.erBedsTotal} giường cấp cứu${d.icuBedsAvailable != null ? ` · ${d.icuBedsAvailable} hồi sức` : ''}`
      : 'Chưa cập nhật số giường';
  return (
    <span
      className={cn(
        'flex h-full flex-col gap-2 rounded-lg border p-3 text-sm transition-colors',
        selected ? 'border-primary bg-primary/5 ring-primary/30 ring-2' : 'hover:bg-accent',
      )}
      data-testid={`dest-${d.id}`}
    >
      <span className="flex items-start gap-2">
        <Building2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">{d.name}</span>
          <span className="text-muted-foreground block text-xs">
            {facilityType[d.type]} · <MapPin className="inline size-3" aria-hidden />{' '}
            {d.commune.province.fullName}
            {!d.sameProvince && ' · liên tỉnh'}
          </span>
        </span>
        {d.recommended && (
          <Badge className="bg-primary text-primary-foreground shrink-0 border-transparent">
            <Sparkles className="size-3" aria-hidden /> Gợi ý
          </Badge>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge className={cn('border-transparent', loadLevel[d.load].className)}>
          {loadLevel[d.load].label}
          {d.capacityStale && d.load !== 'UNKNOWN' ? ' (số liệu cũ)' : ''}
        </Badge>
        <span>{beds}</span>
        {d.travelMinutes != null && (
          <span className="text-muted-foreground">
            · ~{d.travelMinutes} phút
            {d.distanceKm != null ? ` (${Math.round(d.distanceKm * 1.35)} km)` : ''}
          </span>
        )}
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          d.onDutyCount > 0
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-amber-700 dark:text-amber-400',
        )}
      >
        {d.onDutyCount > 0 ? (
          <Users className="size-3.5" aria-hidden />
        ) : (
          <AlertTriangle className="size-3.5" aria-hidden />
        )}
        {d.onDutyCount > 0
          ? `${d.onDutyCount} bác sĩ đang trực trực tuyến`
          : 'Chưa có ai trực trực tuyến'}
      </span>
      {d.warnings.filter((w) => !/trực tuyến|số giường|giường đã cũ/.test(w)).length > 0 && (
        <span className="text-xs text-amber-800 dark:text-amber-300">
          ⚠ {d.warnings.filter((w) => !/trực tuyến|số giường|giường đã cũ/.test(w)).join(' · ')}
        </span>
      )}
      {d.emergencyPhone && (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Phone className="size-3" aria-hidden /> Đường dây nóng {d.emergencyPhone}
        </span>
      )}
      <span className="flex flex-wrap gap-1">
        {[...d.specialties]
          .sort((a, b) => Number(b.code === specialty) - Number(a.code === specialty))
          .slice(0, 6)
          .map((s) => (
            <Badge
              key={s.code}
              variant="outline"
              className={cn(
                'font-normal',
                s.code === specialty && 'border-primary text-primary font-medium',
              )}
            >
              {s.name}
            </Badge>
          ))}
      </span>
    </span>
  );
}

/** Mặc định theo tình trạng bệnh nhân: có xe cứu thương sẵn sàng → dùng ngay; ca cấp cứu không có xe → xin xe đón. */
function defaultTransport(t: TransportOptions, priority: ReferralPriority) {
  const amb = t.ownVehicles.find((v) => v.status === 'AVAILABLE' && v.type !== 'TRANSPORT');
  if (amb)
    return { transportMode: 'FACILITY_VEHICLE' as const, vehicleId: amb.id, transportNote: '' };
  if (priority === 'ROUTINE') {
    const any = t.ownVehicles.find((v) => v.status === 'AVAILABLE');
    return any
      ? { transportMode: 'FACILITY_VEHICLE' as const, vehicleId: any.id, transportNote: '' }
      : { transportMode: 'FAMILY' as const, vehicleId: '', transportNote: '' };
  }
  return { transportMode: 'PICKUP' as const, vehicleId: '', transportNote: '' };
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
  transport: TransportOptions;
  /** Bệnh viện chọn sẵn (VD cơ sở được đề xuất khi ca bị đề nghị chuyển) */
  initialTo?: string;
}

/** Lệnh chuyển tuyến khẩn cấp: chọn bệnh viện, mức độ, xử trí sơ cứu, phương tiện & thời gian dự kiến tới. */
export function ReferralForm({
  portal,
  recordId,
  defaults,
  destinations,
  escorts,
  transport,
  initialTo,
}: Props) {
  const router = useRouter();
  const form = useForm<ReferralFormValues>({
    resolver: zodResolver(referralFormSchema),
    defaultValues: {
      sourceRecordId: recordId,
      toFacilityId:
        (
          destinations.find((d) => d.id === initialTo) ??
          destinations.find((d) => d.recommended) ??
          destinations[0]
        )?.id ?? '',
      requiredSpecialtyCode: '',
      priority: defaults.priority,
      reason: defaults.reason,
      clinicalSummary: defaults.clinicalSummary,
      initialTreatment: defaults.initialTreatment,
      escortId: '',
      vehicleInfo: '',
      etaMinutes: 45,
      ...defaultTransport(transport, defaults.priority),
    },
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const [toFacilityId, priority, specialty] = useWatch({
    control,
    name: ['toFacilityId', 'priority', 'requiredSpecialtyCode'],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(destinations);
  const [ranking, setRanking] = useState(false);
  // Người dùng đã tự chọn bệnh viện → không tự đổi theo gợi ý nữa
  const [picked, setPicked] = useState(!!initialTo);
  const pickedRef = useRef(!!initialTo);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  const first = useRef(true);
  const err = formState.errors;
  const target = list.find((d) => d.id === toFacilityId);
  const specialtyOptions = [
    ...new Map(destinations.flatMap((d) => d.specialties).map((s) => [s.code, s])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // Đổi mức độ / chuyên khoa cần → xếp hạng lại bệnh viện (Task B)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setRanking(true);
      void rankDestinations(priority, specialty).then((ranked) => {
        if (cancelled) return;
        setRanking(false);
        if (!ranked) return;
        setList(ranked);
        const best = ranked.find((d) => d.recommended) ?? ranked[0];
        if (!pickedRef.current && best) setValue('toFacilityId', best.id);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [priority, specialty, setValue]);

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const res = await createReferral(values);
      if (!res.ok) return setError(res.message);
      const qs = new URLSearchParams({
        sent: res.data.referral.code,
        delivered: String(res.data.delivered),
        ...(res.data.pickup && { pickup: String(res.data.pickup.facilities) }),
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
            Xếp theo mức phù hợp cho ca {referralPriority[priority].label.toLowerCase()}: chuyên
            khoa cần, giường trống, thời gian di chuyển, bác sĩ đang trực. Bệnh viện quá tải vẫn
            chọn được — ca cấp cứu không bị từ chối.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requiredSpecialtyCode">Chuyên khoa cần ở tuyến trên</Label>
              <NativeSelect
                id="requiredSpecialtyCode"
                className="w-64"
                {...register('requiredSpecialtyCode')}
              >
                <option value="">— Không chỉ định —</option>
                {specialtyOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {ranking && (
              <span className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Đang xếp hạng lại…
              </span>
            )}
          </div>
          <div
            className="grid gap-3 md:grid-cols-2"
            role="radiogroup"
            aria-label="Bệnh viện tuyến trên"
          >
            {list.map((d) => (
              <label key={d.id} className="cursor-pointer">
                <input
                  type="radio"
                  value={d.id}
                  className="sr-only"
                  {...register('toFacilityId', { onChange: () => setPicked(true) })}
                />
                <DestinationCard d={d} selected={toFacilityId === d.id} specialty={specialty} />
              </label>
            ))}
          </div>
          {list.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Không có bệnh viện nào nhận chuyển tuyến.
            </p>
          )}
          {target &&
            (target.load === 'RED' || target.warnings.some((w) => w.startsWith('Không có'))) && (
              <p
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
              >
                {target.name}: {target.warnings.filter((w) => !/trực tuyến/.test(w)).join(', ')}.
                Bệnh viện vẫn phải tiếp nhận và ổn định ca cấp cứu
                {list.find((d) => d.recommended && d.id !== target.id)
                  ? ` — cân nhắc gợi ý ${list.find((d) => d.recommended)!.name}.`
                  : '.'}
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

      <TransportSection
        control={control}
        register={register}
        setValue={setValue}
        errors={err}
        options={transport}
        target={target}
        escorts={escorts}
      />

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
