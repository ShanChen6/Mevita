/**
 * Kiểm thử chịu tải kênh realtime (Task 5.3) — chạy với API đang hoạt động:
 *
 *   pnpm --filter @mevita/api load:socket -- --hospitals 20 --doctors 10 --stations 5 --duration 30
 *
 * Mô phỏng H bệnh viện × D bác sĩ trực (mỗi người 1 kết nối) và H × S xe chuyển viện (mỗi xe 1 kết nối
 * của nhân viên đi kèm). Ba giai đoạn:
 *   1. Kết nối đồng loạt — thời gian bắt tay, số kết nối lỗi.
 *   2. Cảnh báo ca mới — mỗi trạm gửi 1 lệnh chuyển tuyến qua HTTP; đo độ trễ tới từng bác sĩ trực
 *      của đúng bệnh viện, kiểm tra không lọt sang bệnh viện khác.
 *   3. Sinh tồn trên xe — mỗi xe gửi `vital_update` mỗi `--interval` ms trong `--duration` giây; đo độ trễ
 *      ack và độ trễ tới màn hình bệnh viện, đếm bản bị mất / trùng / lọt sai phòng.
 * Dữ liệu tạm có mã `LOAD-…` và email `@mevita.load`, tự xoá khi xong (kể cả khi lỗi).
 * Vé socket và access token được ký trực tiếp bằng khoá JWT trong .env (chỉ dùng cho kiểm thử, bỏ qua
 * giới hạn tần suất của API cấp vé). Không chạy với CSDL production.
 */
import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { io, type Socket } from 'socket.io-client';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const { values: args } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.LOAD_API_URL ?? 'http://localhost:4000' },
    hospitals: { type: 'string', default: '20' },
    doctors: { type: 'string', default: '10' },
    stations: { type: 'string', default: '5' },
    duration: { type: 'string', default: '30' },
    interval: { type: 'string', default: '2000' },
    concurrency: { type: 'string', default: '100' },
    pid: { type: 'string' },
    out: { type: 'string' },
  },
});
const H = Number(args.hospitals);
const D = Number(args.doctors);
const S = Number(args.stations);
const DURATION = Number(args.duration) * 1000;
const INTERVAL = Number(args.interval);
const API = args.api;
const tag = `L${Date.now().toString(36).toUpperCase()}`;

const secret = process.env.JWT_ACCESS_SECRET;
if (!secret || !process.env.DATABASE_URL)
  throw new Error('Thiếu JWT_ACCESS_SECRET / DATABASE_URL trong .env');
