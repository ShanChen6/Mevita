'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { createVehicle, type VehicleFormValues } from '@/lib/actions/vehicles';
import { vehicleType } from '@/lib/labels';

const EMPTY: VehicleFormValues = {
  plateNumber: '',
  type: 'BASIC_AMBULANCE',
  equipment: '',
  driverName: '',
  driverPhone: '',
};

export function VehicleForm() {
  const [v, setV] = useState<VehicleFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set =
    (k: keyof VehicleFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createVehicle(v);
          if (!res.ok) return setError(res.message);
          setError(null);
          setV(EMPTY);
          toast.success(`Đã thêm xe ${v.plateNumber}`);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plateNumber">Biển số</Label>
        <Input
          id="plateNumber"
          required
          placeholder="24A-115.15"
          value={v.plateNumber}
          onChange={set('plateNumber')}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Loại xe</Label>
        <NativeSelect id="type" value={v.type} onChange={set('type')}>
          {Object.entries(vehicleType).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="equipment">Trang bị</Label>
        <Input
          id="equipment"
          placeholder="Máy thở, monitor, oxy"
          value={v.equipment}
          onChange={set('equipment')}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="driverName">Tài xế</Label>
        <Input id="driverName" value={v.driverName} onChange={set('driverName')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="driverPhone">SĐT tài xế</Label>
        <Input
          id="driverPhone"
          inputMode="tel"
          value={v.driverPhone}
          onChange={set('driverPhone')}
        />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <Button type="submit" disabled={pending || !v.plateNumber}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Thêm xe
        </Button>
        <FormError message={error ?? undefined} />
      </div>
    </form>
  );
}
