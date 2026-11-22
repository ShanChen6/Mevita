import { NextResponse, type NextRequest } from 'next/server';

import { API_URL } from '@/lib/api';

/**
 * Proxy các API công khai (danh mục cơ sở y tế, khung giờ trống) cho trình duyệt.
 * Chỉ cho phép các đường dẫn trong danh sách — tránh biến web thành proxy mở tới API.
 */
const ALLOWED = [
  /^facilities$/,
  /^facilities\/[0-9a-f-]{36}$/,
  /^facilities\/[0-9a-f-]{36}\/slots$/,
  /^provinces$/,
  /^provinces\/\d{2}\/communes$/,
];

export async function GET(request: NextRequest, ctx: RouteContext<'/api/public/[...path]'>) {
  const path = (await ctx.params).path.join('/');
  if (!ALLOWED.some((re) => re.test(path))) {
    return NextResponse.json({ message: 'Không tìm thấy' }, { status: 404 });
  }
  try {
    const res = await fetch(`${API_URL}/${path}${request.nextUrl.search}`, { cache: 'no-store' });
    const body: unknown = await res.json();
    // Khung giờ thay đổi liên tục; danh mục thì cho cache ngắn
    const cache = path.endsWith('/slots') ? 'no-store' : 'public, max-age=300';
    return NextResponse.json(body, { status: res.status, headers: { 'Cache-Control': cache } });
  } catch {
    return NextResponse.json({ message: 'Không kết nối được máy chủ' }, { status: 503 });
  }
}
