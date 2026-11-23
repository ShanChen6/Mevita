/**
 * Âm thanh cảnh báo ca chuyển tuyến (Web Audio API — không cần tệp âm thanh).
 * Trình duyệt chỉ cho phát sau khi người dùng đã chạm/bấm vào trang: `installAudioUnlock` mở khoá
 * AudioContext ở lần tương tác đầu tiên. Người dùng có thể tắt tiếng (lưu trong localStorage).
 */
import type { ReferralPriorityValue } from '@/lib/data/types';

const PREF_KEY = 'mevita:alert-sound';
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  return ctx;
}

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // bỏ qua: chế độ riêng tư
  }
  if (on) void context()?.resume();
  listeners.forEach((l) => l());
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mở khoá âm thanh ở lần tương tác đầu tiên với trang. */
export function installAudioUnlock() {
  const unlock = () => {
    void context()?.resume();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, volume = 0.25) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/** Một chu kỳ âm báo theo mức độ: tối khẩn = còi hai âm, khẩn = 3 tiếng bíp, thường = 1 tiếng. */
function cycle(ac: AudioContext, priority: ReferralPriorityValue) {
  const t = ac.currentTime + 0.01;
  if (priority === 'CRITICAL')
    [0, 1, 2, 3].forEach((i) => tone(ac, i % 2 ? 660 : 960, t + i * 0.25, 0.24));
  else if (priority === 'URGENT') [0, 1, 2].forEach((i) => tone(ac, 880, t + i * 0.3, 0.18));
  else tone(ac, 740, t, 0.35, 0.18);
}

export type SoundState = 'playing' | 'muted' | 'blocked';

/**
 * Phát cảnh báo lặp lại (tối khẩn: tới khi được xác nhận, tối đa 2 phút; khẩn: 3 lần; thường: 1 lần).
 * Trả về trạng thái và hàm dừng.
 */
export function playAlert(priority: ReferralPriorityValue): {
  state: SoundState;
  stop: () => void;
} {
  if (!isSoundEnabled()) return { state: 'muted', stop: () => {} };
  const ac = context();
  if (!ac) return { state: 'blocked', stop: () => {} };
  if (ac.state !== 'running') void ac.resume();
  if (ac.state !== 'running') return { state: 'blocked', stop: () => {} };
  const repeats = priority === 'CRITICAL' ? 60 : priority === 'URGENT' ? 3 : 1;
  let n = 0;
  cycle(ac, priority);
  const timer = setInterval(() => {
    if (++n >= repeats) return clearInterval(timer);
    cycle(ac, priority);
  }, 2000);
  return { state: 'playing', stop: () => clearInterval(timer) };
}
