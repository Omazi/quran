// Access rules and behaviour of the sync tables (docs/specs/sync.md, section 3), run for real on
// PostgreSQL 17 (embedded-postgres), with the social migration and then the sync migration, in
// the order Supabase applies them. Actors (harness.mjs): omar (owner of the rows), sarah (friend),
// mustapha (stranger), anon (signed-out visitor).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, U, MIGRATION, SYNC_MIGRATION, SYNC_DEVICE_MIGRATION } from './harness.mjs';

let db;
before(async () => {
  db = await startDb({ migrations: [MIGRATION, SYNC_MIGRATION, SYNC_DEVICE_MIGRATION] });
  process.stdout.write(`# PostgreSQL ${db.version}; migrations ${db.migration}\n`);
});
after(async () => {
  await db?.stop();
});

const t = (name, fn) => it(name, () => db.tx(fn));

const today = () => new Date().toISOString().slice(0, 10);
const page = (n, date = '2026-11-20', khatm = 1) => ({
  id: `p.${khatm}.${n}.${date}`,
  event: { kind: 'page', khatm, page: n, date },
});
const time = (device, date, app, reader = 0) => ({
  id: `t.${device}.${date}.${app}.${reader}`,
  event: { kind: 'time', device, date, app, reader },
});
const setting = (key, value, at, device = 'phone') => ({
  id: `s.${key}.${device}.${at}`,
  event: { kind: 'setting', key, value, at, device },
});

const push = async (who, events) =>
  (await who.one(`select public.sync_push($1::jsonb) as r`, [JSON.stringify(events)])).r;
const pull = async (who, after = 0, limit = 1000) =>
  (await who.one(`select public.sync_pull($1, $2) as r`, [after, limit])).r;

describe('structure', () => {
  t('both tables have row level security; anon has no privilege on them', async (w) => {
    for (const table of ['public.sync_accounts', 'public.sync_events']) {
      const [{ rls }] = await w.suRows(
        `select relrowsecurity as rls from pg_class where oid = $1::regclass`,
        [table],
      );
      assert.equal(rls, true, `${table}: RLS off`);
      for (const p of [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
      ]) {
        const [{ ok }] = await w.suRows(`select has_table_privilege('anon', $1, $2) as ok`, [
          table,
          p,
        ]);
        assert.equal(ok, false, `anon has ${p} on ${table}`);
      }
    }
  });

  t('signed-in people may only read sync_events, and nothing of sync_accounts', async (w) => {
    const priv = async (table, p) =>
      (await w.suRows(`select has_table_privilege('authenticated', $1, $2) as ok`, [table, p]))[0]
        .ok;
    assert.equal(await priv('public.sync_events', 'SELECT'), true);
    for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      assert.equal(
        await priv('public.sync_events', p),
        false,
        `authenticated has ${p} on sync_events`,
      );
    }
    for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal(
        await priv('public.sync_accounts', p),
        false,
        `authenticated has ${p} on sync_accounts`,
      );
    }
  });

  t(
    'the sync functions are security definer, with an empty search_path, for signed-in people only',
    async (w) => {
      const rows = await w.suRows(
        `select p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig, n.nspname
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.proname like 'sync\\_%'`,
      );
      assert.equal(rows.filter((r) => r.nspname === 'public').length, 2);
      for (const r of rows) {
        assert.ok(r.proconfig?.includes('search_path=""'), `${r.sig}: search_path ${r.proconfig}`);
        const [{ ok: anonCan }] = await w.suRows(
          `select has_function_privilege('anon', $1, 'EXECUTE') as ok`,
          [r.sig],
        );
        assert.equal(anonCan, false, `anon can run ${r.sig}`);
        const [{ ok: userCan }] = await w.suRows(
          `select has_function_privilege('authenticated', $1, 'EXECUTE') as ok`,
          [r.sig],
        );
        assert.equal(userCan, r.nspname === 'public', `authenticated and ${r.sig}`);
        if (r.nspname === 'public')
          assert.equal(r.prosecdef, true, `${r.sig} is not security definer`);
      }
    },
  );

  t('the social functions keep their grants after this migration', async (w) => {
    const [{ ok }] = await w.suRows(
      `select has_function_privilege('authenticated', 'public.list_friends()', 'EXECUTE') as ok`,
    );
    assert.equal(ok, true);
  });

  t('rows of a deleted account go with it', async (w) => {
    await push(w.omar, [page(1)]);
    await w.omar.q(`select public.delete_my_account()`);
    const [{ n }] = await w.suRows(
      `select count(*)::int as n from public.sync_events where user_id = $1`,
      [U.omar],
    );
    const [{ m }] = await w.suRows(
      `select count(*)::int as m from public.sync_accounts where user_id = $1`,
      [U.omar],
    );
    assert.deepEqual([n, m], [0, 0]);
  });
});