if (process.env.NODE_ENV === 'production')
  throw new Error('Không chạy kiểm thử tải với môi trường production');

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload: Record<string, unknown>, audience: string, ttl: number) {
  const now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...payload, iss: 'mevita-api', aud: audience, iat: now, exp: now + ttl })}`;
  return `${head}.${createHmac('sha256', secret!).update(head).digest('base64url')}`;
}
const ticket = (u: { id: string; role: string; fid: string; name: string }) =>
  sign({ sub: u.id, role: u.role, fid: u.fid, name: u.name }, 'mevita-socket', 600);
const accessToken = (u: { id: string; role: string; fid: string }) =>
  sign({ sub: u.id, role: u.role, fid: u.fid }, 'mevita', 3600);

function stats(xs: number[]) {
  if (xs.length === 0) return { n: 0, p50: null, p95: null, p99: null, max: null, mean: null };
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) =>
    Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10;
  return {
    n: s.length,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    max: Math.round(s.at(-1)! * 10) / 10,
    mean: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10,
  };
}

/** CPU (giây) và RSS (MB) của tiến trình API, nếu biết pid (Linux /proc). */
function proc(pid?: string) {
  if (!pid) return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    const ticks = Number(stat[11]) + Number(stat[12]);
    const rss = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1];
    return { cpuSeconds: ticks / 100, rssMb: Math.round(Number(rss) / 1024) };
  } catch {
    return null;
  }
}

async function pool<T>(items: T[], limit: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        await fn(items[k], k);
      }
    }),
  );
}

interface Actor {
  id: string;
  role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF';
  fid: string;
  name: string;
  hospital: number;
  socket?: Socket;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const hospitals: string[] = [];
  const stationsOf: { id: string; hospital: number }[] = [];
  const doctors: Actor[] = [];
  const escorts: (Actor & { station: string; recordId: string; patientId: string })[] = [];
  const report: Record<string, unknown> = {
    config: {
      hospitals: H,
      doctorsPerHospital: D,
      stationsPerHospital: S,
      durationSec: DURATION / 1000,
      intervalMs: INTERVAL,
    },
  };
  try {
    // ── Chuẩn bị dữ liệu ─────────────────────────────────────────────
    const commune = await prisma.commune.findFirstOrThrow({
      where: { provinceCode: '15' },
      select: { code: true },
    });
    const icd = await prisma.icd10Code.findFirstOrThrow({ select: { code: true } });
    const facilities = [];
    const users = [];
    const staff = [];
    const patients = [];
    const records = [];
    for (let h = 0; h < H; h++) {
      const hid = randomUUID();
      hospitals.push(hid);
      facilities.push({
        id: hid,
        code: `LOAD-${tag}-H${h}`,
        name: `BV tải ${h}`,
        type: 'PROVINCIAL_GENERAL_HOSPITAL' as const,
        level: 'BASIC' as const,
        communeCode: commune.code,
        acceptsReferrals: true,
      });
      for (let k = 0; k < D; k++) {
        const id = randomUUID();
        users.push({
          id,
          email: `h${h}d${k}-${tag.toLowerCase()}@mevita.load`,
          passwordHash: 'load-test',
          fullName: `BS tải ${h}-${k}`,
          role: 'PROVINCE_STAFF' as const,
        });
        staff.push({ userId: id, facilityId: hid, position: 'DOCTOR' as const });
        doctors.push({
          id,
          role: 'PROVINCE_STAFF',
          fid: hid,
          name: `BS tải ${h}-${k}`,
          hospital: h,
        });
      }
      for (let s = 0; s < S; s++) {
        const sid = randomUUID();
        stationsOf.push({ id: sid, hospital: h });
        facilities.push({
          id: sid,
          code: `LOAD-${tag}-S${h}-${s}`,
          name: `Trạm tải ${h}-${s}`,
          type: 'COMMUNE_HEALTH_STATION' as const,
          level: 'PRIMARY' as const,
          communeCode: commune.code,
          acceptsReferrals: false,
        });
        const uid = randomUUID();
        users.push({
          id: uid,
          email: `s${h}e${s}-${tag.toLowerCase()}@mevita.load`,
          passwordHash: 'load-test',
          fullName: `ĐD tải ${h}-${s}`,
          role: 'COMMUNE_STAFF' as const,
        });
        staff.push({ userId: uid, facilityId: sid, position: 'NURSE' as const });
        const patientId = randomUUID();
        patients.push({
          id: patientId,
          fullName: `BN tải ${h}-${s}`,
          dateOfBirth: new Date('1980-01-01'),
          gender: 'MALE' as const,
          addressDetail: '[LOAD]',
        });
        const recordId = randomUUID();
        records.push({
          id: recordId,
          code: `LOAD${tag}${h}X${s}`.slice(0, 20),
          patientId,
          doctorId: uid,
          facilityId: sid,
          chiefComplaint: 'Kiểm thử tải',
        });
        escorts.push({
          id: uid,
          role: 'COMMUNE_STAFF',
          fid: sid,
          name: `ĐD tải ${h}-${s}`,
          hospital: h,
          station: sid,
          recordId,
          patientId,
        });
      }
    }
    await prisma.healthFacility.createMany({ data: facilities });
    await prisma.user.createMany({ data: users });
    await prisma.staffProfile.createMany({ data: staff });
    await prisma.patient.createMany({ data: patients });
    await prisma.medicalRecord.createMany({ data: records });
    await prisma.diagnosis.createMany({
      data: records.map((r) => ({ medicalRecordId: r.id, icdCode: icd.code, isPrimary: true })),
    });
    const before = proc(args.pid);

    // ── 1. Kết nối đồng loạt ────────────────────────────────────────
    const actors: Actor[] = [...doctors, ...escorts];
    const connectMs: number[] = [];
    let connectFail = 0;
    const t0 = Date.now();
    await pool(actors, Number(args.concurrency), async (a) => {
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const s = io(`${API}/realtime`, {
          auth: { token: ticket(a) },
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
          timeout: 15_000,
        });
        s.once('connect', () => {
          connectMs.push(performance.now() - start);
          a.socket = s;
          resolve();
        });
        s.once('connect_error', () => {
          connectFail++;
          resolve();
        });
      });
    });
    report.connect = {
      sockets: actors.length,
      failed: connectFail,
      wallMs: Date.now() - t0,
      latencyMs: stats(connectMs),
    };
    console.log('1. Kết nối', report.connect);
    await new Promise((r) => setTimeout(r, 1000));

    // ── 2. Cảnh báo ca mới ──────────────────────────────────────────
    const sentAt = new Map<string, number>();
    const alertLatency: number[] = [];
    let wrongRoom = 0;
    const received = new Map<string, number>(); // referralId → số bác sĩ nhận
    const referralHospital = new Map<string, number>();
    // Sự kiện socket thường tới TRƯỚC phản hồi HTTP → ghi thời điểm nhận, tính độ trễ sau khi biết mốc gửi
    const receipts: { id: string; hospital: number; at: number }[] = [];
    for (const doc of doctors)
      doc.socket?.on('new_incoming_referral', (e: { id: string }) => {
        receipts.push({ id: e.id, hospital: doc.hospital, at: performance.now() });
      });
    const referralIds = new Map<string, string>(); // escort id → referral id
    const httpMs: number[] = [];
    let httpFail = 0;
    let deliveredReported = 0;
    await pool(escorts, 50, async (e) => {
      const start = performance.now();
      const res = await fetch(`${API}/api/referrals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken(e)}` },
        body: JSON.stringify({
          sourceRecordId: e.recordId,
          toFacilityId: hospitals[e.hospital],
          priority: 'CRITICAL',
          reason: 'Kiểm thử tải kênh cảnh báo',
          clinicalSummary: 'Dữ liệu kiểm thử tải — bỏ qua',
          escortId: e.id,
          etaMinutes: 30,
        }),
      });
      httpMs.push(performance.now() - start);
      if (!res.ok) {
        httpFail++;
        return;
      }
      const body = (await res.json()) as { referral: { id: string }; delivered: number };
      // Phản hồi HTTP có thể về sau sự kiện socket: lấy mốc lúc bắt đầu gửi
      sentAt.set(body.referral.id, start);
      referralHospital.set(body.referral.id, e.hospital);
      referralIds.set(e.id, body.referral.id);
      deliveredReported += body.delivered;
    });
    await new Promise((r) => setTimeout(r, 2000));
    for (const r of receipts) {
      const h = referralHospital.get(r.id);
      if (h === undefined) continue;
      if (h !== r.hospital) wrongRoom++;
      received.set(r.id, (received.get(r.id) ?? 0) + 1);
      alertLatency.push(r.at - sentAt.get(r.id)!);
    }
    const expectedAlerts = referralIds.size * D;
    const gotAlerts = [...received.values()].reduce((a, b) => a + b, 0);
    report.alerts = {
      referrals: referralIds.size,
      httpFailed: httpFail,
      httpMs: stats(httpMs),
      expectedDeliveries: expectedAlerts,
      received: gotAlerts,
      serverReportedDelivered: deliveredReported,
      wrongRoom,
      latencyMs: stats(alertLatency),
    };
    console.log('2. Cảnh báo', report.alerts);

    // ── 3. Sinh tồn trên xe ─────────────────────────────────────────
    const vitalSent = new Map<string, { at: number; hospital: number }>();
    const vitalLatency: number[] = [];
    const ackLatency: number[] = [];
    const vitalSeen = new Map<string, number>();
    let vitalWrong = 0;
    let ackFail = 0;
    let ackTimeout = 0;
    for (const doc of doctors)
      doc.socket?.on('vital_update', (e: { vitals: { clientId: string }[] }) => {
        for (const v of e.vitals) {
          const sent = vitalSent.get(v.clientId);
          if (!sent) continue;
          if (sent.hospital !== doc.hospital) vitalWrong++;
          vitalSeen.set(v.clientId, (vitalSeen.get(v.clientId) ?? 0) + 1);
          vitalLatency.push(performance.now() - sent.at);
        }
      });
    const cpuMid = proc(args.pid);
    const end = Date.now() + DURATION;
    await Promise.all(
      escorts.map(async (e, i) => {
        const referralId = referralIds.get(e.id);
        if (!referralId || !e.socket) return;
        await new Promise((r) => setTimeout(r, (i * INTERVAL) / escorts.length)); // dàn đều
        while (Date.now() < end) {
          const clientId = randomUUID();
          const at = performance.now();
          vitalSent.set(clientId, { at, hospital: e.hospital });
          try {
            const ack = (await e.socket.timeout(10_000).emitWithAck('vital_update', {
              referralId,
              entries: [
                {
                  clientId,
                  recordedAt: new Date().toISOString(),
                  pulse: 80 + (i % 40),
                  systolicBp: 120,
                  diastolicBp: 80,
                  spo2: 95,
                },
              ],
            })) as { ok: boolean };
            ackLatency.push(performance.now() - at);
            if (!ack.ok) ackFail++;
          } catch {
            ackTimeout++;
          }
          await new Promise((r) => setTimeout(r, INTERVAL));
        }
      }),
    );
    await new Promise((r) => setTimeout(r, 2000));
    const sent = vitalSent.size;
    const deliveries = [...vitalSeen.values()].reduce((a, b) => a + b, 0);
    const after = proc(args.pid);
    report.vitals = {
      sent,
      perSecond: Math.round((sent / (DURATION / 1000)) * 10) / 10,
      ackFailed: ackFail,
      ackTimeout,
      ackMs: stats(ackLatency),
      expectedDeliveries: sent * D,
      delivered: deliveries,
      missing: sent * D - deliveries,
      wrongRoom: vitalWrong,
      deliveryMs: stats(vitalLatency),
      rowsInDb: await prisma.referralVitalLog.count({
        where: { referral: { fromFacility: { code: { startsWith: `LOAD-${tag}` } } } },
      }),
    };
    console.log('3. Sinh tồn', report.vitals);
    if (before && after && cpuMid)
      report.server = {
        rssMbBefore: before.rssMb,
        rssMbAfter: after.rssMb,
        cpuSecondsDuringVitals: Math.round((after.cpuSeconds - cpuMid.cpuSeconds) * 10) / 10,
        cpuPercentDuringVitals:
          Math.round(((after.cpuSeconds - cpuMid.cpuSeconds) / (DURATION / 1000 + 2)) * 1000) / 10,
      };
    if (report.server) console.log('Máy chủ', report.server);
  } finally {
    for (const a of [...doctors, ...escorts]) a.socket?.disconnect();
    // Dọn dữ liệu tạm
    const fac = { code: { startsWith: `LOAD-${tag}` } };
    await prisma.referral.deleteMany({ where: { fromFacility: fac } });
    await prisma.medicalRecord.deleteMany({ where: { facility: fac } });
    await prisma.patient.deleteMany({ where: { addressDetail: '[LOAD]' } });
    await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: '@mevita.load' } } } });
    await prisma.staffProfile.deleteMany({ where: { facility: fac } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `${tag.toLowerCase()}@mevita.load` } },
    });
    await prisma.healthFacility.deleteMany({ where: fac });
    await prisma.$disconnect();
    if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
