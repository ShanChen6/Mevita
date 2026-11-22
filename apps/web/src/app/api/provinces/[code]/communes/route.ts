import { NextResponse } from 'next/server';

import { ApiError } from '@/lib/api';
import { getCommunes } from '@/lib/data/patient';

/**
 * Danh sách xã/phường của một tỉnh cho các ô chọn địa chỉ phía trình duyệt.
 * Đi qua máy chủ web (BFF) để trình duyệt không phải gọi trực tiếp API khác domain.
 */
export async function GET(_: Request, ctx: RouteContext<'/api/provinces/[code]/communes'>) {
  const { code } = await ctx.params;
  if (!/^\d{2}$/.test(code))
    return NextResponse.json({ message: 'Mã tỉnh không hợp lệ' }, { status: 400 });
  try {
    const communes = await getCommunes(code);
    return NextResponse.json(
      communes.map(({ code, name, fullName }) => ({ code, name, fullName })),
      // Danh mục hành chính ít thay đổi — cho phép trình duyệt cache 1 ngày
      { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message: 'Không tải được danh sách xã/phường' }, { status });
  }
}
