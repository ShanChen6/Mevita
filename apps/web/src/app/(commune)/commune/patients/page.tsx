import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Search, Stethoscope } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ageAt, formatDate } from '@/lib/format';
import { medicalRecords, MOCK_NOW, patients } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Tra cứu bệnh nhân' };

export default function PatientLookupPage() {
  const p = patients[0]!;
  return (
    <>
      <PageHeader
        title="Tra cứu bệnh nhân"
        description="Tìm nhanh theo số CCCD, mã BHYT hoặc mã lịch hẹn."
      />
      <WireframeNote task="3.1" />

      <div className="relative">
        <Search
          className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          defaultValue={p.nationalId}
          className="h-11 pl-9 text-base"
          aria-label="Tìm bệnh nhân"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{p.fullName}</CardTitle>
          <CardDescription>
            {p.gender} · {ageAt(p.dateOfBirth, MOCK_NOW)} tuổi · CCCD {p.nationalId} · BHYT{' '}
            {p.healthInsuranceNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {p.allergies.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">Dị ứng:</span> {p.allergies.join(', ')}
              </span>
            </div>
          )}
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Nhóm máu: </span>
              {p.bloodType}
            </p>
            <p>
              <span className="text-muted-foreground">Bệnh mạn tính: </span>
              {p.chronicConditions.join(', ') || 'Không'}
            </p>
            <p>
              <span className="text-muted-foreground">Địa chỉ: </span>
              {p.address}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Các lần khám trước (mọi cơ sở)</p>
            {medicalRecords.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-2 text-sm"
              >
                <span className="text-muted-foreground tabular-nums">{formatDate(r.visitAt)}</span>
                <span>{r.facility.name}</span>
                <span className="text-muted-foreground">{r.doctorName}</span>
                {r.diagnoses
                  .filter((d) => d.primary)
                  .map((d) => (
                    <Badge key={d.code} variant="outline" className="font-mono">
                      {d.code}
                    </Badge>
                  ))}
              </div>
            ))}
          </div>

          <Button className="self-start" asChild>
            <Link href="/commune/encounters/new">
              <Stethoscope /> Bắt đầu khám
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
