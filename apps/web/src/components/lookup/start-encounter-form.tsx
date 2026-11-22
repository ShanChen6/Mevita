'use client';

import { useState, useTransition } from 'react';
import { Loader2, Stethoscope } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { startEncounter } from '@/lib/actions/patients';

interface Props {
  patientId: string;
  onStarted: (record: { id: string; code: string; created: boolean }) => void;
}

/** Mở phiếu khám cho bệnh nhân đến trực tiếp (không đặt lịch). */
export function StartEncounterForm({ patientId, onStarted }: Props) {
  const [complaint, setComplaint] = useState('');
  const [type, setType] = useState<'OUTPATIENT' | 'EMERGENCY'>('OUTPATIENT');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await startEncounter({
        patientId,
        chiefComplaint: complaint,
        encounterType: type,
      });
      if (!res.ok) return setError(res.message);
      setError(null);
      onStarted(res.data);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <p className="text-sm font-medium">Tiếp nhận khám trực tiếp</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Lý do đến khám"
          placeholder="Lý do đến khám, VD: sốt cao 2 ngày"
          value={complaint}
          maxLength={500}
          onChange={(e) => setComplaint(e.target.value)}
          className="flex-1"
        />
        <div className="sm:w-36">
          <NativeSelect
            aria-label="Hình thức"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="OUTPATIENT">Khám thường</option>
            <option value="EMERGENCY">Cấp cứu</option>
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending || complaint.trim().length < 2}>
          {pending ? <Loader2 className="animate-spin" /> : <Stethoscope />} Bắt đầu khám
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </form>
  );
}
