'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch, type FieldErrors, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { updateProfile } from '@/app/(patient)/patient/profile/actions';
import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { profileFormSchema, type ProfileFormValues } from '@/lib/data/profile-schema';
import type { CommuneOption, PatientProfile, ProvinceOption } from '@/lib/data/types';
import { bloodType, gender, type BloodType, type Gender } from '@/lib/labels';
import { cn } from '@/lib/utils';

function toFormValues(p: PatientProfile): ProfileFormValues {
  return {
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth.slice(0, 10),
    gender: p.gender,
    nationalId: p.nationalId ?? '',
    healthInsuranceNumber: p.healthInsuranceNumber ?? '',
    healthInsuranceExpiry: p.healthInsuranceExpiry?.slice(0, 10) ?? '',
    phone: p.phone ?? '',
    provinceCode: p.commune?.province.code ?? '',
    communeCode: p.commune?.code ?? '',
    addressDetail: p.addressDetail ?? '',
    bloodType: p.bloodType,
    allergies: p.allergies ?? '',
    chronicConditions: p.chronicConditions ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  };
}

type FieldName = FieldPath<ProfileFormValues>;

interface RowProps {
  name: FieldName;
  label: string;
  hint?: string;
  className?: string;
  errors: FieldErrors<ProfileFormValues>;
  children: React.ReactNode;
}

