/**
 * Quay VIDEO DỰ PHÒNG cho buổi bảo vệ (Task 6.3). Script tự chạy trọn ca chuyển tuyến demo trên 3 "thiết bị":
 * laptop bác sĩ trạm xã, laptop bác sĩ trực BVĐK tỉnh và điện thoại điều dưỡng trên xe. Mỗi thiết bị được
 * ghi hình riêng, sau đó ffmpeg ghép thành một video 1920×1080 có nhãn và phụ đề tiếng Việt.
 *
 * Chuẩn bị: web + API đang chạy, đã `pnpm --filter @mevita/api demo:reset`, máy có ffmpeg.
 *
 *   node scripts/demo-video/record.mjs \
 *     [--web http://localhost:3000] [--api http://localhost:4000/api] [--password Mevita@2026] [--out demo-video]
 *
 * Kết quả: <out>/mevita-demo.mp4, cùng video gốc của từng thiết bị (.webm) và phụ đề (.srt).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, devices } from 'playwright';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const WEB = arg('web', 'http://localhost:3000');
const API = arg('api', 'http://localhost:4000/api');
const PASSWORD = arg('password', 'Mevita@2026');
const OUT = resolve(arg('out', 'demo-video'));
mkdirSync(OUT, { recursive: true });

const STATION = { latitude: 22.7676, longitude: 104.1236 };
const ROUTE = [
  [22.7212, 104.1105],
  [22.6655, 104.0811],
  [22.6018, 104.0632],
  [22.5404, 104.0518],
  [22.4741, 104.0302],
  [22.4392, 104.0261],
];
const HOSPITAL_GATE = { latitude: 22.4167, longitude: 104.0228 };

const T0 = Date.now();
const now = () => (Date.now() - T0) / 1000;
const captions = [];
/** Phụ đề hiện từ bây giờ tới khi có phụ đề kế tiếp. */
const say = (text) => {
  if (captions.length) captions.at(-1).end = now();
  captions.push({ start: now(), end: null, text });
  console.log(`[${now().toFixed(1)}s] ${text}`);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const vis = (p, sel) => p.locator(sel).filter({ visible: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const starts = {};
async function device(key, email, options) {
  const ctx = await browser.newContext({
    ...options,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    recordVideo: { dir: join(OUT, `raw-${key}`), size: options.viewport },
  });
  const page = await ctx.newPage();
  starts[key] = now();
  await page.goto(`${WEB}/login`);
  await vis(page, '#identifier').fill(email);
  await vis(page, '#password').fill(PASSWORD);
  await vis(page, 'main form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
  return { ctx, page };
}
const closePopups = async (p) => {
  for (const b of await p.getByRole('button', { name: 'Để sau' }).all())
    if (await b.isVisible()) await b.click();
};

// Phiếu khám cấp cứu đang chờ trong dữ liệu demo
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'bs.an@mevita.vn', password: PASSWORD }),
}).then((r) => r.json());
const open = await fetch(`${API}/medical-records/open`, {
  headers: { authorization: `Bearer ${login.accessToken}` },
}).then((r) => r.json());
const record = open.find((r) => r.code === 'DEMO-KB-08');
if (!record)
  throw new Error('Không thấy phiếu DEMO-KB-08 — chạy pnpm --filter @mevita/api demo:reset trước');

const laptop = { viewport: { width: 1280, height: 720 } };
const { ctx: ctxA, page: A } = await device('xa', 'bs.an@mevita.vn', laptop);
const { ctx: ctxB, page: B } = await device('tinh', 'bs.binh@mevita.vn', laptop);
const iphone = devices['iPhone 13'];
const { ctx: ctxE, page: E } = await device('xe', 'dd.hoa@mevita.vn', {
  ...iphone,
  permissions: ['geolocation'],
  geolocation: STATION,
});

