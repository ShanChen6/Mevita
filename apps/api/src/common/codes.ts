import { randomInt } from 'node:crypto';

/** Bỏ các ký tự dễ nhầm khi đọc qua điện thoại: 0/O, 1/I/L. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mã ngắn dễ đọc, VD: LH8K2Q7M (lịch hẹn), BA3F9W1Z (bệnh án). */
export function generateCode(prefix: string, length = 6): string {
  let code = prefix;
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
