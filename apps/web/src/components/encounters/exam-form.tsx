'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CheckCircle2, Loader2, Plus, Save, Star, Trash2, X } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { saveRecord, signRecord } from '@/lib/actions/encounters';
import { recordFormSchema, type RecordFormValues } from '@/lib/data/record-schema';
import type { MedicalRecordDetail } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { encounterType } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Icd10Picker } from './icd10-picker';
import { ClinicalImageUploader } from './image-uploader';
import { SignDialog } from './sign-dialog';
import { VITALS, vitalLevel } from './vitals';

function toValues(r: MedicalRecordDetail): RecordFormValues {
  return {
    encounterType: r.encounterType,
    specialtyId: r.specialty?.id ?? '',
    chiefComplaint: r.chiefComplaint,
    symptoms: r.symptoms ?? '',
    physicalExamination: r.physicalExamination ?? '',
    pulse: r.pulse,
    temperature: r.temperature,
    systolicBp: r.systolicBp,
    diastolicBp: r.diastolicBp,
    respiratoryRate: r.respiratoryRate,
    spo2: r.spo2,
    weightKg: r.weightKg,
    heightCm: r.heightCm,
    diagnoses: r.diagnoses.map(({ icdCode, name, isPrimary }) => ({ icdCode, name, isPrimary })),
    diagnosisNote: r.diagnosisNote ?? '',
    prescriptionItems: r.prescriptionItems.map((p) => ({
      drugName: p.drugName,
      strength: p.strength ?? '',
      quantity: p.quantity,
      unit: p.unit,
      instructions: p.instructions,
      durationDays: p.durationDays,
    })),
    treatmentPlan: r.treatmentPlan ?? '',
    followUpDate: r.followUpDate?.slice(0, 10) ?? '',
  };
}

/** Ô số: chấp nhận dấu phẩy thập phân kiểu Việt Nam; để trống = chưa đo. */
const asNumber = (v: unknown) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? (v as never) : n;
};

const levelClass = {
  normal: '',
  warning: 'border-amber-400 bg-amber-50 dark:bg-amber-500/10',
  danger: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200',
};

interface Props {
  record: MedicalRecordDetail;
  specialties: { id: string; name: string }[];
}

