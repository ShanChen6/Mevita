import type { Metadata } from 'next';
import { Building2, ImageIcon, Pill, Stethoscope } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDecimal, formatTime } from '@/lib/format';
import { medicalRecords } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Lịch sử khám bệnh' };

export default function MedicalHistoryPage() {
  return (
    <>
      <PageHeader
        title="Lịch sử khám bệnh"
        description="Mọi lần khám tại các cơ sở y tế, kèm bác sĩ, chẩn đoán, đơn thuốc và kết quả cận lâm sàng."
      />
      <WireframeNote task="2.2" />

      <ol className="relative flex flex-col gap-6 border-l pl-6 sm:ml-3">
        {medicalRecords.map((r) => (
          <li key={r.id} className="relative">
            <span
              aria-hidden
              className="border-background bg-primary ring-primary/30 absolute -left-[31px] top-5 size-3 rounded-full border-2 ring-2"
            />
            <Card className="gap-4">
              <CardHeader>
                <p className="text-primary text-xs font-medium">
                  {formatTime(r.visitAt)} · {formatDate(r.visitAt)}
                </p>
                <CardTitle className="text-lg">{r.chiefComplaint}</CardTitle>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1">
                    <Stethoscope className="size-3.5" aria-hidden /> {r.doctorName} · {r.specialty}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3.5" aria-hidden /> {r.facility.name}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <p className="font-medium">Chẩn đoán (ICD-10)</p>
                  {r.diagnoses.map((d) => (
                    <p key={d.code} className="flex items-start gap-2">
                      <Badge variant={d.primary ? 'default' : 'outline'} className="font-mono">
                        {d.code}
                      </Badge>
                      <span>
                        {d.name}
                        {d.primary && <span className="text-muted-foreground"> (chính)</span>}
                      </span>
                    </p>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1 font-medium">
                    <Pill className="size-3.5" aria-hidden /> Đơn thuốc
                  </p>
                  {r.prescription.map((p) => (
                    <p key={p.drug}>
                      <span className="font-medium">{p.drug}</span>
                      <span className="text-muted-foreground block">{p.instructions}</span>
                    </p>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <p className="font-medium">Sinh tồn</p>
                  <p className="text-muted-foreground">
                    Mạch {r.vitals.pulse} · HA {r.vitals.bp} · {formatDecimal(r.vitals.temperature)}
                    °C · SpO2 {r.vitals.spo2}%
                  </p>
                  {r.images > 0 && (
                    <div className="flex gap-2">
                      {Array.from({ length: r.images }, (_, i) => (
                        <div
                          key={i}
                          className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-md border"
                          title="Ảnh cận lâm sàng (Cloudinary)"
                        >
                          <ImageIcon className="size-5" aria-hidden />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
