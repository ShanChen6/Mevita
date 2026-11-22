import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Cần PostgreSQL đã migrate + seed (`pnpm db:deploy && pnpm db:seed`).
 * Tự bỏ qua nếu không kết nối được DB.
 */
describe('Administrative units (e2e)', () => {
  let app: INestApplication<App>;
  let dbReady = false;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.province.count()) > 0;
    if (!dbReady)
      console.warn('⚠️  Bỏ qua e2e danh mục hành chính: DB chưa sẵn sàng hoặc chưa seed.');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/provinces trả về 34 tỉnh/thành', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/provinces').expect(200);
    const body = res.body as { code: string; _count: { communes: number } }[];
    expect(body).toHaveLength(34);
    expect(body.reduce((sum, p) => sum + p._count.communes, 0)).toBe(3321);
  });

  it('GET /api/provinces?type=MUNICIPALITY', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/provinces?type=MUNICIPALITY').expect(200);
    expect((res.body as { code: string }[]).map((p) => p.code)).toContain('01');
  });

  it('GET /api/provinces/15/communes tìm không dấu "muong khuong"', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/provinces/15/communes?q=muong%20khuong').expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({ code: '02761', fullName: 'Xã Mường Khương', provinceCode: '15' }),
    ]);
  });

  it('GET /api/communes?q=Mường Khương tìm có dấu', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/communes').query({ q: 'Mường Khương' }).expect(200);
    expect((res.body as { code: string }[]).map((c) => c.code)).toContain('02761');
  });

  it('tìm kèm loại đơn vị: "xa muong khuong", "Đặc khu"', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const byPrefix = await http().get('/api/communes').query({ q: 'xa muong khuong' }).expect(200);
    expect((byPrefix.body as { code: string }[]).map((c) => c.code)).toContain('02761');

    const zones = await http()
      .get('/api/communes')
      .query({ q: 'Đặc khu', type: 'SPECIAL_ZONE', limit: 100 })
      .expect(200);
    expect(zones.body).toHaveLength(13);
  });

  it('GET /api/communes/02761 kèm thông tin tỉnh', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/communes/02761').expect(200);
    expect(res.body).toMatchObject({ code: '02761', province: { code: '15', name: 'Lào Cai' } });
  });

  it('404 khi mã không tồn tại, 400 khi mã sai định dạng', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http().get('/api/provinces/99').expect(404);
    await http().get('/api/provinces/abc').expect(400);
    await http().get('/api/communes?type=DISTRICT').expect(400);
  });
});
