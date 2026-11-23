import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Search } from 'lucide-react';

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
import { getAuditFacets, listAudit } from '@/lib/data/admin';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Nhật ký truy cập' };

const ACTION: Record<string, string> = {
  VIEW: 'Xem',
  CREATE: 'Tạo',
  UPDATE: 'Sửa',
  DELETE: 'Xoá',
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  SIGN: 'Ký',
};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined);

async function Audit({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = { action: str(sp.action), entityType: str(sp.entityType), q: str(sp.q) };
  const [data, facets] = await Promise.all([
    listAudit({ ...filter, cursor: str(sp.cursor) }),
    getAuditFacets(),
  ]);
  const base = new URLSearchParams(
    Object.entries(filter).filter((e): e is [string, string] => !!e[1]),
  );
  return (
    <>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Người thao tác (tên / email)
          <Input name="q" defaultValue={filter.q} className="h-9 w-56" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Hành động
          <NativeSelect name="action" defaultValue={filter.action ?? ''} className="h-9 w-36">
            <option value="">Tất cả</option>
            {facets.actions.map((a) => (
              <option key={a} value={a}>
                {ACTION[a] ?? a}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Đối tượng
          <NativeSelect
            name="entityType"
            defaultValue={filter.entityType ?? ''}
            className="h-9 w-48"
          >
            <option value="">Tất cả</option>
            {facets.entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" className="h-9">
          <Search /> Lọc
        </Button>
      </form>
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Thời điểm</TableHead>
              <TableHead>Người thao tác</TableHead>
              <TableHead>Hành động</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead className="pr-4">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((e) => (
              <TableRow key={e.id} data-testid="audit-row">
                <TableCell className="whitespace-nowrap pl-4 text-sm tabular-nums">
                  {formatDateTime(e.createdAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {e.user?.fullName ?? '—'}
                  {e.user?.email && (
                    <span className="text-muted-foreground block text-xs">{e.user.email}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={e.action === 'VIEW' ? 'outline' : 'secondary'}>
                    {ACTION[e.action] ?? e.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {e.entityType}
                  {e.entityId && (
                    <span className="text-muted-foreground block font-mono text-xs">
                      {e.entityId.slice(0, 8)}…
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-72 truncate pr-4 font-mono text-xs"
                  title={e.metadata ? JSON.stringify(e.metadata) : undefined}
                >
                  {e.metadata ? JSON.stringify(e.metadata) : ''}
                  {e.ipAddress && <span className="block">IP {e.ipAddress}</span>}
                </TableCell>
              </TableRow>
            ))}
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  Không có bản ghi phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <nav className="flex justify-end gap-2" aria-label="Phân trang">
        {str(sp.cursor) && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/audit?${base}`}>Về mới nhất</Link>
          </Button>
        )}
        {data.nextCursor && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/admin/audit?${new URLSearchParams([...base, ['cursor', data.nextCursor]])}`}
            >
              Cũ hơn
            </Link>
          </Button>
        )}
      </nav>
    </>
  );
}

export default function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  return (
    <>
      <PageHeader
        title="Nhật ký truy cập"
        description="Mọi lần xem/sửa hồ sơ bệnh nhân, đăng nhập và thao tác quản trị đều được ghi lại."
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-xl border" aria-busy />}
      >
        <Audit searchParams={searchParams} />
      </Suspense>
    </>
  );
}
