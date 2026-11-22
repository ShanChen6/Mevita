/**
 * DỮ LIỆU MẪU cho wireframe (Task 1.4).
 * Sẽ được thay bằng dữ liệu thật từ API ở các Task 2.x – 5.x.
 * Cấu trúc bám theo Prisma schema để dễ thay thế.
 */
import type {
  AppointmentStatus,
  ConsciousnessLevel,
  FacilityType,
  ReferralPriority,
  ReferralStatus,
} from './labels';

/** Mốc thời gian cố định của dữ liệu mẫu ("hôm nay" trong wireframe). */
export const MOCK_NOW = '2026-12-01T09:00:00+07:00';

export interface MockFacility {
  id: string;
  name: string;
  type: FacilityType;
  communeName: string;
  provinceName: string;
}

export const facilities = {
  muongKhuong: {
    id: 'fac-muong-khuong',
    name: 'Trạm Y tế Xã Mường Khương',
    type: 'COMMUNE_HEALTH_STATION',
    communeName: 'Xã Mường Khương',
    provinceName: 'Tỉnh Lào Cai',
  },
  baoThang: {
    id: 'fac-bao-thang',
    name: 'Trạm Y tế Xã Bảo Thắng',
    type: 'COMMUNE_HEALTH_STATION',
    communeName: 'Xã Bảo Thắng',
    provinceName: 'Tỉnh Lào Cai',
  },
  laoCaiGeneral: {
    id: 'fac-bvdk-lao-cai',
    name: 'Bệnh viện Đa khoa Tỉnh Lào Cai',
    type: 'PROVINCIAL_GENERAL_HOSPITAL',
    communeName: 'Phường Lào Cai',
    provinceName: 'Tỉnh Lào Cai',
  },
  vietDuc: {
    id: 'fac-viet-duc',
    name: 'Bệnh viện Hữu nghị Việt Đức',
    type: 'CENTRAL_HOSPITAL',
    communeName: 'Phường Cửa Nam',
    provinceName: 'Thành phố Hà Nội',
  },
} satisfies Record<string, MockFacility>;

export interface MockPatient {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'Nam' | 'Nữ';
  nationalId: string;
  healthInsuranceNumber: string;
  phone: string;
  address: string;
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
}

export const patients: MockPatient[] = [
  {
    id: 'pt-1',
    fullName: 'Lò Văn Cường',
    dateOfBirth: '1990-05-01',
    gender: 'Nam',
    nationalId: '010090001234',
    healthInsuranceNumber: 'DN4010090001234',
    phone: '0912 345 678',
    address: 'Thôn Pạc Bo, Xã Mường Khương, Tỉnh Lào Cai',
    bloodType: 'O+',
    allergies: ['Penicillin'],
    chronicConditions: ['Tăng huyết áp'],
  },
  {
    id: 'pt-2',
    fullName: 'Vàng Thị Mai',
    dateOfBirth: '1985-11-20',
    gender: 'Nữ',
    nationalId: '010185004321',
    healthInsuranceNumber: 'GD4010185004321',
    phone: '0987 654 321',
    address: 'Thôn Na Pao, Xã Mường Khương, Tỉnh Lào Cai',
    bloodType: 'A+',
    allergies: [],
    chronicConditions: ['Đái tháo đường type 2'],
  },
  {
    id: 'pt-3',
    fullName: 'Giàng A Sử',
    dateOfBirth: '2018-03-14',
    gender: 'Nam',
    nationalId: '010218007788',
    healthInsuranceNumber: 'TE1010218007788',
    phone: '0868 112 233',
    address: 'Thôn Sín Chải, Xã Mường Khương, Tỉnh Lào Cai',
    bloodType: 'Chưa rõ',
    allergies: ['Hải sản'],
    chronicConditions: [],
  },
];

export interface MockAppointment {
  id: string;
  code: string;
  patientId: string;
  patientName: string;
  facility: MockFacility;
  specialty: string;
  doctorName?: string;
  startAt: string;
  reason: string;
  status: AppointmentStatus;
}

export const appointments: MockAppointment[] = [
  {
    id: 'ap-1',
    code: 'LH8K2Q7M',
    patientId: 'pt-1',
    patientName: 'Lò Văn Cường',
    facility: facilities.muongKhuong,
    specialty: 'Nội tổng quát',
    doctorName: 'BS. Nguyễn Văn An',
    startAt: '2026-12-01T08:00:00+07:00',
    reason: 'Tái khám tăng huyết áp',
    status: 'CHECKED_IN',
  },
  {
    id: 'ap-2',
    code: 'LH3F9W1Z',
    patientId: 'pt-2',
    patientName: 'Vàng Thị Mai',
    facility: facilities.muongKhuong,
    specialty: 'Nội tổng quát',
    doctorName: 'BS. Nguyễn Văn An',
    startAt: '2026-12-01T08:30:00+07:00',
    reason: 'Kiểm tra đường huyết định kỳ',
    status: 'CONFIRMED',
  },
  {
    id: 'ap-3',
    code: 'LH7P4D2X',
    patientId: 'pt-3',
    patientName: 'Giàng A Sử',
    facility: facilities.muongKhuong,
    specialty: 'Nhi khoa',
    startAt: '2026-12-01T09:15:00+07:00',
    reason: 'Sốt, ho 3 ngày',
    status: 'PENDING',
  },
  {
    id: 'ap-4',
    code: 'LH1M6N8B',
    patientId: 'pt-1',
    patientName: 'Lò Văn Cường',
    facility: facilities.laoCaiGeneral,
    specialty: 'Tim mạch',
    doctorName: 'BS. Hoàng Minh Đức',
    startAt: '2026-12-15T14:00:00+07:00',
    reason: 'Khám chuyên khoa tim mạch',
    status: 'CONFIRMED',
  },
  {
    id: 'ap-5',
    code: 'LH5R2T9C',
    patientId: 'pt-1',
    patientName: 'Lò Văn Cường',
    facility: facilities.muongKhuong,
    specialty: 'Nội tổng quát',
    startAt: '2026-10-05T07:30:00+07:00',
    reason: 'Đau đầu, chóng mặt',
    status: 'COMPLETED',
  },
];