/** Nhãn + ô nhập + lỗi/gợi ý. Khai báo ngoài form để React không gắn lại ô nhập mỗi lần render. */
function Row({ name, label, hint, className, errors, children }: RowProps) {
  const message = errors[name]?.message;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {message ? (
        <p id={`${name}-error`} className="text-destructive text-xs">
          {message}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

interface Props {
  profile: PatientProfile;
  provinces: ProvinceOption[];
  initialCommunes: CommuneOption[];
}

export function ProfileForm({ profile, provinces, initialCommunes }: Props) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(profile),
  });
  const { register, handleSubmit, formState, control, setValue, setError, reset, getValues } = form;
  const [communes, setCommunes] = useState(initialCommunes);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const provinceCode = useWatch({ control, name: 'provinceCode' });

  // Đổi tỉnh → xoá xã đã chọn và tải danh sách xã của tỉnh mới.
  // Nếu người dùng đổi tỉnh liên tục, chỉ nhận kết quả của tỉnh đang chọn.
  async function onProvinceChange(code: string) {
    setValue('communeCode', '', { shouldDirty: true });
    setCommunes([]);
    if (!code) return;
    setLoadingCommunes(true);
    try {
      const res = await fetch(`/api/provinces/${code}/communes`);
      if (!res.ok) throw new Error();
      const list = (await res.json()) as CommuneOption[];
      if (getValues('provinceCode') === code) setCommunes(list);
    } catch {
      if (getValues('provinceCode') === code) {
        setError('communeCode', { message: 'Không tải được danh sách xã/phường' });
      }
    } finally {
      if (getValues('provinceCode') === code) setLoadingCommunes(false);
    }
  }

  const onSubmit = (values: ProfileFormValues) =>
    startTransition(async () => {
      setMessage(null);
      const res = await updateProfile(values);
      if (res.ok) {
        reset(values);
        setMessage({ ok: true, text: 'Đã lưu hồ sơ sức khoẻ.' });
        return;
      }
      for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
        setError(field as FieldName, { message: msg });
      }
      setMessage({ ok: false, text: res.message });
    });

  const err = formState.errors;
  const field = (name: FieldName) => ({
    id: name,
    'aria-invalid': !!err[name],
    'aria-describedby': `${name}-error`,
    ...register(name),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin định danh</CardTitle>
          <CardDescription>
            Dùng để tiếp đón nhanh tại cơ sở y tế và thanh toán BHYT.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Row errors={err} name="fullName" label="Họ và tên">
            <Input autoComplete="name" {...field('fullName')} />
          </Row>
          <div className="grid grid-cols-2 gap-4">
            <Row errors={err} name="dateOfBirth" label="Ngày sinh">
              <Input type="date" {...field('dateOfBirth')} />
            </Row>
            <Row errors={err} name="gender" label="Giới tính">
              <NativeSelect {...field('gender')}>
                {(Object.keys(gender) as Gender[]).map((g) => (
                  <option key={g} value={g}>
                    {gender[g]}
                  </option>
                ))}
              </NativeSelect>
            </Row>
          </div>
          <Row errors={err} name="nationalId" label="Số CCCD" hint="12 chữ số">
            <Input inputMode="numeric" maxLength={12} {...field('nationalId')} />
          </Row>
          <Row errors={err} name="phone" label="Số điện thoại liên hệ">
            <Input type="tel" autoComplete="tel" {...field('phone')} />
          </Row>
          <Row errors={err} name="healthInsuranceNumber" label="Mã thẻ BHYT">
            <Input className="uppercase" {...field('healthInsuranceNumber')} />
          </Row>
          <Row errors={err} name="healthInsuranceExpiry" label="Hạn thẻ BHYT">
            <Input type="date" {...field('healthInsuranceExpiry')} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Địa chỉ</CardTitle>
          <CardDescription>
            Theo đơn vị hành chính 2 cấp: 34 tỉnh/thành, 3.321 xã/phường/đặc khu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Row errors={err} name="provinceCode" label="Tỉnh / Thành phố">
            <NativeSelect
              id="provinceCode"
              {...register('provinceCode', {
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                  onProvinceChange(e.target.value),
              })}
            >
              <option value="">Chọn tỉnh/thành…</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.fullName}
                </option>
              ))}
            </NativeSelect>
          </Row>
          <Row errors={err} name="communeCode" label="Xã / Phường / Đặc khu">
            <NativeSelect {...field('communeCode')} disabled={!provinceCode || loadingCommunes}>
              <option value="">{loadingCommunes ? 'Đang tải…' : 'Chọn xã/phường…'}</option>
              {communes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.fullName}
                </option>
              ))}
            </NativeSelect>
          </Row>
          <Row errors={err} name="addressDetail" label="Số nhà, thôn/bản">
            <Input autoComplete="street-address" {...field('addressDetail')} />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiền sử & liên hệ khẩn cấp</CardTitle>
          <CardDescription>
            Bác sĩ sẽ thấy cảnh báo dị ứng mỗi khi khám hoặc tiếp nhận chuyển tuyến.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Row errors={err} name="bloodType" label="Nhóm máu">
            <NativeSelect {...field('bloodType')}>
              {(Object.keys(bloodType) as BloodType[]).map((b) => (
                <option key={b} value={b}>
                  {bloodType[b]}
                </option>
              ))}
            </NativeSelect>
          </Row>
          <Row
            errors={err}
            name="allergies"
            label="Dị ứng"
            hint="VD: Penicillin, hải sản. Để trống nếu không có."
          >
            <Input {...field('allergies')} />
          </Row>
          <Row
            errors={err}
            name="chronicConditions"
            label="Bệnh mạn tính / tiền sử"
            className="sm:col-span-2"
          >
            <Textarea rows={3} {...field('chronicConditions')} />
          </Row>
          <Row errors={err} name="emergencyContactName" label="Người liên hệ khẩn cấp">
            <Input {...field('emergencyContactName')} />
          </Row>
          <Row errors={err} name="emergencyContactPhone" label="SĐT người liên hệ">
            <Input type="tel" {...field('emergencyContactPhone')} />
          </Row>
        </CardContent>
      </Card>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {message &&
          (message.ok ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="size-4" aria-hidden /> {message.text}
            </p>
          ) : (
            <FormError message={message.text} />
          ))}
        <Button type="submit" disabled={pending || !formState.isDirty}>
          {pending && <Loader2 className="animate-spin" />} Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
