import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Search } from 'lucide-react';

import { UserActiveToggle } from '@/components/admin/user-active-toggle';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSession } from '@/lib/auth/session';
import { listUsers } from '@/lib/data/admin';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Tài khoản' };

const ROLE: Record<string, string> = {
  PATIENT: 'Bệnh nhân',
  COMMUNE_STAFF: 'Tuyến xã',
  PROVINCE_STAFF: 'Tuyến tỉnh',
  ADMIN: 'Quản trị',
};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined);

async function Users({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = str(sp.q);
  const role = str(sp.role);
  const status = str(sp.status);
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [data, session] = await Promise.all([listUsers({ q, role, status, page }), getSession()]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (p: number) =>
    `/admin/users?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Tìm theo tên, email, số điện thoại
          <Input name="q" defaultValue={q} className="h-9 w-64" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Vai trò
          <NativeSelect name="role" defaultValue={role ?? ''} className="h-9 w-40">
            <option value="">Tất cả</option>
            {Object.entries(ROLE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Trạng thái
          <NativeSelect name="status" defaultValue={status ?? ''} className="h-9 w-36">
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã khoá</option>
          </NativeSelect>
        </label>
        <Button type="submit" className="h-9">
          <Search /> Lọc
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        {data.total.toLocaleString('vi-VN')} tài khoản
      </p>
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Họ tên</TableHead>
              <TableHead>Đăng nhập</TableHead>
              <TableHead>Vai trò · nơi công tác</TableHead>
              <TableHead>Lần đăng nhập cuối</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="pr-4 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((u) => (
              <TableRow key={u.id} data-testid={`user-${u.email ?? u.phone}`}>
                <TableCell className="pl-4 font-medium">
                  {u.staffProfile?.academicTitle ? `${u.staffProfile.academicTitle}. ` : ''}
                  {u.fullName}
                </TableCell>
                <TableCell className="text-sm">
                  {u.email}
                  {u.phone && (
                    <span className="text-muted-foreground block text-xs">{u.phone}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {ROLE[u.role]}
                  {u.staffProfile && (
                    <span className="text-muted-foreground block text-xs">
                      {u.staffProfile.facility.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge variant="outline">Hoạt động</Badge>
                  ) : (
                    <Badge variant="destructive">Đã khoá</Badge>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <UserActiveToggle
                    id={u.id}
                    name={u.fullName}
                    isActive={u.isActive}
                    self={u.id === session?.userId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && (
        <nav className="flex items-center justify-end gap-2 text-sm" aria-label="Phân trang">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={link(page - 1)}>Trang trước</Link>
            </Button>
          )}
          <span className="text-muted-foreground">
            Trang {page}/{pages}
          </span>
          {page < pages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={link(page + 1)}>Trang sau</Link>
            </Button>
          )}
        </nav>
      )}
    </>
  );
}

export default function UsersPage({ searchParams }: PageProps<'/admin/users'>) {
  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Khoá tài khoản thì người dùng không đăng nhập được và mọi phiên đăng nhập bị thu hồi."
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-xl border" aria-busy />}
      >
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}
