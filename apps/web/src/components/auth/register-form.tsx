'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';

import { register } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { FormState } from '@/lib/auth/schemas';
import { cn } from '@/lib/utils';
import { FieldError, FormError } from './form-message';

interface FieldProps {
  name: string;
  label: string;
  hint?: string;
  className?: string;
  state: FormState;
  children: (props: {
    id: string;
    name: string;
    'aria-invalid': boolean;
    'aria-describedby': string;
  }) => React.ReactNode;
}

function FormField({ name, label, hint, className, state, children }: FieldProps) {
  const errors = state.fieldErrors?.[name];
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={name}>{label}</Label>
      {children({ id: name, name, 'aria-invalid': !!errors, 'aria-describedby': `${name}-error` })}
      {errors ? (
        <FieldError id={`${name}-error`} errors={errors} />
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const v = state.values ?? {};

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormError message={state.message} />
      </div>
      <FormField name="fullName" label="Họ và tên" state={state} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="name" defaultValue={v.fullName} required />}
      </FormField>
      <FormField name="phone" label="Số điện thoại" state={state}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" defaultValue={v.phone} />}
      </FormField>
      <FormField
        name="email"
        label="Email"
        hint="Không bắt buộc nếu đã có số điện thoại"
        state={state}
      >
        {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={v.email} />}
      </FormField>
      <FormField name="dateOfBirth" label="Ngày sinh" state={state}>
        {(p) => <Input {...p} type="date" defaultValue={v.dateOfBirth} required />}
      </FormField>
      <FormField name="gender" label="Giới tính" state={state}>
        {(p) => (
          <NativeSelect {...p} defaultValue={v.gender ?? ''} required>
            <option value="" disabled>
              Chọn…
            </option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </NativeSelect>
        )}
      </FormField>
      <FormField
        name="nationalId"
        label="Số CCCD"
        hint="Không bắt buộc. Có thể bổ sung sau trong hồ sơ."
        state={state}
        className="sm:col-span-2"
      >
        {(p) => <Input {...p} inputMode="numeric" maxLength={12} defaultValue={v.nationalId} />}
      </FormField>
      <FormField
        name="password"
        label="Mật khẩu"
        hint="Tối thiểu 8 ký tự, có chữ và số"
        state={state}
      >
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </FormField>
      <FormField name="confirmPassword" label="Nhập lại mật khẩu" state={state}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </FormField>
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        {pending && <Loader2 className="animate-spin" />} Tạo tài khoản
      </Button>
    </form>
  );
}
