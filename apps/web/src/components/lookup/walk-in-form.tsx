'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { createWalkInPatient, type CreatePatientValues } from '@/lib/actions/patients';
import type { LookupKind } from '@/lib/data/types';
import { StartEncounterForm } from './start-encounter-form';

interface Props {
  /** Từ khoá vừa tra — điền sẵn CCCD/BHYT/SĐT nếu khớp định dạng */
  query: string;
  kind: LookupKind;
  onEncounter: (code: string) => void;
}

/** Tạo hồ sơ cho bệnh nhân lần đầu đến cơ sở (chưa có trên hệ thống). */
export function WalkInForm({ query, kind, onEncounter }: Props) {
  const compact = query.replace(/[\s.-]/g, '').toUpperCase();
  const [values, setValues] = useState<CreatePatientValues>({
    fullName: kind === 'NAME' ? query.trim() : '',
    dateOfBirth: '',
    gender: 'MALE',
    nationalId: kind === 'NATIONAL_ID' ? compact : '',
    healthInsuranceNumber: kind === 'HEALTH_INSURANCE' ? compact : '',
    phone: kind === 'PHONE_OR_INSURANCE' ? compact : '',
    allergies: '',
  });
  const [created, setCreated] = useState<{ id: string; fullName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set =
    (k: keyof CreatePatientValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createWalkInPatient(values);
      if (!res.ok) return setError(res.message);
      setError(null);
      setCreated(res.data);
    });
  };

  if (created) {
    return (
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> Đã tạo hồ sơ{' '}
            {created.fullName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StartEncounterForm patientId={created.id} onStarted={(r) => onEncounter(r.code)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-5" aria-hidden /> Tạo hồ sơ bệnh nhân mới
        </CardTitle>
        <CardDescription>
          Bệnh nhân chưa có trên hệ thống. Có thể bổ sung thông tin sau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="w-name">Họ và tên</Label>
            <Input id="w-name" value={values.fullName} onChange={set('fullName')} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-dob">Ngày sinh</Label>
            <Input
              id="w-dob"
              type="date"
              value={values.dateOfBirth}
              onChange={set('dateOfBirth')}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-gender">Giới tính</Label>
            <NativeSelect id="w-gender" value={values.gender} onChange={set('gender')}>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-cccd">Số CCCD</Label>
            <Input
              id="w-cccd"
              inputMode="numeric"
              maxLength={12}
              value={values.nationalId}
              onChange={set('nationalId')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-bhyt">Mã thẻ BHYT</Label>
            <Input
              id="w-bhyt"
              className="uppercase"
              value={values.healthInsuranceNumber}
              onChange={set('healthInsuranceNumber')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-phone">Số điện thoại</Label>
            <Input id="w-phone" type="tel" value={values.phone} onChange={set('phone')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-allergies">Dị ứng</Label>
            <Input
              id="w-allergies"
              placeholder="Để trống nếu không có"
              value={values.allergies}
              onChange={set('allergies')}
            />
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormError message={error ?? undefined} />
            <Button type="submit" className="self-end" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Tạo hồ sơ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