describe('sending and reading back', () => {
  t('events come back in order; sending them again keeps them once', async (w) => {
    const events = [page(1), page(2), setting('dailyGoalPages', 10, 5000)];
    const first = await push(w.omar, events);
    assert.equal(first.accepted, 3);
    assert.equal(first.rejected, 0);
    assert.equal(typeof first.server_now, 'number');
    const again = await push(w.omar, events);
    assert.equal(again.accepted, 0);
    const read = await pull(w.omar);
    assert.deepEqual(
      read.events,
      events.map((e) => e.event),
    );
    assert.equal(read.cursor, 3);
    assert.equal(read.has_more, false);
    assert.deepEqual((await pull(w.omar, 3)).events, []);
    assert.equal((await pull(w.omar, 3)).cursor, 3);
  });

  t('reads page by page', async (w) => {
    await push(
      w.omar,
      [1, 2, 3, 4, 5].map((n) => page(n)),
    );
    const one = await pull(w.omar, 0, 2);
    assert.equal(one.events.length, 2);
    assert.equal(one.has_more, true);
    const two = await pull(w.omar, one.cursor, 2);
    const three = await pull(w.omar, two.cursor, 2);
    assert.equal(three.events.length, 1);
    assert.equal(three.has_more, false);
    assert.deepEqual(
      [...one.events, ...two.events, ...three.events].map((e) => e.page),
      [1, 2, 3, 4, 5],
    );
  });

  t('nobody else reads or writes omar’s events', async (w) => {
    await push(w.omar, [page(1)]);
    for (const actor of ['sarah', 'mustapha']) {
      assert.deepEqual((await pull(w.as(actor))).events, []);
      assert.deepEqual(await w.as(actor).rows(`select * from public.sync_events`), []);
      await w.as(actor).denied(
        `insert into public.sync_events (user_id, id, seq, kind, merge_key, event)
         values ($1, 'x', 99, 'page', 'k', '{}')`,
        [U.omar],
      );
      await w.as(actor).denied(`delete from public.sync_events`);
    }
    const own = await w.omar.rows(`select id from public.sync_events`);
    assert.deepEqual(
      own.map((r) => r.id),
      ['p.1.1.2026-11-20'],
    );
    await w.omar.denied(`update public.sync_events set event = '{}'`);
    await w.omar.denied(`select * from public.sync_accounts`);
  });

  t('anon can neither send nor read', async (w) => {
    await w.anon.denied(`select public.sync_push('[]'::jsonb)`);
    await w.anon.denied(`select public.sync_pull(0, 10)`);
  });

  t('sequence numbers are per account', async (w) => {
    await push(w.omar, [page(1)]);
    await push(w.sarah, [page(1), page(2)]);
    assert.equal((await pull(w.omar)).cursor, 1);
    assert.equal((await pull(w.sarah)).cursor, 2);
  });
});

