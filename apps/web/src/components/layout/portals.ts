import {
  Ambulance,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  FileHeart,
  History,
  LayoutDashboard,
  Search,
  Siren,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export type Portal = 'patient' | 'commune' | 'province';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Chỉ khớp đúng đường dẫn (không khớp các trang con) */
  exact?: boolean;
}

export interface PortalConfig {
  name: string;
  shortName: string;
  /** Màu nhận diện phân hệ (dải màu trên logo) */
  accentClass: string;
  nav: NavItem[];
}

export const portals: Record<Portal, PortalConfig> = {
  patient: {
    name: 'Cổng Bệnh nhân',
    shortName: 'Bệnh nhân',
    accentClass: 'bg-primary',
    nav: [
      { href: '/patient', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
      { href: '/patient/appointments/new', label: 'Đặt lịch khám', icon: CalendarPlus },
      {
        href: '/patient/appointments',
        label: 'Lịch hẹn của tôi',
        icon: CalendarCheck,
        exact: true,
      },
      { href: '/patient/records', label: 'Lịch sử khám bệnh', icon: History },
      { href: '/patient/profile', label: 'Hồ sơ sức khoẻ', icon: UserRound },
    ],
  },
  commune: {
    name: 'Trạm Y tế Xã',
    shortName: 'Tuyến Xã',
    accentClass: 'bg-emerald-600',
    nav: [
      { href: '/commune', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
      { href: '/commune/appointments', label: 'Tiếp đón & Lịch hẹn', icon: ClipboardList },
      { href: '/commune/patients', label: 'Tra cứu bệnh nhân', icon: Search },
      { href: '/commune/encounters/new', label: 'Khám bệnh', icon: Stethoscope },
      { href: '/commune/referrals', label: 'Chuyển tuyến', icon: Ambulance },
    ],
  },
  province: {
    name: 'Bệnh viện Tuyến Tỉnh',
    shortName: 'Tuyến Tỉnh',
    accentClass: 'bg-red-600',
    nav: [
      { href: '/province', label: 'Điều phối cấp cứu', icon: Siren, exact: true },
      { href: '/province/referrals', label: 'Ca chuyển tuyến', icon: Ambulance },
      { href: '/province/appointments', label: 'Lịch hẹn khám', icon: CalendarCheck },
      { href: '/province/patients', label: 'Tra cứu bệnh nhân', icon: Search },
      { href: '/province/records', label: 'Hồ sơ điều trị', icon: FileHeart },
    ],
  },
};
