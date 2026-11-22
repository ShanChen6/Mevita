'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createAppointment } from '@/lib/actions/appointments';
import type {
  CommuneOption,
  FacilityDetail,
  FacilitySummary,
  ProvinceOption,
  TimeSlot,
} from '@/lib/data/types';
import { addDaysStr, formatShortDate, formatTime, formatWeekday, vnNoon } from '@/lib/format';
import { facilityType } from '@/lib/labels';
import { cn } from '@/lib/utils';

const STEPS = ['Cơ sở y tế', 'Chuyên khoa & Giờ khám', 'Triệu chứng & Xác nhận'] as const;
const DAYS_SHOWN = 14;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(body.message ?? 'Có lỗi xảy ra');
  return body;
}

interface Props {
  today: string;
  provinces: ProvinceOption[];
  defaultProvinceCode: string;
  initialFacilities: FacilitySummary[];
}

export function BookingWizard({ today, provinces, defaultProvinceCode, initialFacilities }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Bước 1
  const [provinceCode, setProvinceCode] = useState(defaultProvinceCode);
  const [communes, setCommunes] = useState<CommuneOption[] | null>(null);
  const [communeCode, setCommuneCode] = useState('');
  const [facilities, setFacilities] = useState(initialFacilities);
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [loading, setLoading] = useState<'facilities' | 'facility' | 'slots' | null>(null);

  // Bước 2
  const [specialtyId, setSpecialtyId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);

  // Bước 3
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [submitting, startSubmit] = useTransition();

  async function loadFacilities(province: string, commune: string) {
    setLoading('facilities');
    setFacility(null);
    try {
      const qs = new URLSearchParams({
        ...(province && { provinceCode: province }),
        ...(commune && { communeCode: commune }),
      });
      setFacilities(await getJson<FacilitySummary[]>(`/api/public/facilities?${qs}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function onProvince(code: string) {
    setProvinceCode(code);
    setCommuneCode('');
    setCommunes(null);
    void loadFacilities(code, '');
    if (code)
      setCommunes(
        await getJson<CommuneOption[]>(`/api/public/provinces/${code}/communes`).catch(() => null),
      );
  }

  function onCommune(code: string) {
    setCommuneCode(code);
    void loadFacilities(provinceCode, code);
  }

  async function chooseFacility(id: string) {
    setLoading('facility');
    try {
      const detail = await getJson<FacilityDetail>(`/api/public/facilities/${id}`);
      setFacility(detail);
      setSpecialtyId(detail.specialties[0]?.id ?? '');
      setDoctorId('');
      setDate('');
      setSlots(null);
      setSlot(null);
      setError(null);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function loadSlots(next: { specialtyId: string; doctorId: string; date: string }) {
    setSlot(null);
    if (!facility || !next.specialtyId || !next.date) return setSlots(null);
    setLoading('slots');
    try {
      const qs = new URLSearchParams({
        date: next.date,
        specialtyId: next.specialtyId,
        ...(next.doctorId && { doctorId: next.doctorId }),
      });
      setSlots(await getJson<TimeSlot[]>(`/api/public/facilities/${facility.id}/slots?${qs}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setSlots(null);
    } finally {
      setLoading(null);
    }
  }

  const openDays = new Set(facility?.openingHours.map((h) => h.dayOfWeek));
  const dates = Array.from({ length: DAYS_SHOWN }, (_, i) => addDaysStr(today, i)).filter((d) =>
    openDays.has(new Date(`${d}T00:00:00Z`).getUTCDay()),
  );
  const doctors =
    facility?.doctors.filter((d) => !specialtyId || d.specialtyId === specialtyId) ?? [];
  const specialty = facility?.specialties.find((s) => s.id === specialtyId);
  const doctor = facility?.doctors.find((d) => d.id === doctorId);

  function submit() {
    if (!facility || !slot) return;
    startSubmit(async () => {
      const res = await createAppointment({
        facilityId: facility.id,
        specialtyId,
        doctorId: doctorId || null,
        startAt: slot.startAt,
        reason,
        initialSymptoms: symptoms,
      });
      if (!res.ok) {
        setError(res.message);
        // Khung giờ vừa bị người khác đặt → quay lại chọn giờ
        if (/hết chỗ|kín lịch/.test(res.message)) {
          setStep(1);
          void loadSlots({ specialtyId, doctorId, date });
        }
        return;
      }
      router.push(`/patient/appointments?booked=${res.data.code}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Các bước đặt lịch">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default',
                i === step && 'border-primary bg-primary/5 font-medium',
                i < step && 'hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  i < step
                    ? 'bg-emerald-600 text-white'
                    : i === step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <FormError message={error ?? undefined} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bước 1 · Chọn nơi khám</CardTitle>
            <CardDescription>
              Theo danh mục hành chính 2 cấp: 34 tỉnh/thành, 3.321 xã/phường.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="province">Tỉnh / Thành phố</Label>
                <NativeSelect
                  id="province"
                  value={provinceCode}
                  onChange={(e) => void onProvince(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.fullName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="commune">Xã / Phường (không bắt buộc)</Label>
                <NativeSelect
                  id="commune"
                  value={communeCode}
                  disabled={!provinceCode || !communes}
                  onChange={(e) => onCommune(e.target.value)}
                >
                  <option value="">Tất cả xã/phường</option>
                  {communes?.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.fullName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-col gap-2" aria-busy={loading === 'facilities'}>
              <p className="text-sm font-medium">
                Cơ sở y tế nhận đặt lịch{' '}
                <span className="text-muted-foreground font-normal">({facilities.length})</span>
              </p>
              {loading === 'facilities' ? (
                <div className="bg-muted/60 h-24 animate-pulse rounded-lg" />
              ) : facilities.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Chưa có cơ sở nào ở khu vực này nhận đặt lịch qua Mevita.
                </p>
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {facilities.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => void chooseFacility(f.id)}
                        disabled={loading === 'facility'}
                        className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring/50 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px]"
                      >
                        <Building2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">{f.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {facilityType[f.type]}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <MapPin className="size-3 shrink-0" aria-hidden />
                            {f.commune.fullName}, {f.commune.province.fullName}
                          </span>
                        </span>
                        <ChevronRight
                          className="text-muted-foreground ml-auto size-4 shrink-0 self-center"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && facility && (
        <Card>
          <CardHeader>
            <CardTitle>Bước 2 · Chuyên khoa, bác sĩ & giờ khám</CardTitle>
            <CardDescription>{facility.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="specialty">Chuyên khoa</Label>
                <NativeSelect
                  id="specialty"
                  value={specialtyId}
                  onChange={(e) => {
                    setSpecialtyId(e.target.value);
                    setDoctorId('');
                    void loadSlots({ specialtyId: e.target.value, doctorId: '', date });
                  }}
                >
                  {facility.specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor">Bác sĩ (không bắt buộc)</Label>
                <NativeSelect
                  id="doctor"
                  value={doctorId}
                  onChange={(e) => {
                    setDoctorId(e.target.value);
                    void loadSlots({ specialtyId, doctorId: e.target.value, date });
                  }}
                >
                  <option value="">Bất kỳ bác sĩ nào</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.academicTitle ? `${d.academicTitle}. ` : ''}
                      {d.fullName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Ngày khám</legend>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDate(d);
                      void loadSlots({ specialtyId, doctorId, date: d });
                    }}
                    aria-pressed={date === d}
                    className={cn(
                      'flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-xs transition-colors',
                      date === d
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    <span>{d === today ? 'Hôm nay' : formatWeekday(vnNoon(d))}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatShortDate(vnNoon(d))}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {date && (
              <div className="flex flex-col gap-2" aria-busy={loading === 'slots'}>
                <p className="text-sm font-medium">Khung giờ</p>
                {loading === 'slots' ? (
                  <div className="bg-muted/60 h-20 animate-pulse rounded-lg" />
                ) : !slots || slots.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Cơ sở không làm việc ngày này.</p>
                ) : slots.every((s) => !s.available) ? (
                  <p className="text-muted-foreground text-sm">
                    Ngày này đã kín lịch, vui lòng chọn ngày khác.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                      {slots.map((s) => (
                        <Button
                          key={s.startAt}
                          type="button"
                          variant={slot?.startAt === s.startAt ? 'default' : 'outline'}
                          disabled={!s.available}
                          aria-pressed={slot?.startAt === s.startAt}
                          onClick={() => setSlot(s)}
                          className="tabular-nums"
                        >
                          {formatTime(s.startAt)}
                        </Button>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Khung giờ mờ đã kín hoặc đã qua.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ChevronLeft /> Đổi cơ sở
              </Button>
              <Button disabled={!slot} onClick={() => setStep(2)}>
                Tiếp tục <ChevronRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && facility && slot && (
        <Card>
          <CardHeader>
            <CardTitle>Bước 3 · Triệu chứng ban đầu & xác nhận</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Lý do khám</Label>
              <Textarea
                id="reason"
                rows={2}
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Khám sức khoẻ định kỳ, tái khám tăng huyết áp…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="symptoms">Triệu chứng (không bắt buộc)</Label>
              <Textarea
                id="symptoms"
                rows={3}
                value={symptoms}
                maxLength={2000}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="VD: Sốt 38,5°C, ho khan 3 ngày, đau họng…"
              />
              <p className="text-muted-foreground text-xs">
                Giúp bác sĩ chuẩn bị trước khi bạn đến.
              </p>
            </div>

            <dl className="bg-muted grid gap-x-6 gap-y-2 rounded-lg p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cơ sở</dt>
                <dd className="font-medium">{facility.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Thời gian</dt>
                <dd className="font-medium">
                  {formatTime(slot.startAt)} · {formatWeekday(slot.startAt)},{' '}
                  {formatShortDate(slot.startAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chuyên khoa</dt>
                <dd className="font-medium">{specialty?.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bác sĩ</dt>
                <dd className="font-medium">
                  {doctor
                    ? `${doctor.academicTitle ? `${doctor.academicTitle}. ` : ''}${doctor.fullName}`
                    : 'Bất kỳ'}
                </dd>
              </div>
            </dl>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
                <ChevronLeft /> Đổi giờ
              </Button>
              <Button onClick={submit} disabled={submitting || reason.trim().length < 3}>
                {submitting ? <Loader2 className="animate-spin" /> : <Check />} Xác nhận đặt lịch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
