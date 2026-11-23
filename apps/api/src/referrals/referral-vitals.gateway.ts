import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { NAMESPACE, RealtimeEvent, type SocketUser } from '../realtime/realtime.events.js';
import { locationSocketSchema, vitalSocketSchema } from './referrals.schemas.js';
import { TransportService } from './transport.service.js';
import { ReferralVitalsService } from './referral-vitals.service.js';

export type VitalAck =
  | { ok: true; accepted: string[]; created: number }
  /** `retry = false`: dữ liệu bị từ chối hẳn (sai, không có quyền, ca đã kết thúc) — đừng gửi lại */
  | { ok: false; message: string; retry: boolean };

/**
 * Thiết bị trên xe gửi `vital_update` (kèm ack) qua kênh realtime đã xác thực bằng vé socket.
 * Dùng chung namespace /realtime với RealtimeGateway (xác thực ở middleware của gateway đó).
 */
@WebSocketGateway({ namespace: NAMESPACE })
export class ReferralVitalsGateway {
  private readonly logger = new Logger(ReferralVitalsGateway.name);

  constructor(
    private readonly vitals: ReferralVitalsService,
    private readonly transport: TransportService,
  ) {}

  @SubscribeMessage(RealtimeEvent.VitalUpdate)
  async submit(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<VitalAck> {
    const user = (socket.data as { user?: SocketUser }).user;
    if (!user || (user.role !== 'COMMUNE_STAFF' && user.role !== 'PROVINCE_STAFF'))
      return { ok: false, message: 'Không có quyền', retry: false };
    const parsed = vitalSocketSchema.safeParse(body);
    if (!parsed.success)
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
        retry: false,
      };
    try {
      const res = await this.vitals.record(parsed.data.referralId, user, parsed.data.entries);
      return { ok: true, ...res };
    } catch (error) {
      if (error instanceof HttpException)
        return { ok: false, message: error.message, retry: false };
      this.logger.error(error);
      return { ok: false, message: 'Lỗi máy chủ, sẽ thử lại', retry: true };
    }
  }

  /** Vị trí xe từ điện thoại trên xe (Task C) — cùng giao ước ack như sinh tồn */
  @SubscribeMessage(RealtimeEvent.VehicleLocation)
  async location(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<VitalAck> {
    const user = (socket.data as { user?: SocketUser }).user;
    if (!user || (user.role !== 'COMMUNE_STAFF' && user.role !== 'PROVINCE_STAFF'))
      return { ok: false, message: 'Không có quyền', retry: false };
    const parsed = locationSocketSchema.safeParse(body);
    if (!parsed.success)
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
        retry: false,
      };
    try {
      const res = await this.transport.recordLocations(
        parsed.data.referralId,
        user,
        parsed.data.entries,
      );
      return { ok: true, accepted: res.accepted, created: res.created };
    } catch (error) {
      if (error instanceof HttpException)
        return { ok: false, message: error.message, retry: false };
      this.logger.error(error);
      return { ok: false, message: 'Lỗi máy chủ, sẽ thử lại', retry: true };
    }
  }
}