try {
  say(
    'Mevita — chuyển tuyến cấp cứu thời gian thực: Trạm Y tế Xã Mường Khương → BVĐK Tỉnh Lào Cai',
  );
  await B.goto(`${WEB}/province`);
  await vis(B, 'header [role=status]')
    .filter({ hasText: /Đang trực/ })
    .waitFor({ timeout: 20000 });
  await A.goto(`${WEB}/commune/encounters/${record.id}`);
  await pause(3500);

  say(
    'Trạm xã: anh Sùng Seo Chư bị tai nạn giao thông, GCS 12, nghi máu tụ nội sọ — vượt khả năng chuyên môn',
  );
  await A.mouse.wheel(0, 500);
  await pause(3500);
  await A.mouse.wheel(0, -500);
  await A.getByRole('link', { name: 'Chuyển tuyến khẩn cấp' }).click();
  await vis(A, '#clinicalSummary').waitFor();

  say('Tóm tắt bệnh án tự soạn từ phiếu khám. Cảnh báo dị ứng luôn hiện trên đầu');
  await pause(3500);
  say(
    'Gợi ý bệnh viện theo chuyên khoa, giường trống, thời gian di chuyển, bác sĩ đang trực — BV quá tải bị xếp sau, không bị loại',
  );
  await vis(A, '#requiredSpecialtyCode').selectOption('NEUROSURGERY');
  await pause(1500);
  await vis(A, '[aria-label="Bệnh viện tuyến trên"]').scrollIntoViewIfNeeded();
  await pause(4500);
  await vis(A, '[aria-label="Bệnh viện tuyến trên"] label')
    .filter({ hasText: 'Bệnh viện Đa khoa Tỉnh Lào Cai' })
    .click();
  const escort = vis(A, '#escortId');
  const hoa = await escort.locator('option', { hasText: 'Hoa' }).first().getAttribute('value');
  await escort.selectOption(hoa);
  await vis(A, 'input[value=EMS_115]').check();
  await vis(A, '#vehicleInfo').fill('Xe cấp cứu 115 Lào Cai');
  await pause(1500);

  say('Bấm gửi — bác sĩ trực tuyến tỉnh nhận cảnh báo kèm còi trong chưa đầy 1 giây');
  await A.getByRole('button', { name: /Gửi lệnh chuyển tuyến tới/ })
    .filter({ visible: true })
    .click();
  const alert = vis(B, '[data-testid=incoming-alert]');
  await alert.waitFor({ timeout: 10000 });
  await A.waitForURL(/sent=/);
  await pause(4000);
  await alert.getByRole('button', { name: 'Xem hồ sơ & tiếp nhận' }).click();
  await B.waitForURL(/\/province\/referrals\/[0-9a-f-]{36}/);
  const referralId = B.url().split('/').pop();
  await B.getByText('Thông tin chuyên môn').waitFor();
  await pause(2500);

  say('Ca cấp cứu không có nút "từ chối": BV xác nhận sẵn sàng ê-kíp, trạm xã được báo ngay');
  await vis(B, 'button:has-text("Xác nhận tiếp nhận & Sẵn sàng ê-kíp")').click();
  await vis(B, '[data-testid=accepted-banner]').waitFor();
  await pause(3500);

  say('Điện thoại điều dưỡng trên xe: chia sẻ vị trí GPS và nhập sinh tồn');
  await E.goto(`${WEB}/escort/${referralId}`);
  await vis(E, '[data-testid=sync-status]')
    .filter({ hasText: 'Đã kết nối' })
    .waitFor({ timeout: 20000 });
  const share = E.getByRole('button', { name: 'Bật chia sẻ' });
  if (await share.isVisible().catch(() => false)) await share.click();
  const fill = async (v) => {
    for (const [k, val] of Object.entries(v)) await vis(E, `#${k}`).fill(String(val));
  };
  await fill({ pulse: 104, bp: '160/95', spo2: 93, respiratoryRate: 22, gcs: 12 });
  await E.getByRole('button', { name: /V — Đáp ứng lời nói/ }).click();
  await vis(E, 'button[type=submit]').click();
  await vis(B, '[data-testid=latest-SpO2]').filter({ hasText: '93%' }).waitFor({ timeout: 10000 });
  await B.locator('[data-testid=live-vitals]').scrollIntoViewIfNeeded();
  await pause(3000);

  say('Qua đèo mất sóng: lần đo được lưu tạm trên máy, không mất dữ liệu');
  await ctxE.setGeolocation({ latitude: ROUTE[0][0], longitude: ROUTE[0][1] });
  await ctxE.setOffline(true);
  await vis(E, '[data-testid=sync-status]')
    .filter({ hasText: 'Mất sóng' })
    .waitFor({ timeout: 10000 });
  await fill({ pulse: 92, bp: '168/98', spo2: 92, gcs: 11 });
  await vis(E, 'button[type=submit]').click();
  await pause(2000);
  await fill({ pulse: 84, bp: '175/100', spo2: 91, gcs: 11 });
  await vis(E, 'button[type=submit]').click();
  await pause(3000);

  say(
    'Có sóng lại: tự gửi bù — BV thấy GCS giảm, mạch chậm, huyết áp tăng (dấu hiệu tăng áp lực nội sọ)',
  );
  await ctxE.setOffline(false);
  await vis(B, '[data-testid=vital-row]').nth(2).waitFor({ timeout: 20000 });
  await pause(4500);

  say('Bệnh viện theo dõi xe trên bản đồ, giờ tới tính lại theo vị trí thật');
  await B.locator('[data-testid=vehicle-tracking]')
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  for (const [latitude, longitude] of ROUTE.slice(1)) {
    await ctxE.setGeolocation({ latitude, longitude });
    await pause(2200);
  }
  say('Xe còn 1 km: bệnh viện nhận cảnh báo chuẩn bị đón ở cổng cấp cứu');
  await ctxE.setGeolocation(HOSPITAL_GATE);
  await B.getByText(/sắp tới/)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  await pause(4000);
  await closePopups(B);

  say(
    'Bàn giao: mở hồ sơ điều trị tiếp nối — kế thừa dữ liệu tuyến xã và toàn bộ diễn biến trên xe',
  );
  await B.evaluate(() => window.scrollTo(0, 0));
  await vis(B, 'button:has-text("Xe đã tới — Tiếp nhận bệnh nhân")').click();
  await B.getByRole('button', { name: 'Tiếp nhận & mở hồ sơ điều trị' }).click();
  await B.waitForURL(/\/province\/encounters\//, { timeout: 15000 });
  await vis(B, '[data-testid=referral-context]').waitFor();
  await vis(E, '[data-testid=handover]')
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await pause(3000);
  await B.mouse.wheel(0, 600);
  await pause(4000);
  say(
    'Hết. Toàn bộ dữ liệu là kịch bản demo — dựng lại bằng: pnpm --filter @mevita/api demo:reset',
  );
  await pause(3000);
  captions.at(-1).end = now();
} finally {
  await Promise.all([ctxA.close(), ctxB.close(), ctxE.close()]);
  await browser.close();
}

// ── Ghép video ────────────────────────────────────────────────────────────────────────────
const raw = {};
for (const k of ['xa', 'tinh', 'xe']) {
  const dir = join(OUT, `raw-${k}`);
  const file = execFileSync('ls', [dir]).toString().trim().split('\n')[0];
  raw[k] = join(OUT, `${k}.webm`);
  renameSync(join(dir, file), raw[k]);
}
const srt = captions
  .map((c, i) => {
    const ts = (s) => new Date(s * 1000).toISOString().slice(11, 23).replace('.', ',');
    return `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`;
  })
  .join('\n');
writeFileSync(join(OUT, 'mevita-demo.srt'), srt);

const font = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  'C:/Windows/Fonts/arial.ttf',
].find((f) => existsSync(f));
const fontOpt = font ? `fontfile='${font.replace(/:/g, '\\:')}':` : '';
/** Ngắt dòng phụ đề ~60 ký tự để vừa khung bên phải. */
const wrap = (t, n = 58) =>
  t.split(' ').reduce(
    (lines, w) => {
      const last = lines.at(-1);
      if ((last + ' ' + w).trim().length > n) lines.push(w);
      else lines[lines.length - 1] = (last + ' ' + w).trim();
      return lines;
    },
    [''],
  );