describe('what the server refuses', () => {
  t('malformed events are skipped and counted, never stored', async (w) => {
    const far = '2099-01-01';
    const bad = [
      { id: 'p.1.605', event: { kind: 'page', khatm: 1, page: 605, date: '2026-11-20' } },
      { id: 'p.0.1', event: { kind: 'page', khatm: 0, page: 1, date: '2026-11-20' } },
      { id: 'p.far', event: { kind: 'page', khatm: 1, page: 1, date: far } },
      { id: 'p.old', event: { kind: 'page', khatm: 1, page: 1, date: '2019-12-31' } },
      { id: 'p.bad', event: { kind: 'page', khatm: 1, page: 1, date: '2026-02-30' } },
      { id: 'p.text', event: { kind: 'page', khatm: '1', page: 1, date: '2026-11-20' } },
      { id: 'bad id!', event: page(1).event },
      { event: page(1).event },
      { id: 'x.1', event: { kind: 'unknown' } },
      { id: 't.r', event: { kind: 'time', device: 'a', date: '2026-11-20', app: 1, reader: 2 } },
      { id: 't.d', event: { kind: 'time', device: 'a b', date: '2026-11-20', app: 1, reader: 0 } },
      { id: 's.p', event: { kind: 'setting', key: '__proto__', value: 1, at: 1, device: 'a' } },
      { id: 's.n', event: { kind: 'setting', key: 'k', at: 1, device: 'a' } },
      {
        id: 's.big',
        event: { kind: 'setting', key: 'k', value: 'x'.repeat(1500), at: 1, device: 'a' },
      },
      { id: 'b.on', event: { kind: 'bookmark', page: 3, on: 'yes', at: 1, device: 'a' } },
      { id: 'pa.r', event: { kind: 'pause', from: '2026-11-02', to: '2026-11-01' } },
      'not an object',
    ];
    const r = await push(w.omar, bad);
    assert.equal(r.accepted, 0);
    assert.equal(r.rejected, bad.length);
    assert.deepEqual((await pull(w.omar)).events, []);
  });

  t('refuses device names that would pollute an object', async (w) => {
    const bad = ['__proto__', 'constructor', 'prototype'].map((device) =>
      time(device, '2026-11-20', 5),
    );
    const r = await push(w.omar, [...bad, time('phone-1_A', '2026-11-20', 5)]);
    assert.deepEqual([r.accepted, r.rejected], [1, 3]);
  });

  t('keeps only the known fields of an event', async (w) => {
    await push(w.omar, [
      { id: 'p.1.1.2026-11-20', event: { ...page(1).event, extra: 'x'.repeat(100) } },
    ]);
    assert.deepEqual((await pull(w.omar)).events, [page(1).event]);
  });

  t('a stamp from a clock far ahead is brought back to a day ahead of the server', async (w) => {
    await push(w.omar, [setting('dailyGoalPages', 3, 9_000_000_000_000_000)]);
    const [{ event }] = (await pull(w.omar)).events.map((e) => ({ event: e }));
    const [{ ms }] = await w.suRows(`select (extract(epoch from now()) * 1000)::bigint as ms`);
    assert.ok(Number(event.at) <= Number(ms) + 86_400_000);
    assert.ok(Number(event.at) > Number(ms));
  });

  t('accepts today and tomorrow, not later', async (w) => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const r = await push(w.omar, [page(1, today()), page(2, tomorrow), page(3, later)]);
    assert.deepEqual([r.accepted, r.rejected], [2, 1]);
  });

  t('more than 200 events in one request is refused', async (w) => {
    const many = Array.from({ length: 201 }, (_, i) =>
      page((i % 604) + 1, '2026-11-20', 1 + Math.floor(i / 604)),
    );
    await w.omar.raises(
      `select public.sync_push($1::jsonb)`,
      [JSON.stringify(many)],
      'sync_too_many_events',
    );
    await w.omar.raises(`select public.sync_push('{}'::jsonb)`, [], 'sync_too_many_events');
  });

  t('a cursor or a limit that makes no sense is refused', async (w) => {
    await w.omar.raises(`select public.sync_pull(-1, 10)`, [], 'sync_invalid_cursor');
    await w.omar.raises(`select public.sync_pull(0, 0)`, [], 'sync_invalid_limit');
    await w.omar.raises(`select public.sync_pull(null, 10)`, [], 'sync_invalid_cursor');
  });

  t(
    'at most 120 calls a minute per account, then sync_rate_limited; others are not slowed',
    async (w) => {
      for (let i = 0; i < 120; i += 1) await pull(w.omar);
      await w.omar.raises(`select public.sync_pull(0, 10)`, [], 'sync_rate_limited');
      await w.omar.raises(`select public.sync_push('[]'::jsonb)`, [], 'sync_rate_limited');
      await pull(w.sarah);
      // A minute later the window starts again.
      await w.su(
        `update public.sync_accounts set window_started_at = now() - interval '61 seconds' where user_id = $1`,
        [U.omar],
      );
      await pull(w.omar);
    },
  );

  t('an account cannot hold more than 100 000 events', async (w) => {
    await push(w.omar, [page(1)]);
    await w.su(`update public.sync_accounts set event_count = 100000 where user_id = $1`, [U.omar]);
    await w.omar.raises(
      `select public.sync_push($1::jsonb)`,
      [JSON.stringify([page(2)])],
      'sync_quota_exceeded',
    );
  });
});

