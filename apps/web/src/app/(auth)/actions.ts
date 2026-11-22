'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { apiFetch, ApiError, type TokenPair } from '@/lib/api';
import { REFRESH_COOKIE, safeRedirectPath } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { loginFormSchema, registerFormSchema, type FormState } from '@/lib/auth/schemas';
import { clearSessionCookies, setSessionCookies } from '@/lib/auth/session';

const pickValues = (formData: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? '')]));

async function startSession(tokens: TokenPair, next?: string): Promise<never> {
  await setSessionCookies(tokens);
  const session = await verifyAccessToken(tokens.accessToken);
  if (!session)
    throw new Error('Không đọc được phiên đăng nhập — kiểm tra JWT_ACCESS_SECRET của web và API');
  redirect(safeRedirectPath(next, session.role));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const values = pickValues(formData, ['identifier', 'next']);
  const parsed = loginFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  let tokens: TokenPair;
  try {
    tokens = await apiFetch<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: parsed.data.identifier, password: parsed.data.password }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message:
          error.status === 429 ? 'Bạn thử quá nhiều lần, vui lòng đợi 1 phút.' : error.message,
        values,
      };
    }
    throw error;
  }
  return startSession(tokens, parsed.data.next);
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const values = pickValues(formData, [
    'fullName',
    'email',
    'phone',
    'dateOfBirth',
    'gender',
    'nationalId',
  ]);
  const parsed = registerFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  // Bỏ trường nhập lại mật khẩu và các trường để trống trước khi gửi lên API
  const body = Object.fromEntries(
    Object.entries(parsed.data).filter(([k, v]) => k !== 'confirmPassword' && v !== ''),
  );
  let tokens: TokenPair;
  try {
    tokens = await apiFetch<TokenPair>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = error.errors?.reduce<Record<string, string[]>>((acc, e) => {
        (acc[e.path] ??= []).push(e.message);
        return acc;
      }, {});
      return { message: error.message, fieldErrors, values };
    }
    throw error;
  }
  return startSession(tokens);
}

export async function logout(): Promise<never> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  await clearSessionCookies();
  redirect('/login');
}