export interface MockRecord {
  id: string;
  code: string;
  visitAt: string;
  facility: MockFacility;
  doctorName: string;
  specialty: string;
  chiefComplaint: string;
  diagnoses: { code: string; name: string; primary: boolean }[];
  prescription: { drug: string; instructions: string }[];
  vitals: { pulse: number; bp: string; temperature: number; spo2: number };
  images: number;
}

export const medicalRecords: MockRecord[] = [
  {
    id: 'mr-3',
    code: 'BA2611A01',
    visitAt: '2026-11-10T08:20:00+07:00',
    facility: facilities.laoCaiGeneral,
    doctorName: 'BS. Hoàng Minh Đức',
    specialty: 'Tim mạch',
    chiefComplaint: 'Hồi hộp, đánh trống ngực',
    diagnoses: [
      { code: 'I10', name: 'Tăng huyết áp vô căn', primary: true },
      { code: 'R00.2', name: 'Đánh trống ngực', primary: false },
    ],
    prescription: [
      { drug: 'Amlodipin 5mg', instructions: 'Uống 1 viên/ngày buổi sáng' },
      { drug: 'Bisoprolol 2,5mg', instructions: 'Uống 1 viên/ngày sau ăn sáng' },
    ],
    vitals: { pulse: 96, bp: '150/95', temperature: 36.8, spo2: 98 },
    images: 2,
  },
  {
    id: 'mr-2',
    code: 'BA2610M07',
    visitAt: '2026-10-05T07:45:00+07:00',
    facility: facilities.muongKhuong,
    doctorName: 'BS. Nguyễn Văn An',
    specialty: 'Nội tổng quát',
    chiefComplaint: 'Đau đầu, chóng mặt',
    diagnoses: [{ code: 'I10', name: 'Tăng huyết áp vô căn', primary: true }],
    prescription: [{ drug: 'Amlodipin 5mg', instructions: 'Uống 1 viên/ngày buổi sáng' }],
    vitals: { pulse: 88, bp: '160/100', temperature: 36.6, spo2: 98 },
    images: 0,
  },
  {
    id: 'mr-1',
    code: 'BA2603M02',
    visitAt: '2026-03-18T09:10:00+07:00',
    facility: facilities.muongKhuong,
    doctorName: 'BS. Nguyễn Văn An',
    specialty: 'Nội tổng quát',
    chiefComplaint: 'Ho, sốt',
    diagnoses: [{ code: 'J06.9', name: 'Nhiễm trùng hô hấp trên cấp', primary: true }],
    prescription: [
      { drug: 'Paracetamol 500mg', instructions: 'Uống 1 viên khi sốt > 38,5°C, cách 6 giờ' },
    ],
    vitals: { pulse: 92, bp: '125/80', temperature: 38.4, spo2: 97 },
    images: 1,
  },
];

export interface MockVitalLog {
  recordedAt: string;
  pulse: number;
  systolicBp: number;
  diastolicBp: number;
  spo2: number;
  gcs: number;
  consciousness: ConsciousnessLevel;
}

export interface MockReferral {
  id: string;
  code: string;
  patient: MockPatient;
  from: MockFacility;
  to: MockFacility;
  referredBy: string;
  priority: ReferralPriority;
  status: ReferralStatus;
  createdAt: string;
  /** Số phút còn lại tới khi xe dự kiến tới nơi, tính từ lúc mở trang (chỉ dùng cho wireframe). */
  etaMinutes: number;
  reason: string;
  clinicalSummary: string;
  initialTreatment: string;
  diagnosis: string;
  vehicleInfo: string;
  escortName: string;
  preparationNote?: string;
  vitals: MockVitalLog[];
}

const vitalsAt = (start: string, rows: Omit<MockVitalLog, 'recordedAt'>[]): MockVitalLog[] =>
  rows.map((row, i) => ({
    ...row,
    recordedAt: new Date(new Date(start).getTime() + i * 5 * 60_000).toISOString(),
  }));

