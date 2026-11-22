import { nextStatus } from './appointment-status.js';

describe('nextStatus', () => {
  it.each([
    ['PENDING', 'confirm', 'CONFIRMED'],
    ['PENDING', 'check-in', 'CHECKED_IN'],
    ['CONFIRMED', 'check-in', 'CHECKED_IN'],
    ['CONFIRMED', 'cancel', 'CANCELLED'],
    ['CONFIRMED', 'no-show', 'NO_SHOW'],
    ['CHECKED_IN', 'complete', 'COMPLETED'],
  ] as const)('%s --%s--> %s', (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
  });

  it.each([
    ['CONFIRMED', 'confirm'],
    ['CHECKED_IN', 'cancel'],
    ['CANCELLED', 'check-in'],
    ['COMPLETED', 'cancel'],
    ['NO_SHOW', 'confirm'],
    ['PENDING', 'complete'],
  ] as const)('không cho %s --%s-->', (from, action) => {
    expect(nextStatus(from, action)).toBeNull();
  });
});
