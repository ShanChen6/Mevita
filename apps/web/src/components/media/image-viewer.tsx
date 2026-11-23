'use client';

import { useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  XIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ClinicalImage } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';
import { clinicalImageType } from '@/lib/labels';

const MIN = 1;
const MAX = 4;

interface Props {
  images: ClinicalImage[];
  /** Ảnh đang mở; null = đóng */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * Trình xem ảnh y khoa: phóng to 1–4× (nút, con lăn, phím +/-), kéo để di chuyển khi phóng to,
 * ← → chuyển ảnh, Esc đóng. Ảnh gốc tải qua URL có chữ ký.
 */
export function ImageViewer({ images, index, onIndexChange }: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const image = index !== null ? images[index] : undefined;

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const go = (delta: number) => {
    if (index === null || images.length < 2) return;
    reset();
    onIndexChange((index + delta + images.length) % images.length);
  };
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const next = Math.min(MAX, Math.max(MIN, Math.round(z * factor * 100) / 100));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });

  return (
    <DialogPrimitive.Root
      open={!!image}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onIndexChange(null);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-black/95 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === '+' || e.key === '=') zoomBy(1.5);
            else if (e.key === '-') zoomBy(1 / 1.5);
            else if (e.key === '0') reset();
          }}
        >
          {image && (
            <>
              <div className="flex items-center gap-2 bg-black px-4 py-3 text-white">
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate text-sm font-medium">
                    {clinicalImageType[image.type]}
                    {image.description && ` — ${image.description}`}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-white/60">
                    Ảnh {index! + 1}/{images.length}
                    {image.takenAt && ` · chụp ${formatDateTime(image.takenAt)}`}
                    {' · '}
                    {Math.round(zoom * 100)}%
                  </DialogPrimitive.Description>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Thu nhỏ"
                  onClick={() => zoomBy(1 / 1.5)}
                  disabled={zoom <= MIN}
                >
                  <ZoomOut />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Phóng to"
                  onClick={() => zoomBy(1.5)}
                  disabled={zoom >= MAX}
                >
                  <ZoomIn />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Về kích thước ban đầu"
                  onClick={reset}
                >
                  <RotateCcw />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Mở ảnh gốc trong tab mới"
                  asChild
                >
                  <a href={image.secureUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
                <DialogPrimitive.Close asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    aria-label="Đóng"
                  >
                    <XIcon />
                  </Button>
                </DialogPrimitive.Close>
              </div>

              <div
                className="relative flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
                style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
                onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2)}
                onDoubleClick={() => (zoom > 1 ? reset() : setZoom(2))}
                onPointerDown={(e) => {
                  if (zoom <= 1) return;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                  setDragging(true);
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (d)
                    setOffset({
                      x: d.ox + (e.clientX - d.x) / zoom,
                      y: d.oy + (e.clientY - d.y) / zoom,
                    });
                }}
                onPointerUp={() => {
                  drag.current = null;
                  setDragging(false);
                }}
              >
                {/* Ảnh y khoa đã được tối ưu và ký URL phía máy chủ — dùng <img> thường */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={image.id}
                  src={image.secureUrl}
                  alt={`${clinicalImageType[image.type]}${image.description ? ` — ${image.description}` : ''}`}
                  draggable={false}
                  className="max-h-full max-w-full object-contain transition-transform duration-75"
                  style={{ transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)` }}
                />
                {images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute left-3 size-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                      aria-label="Ảnh trước"
                      onClick={() => go(-1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-3 size-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                      aria-label="Ảnh sau"
                      onClick={() => go(1)}
                    >
                      <ChevronRight />
                    </Button>
                  </>
                )}
              </div>
              <p className="bg-black py-2 text-center text-xs text-white/50">
                Con lăn hoặc +/− để phóng to · kéo để di chuyển · nhấp đúp để đặt lại · ← → chuyển
                ảnh
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