export function ExamForm({ record, specialties }: Props) {
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: toValues(record),
  });
  const { register, control, handleSubmit, formState, reset, setValue, getValues, trigger } = form;
  const diagnoses = useFieldArray({ control, name: 'diagnoses' });
  const drugs = useFieldArray({ control, name: 'prescriptionItems' });
  const vitals = useWatch({
    control,
    name: ['pulse', 'temperature', 'systolicBp', 'diastolicBp', 'respiratoryRate', 'spo2'],
  });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const err = formState.errors;
  const p = record.patient;
  // `fields` của useFieldArray không tự cập nhật khi setValue — đọc bệnh chính từ giá trị đang theo dõi
  const dx = useWatch({ control, name: 'diagnoses' });
  const isPrimary = (i: number) => dx[i]?.isPrimary ?? false;

  // Cảnh báo khi rời trang mà còn thay đổi chưa lưu
  useEffect(() => {
    if (!formState.isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formState.isDirty]);

  async function persist(values: RecordFormValues): Promise<boolean> {
    const res = await saveRecord(record.id, values);
    if (!res.ok) {
      setStatus({ ok: false, text: res.message });
      return false;
    }
    reset(toValues(res.data));
    setStatus({ ok: true, text: `Đã lưu nháp lúc ${formatTime(res.data.updatedAt)}` });
    return true;
  }

  const onSave = handleSubmit((values) => startSaving(async () => void (await persist(values))));

  async function saveBeforeSign() {
    if (!(await trigger())) {
      setStatus({ ok: false, text: 'Vui lòng sửa các lỗi trên form trước khi ký' });
      return false;
    }
    return formState.isDirty ? persist(getValues()) : true;
  }

  async function sign(password: string) {
    const res = await signRecord(record.id, password);
    return res.ok ? null : res.message;
  }

  const num = (name: FieldPath<RecordFormValues>) => register(name, { setValueAs: asNumber });
  const fieldError = (name: string) => {
    const e = name
      .split('.')
      .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], err) as
      { message?: string } | undefined;
    return e?.message ? <p className="text-destructive text-xs">{e.message}</p> : null;
  };

  return (
    <form onSubmit={onSave} className="flex flex-col gap-6" noValidate>
      {p.allergies && (
        <div
          role="alert"
          className="sticky top-16 z-10 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 shadow-sm dark:bg-red-950 dark:text-red-200"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Dị ứng:</span> {p.allergies}
            {p.chronicConditions && (
              <span className="text-red-800/80 dark:text-red-200/80">
                {' '}
                · Bệnh mạn tính: {p.chronicConditions}
              </span>
            )}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chỉ số sinh tồn</CardTitle>
          <CardDescription>
            Ô tô vàng: ngoài ngưỡng bình thường · tô đỏ: cần xử trí ngay.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {VITALS.map((v, i) => {
            const level = vitalLevel(v.key, vitals[i]);
            return (
              <div key={v.key} className="flex flex-col gap-2">
                <Label htmlFor={v.key}>
                  {v.label} <span className="text-muted-foreground font-normal">({v.unit})</span>
                </Label>
                <Input
                  id={v.key}
                  inputMode="decimal"
                  className={cn('tabular-nums', level && levelClass[level])}
                  aria-invalid={!!err[v.key]}
                  {...num(v.key)}
                />
                {fieldError(v.key)}
              </div>
            );
          })}
          <div className="flex flex-col gap-2">
            <Label htmlFor="weightKg">
              Cân nặng <span className="text-muted-foreground font-normal">(kg)</span>
            </Label>
            <Input
              id="weightKg"
              inputMode="decimal"
              className="tabular-nums"
              {...num('weightKg')}
            />
            {fieldError('weightKg')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="heightCm">
              Chiều cao <span className="text-muted-foreground font-normal">(cm)</span>
            </Label>
            <Input
              id="heightCm"
              inputMode="decimal"
              className="tabular-nums"
              {...num('heightCm')}
            />
            {fieldError('heightCm')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Khám lâm sàng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="encounterType">Hình thức</Label>
            <NativeSelect id="encounterType" {...register('encounterType')}>
              {(Object.keys(encounterType) as (keyof typeof encounterType)[]).map((k) => (
                <option key={k} value={k}>
                  {encounterType[k]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="specialtyId">Chuyên khoa</Label>
            <NativeSelect id="specialtyId" {...register('specialtyId')}>
              <option value="">— Không chọn —</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="chiefComplaint">Lý do đến khám</Label>
            <Input
              id="chiefComplaint"
              aria-invalid={!!err.chiefComplaint}
              {...register('chiefComplaint')}
            />
            {fieldError('chiefComplaint')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="symptoms">Triệu chứng / bệnh sử</Label>
            <Textarea id="symptoms" rows={4} {...register('symptoms')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="physicalExamination">Khám thực thể</Label>
            <Textarea
              id="physicalExamination"
              rows={4}
              placeholder="Tim đều, phổi không rale…"
              {...register('physicalExamination')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chẩn đoán (ICD-10)</CardTitle>
          <CardDescription>
            Chẩn đoán đầu tiên được chọn làm bệnh chính; bấm ★ để đổi bệnh chính.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Icd10Picker
            exclude={diagnoses.fields.map((d) => d.icdCode)}
            disabled={diagnoses.fields.length >= 10}
            onSelect={(o) =>
              diagnoses.append(
                { icdCode: o.code, name: o.nameVi, isPrimary: diagnoses.fields.length === 0 },
                { shouldFocus: false },
              )
            }
          />
          {diagnoses.fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chưa có chẩn đoán. Cần ít nhất 1 bệnh chính để ký hồ sơ.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {diagnoses.fields.map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    title={isPrimary(i) ? 'Bệnh chính' : 'Chọn làm bệnh chính'}
                    aria-label={
                      isPrimary(i)
                        ? `${d.icdCode} là bệnh chính`
                        : `Chọn ${d.icdCode} làm bệnh chính`
                    }
                    aria-pressed={isPrimary(i)}
                    onClick={() =>
                      diagnoses.fields.forEach((_, j) =>
                        setValue(`diagnoses.${j}.isPrimary`, i === j, { shouldDirty: true }),
                      )
                    }
                    className="text-muted-foreground hover:text-amber-500"
                  >
                    <Star
                      className={cn('size-4', isPrimary(i) && 'fill-amber-400 text-amber-500')}
                    />
                  </button>
                  <Badge variant={isPrimary(i) ? 'default' : 'outline'} className="font-mono">
                    {d.icdCode}
                  </Badge>
                  <span className="flex-1">
                    {d.name}
                    {isPrimary(i) && <span className="text-muted-foreground"> · bệnh chính</span>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Xoá ${d.icdCode}`}
                    onClick={() => {
                      const wasPrimary = isPrimary(i);
                      diagnoses.remove(i);
                      if (wasPrimary && diagnoses.fields.length > 1)
                        setValue('diagnoses.0.isPrimary', true, { shouldDirty: true });
                    }}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="diagnosisNote">Kết luận chi tiết</Label>
            <Textarea id="diagnosisNote" rows={3} {...register('diagnosisNote')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đơn thuốc</CardTitle>
          {p.allergies && (
            <CardDescription className="text-destructive">
              Lưu ý dị ứng: {p.allergies}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {drugs.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid items-start gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_80px_90px_80px] sm:border-0 sm:p-0"
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor={`drug-${i}`} className={cn(i > 0 && 'sm:sr-only')}>
                  Tên thuốc
                </Label>
                <Input id={`drug-${i}`} {...register(`prescriptionItems.${i}.drugName`)} />
                {fieldError(`prescriptionItems.${i}.drugName`)}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`strength-${i}`} className={cn(i > 0 && 'sm:sr-only')}>
                  Hàm lượng
                </Label>
                <Input
                  id={`strength-${i}`}
                  placeholder="500mg"
                  {...register(`prescriptionItems.${i}.strength`)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`qty-${i}`} className={cn(i > 0 && 'sm:sr-only')}>
                  SL
                </Label>
                <Input
                  id={`qty-${i}`}
                  inputMode="decimal"
                  {...register(`prescriptionItems.${i}.quantity`, { setValueAs: asNumber })}
                />
                {fieldError(`prescriptionItems.${i}.quantity`)}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`unit-${i}`} className={cn(i > 0 && 'sm:sr-only')}>
                  Đơn vị
                </Label>
                <Input id={`unit-${i}`} {...register(`prescriptionItems.${i}.unit`)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`days-${i}`} className={cn(i > 0 && 'sm:sr-only')}>
                  Số ngày
                </Label>
                <Input
                  id={`days-${i}`}
                  inputMode="numeric"
                  {...register(`prescriptionItems.${i}.durationDays`, { setValueAs: asNumber })}
                />
              </div>
              <div className="flex items-start gap-2 sm:col-span-5">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor={`use-${i}`} className="sr-only">
                    Cách dùng
                  </Label>
                  <Input
                    id={`use-${i}`}
                    placeholder="Cách dùng, VD: Uống 1 viên × 2 lần/ngày sau ăn"
                    {...register(`prescriptionItems.${i}.instructions`)}
                  />
                  {fieldError(`prescriptionItems.${i}.instructions`)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá thuốc ${i + 1}`}
                  onClick={() => drugs.remove(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={drugs.fields.length >= 30}
            onClick={() =>
              drugs.append({
                drugName: '',
                strength: '',
                quantity: 1,
                unit: 'viên',
                instructions: '',
                durationDays: null,
              })
            }
          >
            <Plus /> Thêm thuốc
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lời dặn & tái khám</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="treatmentPlan">Hướng điều trị / lời dặn</Label>
            <Textarea id="treatmentPlan" rows={3} {...register('treatmentPlan')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="followUpDate">Ngày tái khám</Label>
            <Input id="followUpDate" type="date" {...register('followUpDate')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cận lâm sàng</CardTitle>
          <CardDescription>
            Ảnh phiếu xét nghiệm, siêu âm, X-quang — lưu ngay khi tải lên, không cần bấm Lưu nháp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicalImageUploader recordId={record.id} initialImages={record.clinicalImages} />
        </CardContent>
      </Card>

      <div className="bg-background/95 sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <div className="flex-1 text-sm" role="status">
          {status &&
            (status.ok ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> {status.text}
              </span>
            ) : (
              <FormError message={status.text} />
            ))}
          {!status && formState.isDirty && (
            <span className="text-muted-foreground">Có thay đổi chưa lưu</span>
          )}
        </div>
        <Button type="submit" variant="outline" disabled={saving || !formState.isDirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Lưu nháp
        </Button>
        <SignDialog
          beforeSign={saveBeforeSign}
          onSign={sign}
          disabled={saving}
          summary={`${p.fullName} · ${dx.find((d) => d.isPrimary)?.icdCode ?? 'chưa có chẩn đoán'}.`}
        />
      </div>
    </form>
  );
}
