import { classifyLookup } from './lookup-query.js';

describe('classifyLookup', () => {
  it.each([
    ['010090001234', 'NATIONAL_ID', '010090001234'],
    ['0100 9000 1234', 'NATIONAL_ID', '010090001234'],
    ['lh8k2q7m', 'APPOINTMENT_CODE', 'LH8K2Q7M'],
    ['dn 4010090001234', 'HEALTH_INSURANCE', 'DN4010090001234'],
    ['0912 345 678', 'PHONE_OR_INSURANCE', '0912345678'],
    ['+84912345678', 'PHONE_OR_INSURANCE', '0912345678'],
    ['  Lò   Văn Cường ', 'NAME', 'Lò Văn Cường'],
    ['0123', 'NAME', '0123'],
  ])('%s → %s', (q, kind, value) => {
    expect(classifyLookup(q)).toEqual({ kind, value });
  });
});
