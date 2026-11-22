'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon, ZoomIn } from 'lucide-react';

import type { MedicalRecordItem } from '@/lib/data/types';
import { clinicalImageType } from '@/lib/labels';

/** Ảnh thu nhỏ (Cloudinary) — bấm để xem ảnh gốc phóng to. */
export function ClinicalImageGallery({ images }: { images: MedicalRecordItem['clinicalImages'] }) {
  if (images.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {images.map((img) => (
        <li key={img.id}>
          <DialogPrimitive.Root>
            <DialogPrimitive.Trigger className="bg-muted focus-visible:ring-ring/50 group relative block size-20 overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-[3px]">
              {/* Ảnh đã được Cloudinary tối ưu kích thước/định dạng qua URL, không cần next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbnailUrl}
                alt={clinicalImageType[img.type]}
                className="size-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] text-white">
                {clinicalImageType[img.type]}
              </span>
              <ZoomIn
                className="absolute right-1 top-1 size-4 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80" />
              <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4 outline-none">
                <DialogPrimitive.Title className="text-sm font-medium text-white">
                  {clinicalImageType[img.type]}
                  {img.description && ` — ${img.description}`}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Ảnh cận lâm sàng kích thước đầy đủ
                </DialogPrimitive.Description>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.secureUrl}
                  alt={clinicalImageType[img.type]}
                  className="max-h-[85svh] max-w-full rounded-md object-contain"
                />
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                  <XIcon className="size-5" />
                  <span className="sr-only">Đóng</span>
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </li>
      ))}
    </ul>
  );
}
