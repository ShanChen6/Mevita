'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';

export interface MapPlace {
  label: string;
  latitude: number;
  longitude: number;
  kind: 'from' | 'to' | 'vehicle';
  /** Màu tô riêng (VD bệnh viện theo mức tải) */
  color?: string;
  /** Nhãn luôn hiện (mặc định: trừ xe) */
  permanent?: boolean;
}

const STYLE = {
  from: { color: '#0b7a75', fillColor: '#0b7a75' },
  to: { color: '#c81e1e', fillColor: '#c81e1e' },
  vehicle: { color: '#ffffff', fillColor: '#2a78d6' },
} as const;

function Fit({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0]!, 13);
    else map.fitBounds(points as LatLngBoundsExpression, { padding: [32, 32], maxZoom: 15 });
    // Chỉ căn lại khi tập điểm mốc thay đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * Bản đồ OpenStreetMap: cơ sở gửi, bệnh viện nhận, vị trí xe hiện tại và quãng đường đã đi.
 * Chỉ chạy ở trình duyệt (Leaflet cần `window`) — dùng qua VehicleMapLazy.
 */
export default function VehicleMap({
  places,
  track,
  className = 'h-72',
}: {
  places: MapPlace[];
  track: LatLngTuple[];
  className?: string;
}) {
  const anchors: LatLngTuple[] = places.map((p) => [p.latitude, p.longitude]);
  const center = anchors[0] ?? [21.03, 105.85];
  return (
    <MapContainer
      center={center}
      zoom={10}
      scrollWheelZoom={false}
      className={`${className} w-full rounded-lg border`}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {track.length > 1 && (
        <Polyline positions={track} pathOptions={{ color: '#2a78d6', weight: 4, opacity: 0.8 }} />
      )}
      {places.map((p) => (
        <CircleMarker
          key={`${p.kind}-${p.label}-${p.latitude}`}
          center={[p.latitude, p.longitude]}
          radius={p.kind === 'vehicle' ? 9 : 7}
          pathOptions={{
            ...(p.color ? { color: '#ffffff', fillColor: p.color } : STYLE[p.kind]),
            weight: p.kind === 'vehicle' || p.color ? 3 : 2,
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={p.permanent ?? p.kind !== 'vehicle'}>
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <Fit points={anchors} />
    </MapContainer>
  );
}
