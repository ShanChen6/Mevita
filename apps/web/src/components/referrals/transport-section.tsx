'use client';

import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { AlertTriangle, Ambulance, Car, Info, Phone, Truck, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { ReferralFormValues } from '@/lib/data/referral-schema';
import type { ReferralDestination, StaffOption, TransportOptions } from '@/lib/data/types';
import { belowRecommendation, hasCoords, haversineKm, travelMinutes } from '@/lib/geo';
import { transportMode, vehicleStatus, vehicleType } from '@/lib/labels';
import { cn } from '@/lib/utils';

const MODES = ['FACILITY_VEHICLE', 'PICKUP', 'EMS_115', 'FAMILY', 'OTHER'] as const;
const ICON = {
  FACILITY_VEHICLE: Truck,
  PICKUP: Ambulance,
  EMS_115: Phone,
  FAMILY: Users,
  OTHER: Car,
} as const;
const ETA_PRESETS = [15, 30, 45, 60, 90, 120];
const POSITION: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  MIDWIFE: 'Hộ sinh',
  PHYSICIAN_ASSISTANT: 'Y sĩ',
  COORDINATOR: 'Điều phối',
  RECEPTIONIST: 'Tiếp đón',
};

interface Props {
  control: Control<ReferralFormValues>;
  register: UseFormRegister<ReferralFormValues>;
  setValue: UseFormSetValue<ReferralFormValues>;
  errors: FieldErrors<ReferralFormValues>;
  options: TransportOptions;
  target: ReferralDestination | undefined;
  escorts: StaffOption[];
}

/**
 * Vận chuyển (Task C): khuyến nghị theo mức độ ưu tiên, chọn xe của cơ sở / yêu cầu xe đón / 115 / gia đình.
 * Chọn thấp hơn khuyến nghị phải ghi lý do (API kiểm tra lại).
 */
