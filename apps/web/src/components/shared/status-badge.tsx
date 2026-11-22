import { Badge } from '@/components/ui/badge';
import {
  appointmentStatus,
  referralPriority,
  referralStatus,
  type AppointmentStatus,
  type ReferralPriority,
  type ReferralStatus,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const d = appointmentStatus[status];
  return <Badge className={cn('border-transparent', d.className)}>{d.label}</Badge>;
}

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const d = referralStatus[status];
  return <Badge className={cn('border-transparent', d.className)}>{d.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: ReferralPriority }) {
  const d = referralPriority[priority];
  return <Badge className={cn('border-transparent', d.className)}>{d.label}</Badge>;
}
