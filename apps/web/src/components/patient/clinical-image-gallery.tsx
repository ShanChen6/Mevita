'use client';

import { useState } from 'react';
import { Trash2, ZoomIn } from 'lucide-react';

import { ImageViewer } from '@/components/media/image-viewer';
import type { ClinicalImage } from '@/lib/data/types';
import { clinicalImageType } from '@/lib/labels';

interface Props {
  images: ClinicalImage[];
  /** Có truyền thì hiện nút xoá trên từng ảnh (khi hồ sơ còn nháp) */
  onDelete?: (image: ClinicalImage) => void;
}

/** Lưới ảnh thu nhỏ — bấm để mở trình xem phóng to. */
export function ClinicalImageGallery({ images, onDelete }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <li key={img.id} className="group relative">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="bg-muted focus-visible:ring-ring/50 relative block size-24 overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-[3px]"
              aria-label={`Xem ${clinicalImageType[img.type]}${img.description ? `: ${img.description}` : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbnailUrl}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[10px] text-white">
                {clinicalImageType[img.type]}
              </span>
              <ZoomIn
                className="absolute left-1 top-1 size-4 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(img)}
                aria-label={`Xoá ảnh ${clinicalImageType[img.type]}`}
                className="bg-background text-destructive hover:bg-destructive absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border shadow-sm hover:text-white"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <ImageViewer images={images} index={open} onIndexChange={setOpen} />
    </>
  );
}