export function TransportSection({
  control,
  register,
  setValue,
  errors,
  options,
  target,
  escorts,
}: Props) {
  const [priority, mode, vehicleId, eta] = useWatch({
    control,
    name: ['priority', 'transportMode', 'vehicleId', 'etaMinutes'],
  });
  const vehicle = options.ownVehicles.find((v) => v.id === vehicleId);
  const below = belowRecommendation(priority, mode, vehicle?.type ?? null);
  const suggested =
    options.origin && hasCoords(target) ? travelMinutes(haversineKm(options.origin, target)) : null;
  const km =
    options.origin && hasCoords(target)
      ? Math.round(haversineKm(options.origin, target) * 1.35)
      : null;
  const available = options.ownVehicles.filter((v) => v.status === 'AVAILABLE');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vận chuyển</CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{' '}
          {options.recommendation[priority]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5"
          role="radiogroup"
          aria-label="Phương thức vận chuyển"
        >
          {MODES.map((m) => {
            const Icon = ICON[m];
            const warn = belowRecommendation(
              priority,
              m,
              m === 'FACILITY_VEHICLE'
                ? (available.find((v) => v.type !== 'TRANSPORT')?.type ?? 'TRANSPORT')
                : null,
            );
            return (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm',
                  mode === m && 'border-primary bg-primary/5 ring-primary/30 ring-2',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    value={m}
                    className="accent-primary"
                    {...register('transportMode', {
                      // Chọn "Xe của cơ sở" → chọn sẵn xe phù hợp nhất đang sẵn sàng (xe cứu thương trước)
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.value === 'FACILITY_VEHICLE' && !vehicleId) {
                          const best =
                            available.find((v) => v.type !== 'TRANSPORT') ?? available[0];
                          if (best) setValue('vehicleId', best.id);
                        }
                      },
                    })}
                  />
                  <Icon className="size-4" aria-hidden /> {transportMode[m]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {m === 'FACILITY_VEHICLE' &&
                    (available.length ? `${available.length} xe sẵn sàng` : 'Không có xe sẵn sàng')}
                  {m === 'PICKUP' &&
                    (options.pickupCandidates[0]
                      ? `${options.pickupCandidates[0].name}: ~${options.pickupCandidates[0].pickupMinutes ?? '?'} phút tới đón`
                      : 'Chưa có cơ sở nào có xe sẵn sàng')}
                  {m === 'EMS_115' && 'Gọi 115, ghi biển số / số điện thoại'}
                  {m === 'FAMILY' && 'Người nhà tự đưa đi'}
                  {m === 'OTHER' && 'Ghi rõ phương tiện'}
                </span>
                {warn && priority !== 'ROUTINE' && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Dưới khuyến nghị
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {mode === 'FACILITY_VEHICLE' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicleId">Xe của cơ sở</Label>
            <NativeSelect
              id="vehicleId"
              aria-invalid={!!errors.vehicleId}
              {...register('vehicleId')}
            >
              <option value="">— Chọn xe —</option>
              {options.ownVehicles.map((v) => (
                <option key={v.id} value={v.id} disabled={v.status !== 'AVAILABLE'}>
                  {v.plateNumber} · {vehicleType[v.type]}
                  {v.status !== 'AVAILABLE' ? ` (${vehicleStatus[v.status].label})` : ''}
                </option>
              ))}
            </NativeSelect>
            {errors.vehicleId && (
              <p className="text-destructive text-xs">{errors.vehicleId.message}</p>
            )}
          </div>
        )}

        {mode === 'PICKUP' && (
          <div className="flex flex-col gap-2 text-sm" data-testid="pickup-candidates">
            <p>
              Yêu cầu được gửi ngay tới <span className="font-medium">bệnh viện nhận</span> và các
              cơ sở có xe cứu thương sẵn sàng trong bán kính 150 km.{' '}
              <span className="font-medium">Cơ sở nhận trước được giao ca</span>; bạn nhận thông báo
              xe nào tới đón và giờ dự kiến.
            </p>
            {options.pickupCandidates.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {options.pickupCandidates.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.distanceKm != null && (
                      <span className="text-muted-foreground">
                        {c.distanceKm.toLocaleString('vi-VN')} km · ~{c.pickupMinutes} phút tới đón
                      </span>
                    )}
                    {c.advanced > 0 && <Badge variant="outline">{c.advanced} xe hồi sức</Badge>}
                    {c.basic > 0 && <Badge variant="outline">{c.basic} xe cơ bản</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-800 dark:text-amber-300">
                Chưa có cơ sở nào trong khu vực có xe sẵn sàng — yêu cầu vẫn gửi tới bệnh viện nhận;
                nên gọi thêm 115.
              </p>
            )}
          </div>
        )}

        {below && (
          <div
            className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
            role="alert"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Phương tiện thấp hơn khuyến
              nghị cho ca {priority === 'CRITICAL' ? 'tối khẩn' : 'khẩn'}
            </p>
            <Label htmlFor="transportNote">Lý do (bắt buộc, lưu vào nhật ký)</Label>
            <Textarea
              id="transportNote"
              rows={2}
              placeholder="VD: Đường sạt lở, xe cứu thương không vào được; gia đình đã có xe và nhân viên trạm đi kèm"
              className="bg-background"
              {...register('transportNote')}
            />
            {errors.transportNote && (
              <p className="text-destructive text-xs">{errors.transportNote.message}</p>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
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
            <span className="text-muted-foreground text-xs">
              Người này chia sẻ vị trí & sinh tồn từ điện thoại.
            </span>
          </div>
          {(mode === 'EMS_115' || mode === 'FAMILY' || mode === 'OTHER') && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="vehicleInfo">Phương tiện</Label>
              <Input
                id="vehicleInfo"
                placeholder="VD: Xe 115 biển 24A-115.15, tài xế 0912…"
                {...register('vehicleInfo')}
              />
            </div>
          )}
          {mode !== 'PICKUP' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="etaMinutes">Dự kiến tới nơi sau (phút)</Label>
              <Input
                id="etaMinutes"
                inputMode="numeric"
                aria-invalid={!!errors.etaMinutes}
                {...register('etaMinutes', { valueAsNumber: true })}
              />
              <div className="flex flex-wrap gap-1">
                {suggested != null && (
                  <Button
                    type="button"
                    size="sm"
                    variant={eta === suggested ? 'default' : 'secondary'}
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setValue('etaMinutes', Math.max(5, suggested), { shouldValidate: true })
                    }
                    title={`~${km} km đường bộ, 40 km/h`}
                  >
                    Gợi ý {suggested}′
                  </Button>
                )}
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
              {errors.etaMinutes && (
                <p className="text-destructive text-xs">{errors.etaMinutes.message}</p>
              )}
              <span className="text-muted-foreground text-xs">
                Tự cập nhật theo vị trí xe khi người đi kèm chia sẻ vị trí.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
