import { getCurrentKhatm } from '@/domain/khatm';

import {
  SYNC_CONFIG,
  acknowledgePushed,
  createSyncMeta,
  eventId,
  fullStateEvents,
  mergeRemoteEvents,
  nextRetryDelay,
  nextStamp,
  parseSyncEvent,
  readSyncMeta,
  recordLocalChanges,
  type SyncEvent,
} from '..';
import { Device, RULES, Server, comparable, day, pages, values } from '../test-support/sync-kit';

const newServer = () => new Server(eventId);

describe('event ids', () => {
  it('are the content of the event: the same reading on two phones is one event', () => {
    const page: SyncEvent = { kind: 'page', khatm: 1, page: 5, date: day('2026-11-25') };
    expect(eventId(page)).toBe(eventId({ ...page }));
    expect(eventId(page)).not.toBe(eventId({ ...page, date: day('2026-11-26') }));
  });

  it('differ between kinds, and only use characters the server accepts', () => {
    const events: SyncEvent[] = [
      { kind: 'page', khatm: 1, page: 5, date: day('2026-11-25') },
      { kind: 'time', device: 'a', date: day('2026-11-25'), app: 60, reader: 30 },
      { kind: 'setting', key: 'dailyGoalPages', value: 4, at: 10, device: 'a' },
      { kind: 'bookmark', page: 5, on: true, at: 10, device: 'a' },
      { kind: 'pause', from: day('2026-11-01'), to: day('2026-11-03') },
    ];
    const ids = events.map(eventId);
    expect(new Set(ids).size).toBe(events.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9._-]{1,160}$/);
  });
});

describe('the clock of a device', () => {
  it('never goes back, even when the phone clock does', () => {
    expect(nextStamp(5_000, 4_000)).toBe(5_001);
    expect(nextStamp(5_000, 9_000)).toBe(9_000);
  });

  it('a change made after seeing a stamp from a phone whose clock is ahead still wins', () => {
    const ahead = new Device('ahead', { now: 50_000 });
    const behind = new Device('behind', { now: 1_000 });
    const server = newServer();
    ahead.signIn('u');
    behind.signIn('u');
    ahead.set('dailyGoalPages', 10);
    ahead.sync(server);
    behind.sync(server);
    expect(behind.values.settings.dailyGoalPages).toBe(10);
    // The person changes the goal on the phone whose clock is late: it is the newer choice.
    behind.set('dailyGoalPages', 3);
    behind.sync(server);
    ahead.sync(server);
    expect(ahead.values.settings.dailyGoalPages).toBe(3);
    expect(behind.values.settings.dailyGoalPages).toBe(3);
  });

  it('a stamp far in the future moves the clock at most by the allowed lead', () => {
    const device = new Device('a', { now: 1_000 });
    device.receive([
      { kind: 'setting', key: 'dailyGoalPages', value: 9, at: 10 ** 12, device: 'z' },
    ]);
    expect(device.meta.clock).toBe(1_000 + SYNC_CONFIG.maxClockLeadMs);
  });
});

