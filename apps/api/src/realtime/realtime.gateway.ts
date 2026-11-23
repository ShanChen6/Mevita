import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { PresenceService } from './presence.service.js';
import { RealtimeTicketService } from './realtime-ticket.service.js';
import { NAMESPACE, RealtimeEvent, rooms, type SocketUser } from './realtime.events.js';
import { RealtimeService } from './realtime.service.js';

/** Người dùng đã xác thực của một kết nối (socket.data không có kiểu sẵn). */
const userOf = (socket: Socket) => (socket.data as { user?: SocketUser }).user;
const setUser = (socket: Socket, user: SocketUser) => {
  (socket.data as { user?: SocketUser }).user = user;
};

/**
 * Kênh realtime (Socket.io, namespace /realtime).
 * - Xác thực bằng vé socket ngắn hạn trong `handshake.auth.token`.
 * - Tự vào phòng `user_<id>`; nhân viên y tế vào thêm phòng `facility_<mã cơ sở>` — bác sĩ tuyến trên
 *   đang trực nhận cảnh báo chuyển tuyến gửi tới phòng của bệnh viện mình.
 * CORS và giới hạn kích thước gói tin cấu hình ở RealtimeIoAdapter.
 */
@WebSocketGateway({ namespace: NAMESPACE })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() private server!: Namespace;

  constructor(
    private readonly tickets: RealtimeTicketService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attach(server);
    // Xác thực trước khi chấp nhận kết nối — vé sai/hết hạn: client nhận connect_error "unauthorized"
    server.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      this.tickets
        .verify(auth?.token)
        .then((user) => {
          setUser(socket, user);
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  async handleConnection(socket: Socket) {
    const user = userOf(socket);
    if (!user) return socket.disconnect(true);
    await socket.join(rooms.user(user.id));
    if (user.role === 'ADMIN') await socket.join(rooms.admins);
    if (user.facilityId) {
      await socket.join(rooms.facility(user.facilityId));
      if (this.presence.join(user)) this.broadcastPresence(user.facilityId);
      else socket.emit(RealtimeEvent.PresenceUpdate, this.presencePayload(user.facilityId));
    }
    this.logger.debug(`+ ${user.fullName} (${user.role}) ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    const user = userOf(socket);
    if (!user) return;
    if (user.facilityId && this.presence.leave(user)) this.broadcastPresence(user.facilityId);
    this.logger.debug(`- ${user.fullName} ${socket.id}`);
  }

  /** Client hỏi mình là ai, đang ở phòng nào (kiểm tra kết nối). */
  @SubscribeMessage('whoami')
  whoami(@ConnectedSocket() socket: Socket) {
    return { user: userOf(socket), rooms: [...socket.rooms].filter((r) => r !== socket.id) };
  }

  private presencePayload(facilityId: string) {
    return { facilityId, onDuty: this.presence.onDuty(facilityId) };
  }

  private broadcastPresence(facilityId: string) {
    this.server
      .to(rooms.facility(facilityId))
      .emit(RealtimeEvent.PresenceUpdate, this.presencePayload(facilityId));
  }
}
