import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import { PresenceService } from './presence.service.js';
import { rooms } from './realtime.events.js';

/** Gửi sự kiện realtime từ các module nghiệp vụ (VD: chuyển tuyến) tới đúng phòng. */
@Injectable()
export class RealtimeService {
  private server: Namespace | null = null;

  constructor(readonly presence: PresenceService) {}

  /** Gateway gọi khi khởi tạo. */
  attach(server: Namespace) {
    this.server = server;
  }

  /** Gửi tới mọi nhân viên đang trực của cơ sở; trả về số kết nối đã nhận. */
  async emitToFacility(facilityId: string, event: string, payload: unknown): Promise<number> {
    if (!this.server) return 0;
    const room = rooms.facility(facilityId);
    const sockets = await this.server.in(room).fetchSockets();
    this.server.to(room).emit(event, payload);
    return sockets.length;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(rooms.user(userId)).emit(event, payload);
  }

  /** Ngắt mọi kết nối realtime của một người (VD tài khoản bị khoá). */
  disconnectUser(userId: string) {
    this.server?.in(rooms.user(userId)).disconnectSockets(true);
  }
}
