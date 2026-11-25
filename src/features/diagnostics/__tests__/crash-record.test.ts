import {
  MAX_STACK_LENGTH,
  decodeCrashRecord,
  describeError,
  encodeCrashRecord,
  formatCrashRecord,
  type CrashRecord,
} from '../crash-record';

const RECORD: CrashRecord = {
  source: 'fatal',
  message: "undefined is not a function (near '...x.map...')",
  stack: 'TypeError: boom\n    at render (main.jsbundle:1:200)\n    at Foo (main.jsbundle:1:300)',
  componentStack: null,
  recentErrors: ['Warning: something'],
  time: '2026-11-25T18:04:05.000Z',
  route: '/(tabs)/friends/demo-mustapha',
  app: { version: '0.1.0', build: '57', os: 'ios 26.1', device: 'iPhone 15' },
  breadcrumbs: [{ at: 1, kind: 'nav', label: '/onboarding' }],
  isShown: false,
};

describe('the record of a fatal error', () => {
  it('goes to text and comes back the same', () => {
    expect(decodeCrashRecord(encodeCrashRecord(RECORD))).toEqual(RECORD);
  });

  it('refuses what is not a record, without throwing', () => {
    expect(decodeCrashRecord('')).toBeNull();
    expect(decodeCrashRecord('not json')).toBeNull();
    expect(decodeCrashRecord('[1,2]')).toBeNull();
    expect(decodeCrashRecord('{"message": 4}')).toBeNull();
    expect(decodeCrashRecord(null)).toBeNull();
  });

  it('keeps what it can of a record written by another version, and drops bad crumbs', () => {
    const text = JSON.stringify({
      source: 'fatal',
      message: 'm',
      stack: 's',
      time: '2026-11-25T18:04:05.000Z',
      breadcrumbs: [{ at: 1, kind: 'nav', label: 'ok' }, { nope: true }, 'x'],
    });
    const decoded = decodeCrashRecord(text);
    expect(decoded?.message).toBe('m');
    expect(decoded?.route).toBeNull();
    expect(decoded?.breadcrumbs).toEqual([{ at: 1, kind: 'nav', label: 'ok' }]);
    expect(decoded?.isShown).toBe(false);
  });

  it('cuts a stack that is far too long', () => {
    const encoded = encodeCrashRecord({ ...RECORD, stack: 'x'.repeat(100_000) });
    expect(decodeCrashRecord(encoded)?.stack.length).toBeLessThanOrEqual(MAX_STACK_LENGTH);
  });

  it('is written out for a person to send: what, when, where, on what, and the trail', () => {
    const text = formatCrashRecord(RECORD);
    expect(text).toContain(RECORD.message);
    expect(text).toContain('2026-11-25T18:04:05.000Z');
    expect(text).toContain('/(tabs)/friends/demo-mustapha');
    expect(text).toContain('0.1.0 (57)');
    expect(text).toContain('iPhone 15');
    expect(text).toContain('/onboarding');
    expect(text).toContain('at Foo');
  });
});

describe('what an error is, whatever was thrown', () => {
  it('reads an Error', () => {
    const error = new Error('bad');
    expect(describeError(error)).toEqual({ message: 'bad', stack: error.stack ?? '' });
  });

  it('reads anything else as text', () => {
    expect(describeError('plain')).toEqual({ message: 'plain', stack: '' });
    expect(describeError(undefined).message).toBe('undefined');
    expect(describeError({ code: 3 }).message).toContain('code');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => describeError(circular)).not.toThrow();
  });
});
