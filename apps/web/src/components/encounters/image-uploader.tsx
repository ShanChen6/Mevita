'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2 } from 'lucide-react';

import { ClinicalImageGallery } from '@/components/patient/clinical-image-gallery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  confirmUpload,
  deleteImage,
  requestUploadTicket,
  type ClinicalImageTypeValue,
  type UploadTicket,
} from '@/lib/actions/clinical-images';
import type { ClinicalImage } from '@/lib/data/types';
import { clinicalImageType } from '@/lib/labels';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 20;

interface Job {
  key: string;
  name: string;
  progress: number;
  status: 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
}

/** Tải file thẳng lên kho ảnh bằng vé có chữ ký, báo tiến độ (XHR để đọc được % đã gửi). */
function uploadDirect(ticket: UploadTicket, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) body.append(k, v);
    body.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.uploadUrl);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Kho ảnh từ chối (${xhr.status})`;
      try {
        message =
          (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ??
          message;
      } catch {
        /* giữ thông báo mặc định */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải ảnh'));
    xhr.send(body);
  });
}

function validate(file: File): string | null {
  if (!ACCEPT.split(',').includes(file.type)) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP';
  if (file.size > MAX_BYTES) return 'Ảnh vượt quá 10 MB';
  return null;
}

interface Props {
  recordId: string;
  initialImages: ClinicalImage[];
}

/** Tải ảnh cận lâm sàng (xét nghiệm, X-quang, siêu âm…) vào phiếu khám đang mở. */
export function ClinicalImageUploader({ recordId, initialImages }: Props) {
  const [images, setImages] = useState(initialImages);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [type, setType] = useState<ClinicalImageTypeValue>('LAB_RESULT');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...p } : j)));

  async function uploadOne(file: File, key: string) {
    const invalid = validate(file);
    if (invalid) return patch(key, { status: 'error', error: invalid });
    const ticket = await requestUploadTicket(recordId, type);
    if (!ticket.ok) return patch(key, { status: 'error', error: ticket.message });
    try {
      await uploadDirect(ticket.data, file, (progress) => patch(key, { progress }));
    } catch (e) {
      return patch(key, { status: 'error', error: (e as Error).message });
    }
    patch(key, { status: 'confirming', progress: 100 });
    const saved = await confirmUpload(recordId, {
      publicId: ticket.data.publicId,
      type,
      description,
    });
    if (!saved.ok) return patch(key, { status: 'error', error: saved.message });
    setImages((list) => [...list, saved.data]);
    patch(key, { status: 'done' });
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room =
      MAX_IMAGES -
      images.length -
      jobs.filter((j) => j.status === 'uploading' || j.status === 'confirming').length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (files.length < list.length) setError(`Mỗi hồ sơ tối đa ${MAX_IMAGES} ảnh`);
    const created = files.map((f) => ({
      key: `${Date.now()}-${f.name}-${Math.random()}`,
      name: f.name,
      progress: 0,
      status: 'uploading' as const,
    }));
    setJobs((js) => [...js.filter((j) => j.status !== 'done'), ...created]);
    files.forEach((f, i) => void uploadOne(f, created[i]!.key));
    if (inputRef.current) inputRef.current.value = '';
  }

  async function remove(image: ClinicalImage) {
    if (
      !window.confirm(
        `Xoá ảnh ${clinicalImageType[image.type]}${image.description ? ` (${image.description})` : ''}?`,
      )
    )
      return;
    const res = await deleteImage(recordId, image.id);
    if (!res.ok) return setError(res.message);
    setImages((list) => list.filter((i) => i.id !== image.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="image-type">Loại ảnh</Label>
          <NativeSelect
            id="image-type"
            value={type}
            onChange={(e) => setType(e.target.value as ClinicalImageTypeValue)}
          >
            {(Object.keys(clinicalImageType) as ClinicalImageTypeValue[]).map((t) => (
              <option key={t} value={t}>
                {clinicalImageType[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="image-description">Mô tả (không bắt buộc)</Label>
          <Input
            id="image-description"
            value={description}
            maxLength={500}
            placeholder="VD: Công thức máu, X-quang ngực thẳng…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'text-muted-foreground hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors',
          dragOver && 'border-primary bg-primary/5',
        )}
      >
        <ImagePlus className="size-6" aria-hidden />
        <span>
          <span className="text-foreground font-medium">Chọn ảnh</span> hoặc kéo thả vào đây
        </span>
        <span className="text-xs">
          JPG, PNG, WebP · tối đa 10 MB/ảnh · {images.length}/{MAX_IMAGES} ảnh
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Chọn ảnh cận lâm sàng"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {jobs.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.key} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              {j.status === 'done' ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : j.status === 'error' ? (
                <AlertTriangle className="text-destructive size-4 shrink-0" aria-hidden />
              ) : (
                <Loader2
                  className="text-muted-foreground size-4 shrink-0 animate-spin"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate">{j.name}</span>
              {j.status === 'uploading' && (
                <span className="flex w-32 items-center gap-2">
                  <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full transition-all"
                      style={{ width: `${j.progress}%` }}
                    />
                  </span>
                  <span className="w-9 text-right text-xs tabular-nums">{j.progress}%</span>
                </span>
              )}
              {j.status === 'confirming' && (
                <span className="text-muted-foreground text-xs">Đang lưu…</span>
              )}
              {j.status === 'done' && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Đã lưu</span>
              )}
              {j.status === 'error' && <span className="text-destructive text-xs">{j.error}</span>}
            </li>
          ))}
        </ul>
      )}

      <ClinicalImageGallery images={images} onDelete={remove} />
    </div>
  );
}