describe('recording local changes', () => {
  it('records nothing to send before the first sign-in, and returns the same metadata when nothing changed', () => {
    const device = new Device('a');
    const before = device.meta;
    device.read([1, 2], '2026-11-25');
    expect(device.meta.outbox).toEqual([]);
    expect(recordLocalChanges(device.meta, device.values, device.values, 2_000, RULES)).toBe(
      device.meta,
    );
    // Pages live in the journal itself: before an account there is nothing else to remember.
    expect(device.meta).toBe(before);
  });

  it('turns new pages, settings, bookmarks, pauses and time into events once signed in', () => {
    const device = new Device('a');
    device.signIn('u');
    device.read([1, 2], '2026-11-25');
    device.set('dailyGoalPages', 8);
    device.toggleBookmark(42);
    device.addPause({ from: day('2026-11-01'), to: day('2026-11-02') });
    device.addTime('2026-11-25', 60, 20);
    const kinds = device.meta.outbox.map((event) => event.kind);
    expect(kinds.filter((kind) => kind === 'page')).toHaveLength(2);
    expect(kinds).toEqual(expect.arrayContaining(['setting', 'bookmark', 'pause', 'time']));
  });

  it('keeps only the newest event of a setting and of a day of time in the outbox', () => {
    const device = new Device('a');
    device.signIn('u');
    device.set('dailyGoalPages', 8);
    device.set('dailyGoalPages', 9);
    device.addTime('2026-11-25', 60);
    device.addTime('2026-11-25', 60);
    const goals = device.meta.outbox.filter(
      (event) => event.kind === 'setting' && event.key === 'dailyGoalPages',
    );
    expect(goals).toEqual([expect.objectContaining({ value: 9 })]);
    const times = device.meta.outbox.filter((event) => event.kind === 'time');
    expect(times).toEqual([expect.objectContaining({ app: 120 })]);
  });

  it('counts time added on this phone in its own counter', () => {
    const device = new Device('a');
    device.addTime('2026-11-25', 60, 10);
    device.addTime('2026-11-25', 30);
    expect(device.meta.time.a?.[day('2026-11-25')]).toEqual({ app: 90, reader: 10 });
  });
});

describe('two phones, offline for days, then synced', () => {
  it('end with the same journal, time, settings, bookmarks and pauses, whatever the order', () => {
    const scenario = (order: 'a-first' | 'b-first') => {
      const server = newServer();
      const a = new Device('a');
      const b = new Device('b', { now: 1_500 });
      a.signIn('u');
      b.signIn('u');
      a.read(pages(1, 10), '2026-11-20');
      a.read(pages(11, 15), '2026-11-21');
      b.read(pages(8, 20), '2026-11-22');
      a.addTime('2026-11-21', 600, 500);
      b.addTime('2026-11-21', 300, 100);
      a.toggleBookmark(3);
      b.toggleBookmark(7);
      a.clock = 2_000;
      a.set('dailyGoalPages', 10);
      b.clock = 3_000;
      b.set('dailyGoalPages', 12);
      a.addPause({ from: day('2026-11-01'), to: day('2026-11-02') });
      const [first, second] = order === 'a-first' ? [a, b] : [b, a];
      first.sync(server);
      second.sync(server);
      first.sync(server);
      return { a, b };
    };
    const one = scenario('a-first');
    const two = scenario('b-first');
    expect(comparable(one.a.values)).toEqual(comparable(one.b.values));
    expect(comparable(one.a.values)).toEqual(comparable(two.a.values));
    const merged = one.a.values;
    // Pages 1..20, each once; 8..10 keep the earlier day of phone a.
    expect(merged.journal).toHaveLength(20);
    expect(merged.journal.find((entry) => entry.page === 8)?.date).toBe('2026-11-20');
    // The time of both phones is added up, the goal is the newer choice.
    expect(merged.timeSpent[day('2026-11-21')]).toEqual({ app: 900, reader: 600 });
    expect(merged.settings.dailyGoalPages).toBe(12);
    expect(merged.bookmarks).toEqual([3, 7]);
    expect(merged.pauses).toHaveLength(1);
  });

  it('receiving the same events twice, or in another order, changes nothing more', () => {
    const a = new Device('a');
    a.signIn('u');
    a.read(pages(1, 5), '2026-11-20');
    a.addTime('2026-11-20', 100);
    const events = a.meta.outbox;
    const b = new Device('b');
    expect(b.receive(events)).toBe(true);
    const once = comparable(b.values);
    expect(b.receive(events)).toBe(false);
    expect(b.receive([...events].reverse())).toBe(false);
    expect(comparable(b.values)).toEqual(once);
  });

  it('a khatma finished on one phone while the other still reads it stays one valid journal', () => {
    const server = newServer();
    const a = new Device('a');
    const b = new Device('b');
    a.signIn('u');
    b.signIn('u');
    a.read(pages(1, 300), '2026-11-01');
    a.sync(server);
    b.sync(server);
    a.read(pages(301, 604), '2026-11-10');
    a.read([1, 2, 3], '2026-11-11'); // khatma 2 begins
    b.read(pages(301, 320), '2026-11-12'); // b did not know
    a.sync(server);
    b.sync(server);
    a.sync(server);
    expect(comparable(a.values)).toEqual(comparable(b.values));
    expect(getCurrentKhatm(b.values.journal)).toBe(2);
    expect(b.values.journal.filter((entry) => entry.khatm === 2)).toHaveLength(3);
  });

  it('keeps every page when both phones finish different halves of a khatma offline', () => {
    const server = newServer();
    const a = new Device('a');
    const b = new Device('b');
    a.signIn('u');
    b.signIn('u');
    a.read(pages(1, 302), '2026-11-01');
    b.read(pages(303, 604), '2026-11-02');
    b.read([1], '2026-11-03'); // b thinks it is still in khatma 1: page 1 counts there
    a.sync(server);
    b.sync(server);
    a.sync(server);
    expect(comparable(a.values)).toEqual(comparable(b.values));
    expect(getCurrentKhatm(a.values.journal)).toBe(2);
  });

  it('drops entries of a khatma that cannot exist yet instead of breaking the journal', () => {
    const device = new Device('a');
    device.receive([
      { kind: 'page', khatm: 1, page: 1, date: day('2026-11-01') },
      { kind: 'page', khatm: 3, page: 1, date: day('2026-11-01') },
    ]);
    expect(device.values.journal).toEqual([{ khatm: 1, page: 1, date: '2026-11-01' }]);
    expect(() => getCurrentKhatm(device.values.journal)).not.toThrow();
  });
});

