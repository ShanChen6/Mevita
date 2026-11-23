import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  /** Khoá ký access token (HS256) — dùng chung với web để kiểm tra phiên ở proxy */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET cần tối thiểu 32 ký tự'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Khoảng ân hạn cho phép dùng lại refresh token vừa xoay vòng (các request song song) */
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(30),
  /** Địa chỉ công khai của API (dùng cho URL ảnh ở chế độ giả lập) */
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000/api'),
  /** Thư mục lưu ảnh ở chế độ giả lập Cloudinary */
  MEDIA_MOCK_DIR: z.string().default('.uploads'),
  /** Chu kỳ quét leo thang ca chậm phản hồi (ms); 0 = tắt */
  ESCALATION_INTERVAL_MS: z.coerce.number().int().min(0).default(30_000),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
});

/** Ràng buộc thêm khi chạy production — chặn cấu hình mặc định/không an toàn lọt lên máy chủ thật. */
const productionRules = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });
  if (/change-me|ci-only|example/i.test(env.JWT_ACCESS_SECRET) || env.JWT_ACCESS_SECRET.length < 48)
    issue(
      'JWT_ACCESS_SECRET',
      'Production cần khoá ngẫu nhiên ≥ 48 ký tự (VD: openssl rand -base64 48)',
    );
  if (env.CORS_ORIGIN.split(',').some((o) => !o.startsWith('https://')))
    issue('CORS_ORIGIN', 'Production chỉ chấp nhận origin https:// (địa chỉ web trên Vercel)');
  if (!env.API_PUBLIC_URL.startsWith('https://'))
    issue('API_PUBLIC_URL', 'Production cần địa chỉ https:// công khai của API');
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = productionRules.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Biến môi trường không hợp lệ:\n${issues}`);
  }
  return result.data;
}
