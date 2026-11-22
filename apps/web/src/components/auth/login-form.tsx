'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { login } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormState } from '@/lib/auth/schemas';
import { FieldError, FormError } from './form-message';

export function LoginForm() {
  const next = useSearchParams().get('next') ?? '';
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state.message} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="identifier">Email hoặc số điện thoại</Label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          defaultValue={state.values?.identifier}
          aria-invalid={!!err.identifier}
          aria-describedby="identifier-error"
          required
        />
        <FieldError id="identifier-error" errors={err.identifier} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!err.password}
          aria-describedby="password-error"
          required
        />
        <FieldError id="password-error" errors={err.password} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Đăng nhập
      </Button>
    </form>
  );
}
