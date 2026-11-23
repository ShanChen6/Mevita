'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { setVehicleStatus } from '@/lib/actions/vehicles';

export function VehicleStatusToggle({
  id,
  status,
}: {
  id: string;
  status: 'AVAILABLE' | 'ON_MISSION' | 'MAINTENANCE';
}) {
  const [pending, start] = useTransition();
  if (status === 'ON_MISSION') return null;
  const next = status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setVehicleStatus(id, next);
          if (!res.ok) toast.error(res.message);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      {next === 'MAINTENANCE' ? 'Báo bảo trì' : 'Sẵn sàng lại'}
    </Button>
  );
}
