'use client';

import { useState, useTransition } from 'react';
import { Ambulance, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { PriorityBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { dispatchVehicle } from '@/lib/actions/referrals';
import type { PickupRequest, Vehicle } from '@/lib/data/types';
import { ageAt, formatTime } from '@/lib/format';
import { gender, vehicleType } from '@/lib/labels';

function Row({ r, vehicles, now }: { r: PickupRequest; vehicles: Vehicle[]; now: string }) {
  const usable = vehicles.filter(
    (v) =>
      v.status === 'AVAILABLE' &&
      v.isActive &&
      (r.priority === 'ROUTINE' || v.type !== 'TRANSPORT'),
  );
  const [vehicleId, setVehicleId] = useState(usable[0]?.id ?? '');
  const [pending, start] = useTransition();
  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
      data-testid={`pickup-${r.code}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={r.priority} />
        <span className="font-mono text-xs">{r.code}</span>
        <span className="text-muted-foreground">gửi lúc {formatTime(r.createdAt)}</span>
        {r.isDestination && (
          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
            Ca chuyển về bệnh viện mình
          </span>
        )}
      </div>
      <p className="font-medium">
        <MapPin className="mr-1 inline size-3.5" aria-hidden />
        {r.fromFacility.name}
        {r.distanceKm != null && (
          <span className="text-muted-foreground font-normal">
            {' '}
            · {r.distanceKm.toLocaleString('vi-VN')} km · ~{r.pickupMinutes} phút tới đón
          </span>
        )}
      </p>
      <p className="text-muted-foreground">
        BN {gender[r.patient.gender].toLowerCase()}, {ageAt(r.patient.dateOfBirth, now)} tuổi —{' '}
        {r.reason} → {r.toFacility.name}
      </p>
      {usable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="h-9 w-auto"
            aria-label="Chọn xe"
          >
            {usable.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} · {vehicleType[v.type]}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={pending || !vehicleId}
            onClick={() =>
              start(async () => {
                const res = await dispatchVehicle(r.id, vehicleId);
                if (!res.ok) toast.error(res.message);
                else
                  toast.success(
                    `Đã nhận ca ${r.code} — xe ${usable.find((v) => v.id === vehicleId)?.plateNumber} lên đường (~${res.data.pickupMinutes ?? '?'} phút tới đón)`,
                  );
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Ambulance />} Cử xe đi đón
          </Button>
          {r.fromFacility.emergencyPhone && (
            <a className="text-primary text-xs" href={`tel:${r.fromFacility.emergencyPhone}`}>
              Gọi trạm {r.fromFacility.emergencyPhone}
            </a>
          )}
        </div>
      ) : (
        <p className="text-amber-800 dark:text-amber-300">
          Cơ sở không còn xe phù hợp đang sẵn sàng.
        </p>
      )}
    </li>
  );
}

/** Yêu cầu xe đón đang chờ mà cơ sở mình có thể nhận — cơ sở nhận trước được giao ca. */
export function PickupRequests({
  requests,
  vehicles,
  now,
}: {
  requests: PickupRequest[];
  vehicles: Vehicle[];
  now: string;
}) {
  if (requests.length === 0) return null;
  return (
    <Card id="pickup" className="border-amber-300 dark:border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ambulance className="size-4 text-amber-600" aria-hidden /> Yêu cầu xe đón (
          {requests.length})
        </CardTitle>
        <CardDescription>
          Trạm y tế không có xe phù hợp — cơ sở nhận trước được giao ca, các cơ sở khác tự đóng yêu
          cầu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <Row key={r.id} r={r} vehicles={vehicles} now={now} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