describe('settings', () => {
  it('keep the seed of the account drawn first, so the gardens keep their look', () => {
    const server = newServer();
    const old = new Device('old', {
      start: values({ settings: { ...values().settings, userSeed: 1 } }),
      now: 100,
    });
    old.signIn('u');
    old.sync(server);
    const fresh = new Device('new', {
      start: values({ settings: { ...values().settings, userSeed: 2 } }),
      now: 9_000,
    });
    fresh.signIn('u');
    fresh.sync(server);
    old.sync(server);
    expect(fresh.values.settings.userSeed).toBe(1);
    expect(old.values.settings.userSeed).toBe(1);
  });

  it('a finished introduction stays finished', () => {
    const device = new Device('a');
    device.set('onboardingCompleted', true);
    device.receive([
      { kind: 'setting', key: 'onboardingCompleted', value: false, at: 10 ** 9, device: 'z' },
    ]);
    expect(device.values.settings.onboardingCompleted).toBe(true);
  });

  it('settings never chosen on a new phone give way to the account’s', () => {
    const server = newServer();
    const a = new Device('a', { now: 100 });
    a.signIn('u');
    a.set('language', 'ar');
    a.sync(server);
    const fresh = new Device('b', { now: 99_000 });
    fresh.signIn('u');
    fresh.sync(server);
    expect(fresh.values.settings.language).toBe('ar');
  });

  it('ignores values the store would refuse and keys it does not know', () => {
    const device = new Device('a');
    const changed = device.receive([
      { kind: 'setting', key: 'dailyGoalPages', value: 999, at: 10 ** 6, device: 'z' },
      { kind: 'setting', key: 'somethingNew', value: 1, at: 10 ** 6, device: 'z' },
    ]);
    expect(changed).toBe(false);
    expect(device.values.settings.dailyGoalPages).toBe(5);
    expect(device.values.settings).not.toHaveProperty('somethingNew');
  });

  it('a bookmark removed after it was added on another phone is removed everywhere', () => {
    const server = newServer();
    const a = new Device('a');
    const b = new Device('b');
    a.signIn('u');
    b.signIn('u');
    a.toggleBookmark(9);
    a.sync(server);
    b.sync(server);
    expect(b.values.bookmarks).toEqual([9]);
    b.clock = 5_000;
    b.toggleBookmark(9);
    b.sync(server);
    a.sync(server);
    expect(a.values.bookmarks).toEqual([]);
  });

  it('keeps at most the allowed number of pauses, the same ones on every phone', () => {
    const device = new Device('a');
    const pauses = ['01', '02', '03', '04'].map((d) => ({
      kind: 'pause' as const,
      from: day(`2026-10-${d}`),
      to: day(`2026-10-${d}`),
    }));
    device.receive(pauses.slice().reverse());
    expect(device.values.pauses.map((pause) => pause.from)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });
});

describe('time spent', () => {
  it('keeps the highest counter of each phone and day, and adds the phones up', () => {
    const device = new Device('a');
    device.receive([
      { kind: 'time', device: 'b', date: day('2026-11-20'), app: 100, reader: 50 },
      { kind: 'time', device: 'b', date: day('2026-11-20'), app: 80, reader: 70 },
      { kind: 'time', device: 'c', date: day('2026-11-20'), app: 10, reader: 0 },
    ]);
    expect(device.values.timeSpent[day('2026-11-20')]).toEqual({ app: 110, reader: 70 });
  });

  it('never passes the most a day can hold, and keeps the most recent days only', () => {
    const device = new Device('a');
    device.receive([
      { kind: 'time', device: 'b', date: day('2026-11-20'), app: 80_000, reader: 0 },
      { kind: 'time', device: 'c', date: day('2026-11-20'), app: 80_000, reader: 0 },
      ...['14', '15', '16', '17', '18', '19'].map((d) => ({
        kind: 'time' as const,
        device: 'b',
        date: day(`2026-11-${d}`),
        app: 1,
        reader: 0,
      })),
    ]);
    expect(device.values.timeSpent[day('2026-11-20')]?.app).toBe(RULES.maxSecondsPerDay);
    expect(Object.keys(device.values.timeSpent)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
    expect(Object.keys(device.meta.time.b ?? {})).not.toContain('2026-11-14');
  });

  it('a phone restored from another phone’s backup notices its twin and takes a new name', () => {
    const device = new Device('a');
    device.addTime('2026-11-20', 10);
    device.receive([{ kind: 'time', device: 'a', date: day('2026-11-20'), app: 500, reader: 0 }]);
    expect(device.meta.deviceId).not.toBe('a');
    device.addTime('2026-11-20', 5);
    expect(device.meta.time[device.meta.deviceId]?.[day('2026-11-20')]).toEqual({
      app: 5,
      reader: 0,
    });
    expect(device.values.timeSpent[day('2026-11-20')]?.app).toBe(505);
  });
});

describe('reinstalling, and a new phone', () => {
  it('a phone with nothing gets everything back from the account', () => {
    const server = newServer();
    const old = new Device('old');
    old.signIn('u');
    old.read(pages(1, 40), '2026-11-20');
    old.addTime('2026-11-20', 900, 800);
    old.set('dailyGoalPages', 20);
    old.toggleBookmark(12);
    old.sync(server);
    const reinstalled = new Device('fresh', { now: 9_999 });
    reinstalled.signIn('u');
    reinstalled.sync(server);
    expect(comparable(reinstalled.values)).toEqual(comparable(old.values));
  });

  it('time brought back by a local copy is not counted twice once the account’s arrives', () => {
    const server = newServer();
    const old = new Device('old');
    old.signIn('u');
    old.addTime('2026-11-20', 900);
    old.sync(server);
    // Reinstalled, the iCloud copy brought the same 900 seconds back before the sign-in.
    const restored = new Device('fresh', {
      start: values({ timeSpent: { [day('2026-11-20')]: { app: 900, reader: 0 } } }),
    });
    restored.addTime('2026-11-20', 60);
    expect(restored.values.timeSpent[day('2026-11-20')]?.app).toBe(960);
    restored.signIn('u');
    restored.sync(server);
    expect(restored.values.timeSpent[day('2026-11-20')]?.app).toBe(960);
    old.sync(server);
    expect(old.values.timeSpent[day('2026-11-20')]?.app).toBe(960);
  });

  it('two phones restored from the same copy count its time once', () => {
    const server = newServer();
    const copy = values({ timeSpent: { [day('2026-11-20')]: { app: 600, reader: 0 } } });
    const a = new Device('a', { start: copy });
    const b = new Device('b', { start: copy });
    a.signIn('u');
    b.signIn('u');
    a.sync(server);
    b.sync(server);
    a.sync(server);
    expect(a.values.timeSpent[day('2026-11-20')]?.app).toBe(600);
    expect(b.values.timeSpent[day('2026-11-20')]?.app).toBe(600);
  });

  it('the first sign-in uploads what the phone already had, and merges it with the account', () => {
    const server = newServer();
    const old = new Device('old');
    old.signIn('u');
    old.read(pages(1, 5), '2026-11-01');
    old.sync(server);
    const local = new Device('local');
    local.read(pages(6, 9), '2026-11-02');
    local.toggleBookmark(6);
    local.signIn('u');
    expect(local.meta.outbox.filter((event) => event.kind === 'page')).toHaveLength(4);
    local.sync(server);
    old.sync(server);
    expect(old.values.journal).toHaveLength(9);
    expect(local.values.journal).toHaveLength(9);
    expect(old.values.bookmarks).toEqual([6]);
  });

  it('a new account gets the whole phone again; the same account changes nothing', () => {
    const device = new Device('a');
    device.read([1], '2026-11-01');
    device.signIn('u');
    device.push(newServer());
    expect(device.meta.outbox).toEqual([]);
    device.signIn('u');
    expect(device.meta.outbox).toEqual([]);
    device.signIn('v');
    expect(device.meta.cursor).toBe(0);
    expect(device.meta.outbox.length).toBeGreaterThan(0);
  });

  it('describes the whole state in events', () => {
    const device = new Device('a');
    device.read([1, 2], '2026-11-01');
    device.addTime('2026-11-01', 5);
    const kinds = fullStateEvents(device.meta, device.values).map((event) => event.kind);
    expect(kinds.filter((kind) => kind === 'page')).toHaveLength(2);
    expect(kinds).toContain('time');
    expect(kinds.filter((kind) => kind === 'setting')).toHaveLength(4);
  });
});

describe('the outbox', () => {
  it('forgets what was sent, and keeps what changed during the sending', () => {
    const device = new Device('a');
    device.signIn('u');
    device.addTime('2026-11-20', 10);
    const sending = device.meta.outbox;
    device.addTime('2026-11-20', 10);
    const meta = acknowledgePushed(device.meta, sending);
    expect(meta.outbox).toEqual([expect.objectContaining({ kind: 'time', app: 20 })]);
  });

  it('many offline days are many events, still one per page and per day', () => {
    const device = new Device('a');
    device.signIn('u');
    const start = device.meta.outbox.length;
    for (let d = 1; d <= 28; d += 1) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      device.read(pages(d * 10, d * 10 + 4), date);
      device.addTime(date, 60);
      device.addTime(date, 60);
    }
    expect(device.meta.outbox.length - start).toBe(28 * 5 + 28);
  });
});

describe('untrusted input', () => {
  it('reads back a valid event and refuses everything else', () => {
    const page = { kind: 'page', khatm: 1, page: 3, date: '2026-11-01' };
    expect(parseSyncEvent(page, RULES)).toEqual(page);
    for (const bad of [
      null,
      'x',
      { ...page, page: 605 },
      { ...page, khatm: 0 },
      { ...page, date: '2019-12-31' },
      { ...page, kind: 'other' },
      { kind: 'time', device: 'a', date: '2026-11-01', app: 10, reader: 11 },
      { kind: 'time', device: 'a b', date: '2026-11-01', app: 10, reader: 1 },
      { kind: 'setting', key: '__proto__', value: 1, at: 1, device: 'a' },
      { kind: 'setting', key: 'dailyGoalPages', value: 1, at: -1, device: 'a' },
      { kind: 'bookmark', page: 3, on: 'yes', at: 1, device: 'a' },
      { kind: 'pause', from: '2026-11-02', to: '2026-11-01' },
    ]) {
      expect(parseSyncEvent(bad, RULES)).toBeNull();
    }
  });

  it('reads back the metadata it wrote, and refuses damaged metadata', () => {
    const device = new Device('a');
    device.signIn('u');
    device.read([1], '2026-11-01');
    device.addTime('2026-11-01', 9);
    device.toggleBookmark(4);
    const text = JSON.parse(JSON.stringify(device.meta));
    expect(readSyncMeta(text, RULES)).toEqual(device.meta);
    expect(readSyncMeta({ ...text, deviceId: '' }, RULES)).toBeNull();
    expect(readSyncMeta({ ...text, cursor: -1 }, RULES)).toBeNull();
    expect(
      readSyncMeta({ ...text, time: { a: { '2026-11-01': { app: 1, reader: 2 } } } }, RULES),
    ).toBeNull();
    expect(readSyncMeta(JSON.parse('{"__proto__":1}'), RULES)).toBeNull();
    expect(readSyncMeta(null, RULES)).toBeNull();
  });

  it('drops a damaged event of the outbox rather than all the metadata', () => {
    const meta = createSyncMeta(values(), RULES, { deviceId: 'a', now: 1 });
    const text = JSON.parse(JSON.stringify({ ...meta, account: 'u' }));
    text.outbox = [{ kind: 'page', khatm: 1, page: 1, date: '2026-11-01' }, { kind: 'nope' }];
    expect(readSyncMeta(text, RULES)?.outbox).toHaveLength(1);
  });

  it('merging an event it would refuse changes nothing', () => {
    const meta = createSyncMeta(values(), RULES, { deviceId: 'a', now: 1 });
    const result = mergeRemoteEvents(
      meta,
      values(),
      [{ kind: 'page', khatm: 1, page: 999, date: day('2026-11-01') }],
      RULES,
      { now: 1, newDeviceId: () => 'b' },
    );
    expect(result.changed).toBe(false);
    expect(result.values.journal).toEqual([]);
  });
});

describe('retries', () => {
  it('wait longer after each failure, never more than the most, with some spread', () => {
    const delays = [1, 2, 3, 4, 20].map((failures) => nextRetryDelay(failures, () => 1));
    expect(delays[0]).toBe(SYNC_CONFIG.retryBaseMs);
    expect(delays[1]).toBe(SYNC_CONFIG.retryBaseMs * 2);
    expect(delays[4]).toBe(SYNC_CONFIG.retryMaxMs);
    expect(nextRetryDelay(1, () => 0)).toBe(SYNC_CONFIG.retryBaseMs / 2);
  });
});

describe('any order of changes and syncs', () => {
  /** A small repeatable random source (mulberry32). */
  const randomFrom = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('three phones end equal (seed %i)', (seed) => {
    const random = randomFrom(seed);
    const pick = (n: number) => Math.floor(random() * n);
    const server = newServer();
    const phones = ['a', 'b', 'c'].map(
      (name, index) => new Device(name, { now: 1_000 * (index + 1) }),
    );
    for (const phone of phones) phone.signIn('u');
    for (let step = 0; step < 120; step += 1) {
      const phone = phones[pick(3)] as Device;
      phone.clock += pick(5_000) - 1_000; // clocks wander, sometimes backwards
      const date = `2026-11-${String(10 + pick(8)).padStart(2, '0')}`;
      switch (pick(7)) {
        case 0:
          phone.read([1 + pick(604)], date);
          break;
        case 1:
          phone.set('dailyGoalPages', 1 + pick(60));
          break;
        case 2:
          phone.toggleBookmark(1 + pick(20));
          break;
        case 3:
          phone.addTime(date, pick(300), 0);
          break;
        case 4:
          phone.set('language', ['fr', 'en', 'ar', null][pick(4)] ?? null);
          break;
        case 5:
          phone.addPause({ from: day(date), to: day(date) });
          break;
        default:
          phone.sync(server);
      }
    }
    for (let round = 0; round < 2; round += 1) for (const phone of phones) phone.sync(server);
    const [first, ...others] = phones.map((phone) => comparable(phone.values));
    for (const other of others) expect(other).toEqual(first);
    expect(() => getCurrentKhatm(phones[0]!.values.journal)).not.toThrow();
  });
});
