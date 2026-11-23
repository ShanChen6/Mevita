import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StatsQuery } from './stats.schemas.js';

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Thống kê cho quản trị viên / Sở Y tế (Task 5.2) — tổng hợp bằng SQL trên PostgreSQL.
 * Địa phương = tỉnh/thành nơi đặt cơ sở y tế (nơi khám, nơi chuyển đi). Ngày tính theo giờ Việt Nam.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tỉnh/thành có cơ sở y tế đang hoạt động — cho bộ lọc. */
  provinces() {
    return this.prisma.$queryRaw<{ code: string; name: string }[]>`
      SELECT DISTINCT p.code, p.name
      FROM health_facilities f
      JOIN communes c ON c.code = f.commune_code
      JOIN provinces p ON p.code = c.province_code
      WHERE f.is_active
      ORDER BY p.name`;
  }

  async overview(q: StatsQuery) {
    const from = new Date(`${q.from}T00:00:00+07:00`);
    const to = new Date(new Date(`${q.to}T00:00:00+07:00`).getTime() + 86_400_000);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    const unit = days <= 45 ? 'day' : days <= 400 ? 'week' : 'month';
    const prov = (alias: string) =>
      q.province
        ? Prisma.sql`AND ${Prisma.raw(alias)}.province_code = ${q.province}`
        : Prisma.empty;
    const bucket = (col: string) =>
      Prisma.sql`date_trunc(${unit}, ${Prisma.raw(col)} AT TIME ZONE ${TZ})::date`;

    const [
      appointments,
      records,
      referralRows,
      timings,
      stations,
      provinces,
      trend,
      topDx,
      chapters,
      flows,
      journeys,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ bucket: Date; status: string; n: number }[]>`
          SELECT ${bucket('a.start_at')} AS bucket, a.status::text AS status, count(*)::int AS n
          FROM appointments a
          JOIN health_facilities f ON f.id = a.facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE a.start_at >= ${from} AND a.start_at < ${to} ${prov('fc')}
          GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ type: string; n: number }[]>`
          SELECT f.type::text AS type, count(*)::int AS n
          FROM medical_records m
          JOIN health_facilities f ON f.id = m.facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE m.status = 'FINALIZED' AND m.visit_at >= ${from} AND m.visit_at < ${to} ${prov('fc')}
          GROUP BY 1`,
      this.prisma.$queryRaw<{ status: string; priority: string; inter: boolean; n: number }[]>`
          SELECT r.status::text AS status, r.priority::text AS priority,
                 (fc.province_code <> tc.province_code) AS inter, count(*)::int AS n
          FROM referrals r
          JOIN health_facilities f ON f.id = r.from_facility_id
          JOIN communes fc ON fc.code = f.commune_code
          JOIN health_facilities t ON t.id = r.to_facility_id
          JOIN communes tc ON tc.code = t.commune_code
          WHERE r.created_at >= ${from} AND r.created_at < ${to} ${prov('fc')}
          GROUP BY 1, 2, 3`,
      this.prisma.$queryRaw<{ accept: number | null; transport: number | null }[]>`
          SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM r.accepted_at - r.created_at) / 60)
              FILTER (WHERE r.accepted_at IS NOT NULL AND r.status IN ('ACCEPTED', 'ARRIVED')) AS accept,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM r.arrived_at - r.departed_at) / 60)
              FILTER (WHERE r.arrived_at IS NOT NULL AND r.departed_at IS NOT NULL) AS transport
          FROM referrals r
          JOIN health_facilities f ON f.id = r.from_facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE r.created_at >= ${from} AND r.created_at < ${to} ${prov('fc')}`,
      // Tỉ lệ chuyển tuyến của từng trạm y tế xã = số phiếu chuyển đi / số lượt khám đã ký
      this.prisma.$queryRaw<
        { id: string; name: string; province: string; visits: number; referrals: number }[]
      >`
          WITH v AS (
            SELECT facility_id, count(*)::int AS n FROM medical_records
            WHERE status = 'FINALIZED' AND visit_at >= ${from} AND visit_at < ${to} GROUP BY 1
          ), r AS (
            SELECT from_facility_id, count(*)::int AS n FROM referrals
            WHERE created_at >= ${from} AND created_at < ${to} GROUP BY 1
          )
          SELECT f.id, f.name, p.name AS province, coalesce(v.n, 0) AS visits, coalesce(r.n, 0) AS referrals
          FROM health_facilities f
          JOIN communes fc ON fc.code = f.commune_code
          JOIN provinces p ON p.code = fc.province_code
          LEFT JOIN v ON v.facility_id = f.id
          LEFT JOIN r ON r.from_facility_id = f.id
          WHERE f.type = 'COMMUNE_HEALTH_STATION' AND (v.n > 0 OR r.n > 0) ${prov('fc')}`,
      this.prisma.$queryRaw<{ code: string; name: string; visits: number; referrals: number }[]>`
          WITH v AS (
            SELECT facility_id, count(*)::int AS n FROM medical_records
            WHERE status = 'FINALIZED' AND visit_at >= ${from} AND visit_at < ${to} GROUP BY 1
          ), r AS (
            SELECT from_facility_id, count(*)::int AS n FROM referrals
            WHERE created_at >= ${from} AND created_at < ${to} GROUP BY 1
          )
          SELECT p.code, p.name, sum(coalesce(v.n, 0))::int AS visits, sum(coalesce(r.n, 0))::int AS referrals
          FROM health_facilities f
          JOIN communes fc ON fc.code = f.commune_code
          JOIN provinces p ON p.code = fc.province_code
          LEFT JOIN v ON v.facility_id = f.id
          LEFT JOIN r ON r.from_facility_id = f.id
          WHERE f.type = 'COMMUNE_HEALTH_STATION' ${prov('fc')}
          GROUP BY 1, 2 HAVING sum(coalesce(v.n, 0)) > 0
          ORDER BY 2`,
      this.prisma.$queryRaw<{ bucket: Date; n: number }[]>`
          SELECT ${bucket('r.created_at')} AS bucket, count(*)::int AS n
          FROM referrals r
          JOIN health_facilities f ON f.id = r.from_facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE r.created_at >= ${from} AND r.created_at < ${to} ${prov('fc')}
          GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ code: string; name: string; chapter: string | null; n: number }[]>`
          SELECT d.icd_code AS code, i.name_vi AS name, i.chapter, count(*)::int AS n
          FROM diagnoses d
          JOIN medical_records m ON m.id = d.medical_record_id
          JOIN icd10_codes i ON i.code = d.icd_code
          JOIN health_facilities f ON f.id = m.facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE d.is_primary AND m.status = 'FINALIZED' AND m.visit_at >= ${from} AND m.visit_at < ${to} ${prov('fc')}
          GROUP BY 1, 2, 3 ORDER BY 4 DESC, 1 LIMIT 10`,
      // Mô hình bệnh tật theo địa phương: chẩn đoán chính theo chương ICD-10 × tỉnh
      this.prisma.$queryRaw<
        { province: string; name: string; chapter: string | null; n: number }[]
      >`
          SELECT fc.province_code AS province, p.name, i.chapter, count(*)::int AS n
          FROM diagnoses d
          JOIN medical_records m ON m.id = d.medical_record_id
          JOIN icd10_codes i ON i.code = d.icd_code
          JOIN health_facilities f ON f.id = m.facility_id
          JOIN communes fc ON fc.code = f.commune_code
          JOIN provinces p ON p.code = fc.province_code
          WHERE d.is_primary AND m.status = 'FINALIZED' AND m.visit_at >= ${from} AND m.visit_at < ${to} ${prov('fc')}
          GROUP BY 1, 2, 3`,
      this.prisma.$queryRaw<{ fromName: string; toName: string; inter: boolean; n: number }[]>`
          SELECT fp.name AS "fromName", tp.name AS "toName", (fp.code <> tp.code) AS inter, count(*)::int AS n
          FROM referrals r
          JOIN health_facilities f ON f.id = r.from_facility_id
          JOIN communes fc ON fc.code = f.commune_code
          JOIN provinces fp ON fp.code = fc.province_code
          JOIN health_facilities t ON t.id = r.to_facility_id
          JOIN communes tc ON tc.code = t.commune_code
          JOIN provinces tp ON tp.code = tc.province_code
          WHERE r.created_at >= ${from} AND r.created_at < ${to} ${prov('fc')}
          GROUP BY 1, 2, 3 ORDER BY 4 DESC`,
      // Hành trình nhiều chặng (Task A): lệnh lập từ hồ sơ tiếp nối = chặng chuyển tiếp
      this.prisma.$queryRaw<{ onward: number; stabilize: number; fromHospital: number }[]>`
          SELECT
            count(*) FILTER (WHERE m.source_referral_id IS NOT NULL)::int AS onward,
            count(*) FILTER (WHERE r.acceptance_type = 'STABILIZE_FORWARD')::int AS stabilize,
            count(*) FILTER (WHERE f.type <> 'COMMUNE_HEALTH_STATION')::int AS "fromHospital"
          FROM referrals r
          JOIN medical_records m ON m.id = r.source_record_id
          JOIN health_facilities f ON f.id = r.from_facility_id
          JOIN communes fc ON fc.code = f.commune_code
          WHERE r.created_at >= ${from} AND r.created_at < ${to} ${prov('fc')}`,
    ]);

    const sum = <T>(rows: T[], f: (r: T) => boolean, n: (r: T) => number) =>
      rows.filter(f).reduce((s, r) => s + n(r), 0);
    const apptTotal = sum(
      appointments,
      () => true,
      (r) => r.n,
    );
    const by = (s: string) =>
      sum(
        appointments,
        (r) => r.status === s,
        (r) => r.n,
      );
    const visits = sum(
      records,
      () => true,
      (r) => r.n,
    );
    const communeVisits = sum(
      records,
      (r) => r.type === 'COMMUNE_HEALTH_STATION',
      (r) => r.n,
    );
    const referrals = sum(
      referralRows,
      () => true,
      (r) => r.n,
    );
    const communeReferrals = sum(
      stations,
      () => true,
      (r) => r.referrals,
    );
    const status = (s: string) =>
      sum(
        referralRows,
        (r) => r.status === s,
        (r) => r.n,
      );
    const round = (x: number | null, d = 1) =>
      x == null ? null : Math.round(x * 10 ** d) / 10 ** d;
    const rate = (a: number, b: number) => (b > 0 ? round((a / b) * 100) : null);

    // Ma trận tỉnh × chương ICD: tỉ trọng (%) trong tổng chẩn đoán của tỉnh
    const provTotals = new Map<string, { name: string; total: number }>();
    for (const c of chapters) {
      const t = provTotals.get(c.province) ?? { name: c.name, total: 0 };
      t.total += c.n;
      provTotals.set(c.province, t);
    }
    const chapterTotals = new Map<string, number>();
    for (const c of chapters)
      chapterTotals.set(c.chapter ?? '?', (chapterTotals.get(c.chapter ?? '?') ?? 0) + c.n);
    const topChapters = [...chapterTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);

    return {
      range: { from: q.from, to: q.to, unit, province: q.province ?? null },
      kpis: {
        appointments: apptTotal,
        appointmentsCompleted: by('COMPLETED') + by('CHECKED_IN'),
        cancelRate: rate(by('CANCELLED'), apptTotal),
        noShowRate: rate(by('NO_SHOW'), apptTotal),
        visits,
        communeVisits,
        referrals,
        communeReferralRate: rate(communeReferrals, communeVisits),
        interProvincial: sum(
          referralRows,
          (r) => r.inter,
          (r) => r.n,
        ),
        arrived: status('ARRIVED'),
        rejected: status('REJECTED'),
        cancelled: status('CANCELLED'),
        active: status('PENDING') + status('ACCEPTED'),
        medianAcceptMinutes: round(timings[0]?.accept ?? null),
        medianTransportMinutes: round(timings[0]?.transport ?? null, 0),
        /** Chặng chuyển tiếp: bệnh viện chuyển tiếp ca đã nhận từ tuyến dưới */
        onwardReferrals: journeys[0]?.onward ?? 0,
        /** Tuyến trên nhận để ổn định rồi chuyển tiếp (không từ chối) */
        stabilizeForward: journeys[0]?.stabilize ?? 0,
        /** Lệnh do bệnh viện (tỉnh/TW) lập, không phải trạm xã */
        hospitalReferrals: journeys[0]?.fromHospital ?? 0,
      },
      appointmentsTrend: appointments.map((r) => ({
        ...r,
        bucket: r.bucket.toISOString().slice(0, 10),
      })),
      referralsTrend: trend.map((r) => ({ ...r, bucket: r.bucket.toISOString().slice(0, 10) })),
      referralPriority: ['CRITICAL', 'URGENT', 'ROUTINE'].map((p) => ({
        priority: p,
        n: sum(
          referralRows,
          (r) => r.priority === p,
          (r) => r.n,
        ),
      })),
      stations: stations
        .map((s) => ({ ...s, rate: rate(s.referrals, s.visits) }))
        .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.referrals - a.referrals),
      provinces: provinces.map((p) => ({ ...p, rate: rate(p.referrals, p.visits) })),
      topDiagnoses: topDx,
      diseasePattern: {
        chapters: topChapters,
        rows: [...provTotals.entries()]
          .sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi'))
          .map(([code, t]) => ({
            province: code,
            name: t.name,
            total: t.total,
            shares: topChapters.map((ch) =>
              round(
                ((chapters.find((c) => c.province === code && (c.chapter ?? '?') === ch)?.n ?? 0) /
                  t.total) *
                  100,
              ),
            ),
          })),
      },
      flows,
    };
  }
}