const filters = [
  `[0:v]tpad=start_duration=${starts.xa.toFixed(2)}:color=black,scale=960:540[a]`,
  `[1:v]tpad=start_duration=${starts.tinh.toFixed(2)}:color=black,scale=960:540[b]`,
  `[2:v]tpad=start_duration=${starts.xe.toFixed(2)}:color=black,scale=-2:760[e]`,
  `color=c=0x0f172a:s=1920x1080:d=${Math.ceil(now())}[bg]`,
  `[bg][a]overlay=0:0:shortest=0[v1]`,
  `[v1][b]overlay=0:540[v2]`,
  `[v2][e]overlay=1215:60[v3]`,
];
let last = 'v3';
const label = (text, x, y) => {
  const f = join(OUT, `label-${x}-${y}.txt`);
  writeFileSync(f, text);
  return `drawtext=${fontOpt}textfile='${f}':x=${x}:y=${y}:fontsize=22:fontcolor=white:box=1:boxcolor=0x0b7a75@0.9:boxborderw=8`;
};
const draw = [
  label('Bác sĩ Trạm Y tế Xã Mường Khương', 12, 12),
  label('Bác sĩ trực BVĐK Tỉnh Lào Cai', 12, 552),
  label('Điện thoại điều dưỡng trên xe', 1250, 18),
];
captions.forEach((c, i) => {
  const f = join(OUT, `cap-${i}.txt`);
  writeFileSync(f, wrap(c.text).join('\n'));
  draw.push(
    `drawtext=${fontOpt}textfile='${f}':x=990:y=850:fontsize=27:line_spacing=8:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'`,
  );
});
filters.push(`[${last}]${draw.join(',')}[out]`);
const mp4 = join(OUT, 'mevita-demo.mp4');
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-i',
    raw.xa,
    '-i',
    raw.tinh,
    '-i',
    raw.xe,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-r',
    '25',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    mp4,
  ],
  { stdio: 'inherit' },
);
console.log(`✔ Video: ${mp4} (${Math.round(now())} giây), phụ đề: ${join(OUT, 'mevita-demo.srt')}`);
