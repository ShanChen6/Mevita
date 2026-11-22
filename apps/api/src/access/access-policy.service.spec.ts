import type { AuthUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccessPolicyService } from './access-policy.service.js';

const PATIENT = '0190a000-0000-7000-8000-000000000001';
const OTHER = '0190a000-0000-7000-8000-000000000002';

function makePolicy(found: { record?: boolean; appointment?: boolean; referral?: boolean } = {}) {
  const hit = (v?: boolean) => vi.fn().mockResolvedValue(v ? { id: 'x' } : null);
  const prisma = {
    medicalRecord: { findFirst: hit(found.record) },
    appointment: { findFirst: hit(found.appointment) },
    referral: { findFirst: hit(found.referral) },
  };
  return { policy: new AccessPolicyService(prisma as unknown as PrismaService), prisma };
}

const user = (role: AuthUser['role'], extra: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u',
  role,
  facilityId: null,
  patientId: null,
  ...extra,
});

describe('AccessPolicyService.canAccessPatient', () => {
  it('ADMIN xem được mọi bệnh nhân', async () => {
    expect(await makePolicy().policy.canAccessPatient(user('ADMIN'), PATIENT)).toBe(true);
  });

  it('bệnh nhân chỉ xem được hồ sơ của mình', async () => {
    const { policy } = makePolicy({ record: true });
    const me = user('PATIENT', { patientId: PATIENT });
    expect(await policy.canAccessPatient(me, PATIENT)).toBe(true);
    expect(await policy.canAccessPatient(me, OTHER)).toBe(false);
  });

  it('nhân viên không có cơ sở công tác bị từ chối', async () => {
    expect(
      await makePolicy({ record: true }).policy.canAccessPatient(user('COMMUNE_STAFF'), PATIENT),
    ).toBe(false);
  });

  it.each([
    ['hồ sơ khám tại cơ sở', { record: true }],
    ['lịch hẹn tại cơ sở', { appointment: true }],
    ['phiếu chuyển tuyến tới/từ cơ sở', { referral: true }],
  ])('nhân viên xem được khi bệnh nhân có %s', async (_, found) => {
    const staff = user('PROVINCE_STAFF', { facilityId: 'fac-1' });
    expect(await makePolicy(found).policy.canAccessPatient(staff, PATIENT)).toBe(true);
  });

  it('nhân viên bị từ chối khi bệnh nhân không liên hệ với cơ sở', async () => {
    const staff = user('COMMUNE_STAFF', { facilityId: 'fac-1' });
    expect(await makePolicy().policy.canAccessPatient(staff, PATIENT)).toBe(false);
  });

  it('chỉ tra cứu trong phạm vi cơ sở của nhân viên và bỏ qua phiếu đã huỷ', async () => {
    const { policy, prisma } = makePolicy();
    await policy.canAccessPatient(user('COMMUNE_STAFF', { facilityId: 'fac-1' }), PATIENT);
    expect(prisma.medicalRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: PATIENT, facilityId: 'fac-1' } }),
    );
    expect(prisma.referral.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'CANCELLED' },
          OR: [{ toFacilityId: 'fac-1' }, { fromFacilityId: 'fac-1' }],
        }),
      }),
    );
  });
});
