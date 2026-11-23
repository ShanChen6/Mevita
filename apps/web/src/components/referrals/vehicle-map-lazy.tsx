'use client';

import dynamic from 'next/dynamic';

/** Leaflet chỉ chạy được ở trình duyệt. */
export const VehicleMapLazy = dynamic(() => import('./vehicle-map'), {
  ssr: false,
  loading: () => <div className="bg-muted h-72 w-full animate-pulse rounded-lg border" aria-busy />,
});
