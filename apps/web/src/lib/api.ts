import 'server-only';

/** Địa chỉ API phía server (BFF). Trình duyệt không gọi trực tiếp API cho các thao tác có xác thực. */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** Gọi API Mevita, tự gắn access token nếu có. Ném ApiError khi API trả lỗi. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(503, 'Không kết nối được máy chủ. Vui lòng thử lại sau.');
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    errors?: ApiError['errors'];
  };
  if (!res.ok) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, message ?? 'Có lỗi xảy ra', body.errors);
  }
  return body as T;
}