export const referrals: MockReferral[] = [
  {
    id: 'ct-1',
    code: 'CT26120101',
    patient: patients[0]!,
    from: facilities.muongKhuong,
    to: facilities.laoCaiGeneral,
    referredBy: 'BS. Nguyễn Văn An',
    priority: 'CRITICAL',
    status: 'PENDING',
    createdAt: '2026-12-01T08:25:00+07:00',
    etaMinutes: 42,
    reason: 'Nghi máu tụ nội sọ sau chấn thương, vượt khả năng chuyên môn tuyến xã',
    clinicalSummary:
      'Bệnh nhân nam 36 tuổi, tai nạn xe máy lúc 07:50, va đập vùng đầu. Lơ mơ, nôn 2 lần. Đồng tử 2 bên 3mm, phản xạ ánh sáng (+). Vết thương da đầu vùng thái dương phải 4cm.',
    initialTreatment:
      'Cố định cột sống cổ, băng ép cầm máu vết thương da đầu, thở oxy 5 lít/phút, truyền NaCl 0,9% 500ml.',
    diagnosis: 'S06.5 — Chấn thương sọ não, nghi máu tụ dưới màng cứng',
    vehicleInfo: 'Xe cứu thương 24A-123.45',
    escortName: 'ĐD. Lý Thị Hoa',
    vitals: vitalsAt('2026-12-01T08:30:00+07:00', [
      { pulse: 104, systolicBp: 138, diastolicBp: 86, spo2: 95, gcs: 13, consciousness: 'VOICE' },
      { pulse: 108, systolicBp: 142, diastolicBp: 88, spo2: 94, gcs: 13, consciousness: 'VOICE' },
      { pulse: 112, systolicBp: 148, diastolicBp: 90, spo2: 93, gcs: 12, consciousness: 'VOICE' },
      { pulse: 106, systolicBp: 152, diastolicBp: 92, spo2: 94, gcs: 12, consciousness: 'VOICE' },
      { pulse: 98, systolicBp: 158, diastolicBp: 94, spo2: 93, gcs: 11, consciousness: 'PAIN' },
      { pulse: 92, systolicBp: 164, diastolicBp: 96, spo2: 92, gcs: 11, consciousness: 'PAIN' },
    ]),
  },
  {
    id: 'ct-2',
    code: 'CT26120102',
    patient: patients[1]!,
    from: facilities.baoThang,
    to: facilities.laoCaiGeneral,
    referredBy: 'BS. Phạm Thu Hà',
    priority: 'URGENT',
    status: 'ACCEPTED',
    createdAt: '2026-12-01T07:55:00+07:00',
    etaMinutes: 18,
    reason: 'Đau bụng cấp, nghi viêm ruột thừa',
    clinicalSummary: 'Đau hố chậu phải 12 giờ, sốt 38,2°C, Mc Burney (+).',
    initialTreatment: 'Nhịn ăn, truyền dịch, giảm đau.',
    diagnosis: 'K35.8 — Viêm ruột thừa cấp',
    vehicleInfo: 'Xe cứu thương 24A-678.90',
    escortName: 'ĐD. Phạm Văn Tú',
    preparationNote: 'Phòng mổ số 3 sẵn sàng, đã báo kíp gây mê.',
    vitals: vitalsAt('2026-12-01T08:10:00+07:00', [
      { pulse: 96, systolicBp: 122, diastolicBp: 78, spo2: 98, gcs: 15, consciousness: 'ALERT' },
      { pulse: 98, systolicBp: 120, diastolicBp: 76, spo2: 98, gcs: 15, consciousness: 'ALERT' },
      { pulse: 100, systolicBp: 118, diastolicBp: 76, spo2: 97, gcs: 15, consciousness: 'ALERT' },
    ]),
  },
  {
    id: 'ct-3',
    code: 'CT26113005',
    patient: patients[2]!,
    from: facilities.muongKhuong,
    to: facilities.laoCaiGeneral,
    referredBy: 'BS. Nguyễn Văn An',
    priority: 'ROUTINE',
    status: 'ARRIVED',
    createdAt: '2026-11-30T14:10:00+07:00',
    etaMinutes: 0,
    reason: 'Viêm phổi ở trẻ, cần theo dõi nội trú',
    clinicalSummary: 'Trẻ 8 tuổi, sốt, ho, thở nhanh 36 lần/phút.',
    initialTreatment: 'Hạ sốt, kháng sinh liều đầu.',
    diagnosis: 'J18.9 — Viêm phổi',
    vehicleInfo: 'Xe cứu thương 24A-123.45',
    escortName: 'ĐD. Lý Thị Hoa',
    vitals: vitalsAt('2026-11-30T14:20:00+07:00', [
      { pulse: 118, systolicBp: 100, diastolicBp: 65, spo2: 95, gcs: 15, consciousness: 'ALERT' },
      { pulse: 116, systolicBp: 102, diastolicBp: 66, spo2: 96, gcs: 15, consciousness: 'ALERT' },
    ]),
  },
];

export const findReferral = (id: string) => referrals.find((r) => r.id === id);

export const upperLevelFacilities: MockFacility[] = [facilities.laoCaiGeneral, facilities.vietDuc];
