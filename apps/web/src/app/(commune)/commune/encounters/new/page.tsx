import type { Metadata } from 'next';
import Link from 'next/link';
import { Ambulance, ImagePlus, Plus, Search, Signature, Trash2 } from 'lucide-react';

import { Field } from '@/components/shared/field';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { patients } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Khám bệnh' };

const vitals = [
  { id: 'pulse', label: 'Mạch', unit: 'lần/phút', value: '88' },
  { id: 'temp', label: 'Nhiệt độ', unit: '°C', value: '36,7' },
  { id: 'bp', label: 'Huyết áp', unit: 'mmHg', value: '150/95' },
  { id: 'rr', label: 'Nhịp thở', unit: 'lần/phút', value: '18' },
  { id: 'spo2', label: 'SpO2', unit: '%', value: '98' },
];

export default function EncounterFormPage() {
  const p = patients[0]!;
  return (
    <>
      <PageHeader
        title="Phiếu khám bệnh"
        description={`${p.fullName} · CCCD ${p.nationalId} · Dị ứng: ${p.allergies.join(', ')}`}
        actions={
          <Button variant="destructive" asChild>
            <Link href="/commune/referrals/new">
              <Ambulance /> Chuyển tuyến khẩn cấp
            </Link>
          </Button>
        }
      />
      <WireframeNote task="3.2, 3.3">
        bác sĩ đang đăng nhập tự động được ghi vào hồ sơ khi ký
      </WireframeNote>

      <Card>
        <CardHeader>
          <CardTitle>Chỉ số sinh tồn</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {vitals.map((v) => (
            <Field key={v.id} label={v.label} htmlFor={v.id} hint={v.unit}>
              <Input
                id={v.id}
                defaultValue={v.value}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Khám lâm sàng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Lý do đến khám" htmlFor="complaint">
            <Input id="complaint" defaultValue="Tái khám tăng huyết áp" />
          </Field>
          <Field label="Triệu chứng / bệnh sử" htmlFor="symptoms">
            <Textarea id="symptoms" defaultValue="Thỉnh thoảng đau đầu vùng chẩm buổi sáng." />
          </Field>
          <Field label="Khám thực thể" htmlFor="exam" className="md:col-span-2">
            <Textarea id="exam" placeholder="Tim đều, phổi không rale…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chẩn đoán (ICD-10)</CardTitle>
          <CardDescription>
            Gõ mã hoặc tên bệnh để tra cứu nhanh. Chọn 1 bệnh chính và các bệnh kèm theo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="VD: I10, tăng huyết áp…"
              className="pl-9"
              aria-label="Tra cứu ICD-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="gap-2 py-1">
              <span className="font-mono">I10</span> Tăng huyết áp vô căn · Bệnh chính
            </Badge>
            <Badge variant="outline" className="gap-2 py-1">
              <span className="font-mono">R51</span> Đau đầu · Kèm theo
            </Badge>
          </div>
          <Field label="Kết luận chi tiết" htmlFor="diagnosisNote">
            <Textarea id="diagnosisNote" placeholder="Diễn giải chẩn đoán…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đơn thuốc</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[
            { drug: 'Amlodipin 5mg', qty: '30', unit: 'viên', use: 'Uống 1 viên/ngày buổi sáng' },
          ].map((row) => (
            <div
              key={row.drug}
              className="grid items-end gap-3 sm:grid-cols-[2fr_80px_80px_3fr_auto]"
            >
              <Field label="Thuốc" htmlFor="drug-1">
                <Input id="drug-1" defaultValue={row.drug} />
              </Field>
              <Field label="SL" htmlFor="qty-1">
                <Input id="qty-1" defaultValue={row.qty} inputMode="numeric" />
              </Field>
              <Field label="Đơn vị" htmlFor="unit-1">
                <Input id="unit-1" defaultValue={row.unit} />
              </Field>
              <Field label="Cách dùng" htmlFor="use-1">
                <Input id="use-1" defaultValue={row.use} />
              </Field>
              <Button variant="ghost" size="icon" aria-label="Xoá thuốc">
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start">
            <Plus /> Thêm thuốc
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cận lâm sàng</CardTitle>
          <CardDescription>
            Ảnh phiếu xét nghiệm, siêu âm, X-quang — tải trực tiếp lên Cloudinary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted/50 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm transition-colors"
          >
            <ImagePlus className="size-6" aria-hidden />
            Kéo thả hoặc bấm để chọn ảnh
          </button>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline">Lưu nháp</Button>
        <Button>
          <Signature /> Ký xác nhận & hoàn tất khám
        </Button>
      </div>
    </>
  );
}