describe('what the server keeps (compaction)', () => {
  const rowsOf = (w) =>
    w.suRows(`select id, event from public.sync_events where user_id = $1 order by seq`, [U.omar]);

  t('only the highest time counter of a phone and day is kept', async (w) => {
    await push(w.omar, [time('a', '2026-11-20', 60, 10)]);
    await push(w.omar, [time('a', '2026-11-20', 120, 30)]);
    await push(w.omar, [time('a', '2026-11-20', 90, 20)]); // older, arrives late
    await push(w.omar, [time('b', '2026-11-20', 5, 0)]); // another phone stays
    const rows = await rowsOf(w);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['t.a.2026-11-20.120.30', 't.b.2026-11-20.5.0'],
    );
    const [{ n }] = await w.suRows(
      `select event_count as n from public.sync_accounts where user_id = $1`,
      [U.omar],
    );
    assert.equal(n, 2);
  });

  t('two counters where neither is ahead in both are both kept', async (w) => {
    await push(w.omar, [time('a', '2026-11-20', 100, 0), time('a', '2026-11-20', 50, 40)]);
    assert.equal((await rowsOf(w)).length, 2);
  });

  t('only the newest choice of a setting settled by the newest is kept', async (w) => {
    await push(w.omar, [setting('dailyGoalPages', 5, 1000)]);
    await push(w.omar, [setting('dailyGoalPages', 9, 3000)]);
    await push(w.omar, [setting('dailyGoalPages', 7, 2000)]);
    const rows = await rowsOf(w);
    assert.deepEqual(
      rows.map((r) => r.event.value),
      [9],
    );
  });

  t('the seed and the introduction are kept whole: their rule is not the newest', async (w) => {
    await push(w.omar, [setting('userSeed', 1, 1000), setting('userSeed', 2, 3000)]);
    await push(w.omar, [
      setting('onboardingCompleted', true, 1000),
      setting('onboardingCompleted', false, 3000),
    ]);
    assert.equal((await rowsOf(w)).length, 4);
  });

  t('a page read again later is not stored; an earlier day replaces a later one', async (w) => {
    await push(w.omar, [page(1, '2026-11-20')]);
    await push(w.omar, [page(1, '2026-11-22')]);
    await push(w.omar, [page(1, '2026-11-18')]);
    await push(w.omar, [page(1, '2026-11-20', 2)]); // another khatma is another thing
    const rows = await rowsOf(w);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['p.1.1.2026-11-18', 'p.2.1.2026-11-20'],
    );
  });

  t('a phone that pulls after compaction still gets the winning state', async (w) => {
    await push(w.omar, [time('a', '2026-11-20', 60)]);
    const first = await pull(w.omar);
    await push(w.omar, [time('a', '2026-11-20', 120)]);
    const next = await pull(w.omar, first.cursor);
    assert.deepEqual(
      next.events.map((e) => e.app),
      [120],
    );
  });
});
