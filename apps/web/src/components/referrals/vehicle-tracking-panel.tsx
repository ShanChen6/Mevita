'use client';

import { useState } from 'react';
import { Ambulance, Clock, MapPin, Navigation, Phone, SignalLow } from 'lucide-react';

import { useRealtimeEvent } from '@/components/realtime/realtime-provider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Referral, TrackPoint, VehicleLocationEvent } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { hasCoords } from '@/lib/geo';
import { transportMode, vehicleType } from '@/lib/labels';
import { EtaCountdown } from './eta-countdown';
import { VehicleMapLazy } from './vehicle-map-lazy';

/** Quá thời gian này không nhận được vị trí → báo mất tín hiệu */
const STALE_MS = 2 * 60_000;

function phaseText(r: Referral, phase: 'pickup' | 'transport' | null) {
  if (r.transportMode === 'PICKUP' && !r.vehicle) return 'Đang chờ cơ sở nhận yêu cầu xe đón';
  if (
    (phase ?? (r.transportMode === 'PICKUP' && !r.pickedUpAt ? 'pickup' : 'transport')) === 'pickup'
  )
    return `Xe đang tới ${r.fromFacility.name} đón bệnh nhân`;
  return `Đang chở bệnh nhân tới ${r.toFacility.name}`;
}

/**
 * Hành trình xe chuyển viện (Task C): bản đồ, vị trí trực tiếp từ điện thoại người đi kèm, giờ tới tính lại
 * theo vị trí thật, cảnh báo mất tín hiệu.
 */
export function VehicleTrackingPanel({
  referral: r,
  initialTrack,
  now,
}: {
  referral: Referral;
  initialTrack: TrackPoint[];
  now: string;
}) {
  const [track, setTrack] = useState<TrackPoint[]>(initialTrack);
  const [live, setLive] = useState<Pick<
    VehicleLocationEvent,
    'etaAt' | 'remainingKm' | 'speedKmh' | 'phase'
  > | null>(null);
  const [arriving, setArriving] = useState(!!r.arrivingNotifiedAt);
  const [clock, setClock] = useState(() => Date.parse(now));

  useRealtimeEvent<VehicleLocationEvent>('vehicle_location', (e) => {
    if (e.referralId !== r.id) return;
    setTrack((t) => [...t, ...e.points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)));
    setLive({ etaAt: e.etaAt, remainingKm: e.remainingKm, speedKmh: e.speedKmh, phase: e.phase });
    setClock(Date.now());
  });
  useRealtimeEvent<{ id: string }>('vehicle_arriving', (e) => {
    if (e.id === r.id) setArriving(true);
  });

  const last = track.at(-1) ?? r.latestLocation ?? null;
  const active = r.status === 'PENDING' || r.status === 'ACCEPTED';
  const stale = active && last ? clock - Date.parse(last.recordedAt) > STALE_MS : false;
  const eta = live?.etaAt ?? r.estimatedArrivalAt;
  const places = [
    hasCoords(r.fromFacility) && {
      label: r.fromFacility.name,
      latitude: r.fromFacility.latitude,
      longitude: r.fromFacility.longitude,
      kind: 'from' as const,
    },
    hasCoords(r.toFacility) && {
      label: r.toFacility.name,
      latitude: r.toFacility.latitude,
      longitude: r.toFacility.longitude,
      kind: 'to' as const,
    },
    last && {
      label: r.vehicle ? `Xe ${r.vehicle.plateNumber}` : 'Vị trí xe',
      latitude: last.latitude,
      longitude: last.longitude,
      kind: 'vehicle' as const,
    },
  ].filter((x) => !!x);

  return (
    <Card data-testid="vehicle-tracking">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Ambulance className="size-4 text-sky-600" aria-hidden /> Hành trình xe chuyển viện
          {r.transportMode && <Badge variant="outline">{transportMode[r.transportMode]}</Badge>}
          {arriving && active && (
            <Badge
              className="border-transparent bg-red-600 text-white"
              data-testid="arriving-badge"
            >
              Xe sắp tới
            </Badge>
          )}
        </CardTitle>
        <CardDescription data-testid="tracking-phase">
          {active ? phaseText(r, live?.phase ?? null) : 'Ca đã kết thúc'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-muted rounded-md px-3 py-2">
            <p className="text-muted-foreground text-xs">Dự kiến tới</p>
            <p className="font-semibold" data-testid="tracking-eta">
              {active && eta ? <EtaCountdown until={eta} /> : '—'}
            </p>
          </div>
          <div className="bg-muted rounded-md px-3 py-2">
            <p className="text-muted-foreground text-xs">Còn lại</p>
            <p className="font-semibold tabular-nums" data-testid="tracking-remaining">
              {live?.remainingKm != null ? `${live.remainingKm.toLocaleString('vi-VN')} km` : '—'}
            </p>
          </div>
          <div className="bg-muted rounded-md px-3 py-2">
            <p className="text-muted-foreground text-xs">Tốc độ</p>
            <p className="font-semibold tabular-nums">
              {live?.speedKmh != null
                ? `${live.speedKmh} km/h`
                : last?.speed != null
                  ? `${Math.round(last.speed * 3.6)} km/h`
                  : '—'}
            </p>
          </div>
          <div
            className={
              stale
                ? 'rounded-md bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
                : 'bg-muted rounded-md px-3 py-2'
            }
          >
            <p className="text-xs opacity-80">Vị trí cập nhật</p>
            <p className="flex items-center gap-1 font-semibold tabular-nums">
              {stale && <SignalLow className="size-4" aria-hidden />}
              {last ? formatTime(last.recordedAt) : 'Chưa có'}
            </p>
          </div>
        </div>
        {stale && (
          <p className="text-amber-800 dark:text-amber-300" role="status">
            Chưa nhận được vị trí mới hơn 2 phút — xe có thể đang qua vùng mất sóng; dữ liệu sẽ tự
            gửi bù khi có mạng.
          </p>
        )}
        {places.length > 0 ? (
          <VehicleMapLazy places={places} track={track.map((p) => [p.latitude, p.longitude])} />
        ) : (
          <p className="text-muted-foreground">Chưa có toạ độ cơ sở và vị trí xe.</p>
        )}
        {r.vehicle ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Navigation className="size-3.5" aria-hidden /> {r.vehicle.plateNumber} ·{' '}
              {vehicleType[r.vehicle.type]}
            </span>
            {r.vehicle.equipment && (
              <span className="text-muted-foreground">{r.vehicle.equipment}</span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden /> {r.vehicle.facility.name}
            </span>
            {r.vehicle.driverPhone && (
              <a
                className="text-primary flex items-center gap-1"
                href={`tel:${r.vehicle.driverPhone}`}
              >
                <Phone className="size-3.5" aria-hidden /> Tài xế {r.vehicle.driverName ?? ''}{' '}
                {r.vehicle.driverPhone}
              </a>
            )}
          </p>
        ) : (
          r.vehicleInfo && <p>Phương tiện: {r.vehicleInfo}</p>
        )}
        {r.transportNote && (
          <p className="text-amber-800 dark:text-amber-300">
            <Clock className="mr-1 inline size-3.5" aria-hidden />
            Lý do chọn phương tiện: {r.transportNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
