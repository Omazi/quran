// Access rules of the social tables, run for real on PostgreSQL 17 (embedded-postgres).
// Actors, for the rows of "omar" (see harness.mjs): omar (owner), sarah (accepted friend),
// mustapha (stranger), taghread (blocked by omar), anon (signed-out visitor).
// "refused" = SQLSTATE 42501 (privilege missing, or a row policy refuses the row).
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { startDb, U, ACTORS } from './harness.mjs';

const sharedNormalization = JSON.parse(
  readFileSync(new URL('./search-normalization.json', import.meta.url), 'utf8'),
);

let db;
before(async () => {
  db = await startDb();
  process.stdout.write(`# PostgreSQL ${db.version}; migration ${db.migration}\n`);
});
after(async () => {
  await db?.stop();
});

/** A test running in its own rolled-back transaction, on the seeded scenario. */
const t = (name, fn) => it(name, () => db.tx(fn));

const TODAY = `(now() at time zone 'utc')::date`;
const NEW_USER = '00000000-0000-4000-8000-0000000000f1';
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const addUser = async (w, n, name) => {
  await w.su(`insert into auth.users (id) values ($1)`, [idOf(n)]);
  await w.su(`insert into public.profiles (id, display_name) values ($1, $2)`, [idOf(n), name]);
};
const befriend = (w, a, b) =>
  w.su(
    `insert into public.friendships (requester_id, addressee_id, status, responded_on)
     values ($1, $2, 'accepted', private.today())`,
    [a, b],
  );
const count = async (w, sql, params) => Number((await w.suRows(sql, params))[0].n);

// ---------------------------------------------------------------------------
describe('structure', () => {
  t(
    'every table of the public schema has row level security, and the 13 tables exist',
    async (w) => {
      const rows = await w.suRows(
        `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
      );
      assert.deepEqual(
        rows.map((r) => r.relname),
        [
          'badges',
          'blocks',
          'daily_readings',
          'friendships',
          'garden_summaries',
          'group_members',
          'groups',
          'invite_attempts',
          'invites',
          'nudges',
          'profiles',
          'reading_backups',
          'search_attempts',
        ],
      );
      for (const r of rows) assert.equal(r.relrowsecurity, true, `${r.relname}: RLS off`);
    },
  );

  t('anon has no privilege at all on any table, column, or function', async (w) => {
    const tables = await w.suRows(
      `select c.oid::regclass::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    for (const { name } of tables) {
      for (const p of [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
      ]) {
        assert.equal(
          (await w.suRows(`select has_table_privilege('anon', $1, $2) as ok`, [name, p]))[0].ok,
          false,
          `anon has ${p} on ${name}`,
        );
      }
    }
    const colPriv = await w.suRows(
      `select count(*) as n from information_schema.column_privileges
       where grantee = 'anon' and table_schema = 'public'`,
    );
    assert.equal(Number(colPriv[0].n), 0);
    const fns = await w.suRows(
      `select p.oid::regprocedure::text as sig, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')`,
    );
    assert.ok(fns.length >= 20);
    for (const f of fns) {
      assert.equal(
        (await w.suRows(`select has_function_privilege('anon', $1, 'EXECUTE') as ok`, [f.sig]))[0]
          .ok,
        false,
        `anon can run ${f.sig}`,
      );
    }
  });

  t(
    'signed-in users cannot truncate, reference or add triggers; no policy targets anon or public',
    async (w) => {
      const rows = await w.suRows(
        `select c.oid::regclass::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
      );
      for (const { name } of rows) {
        for (const p of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
          assert.equal(
            (
              await w.suRows(`select has_table_privilege('authenticated', $1, $2) as ok`, [name, p])
            )[0].ok,
            false,
            `authenticated has ${p} on ${name}`,
          );
        }
      }
      const pol = await w.suRows(
        `select tablename, policyname, roles from pg_policies where schemaname = 'public'`,
      );
      assert.ok(pol.length > 20);
      for (const p of pol)
        assert.equal(String(p.roles), '{authenticated}', `${p.policyname}: ${p.roles}`);
    },
  );

  t(
    'every function offered by the API is security definer with an empty search_path, and only for signed-in users',
    async (w) => {
      const rows = await w.suRows(
        `select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
      );
      assert.equal(rows.length, 18);
      for (const r of rows) {
        assert.equal(r.prosecdef, true, `${r.proname} is not security definer`);
        assert.ok(
          r.proconfig?.includes('search_path=""'),
          `${r.proname}: search_path ${r.proconfig}`,
        );
      }
      const priv = await w.suRows(
        `select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and not has_function_privilege('authenticated', p.oid, 'EXECUTE')`,
      );
      assert.deepEqual(priv, []);
    },
  );

  t('every foreign key that points at a person cascades on deletion (rule 10)', async (w) => {
    const rows = await w.suRows(
      `select conrelid::regclass::text as t, confrelid::regclass::text as target, confdeltype
       from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`,
    );
    assert.equal(rows.length, 17);
    for (const r of rows)
      assert.equal(r.confdeltype, 'c', `${r.t} -> ${r.target} does not cascade`);
  });

  t('the garden summary holds no page number and no time', async (w) => {
    const cols = await w.suRows(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'garden_summaries' order by ordinal_position`,
    );
    assert.deepEqual(
      cols.map((c) => c.column_name),
      [
        'user_id',
        'level',
        'hizb_completed',
        'health',
        'last_watered_on',
        'streak_days',
        'badge_count',
        'words_read',
        'verses_read',
        'hasanat_estimate',
        'updated_on',
      ],
    );
    assert.equal(cols.filter((c) => /time/.test(c.data_type)).length, 0);
  });
});

// ---------------------------------------------------------------------------
describe('profiles', () => {
  t('owner reads and changes their own profile', async (w) => {
    const me = await w.omar.one(`select * from public.profiles`);
    assert.equal(me.id, U.omar);
    assert.equal(me.display_name, 'Omar');
    assert.equal(me.show_garden, true);
    assert.equal(me.show_level, true);
    const r = await w.omar.q(
      `update public.profiles set display_name = 'Omar B', show_garden = false, show_level = false where id = $1`,
      [U.omar],
    );
    assert.equal(r.rowCount, 1);
    const after = await w.omar.one(`select * from public.profiles`);
    assert.deepEqual(
      [after.display_name, after.show_garden, after.show_level],
      ['Omar B', false, false],
    );
  });

  t('owner cannot change their id or creation day', async (w) => {
    await w.omar.denied(`update public.profiles set created_on = '2020-01-01' where id = $1`, [
      U.omar,
    ]);
    await w.omar.denied(`update public.profiles set id = $2 where id = $1`, [U.omar, NEW_USER]);
  });

  t('rule 1: names that break the rule are refused, never corrected', async (w) => {
    const bad = [
      '',
      ' ',
      ' Omar',
      'Omar ',
      'a'.repeat(31),
      'Om\nar',
      'Om\rar',
      'Om\tar',
      'Om\u0000ar'.replace('\u0000', '\u0007'),
      'Om ar',
      ' Omar',
      'Omar　',
      'Om\u0085ar',
    ];
    for (const name of bad) {
      await w.omar.fails(
        `update public.profiles set display_name = $2 where id = $1`,
        [U.omar, name],
        '23514',
      );
    }
    for (const name of ['a'.repeat(30), 'Omar B.', 'عمر', 'Ömär 🌙', 'x']) {
      await w.omar.q(`update public.profiles set display_name = $2 where id = $1`, [U.omar, name]);
    }
  });

  t(
    'a new account creates its own profile, and only its own, with no forged creation day',
    async (w) => {
      await w.su(`insert into auth.users (id) values ($1)`, [NEW_USER]);
      await w
        .as(NEW_USER)
        .denied(
          `insert into public.profiles (id, display_name, created_on) values ($1, 'Eve', '2001-01-01')`,
          [NEW_USER],
        );
      await w
        .as(NEW_USER)
        .denied(`insert into public.profiles (id, display_name) values ($1, 'Eve')`, [U.sarah]);
      await w
        .as(NEW_USER)
        .q(`insert into public.profiles (id, display_name) values ($1, 'Eve')`, [NEW_USER]);
      const p = await w.as(NEW_USER).one(`select * from public.profiles`);
      assert.equal(p.show_garden, true);
      assert.equal(p.show_level, true);
    },
  );

  for (const actor of ['sarah', 'mustapha', 'taghread']) {
    t(`${actor} cannot read or change omar's profile directly`, async (w) => {
      const rows = await w.as(actor).rows(`select * from public.profiles where id = $1`, [U.omar]);
      assert.deepEqual(rows, []);
      const r = await w
        .as(actor)
        .q(`update public.profiles set display_name = 'Hacked' where id = $1`, [U.omar]);
      assert.equal(r.rowCount, 0);
      assert.equal(
        (await w.suRows(`select display_name from public.profiles where id = $1`, [U.omar]))[0]
          .display_name,
        'Omar',
      );
    });
  }

  t('anon cannot read, insert or update profiles', async (w) => {
    await w.anon.denied(`select * from public.profiles`);
    await w.anon.denied(`insert into public.profiles (id, display_name) values ($1, 'X')`, [
      NEW_USER,
    ]);
    await w.anon.denied(`update public.profiles set display_name = 'X'`);
  });

  t('rule 4: other people read a name only, and nothing when one blocks the other', async (w) => {
    const ids = [U.omar, U.sarah, U.mustapha, U.taghread];
    const mine = await w.omar.rows(`select * from public.get_public_profiles($1)`, [ids]);
    assert.deepEqual(mine.map((r) => r.display_name).sort(), ['Mustapha', 'Omar', 'Sarah']); // not Taghread (blocked)
    for (const actor of ['sarah', 'mustapha']) {
      const r = await w.as(actor).rows(`select * from public.get_public_profiles($1)`, [[U.omar]]);
      assert.deepEqual(r, [{ id: U.omar, display_name: 'Omar' }]); // no show_* flags, no creation day
    }
    assert.deepEqual(
      await w.taghread.rows(`select * from public.get_public_profiles($1)`, [[U.omar]]),
      [],
    );
    await w.anon.denied(`select * from public.get_public_profiles($1)`, [[U.omar]]);
    await w.omar.raises(
      `select * from public.get_public_profiles($1)`,
      [Array(201).fill(U.sarah)],
      'invalid_ids',
    );
  });

  t('functions refuse a signed-in person who has no profile yet', async (w) => {
    await w.su(`insert into auth.users (id) values ($1)`, [NEW_USER]);
    await w
      .as(NEW_USER)
      .raises(`select public.send_friend_request($1)`, [U.omar], 'profile_required');
    await w.as(NEW_USER).raises(`select * from public.list_friends()`, [], 'profile_required');
  });
});

// ---------------------------------------------------------------------------
describe('garden_summaries', () => {
  t('owner reads, publishes, updates and withdraws their own summary', async (w) => {
    assert.equal((await w.omar.one(`select * from public.garden_summaries`)).hizb_completed, 14);
    await w.omar.q(
      `update public.garden_summaries set hizb_completed = 15, health = 1 where user_id = $1`,
      [U.omar],
    );
    assert.equal(
      (await w.omar.one(`select hizb_completed from public.garden_summaries`)).hizb_completed,
      15,
    );
    await w.sarah.q(
      `insert into public.garden_summaries (user_id, level, hizb_completed, health, streak_days, badge_count)
       values ($1, 1, 0, 0.5, 0, 0)`,
      [U.sarah],
    );
    await w.omar.q(`delete from public.garden_summaries where user_id = $1`, [U.omar]);
    assert.equal((await w.omar.rows(`select * from public.garden_summaries`)).length, 0);
  });

  t(
    'bounds: level, hizb 0..60, health 0..1, streak, badge count, reading counters, days not in the future',
    async (w) => {
      const upd = (set) =>
        w.omar.fails(
          `update public.garden_summaries set ${set} where user_id = $1`,
          [U.omar],
          '23514',
        );
      for (const set of [
        'level = 0',
        'level = -3',
        'hizb_completed = -1',
        'hizb_completed = 61',
        'health = -0.01',
        'health = 1.01',
        `health = 'NaN'`,
        'streak_days = -1',
        'badge_count = -1',
        'words_read = -1',
        'verses_read = -1',
        'hasanat_estimate = -1',
        'words_read = 9007199254740992',
        'hasanat_estimate = 9007199254740992',
        `last_watered_on = ${TODAY} + 5`,
        `updated_on = ${TODAY} + 5`,
      ])
        await upd(set);
      for (const set of [
        'hizb_completed = 0',
        'hizb_completed = 60',
        'health = 0',
        'health = 1',
        'words_read = 0',
        'verses_read = 0',
        'hasanat_estimate = 0',
        'words_read = 9007199254740991',
        'hasanat_estimate = 9007199254740991',
        `last_watered_on = null`,
        `last_watered_on = ${TODAY} + 1`,
      ])
        await w.omar.q(`update public.garden_summaries set ${set} where user_id = $1`, [U.omar]);
    },
  );

  t("nobody publishes, changes or withdraws someone else's summary", async (w) => {
    for (const actor of ['sarah', 'mustapha', 'taghread']) {
      await w.as(actor).denied(
        `insert into public.garden_summaries (user_id, level, hizb_completed, health, streak_days, badge_count)
         values ($1, 1, 60, 1, 0, 0)`,
        [U.omar],
      );
      assert.equal(
        (
          await w
            .as(actor)
            .q(`update public.garden_summaries set hizb_completed = 60 where user_id = $1`, [
              U.omar,
            ])
        ).rowCount,
        0,
      );
      assert.equal(
        (await w.as(actor).q(`delete from public.garden_summaries where user_id = $1`, [U.omar]))
          .rowCount,
        0,
      );
    }
    assert.equal(
      (
        await w.suRows(`select hizb_completed from public.garden_summaries where user_id = $1`, [
          U.omar,
        ])
      )[0].hizb_completed,
      14,
    );
    await w.omar.denied(`update public.garden_summaries set user_id = $2 where user_id = $1`, [
      U.omar,
      U.sarah,
    ]);
  });

  t('a friend cannot read the table directly (they use list_friends)', async (w) => {
    for (const actor of ['sarah', 'mustapha', 'taghread'])
      assert.deepEqual(
        await w
          .as(actor)
          .rows(`select * from public.garden_summaries where user_id = $1`, [U.omar]),
        [],
      );
    await w.anon.denied(`select * from public.garden_summaries`);
    await w.anon.denied(
      `insert into public.garden_summaries (user_id, level, hizb_completed, health, streak_days, badge_count) values ($1,1,0,0,0,0)`,
      [U.omar],
    );
  });

  t('rule 4: an accepted friend sees the garden and the level when both are shown', async (w) => {
    const [row] = await w.sarah.rows(`select * from public.list_friends()`);
    assert.equal(row.friend_id, U.omar);
    assert.equal(row.display_name, 'Omar');
    assert.deepEqual(
      [
        row.garden_visible,
        row.level_visible,
        row.level,
        row.hizb_completed,
        row.health,
        row.streak_days,
        row.badge_count,
        String(row.words_read),
        String(row.verses_read),
        String(row.hasanat_estimate),
      ],
      [true, true, 2, 14, 0.8, 5, 1, '99367', '8000', '4272781'],
    );
    assert.deepEqual(
      Object.keys(row).filter((k) => /page|time|journal/.test(k)),
      [],
    );
    assert.equal(
      (await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar])).hizb_completed,
      14,
    );
  });

  t(
    'rule 4: show_garden = false hides the garden, show_level = false hides level and badges',
    async (w) => {
      await w.omar.q(`update public.profiles set show_garden = false where id = $1`, [U.omar]);
      let row = await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar]);
      assert.deepEqual(
        [
          row.garden_visible,
          row.level_visible,
          row.level,
          row.badge_count,
          row.hizb_completed,
          row.health,
          row.last_watered_on,
          row.streak_days,
          row.updated_on === null,
        ],
        [false, true, 2, 1, null, null, null, null, false],
      );
      // the reading counters follow show_level, not show_garden
      assert.deepEqual([row.words_read, row.verses_read, row.hasanat_estimate].map(String), [
        '99367',
        '8000',
        '4272781',
      ]);
      await w.omar.q(
        `update public.profiles set show_garden = true, show_level = false where id = $1`,
        [U.omar],
      );
      row = await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar]);
      assert.deepEqual(
        [row.level, row.badge_count, row.hizb_completed, row.streak_days],
        [null, null, 14, 5],
      );
      assert.deepEqual([row.words_read, row.verses_read, row.hasanat_estimate], [null, null, null]);
      await w.omar.q(`update public.profiles set show_garden = false where id = $1`, [U.omar]);
      row = await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar]);
      assert.deepEqual(
        [row.level, row.badge_count, row.hizb_completed, row.updated_on],
        [null, null, null, null],
      );
      assert.equal(row.display_name, 'Omar'); // the name always stays
    },
  );

  t('a stranger, a blocked person and a signed-out visitor see no garden', async (w) => {
    for (const actor of ['mustapha', 'taghread']) {
      assert.deepEqual(
        await w.as(actor).rows(`select * from public.get_friend_garden($1)`, [U.omar]),
        [],
      );
      assert.deepEqual(await w.as(actor).rows(`select * from public.list_friends()`), []);
    }
    await w.anon.denied(`select * from public.list_friends()`);
    await w.anon.denied(`select * from public.get_friend_garden($1)`, [U.omar]);
  });

  t('rule 3: once omar blocks a friend, that friend sees no garden', async (w) => {
    await w.omar.q(`select public.block_user($1)`, [U.sarah]);
    assert.deepEqual(
      await w.sarah.rows(`select * from public.get_friend_garden($1)`, [U.omar]),
      [],
    );
    assert.deepEqual(
      await w.omar.rows(`select * from public.get_friend_garden($1)`, [U.sarah]),
      [],
    );
  });

  t(
    'a blocked friendship row that survives (written by an administrator) still shows nothing',
    async (w) => {
      await w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
        U.omar,
        U.sarah,
      ]);
      assert.deepEqual(
        await w.sarah.rows(`select * from public.get_friend_garden($1)`, [U.omar]),
        [],
      );
      assert.deepEqual(await w.omar.rows(`select * from public.list_friends()`), []);
    },
  );
});

// ---------------------------------------------------------------------------
describe('friendships and rules 2 and 3', () => {
  t('the two people read their row; nobody else does', async (w) => {
    assert.equal((await w.omar.rows(`select * from public.friendships`)).length, 1);
    assert.equal((await w.sarah.rows(`select * from public.friendships`)).length, 1);
    for (const actor of ['mustapha', 'taghread'])
      assert.deepEqual(await w.as(actor).rows(`select * from public.friendships`), []);
    await w.anon.denied(`select * from public.friendships`);
  });

  t(
    'nobody writes a friendship directly: no forged accepted friendship, no self-accept, no delete',
    async (w) => {
      for (const actor of ['omar', 'sarah', 'mustapha', 'taghread', 'anon']) {
        const a = w.as(actor);
        await a.denied(
          `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'accepted', current_date)`,
          [U.mustapha, U.omar],
        );
        await a.denied(
          `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
          [U.mustapha, U.omar],
        );
        await a.denied(`update public.friendships set status = 'accepted'`);
        await a.denied(`delete from public.friendships`);
      }
      await w.su(
        `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
        [U.mustapha, U.sarah],
      );
      await w.sarah.denied(
        `update public.friendships set status = 'accepted' where requester_id = $1`,
        [U.mustapha],
      );
    },
  );

  t(
    'the table refuses a self friendship, a second row for the same pair (either direction), a bad status, a wrong answer day',
    async (w) => {
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status) values ($1, $1, 'pending')`,
            [U.omar],
          ),
        { code: '23514' },
      );
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'accepted', current_date)`,
            [U.sarah, U.omar],
          ),
        { code: '23505' },
      );
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'maybe')`,
            [U.mustapha, U.omar],
          ),
        { code: '23514' },
      );
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`,
            [U.mustapha, U.omar],
          ),
        { code: '23514' },
      ); // answered without a day
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'declined', null)`,
            [U.mustapha, U.omar],
          ),
        { code: '23514' },
      );
      await assert.rejects(
        () =>
          w.su(
            `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'pending', current_date)`,
            [U.mustapha, U.omar],
          ),
        { code: '23514' },
      ); // pending with an answer day
    },
  );

  t('send, cross-send accepts, accept; a second send of the same request is refused', async (w) => {
    assert.equal(
      (await w.mustapha.one(`select public.send_friend_request($1) as s`, [U.omar])).s,
      'pending',
    );
    await w.mustapha.raises(
      `select public.send_friend_request($1)`,
      [U.omar],
      'request_already_sent',
    );
    assert.equal(
      await count(w, `select count(*) n from public.friendships where status = 'pending'`),
      1,
    );
    assert.equal(
      (await w.omar.one(`select public.send_friend_request($1) as s`, [U.mustapha])).s,
      'accepted',
    );
    const row = await w.omar.one(`select * from public.friendships where requester_id = $1`, [
      U.mustapha,
    ]);
    assert.equal(row.status, 'accepted'); // one row, the first sender stays the requester
    assert.ok(row.responded_on);
    await w.omar.raises(`select public.send_friend_request($1)`, [U.mustapha], 'already_friends');
    await w.mustapha.raises(`select public.send_friend_request($1)`, [U.omar], 'already_friends');
  });

  t(
    'rule 2: cannot add oneself, nor nobody; nobody is added when the account does not exist',
    async (w) => {
      await w.omar.raises(
        `select public.send_friend_request($1)`,
        [U.omar],
        'cannot_befriend_yourself',
      );
      await w.omar.raises(`select public.send_friend_request(null)`, [], 'invalid_target');
      await w.omar.raises(
        `select public.send_friend_request($1)`,
        [NEW_USER],
        'person_unavailable',
      );
      await w.anon.denied(`select public.send_friend_request($1)`, [U.omar]);
    },
  );

  t('rule 2: only the addressee accepts or declines', async (w) => {
    await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
    await w.mustapha.raises(
      `select public.respond_friend_request($1, true)`,
      [U.omar],
      'not_the_addressee',
    ); // the sender
    await w.mustapha.raises(
      `select public.respond_friend_request($1, true)`,
      [U.mustapha],
      'no_pending_request',
    ); // oneself
    await w.sarah.raises(
      `select public.respond_friend_request($1, true)`,
      [U.mustapha],
      'no_pending_request',
    ); // a third person
    await w.taghread.raises(
      `select public.respond_friend_request($1, true)`,
      [U.mustapha],
      'no_pending_request',
    );
    await w.omar.raises(
      `select public.respond_friend_request($1, null)`,
      [U.mustapha],
      'invalid_answer',
    );
    await w.anon.denied(`select public.respond_friend_request($1, true)`, [U.mustapha]);
    assert.equal(
      (await w.omar.one(`select public.respond_friend_request($1, true) as s`, [U.mustapha])).s,
      'accepted',
    );
    await w.omar.raises(
      `select public.respond_friend_request($1, true)`,
      [U.mustapha],
      'no_pending_request',
    ); // already answered
  });

  t(
    'rule 2: a declined request can be sent again 7 days after the answer, not before',
    async (w) => {
      await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
      assert.equal(
        (await w.omar.one(`select public.respond_friend_request($1, false) as s`, [U.mustapha])).s,
        'declined',
      );
      await w.mustapha.raises(
        `select public.send_friend_request($1)`,
        [U.omar],
        'request_declined_recently',
      );
      await w.su(
        `update public.friendships set responded_on = private.today() - 6 where requester_id = $1`,
        [U.mustapha],
      );
      await w.mustapha.raises(
        `select public.send_friend_request($1)`,
        [U.omar],
        'request_declined_recently',
      );
      await w.su(
        `update public.friendships set responded_on = private.today() - 7 where requester_id = $1`,
        [U.mustapha],
      );
      assert.equal(
        (await w.mustapha.one(`select public.send_friend_request($1) as s`, [U.omar])).s,
        'pending',
      );
      const row = await w.omar.one(`select * from public.friendships where requester_id = $1`, [
        U.mustapha,
      ]);
      assert.deepEqual([row.status, row.responded_on], ['pending', null]);
      assert.equal(await count(w, `select count(*) n from public.friendships`), 2); // still one row for the pair
    },
  );

  t(
    'rule 2: the person who declined can still write first, with no wait; the row changes direction',
    async (w) => {
      await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
      await w.omar.q(`select public.respond_friend_request($1, false)`, [U.mustapha]);
      assert.equal(
        (await w.omar.one(`select public.send_friend_request($1) as s`, [U.mustapha])).s,
        'pending',
      );
      const row = await w.su(`select * from public.friendships where status = 'pending'`);
      assert.deepEqual([row.rows[0].requester_id, row.rows[0].addressee_id], [U.omar, U.mustapha]);
      assert.equal(
        (await w.mustapha.one(`select public.respond_friend_request($1, true) as s`, [U.omar])).s,
        'accepted',
      );
      assert.equal(await count(w, `select count(*) n from public.friendships`), 2);
    },
  );

  t(
    'rule 2: either friend removes an accepted friendship; nothing else can be removed this way',
    async (w) => {
      await w.mustapha.raises(`select public.remove_friendship($1)`, [U.omar], 'not_friends'); // a stranger
      await w.taghread.raises(`select public.remove_friendship($1)`, [U.omar], 'not_friends');
      await w.anon.denied(`select public.remove_friendship($1)`, [U.omar]);
      assert.equal(await count(w, `select count(*) n from public.friendships`), 1);
      await w.sarah.q(`select public.remove_friendship($1)`, [U.omar]);
      assert.equal(await count(w, `select count(*) n from public.friendships`), 0);
      await w.omar.q(`select public.send_friend_request($1)`, [U.mustapha]);
      await w.omar.raises(`select public.remove_friendship($1)`, [U.mustapha], 'not_friends'); // pending: not removable
      await w.mustapha.q(`select public.respond_friend_request($1, false)`, [U.omar]);
      await w.omar.raises(`select public.remove_friendship($1)`, [U.mustapha], 'not_friends'); // declined: holds the wait
      assert.equal(await count(w, `select count(*) n from public.friendships`), 1);
      await w.su(`update public.friendships set status = 'accepted'`);
      await w.omar.q(`select public.remove_friendship($1)`, [U.mustapha]);
      assert.equal(await count(w, `select count(*) n from public.friendships`), 0);
    },
  );

  t(
    'rule 3: blocking removes the friendship and the encouragements; the block is kept',
    async (w) => {
      await w.sarah.q(`select public.send_nudge($1, 'encourage')`, [U.omar]);
      await w.omar.q(`select public.send_nudge($1, 'congratulate')`, [U.sarah]);
      await w.omar.q(`select public.block_user($1)`, [U.sarah]);
      assert.equal(await count(w, `select count(*) n from public.friendships`), 0);
      assert.equal(await count(w, `select count(*) n from public.nudges`), 0);
      assert.equal(
        (await w.omar.rows(`select * from public.blocks where blocked_id = $1`, [U.sarah])).length,
        1,
      );
      await w.omar.raises(`select public.block_user($1)`, [U.sarah], 'already_blocked');
    },
  );

  t(
    'rule 3: blocking removes a pending request but keeps a declined one (the wait survives block + unblock)',
    async (w) => {
      await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
      await w.omar.q(`select public.block_user($1)`, [U.mustapha]);
      assert.equal(
        await count(w, `select count(*) n from public.friendships where requester_id = $1`, [
          U.mustapha,
        ]),
        0,
      );
      await w.omar.q(`select public.unblock_user($1)`, [U.mustapha]);
      await w.su(
        `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'declined', private.today())`,
        [U.mustapha, U.omar],
      );
      await w.omar.q(`select public.block_user($1)`, [U.mustapha]);
      assert.equal(
        await count(
          w,
          `select count(*) n from public.friendships where requester_id = $1 and status = 'declined'`,
          [U.mustapha],
        ),
        1,
      );
      await w.omar.q(`select public.unblock_user($1)`, [U.mustapha]);
      await w.mustapha.raises(
        `select public.send_friend_request($1)`,
        [U.omar],
        'request_declined_recently',
      );
    },
  );

  t(
    'rule 3: a blocked person is refused as if the account did not exist, and nothing is written',
    async (w) => {
      await w.taghread.raises(
        `select public.send_friend_request($1)`,
        [U.omar],
        'person_unavailable',
      );
      await w.omar.raises(
        `select public.send_friend_request($1)`,
        [NEW_USER],
        'person_unavailable',
      ); // same answer for an unknown account
      assert.equal(await count(w, `select count(*) n from public.friendships`), 1);
      await w.su(
        `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
        [U.sarah, U.taghread],
      );
      await w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
        U.sarah,
        U.taghread,
      ]);
      await w.taghread.raises(
        `select public.respond_friend_request($1, true)`,
        [U.sarah],
        'person_unavailable',
      ); // even for a leftover row
    },
  );

  t(
    'rule 3: the blocker must lift the block before writing to the person they blocked',
    async (w) => {
      await w.omar.raises(
        `select public.send_friend_request($1)`,
        [U.taghread],
        'you_blocked_them',
      );
      await w.omar.q(`select public.unblock_user($1)`, [U.taghread]);
      assert.equal(
        (await w.omar.one(`select public.send_friend_request($1) as s`, [U.taghread])).s,
        'pending',
      );
    },
  );

  t('block_user and unblock_user check their input', async (w) => {
    await w.omar.raises(`select public.block_user($1)`, [U.omar], 'cannot_block_yourself');
    await w.omar.raises(`select public.block_user($1)`, [NEW_USER], 'person_unavailable');
    await w.omar.raises(`select public.block_user(null)`, [], 'invalid_target');
    await w.omar.raises(`select public.unblock_user($1)`, [U.sarah], 'not_blocked');
    await w.taghread.raises(`select public.unblock_user($1)`, [U.omar], 'not_blocked'); // the blocked person has no block to lift
    await w.anon.denied(`select public.block_user($1)`, [U.omar]);
    await w.anon.denied(`select public.unblock_user($1)`, [U.omar]);
  });
});

// ---------------------------------------------------------------------------
describe('blocks', () => {
  t(
    'the blocker reads their blocks; the blocked person and everybody else see nothing',
    async (w) => {
      assert.equal((await w.omar.rows(`select * from public.blocks`)).length, 1);
      for (const actor of ['sarah', 'mustapha', 'taghread'])
        assert.deepEqual(await w.as(actor).rows(`select * from public.blocks`), []);
      await w.anon.denied(`select * from public.blocks`);
    },
  );

  t('nobody writes the table directly: no block made by hand, none lifted by hand', async (w) => {
    for (const actor of ['omar', 'sarah', 'mustapha', 'taghread', 'anon']) {
      await w
        .as(actor)
        .denied(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
          U[actor] ?? U.omar,
          U.mustapha,
        ]);
      await w.as(actor).denied(`delete from public.blocks`);
      await w.as(actor).denied(`update public.blocks set blocked_id = $1`, [U.sarah]);
    }
  });

  t(
    'only the blocker lifts a block (unblock_user), and then the other person can write again',
    async (w) => {
      await w.taghread.raises(`select public.unblock_user($1)`, [U.omar], 'not_blocked');
      await w.mustapha.raises(`select public.unblock_user($1)`, [U.omar], 'not_blocked');
      assert.equal(await count(w, `select count(*) n from public.blocks`), 1);
      await w.omar.q(`select public.unblock_user($1)`, [U.taghread]);
      assert.equal(await count(w, `select count(*) n from public.blocks`), 0);
      await w.taghread.q(`select public.send_friend_request($1)`, [U.omar]);
      assert.equal(
        await count(w, `select count(*) n from public.friendships where requester_id = $1`, [
          U.taghread,
        ]),
        1,
      );
    },
  );

  t('the table refuses a block on oneself, and a second block of the same direction', async (w) => {
    await assert.rejects(
      () => w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $1)`, [U.omar]),
      { code: '23514' },
    );
    await assert.rejects(
      () =>
        w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
          U.omar,
          U.taghread,
        ]),
      { code: '23505' },
    );
  });

  t('each of two people can block the other', async (w) => {
    await w.taghread.q(`select public.block_user($1)`, [U.omar]);
    assert.equal((await w.taghread.rows(`select * from public.blocks`)).length, 1);
    assert.equal((await w.omar.rows(`select * from public.blocks`)).length, 1); // omar still sees only his own
  });
});

// ---------------------------------------------------------------------------
describe('invites (rule 6)', () => {
  const makeCode = (actor) => actor.one(`select * from public.create_invite()`);
  const accept = async (actor, code) =>
    (await actor.one(`select public.accept_invite($1) as r`, [code])).r;

  t(
    'create_invite makes an 8-character code of the 31-character alphabet, created + 7 days; only the owner reads it',
    async (w) => {
      const inv = await makeCode(w.omar);
      assert.match(inv.code, /^[A-HJKMNP-Z2-9]{8}$/);
      const row = await w.omar.one(`select * from public.invites`);
      assert.equal(row.code, inv.code);
      assert.equal(row.owner_id, U.omar);
      assert.equal(
        await count(w, `select count(*) n from public.invites where expires_on = created_on + 7`),
        1,
      );
      for (const actor of ['sarah', 'mustapha', 'taghread'])
        assert.deepEqual(await w.as(actor).rows(`select * from public.invites`), []);
      await w.anon.denied(`select * from public.invites`);
      await w.anon.denied(`select * from public.create_invite()`);
    },
  );

  t(
    'drawn codes only use the alphabet (no 0 O 1 I L), differ, and every letter of the alphabet can come out',
    async (w) => {
      const seen = new Set();
      const letters = new Set();
      for (let round = 0; round < 40; round++) {
        for (let i = 0; i < 5; i++) {
          const { code } = await makeCode(w.omar);
          assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
          assert.equal(seen.has(code), false);
          seen.add(code);
          for (const c of code) letters.add(c);
        }
        await w.su(
          `update public.invites set created_on = created_on - 10, expires_on = private.today() - 3`,
        );
      }
      assert.equal(letters.size, 31); // 1600 characters drawn: all 31 appear
    },
  );

  t('codes are not chosen by the client, and at most 5 are alive at once', async (w) => {
    for (const actor of ['omar', 'sarah', 'anon'])
      await w
        .as(actor)
        .denied(
          `insert into public.invites (code, owner_id, expires_on) values ('AAAAAAAA', $1, current_date + 7)`,
          [U.omar],
        );
    for (let i = 0; i < 5; i++) await makeCode(w.omar);
    await w.omar.raises(`select * from public.create_invite()`, [], 'too_many_invites');
    await w.su(
      `update public.invites set created_on = created_on - 10, expires_on = private.today() - 3 where code = (select min(code) from public.invites)`,
    );
    await makeCode(w.omar); // an expired code does not count
  });

  t('the table refuses a malformed code and an expiry before creation', async (w) => {
    for (const code of [
      'abc',
      'AAAAAAA0',
      'AAAAAAAI',
      'AAAAAAAL',
      'AAAAAAAO',
      'AAAAAAA1',
      'AAAAAAAAA',
      'aaaaaaaa',
    ])
      await assert.rejects(
        () =>
          w.su(
            `insert into public.invites (code, owner_id, expires_on) values ($1, $2, current_date + 1)`,
            [code, U.omar],
          ),
        { code: '23514' },
      );
    await assert.rejects(
      () =>
        w.su(
          `insert into public.invites (code, owner_id, created_on, expires_on) values ('AAAAAAAA', $1, current_date, current_date - 1)`,
          [U.omar],
        ),
      { code: '23514' },
    );
  });

  t('another person cannot revoke the code or change it; the owner can revoke', async (w) => {
    const { code } = await makeCode(w.omar);
    assert.equal((await w.mustapha.q(`delete from public.invites`)).rowCount, 0);
    assert.equal(
      (await w.sarah.q(`delete from public.invites where code = $1`, [code])).rowCount,
      0,
    );
    await w.anon.denied(`delete from public.invites`);
    await w.omar.denied(`update public.invites set expires_on = current_date + 100`);
    assert.equal(
      (await w.omar.q(`delete from public.invites where code = $1`, [code])).rowCount,
      1,
    );
    assert.equal(await accept(w.mustapha, code), 'invite_not_found');
  });

  t(
    'a stranger accepts a code: accepted friendship at once; the same code serves several people, until its last day',
    async (w) => {
      const { code } = await makeCode(w.omar);
      assert.equal(await accept(w.mustapha, code), 'accepted');
      const f = await w.omar.one(`select * from public.friendships where requester_id = $1`, [
        U.mustapha,
      ]);
      assert.deepEqual([f.addressee_id, f.status], [U.omar, 'accepted']); // who typed the code is the requester
      assert.ok(f.responded_on);
      assert.equal(await accept(w.mustapha, code), 'already_friends');
      assert.equal(await count(w, `select count(*) n from public.friendships`), 2);
      await addUser(w, 40, 'Zaid');
      assert.equal(await accept(w.as(idOf(40)), code), 'accepted');
      await w.su(
        `update public.invites set expires_on = private.today(), created_on = private.today() - 7`,
      ); // last day: still valid
      await addUser(w, 42, 'Idris');
      assert.equal(await accept(w.as(idOf(42)), code), 'accepted');
      await w.su(
        `update public.invites set expires_on = private.today() - 1, created_on = private.today() - 8`,
      );
      await addUser(w, 43, 'Hamza');
      assert.equal(await accept(w.as(idOf(43)), code), 'invite_expired');
    },
  );

  t(
    'accepting a code replaces a pending or declined request by an accepted friendship',
    async (w) => {
      const { code } = await makeCode(w.omar);
      await w.omar.q(`select public.send_friend_request($1)`, [U.mustapha]); // pending, omar -> mustapha
      assert.equal(await accept(w.mustapha, code), 'accepted');
      const rows = await w.su(
        `select * from public.friendships where requester_id in ($1, $2) and addressee_id in ($1, $2)`,
        [U.omar, U.mustapha],
      );
      assert.deepEqual(
        rows.rows.map((r) => [r.requester_id, r.status]),
        [[U.mustapha, 'accepted']],
      );
      await w.su(`delete from public.friendships where requester_id = $1`, [U.mustapha]);
      await w.su(
        `insert into public.friendships (requester_id, addressee_id, status, responded_on) values ($1, $2, 'declined', private.today())`,
        [U.omar, U.mustapha],
      );
      assert.equal(await accept(w.mustapha, code), 'accepted');
      assert.equal(
        await count(w, `select count(*) n from public.friendships where status = 'accepted'`),
        2,
      );
    },
  );

  t('the reasons of a refusal: malformed (case matters), unknown, expired, own code', async (w) => {
    const { code } = await makeCode(w.omar);
    assert.equal(await accept(w.omar, code), 'invite_is_yours');
    for (const bad of [
      '',
      'abc',
      null,
      '12345678',
      'AAAA AAAA',
      code.toLowerCase(),
      'AAAAAAAL',
      ' ' + code,
    ])
      assert.equal(await accept(w.mustapha, bad), 'invite_code_malformed');
    assert.equal(await accept(w.mustapha, 'AAAAAAAA'), 'invite_not_found');
    await w.su(
      `update public.invites set created_on = created_on - 10, expires_on = private.today() - 1 where code = $1`,
      [code],
    );
    assert.equal(await accept(w.mustapha, code), 'invite_expired');
    assert.equal(
      await count(w, `select count(*) n from public.friendships where requester_id = $1`, [
        U.mustapha,
      ]),
      0,
    );
  });

  t(
    'rule 3: a blocked person gets "not found" for the code of the person who blocked them; the blocker is told',
    async (w) => {
      const { code } = await makeCode(w.omar);
      assert.equal(await accept(w.taghread, code), 'invite_not_found');
      assert.equal(
        await count(w, `select count(*) n from public.friendships where requester_id = $1`, [
          U.taghread,
        ]),
        0,
      );
      await w.su(
        `insert into public.invites (code, owner_id, expires_on) values ('BBBBBBBB', $1, current_date + 3)`,
        [U.taghread],
      );
      assert.equal(await accept(w.omar, 'BBBBBBBB'), 'you_blocked_them');
      assert.equal(
        await count(w, `select count(*) n from public.friendships where addressee_id = $1`, [
          U.taghread,
        ]),
        0,
      );
    },
  );

  t(
    'guessing is slowed: after 10 failures in an hour even a right code is refused; others are not affected',
    async (w) => {
      const { code } = await makeCode(w.omar);
      for (let i = 0; i < 10; i++)
        assert.equal(await accept(w.mustapha, 'AAAAAAAA'), 'invite_not_found');
      assert.equal(await accept(w.mustapha, code), 'too_many_attempts');
      assert.equal(
        await count(w, `select count(*) n from public.friendships where requester_id = $1`, [
          U.mustapha,
        ]),
        0,
      );
      await addUser(w, 41, 'Yusuf');
      assert.equal(await accept(w.as(idOf(41)), code), 'accepted');
      await w.su(`update public.invite_attempts set attempted_at = now() - interval '2 hours'`);
      assert.equal(await accept(w.mustapha, code), 'accepted'); // the hour passed
    },
  );

  t('the attempts table cannot be read or written by anyone', async (w) => {
    await w.mustapha.q(`select public.accept_invite('AAAAAAAA')`);
    assert.equal(await count(w, `select count(*) n from public.invite_attempts`), 1);
    for (const actor of ACTORS) {
      await w.as(actor).denied(`select * from public.invite_attempts`);
      await w.as(actor).denied(`delete from public.invite_attempts`);
      await w
        .as(actor)
        .denied(`insert into public.invite_attempts (user_id) values ($1)`, [U.omar]);
    }
    await w.anon.denied(`select public.accept_invite('AAAAAAAA')`);
  });
});

// ---------------------------------------------------------------------------
describe('nudges (rule 7)', () => {
  t('a friend encourages once a day; both people read it; nobody else does', async (w) => {
    await w.sarah.q(`select public.send_nudge($1, 'encourage')`, [U.omar]);
    const got = await w.omar.rows(`select * from public.nudges`);
    assert.deepEqual([got.length, got[0].from_id, got[0].kind], [1, U.sarah, 'encourage']);
    assert.equal((await w.sarah.rows(`select * from public.nudges`)).length, 1);
    for (const actor of ['mustapha', 'taghread'])
      assert.deepEqual(await w.as(actor).rows(`select * from public.nudges`), []);
    await w.anon.denied(`select * from public.nudges`);
    await w.sarah.raises(
      `select public.send_nudge($1, 'encourage')`,
      [U.omar],
      'already_nudged_today',
    );
    await w.sarah.raises(
      `select public.send_nudge($1, 'congratulate')`,
      [U.omar],
      'already_nudged_today',
    ); // one per friend per day, any kind
    await w.omar.q(`select public.send_nudge($1, 'congratulate')`, [U.sarah]); // the other direction is another nudge
  });

  t(
    "the sender's day is accepted within one day of the server day, and a new day allows a new nudge",
    async (w) => {
      await w.sarah.q(`select public.send_nudge($1, 'encourage')`, [U.omar]);
      await w.sarah.q(`select public.send_nudge($1, 'encourage', ${TODAY} + 1)`, [U.omar]);
      await w.sarah.q(`select public.send_nudge($1, 'encourage', ${TODAY} - 1)`, [U.omar]);
      await w.sarah.raises(
        `select public.send_nudge($1, 'encourage', ${TODAY} + 2)`,
        [U.omar],
        'day_out_of_range',
      );
      await w.sarah.raises(
        `select public.send_nudge($1, 'encourage', ${TODAY} - 2)`,
        [U.omar],
        'day_out_of_range',
      );
    },
  );

  t(
    'only toward an accepted friend: not a stranger, not oneself, not a pending request; a block says the rule-3 words',
    async (w) => {
      await w.mustapha.raises(`select public.send_nudge($1, 'encourage')`, [U.omar], 'not_friends');
      await w.omar.raises(`select public.send_nudge($1, 'encourage')`, [U.omar], 'not_friends');
      await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
      await w.mustapha.raises(`select public.send_nudge($1, 'encourage')`, [U.omar], 'not_friends'); // pending is not a friend yet
      await w.taghread.raises(
        `select public.send_nudge($1, 'encourage')`,
        [U.omar],
        'person_unavailable',
      );
      await w.omar.raises(
        `select public.send_nudge($1, 'encourage')`,
        [U.taghread],
        'you_blocked_them',
      );
      await w.sarah.raises(
        `select public.send_nudge($1, 'encourage')`,
        [NEW_USER],
        'person_unavailable',
      );
      await w.anon.denied(`select public.send_nudge($1, 'encourage')`, [U.omar]);
      assert.equal(await count(w, `select count(*) n from public.nudges`), 0);
    },
  );

  t('kinds are encourage and congratulate only', async (w) => {
    await w.sarah.raises(`select public.send_nudge($1, 'poke')`, [U.omar], 'invalid_kind');
    await w.sarah.raises(`select public.send_nudge($1, null)`, [U.omar], 'invalid_kind');
  });

  t(
    'nobody writes the table directly (no nudge to a stranger, none forged as another sender)',
    async (w) => {
      for (const actor of ['omar', 'sarah', 'mustapha', 'taghread', 'anon']) {
        await w
          .as(actor)
          .denied(
            `insert into public.nudges (from_id, to_id, kind, sent_on) values ($1, $2, 'encourage', current_date)`,
            [U.sarah, U.omar],
          );
        await w.as(actor).denied(`update public.nudges set kind = 'encourage'`);
        await w.as(actor).denied(`delete from public.nudges`);
      }
    },
  );
});

// ---------------------------------------------------------------------------
describe('groups and group_members (rule 8)', () => {
  const newGroup = async (w, actor, name = 'Famille') =>
    (await w.as(actor).one(`select public.create_group($1) as id`, [name])).id;

  t('the creator owns the group; names follow rule 1 with the reasons of the app', async (w) => {
    const g = await newGroup(w, 'omar');
    const group = await w.omar.one(`select * from public.groups where id = $1`, [g]);
    assert.deepEqual([group.name, group.owner_id], ['Famille', U.omar]);
    const members = await w.omar.rows(`select * from public.group_members where group_id = $1`, [
      g,
    ]);
    assert.deepEqual(
      members.map((m) => [m.user_id, m.role]),
      [[U.omar, 'owner']],
    );
    const reasons = {
      '': 'name_empty',
      '   ': 'name_empty',
      ' x': 'name_has_edge_spaces',
      'x　': 'name_has_edge_spaces',
      ['a'.repeat(31)]: 'name_too_long',
      'a\nb': 'name_forbidden_character',
      'a‮b': 'name_forbidden_character',
    };
    for (const [bad, reason] of Object.entries(reasons))
      await w.omar.raises(`select public.create_group($1)`, [bad], reason);
    await w.omar.raises(`select public.create_group(null)`, [], 'name_empty');
    await w.anon.denied(`select public.create_group('X')`);
  });

  t(
    'nobody creates a group, a membership or a role directly (no joining by oneself)',
    async (w) => {
      const g = await newGroup(w, 'omar');
      for (const actor of ['omar', 'sarah', 'mustapha', 'taghread', 'anon']) {
        await w
          .as(actor)
          .denied(`insert into public.groups (name, owner_id) values ('Mine', $1)`, [
            U[actor] ?? U.omar,
          ]);
        await w
          .as(actor)
          .denied(
            `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'member')`,
            [g, U[actor] ?? U.mustapha],
          );
        await w.as(actor).denied(`update public.group_members set role = 'owner'`);
        await w.as(actor).denied(`delete from public.group_members`);
        await w.as(actor).denied(`delete from public.groups`);
      }
    },
  );

  t(
    'only members see a group and its membership: a stranger, a blocked person and anon see nothing',
    async (w) => {
      const g = await newGroup(w, 'omar');
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      const other = await newGroup(w, 'mustapha', 'Voisins'); // someone else's group
      assert.equal((await w.sarah.rows(`select * from public.groups`)).length, 1);
      assert.equal((await w.sarah.rows(`select * from public.group_members`)).length, 2);
      assert.deepEqual(
        (await w.mustapha.rows(`select id from public.groups`)).map((r) => r.id),
        [other],
      );
      assert.deepEqual(
        (await w.mustapha.rows(`select group_id from public.group_members`)).map((r) => r.group_id),
        [other],
      );
      assert.deepEqual(
        await w.mustapha.rows(`select * from public.group_members where group_id = $1`, [g]),
        [],
      );
      assert.deepEqual(await w.taghread.rows(`select * from public.groups`), []);
      assert.deepEqual(await w.taghread.rows(`select * from public.group_members`), []);
      await w.anon.denied(`select * from public.groups`);
      await w.anon.denied(`select * from public.group_members`);
      await w.mustapha.raises(
        `select * from public.list_group_members($1)`,
        [g],
        'group_not_found',
      );
      await w.anon.denied(`select * from public.list_group_members($1)`, [g]);
      const names = await w.sarah.rows(`select * from public.list_group_members($1)`, [g]);
      assert.deepEqual(
        names.map((m) => [m.display_name, m.role]),
        [
          ['Omar', 'owner'],
          ['Sarah', 'member'],
        ],
      );
    },
  );

  t(
    'only the owner renames; a name follows rule 1; the owner cannot be changed by hand',
    async (w) => {
      const g = await newGroup(w, 'omar');
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      assert.equal(
        (await w.omar.q(`update public.groups set name = 'Nouveau' where id = $1`, [g])).rowCount,
        1,
      );
      assert.equal(
        (await w.sarah.q(`update public.groups set name = 'Piraté' where id = $1`, [g])).rowCount,
        0,
      );
      assert.equal(
        (await w.mustapha.q(`update public.groups set name = 'Piraté' where id = $1`, [g]))
          .rowCount,
        0,
      );
      await w.anon.denied(`update public.groups set name = 'x'`);
      assert.equal(
        (await w.omar.one(`select name from public.groups where id = $1`, [g])).name,
        'Nouveau',
      );
      await w.omar.fails(`update public.groups set name = ' x' where id = $1`, [g], '23514');
      await w.omar.denied(`update public.groups set owner_id = $2 where id = $1`, [g, U.sarah]);
    },
  );

  t('add_group_member: a member adds one of their own friends, nobody else', async (w) => {
    const g = await newGroup(w, 'omar');
    await w.omar.raises(`select public.add_group_member($1, $2)`, [g, U.mustapha], 'not_friends'); // stranger
    await w.omar.raises(
      `select public.add_group_member($1, $2)`,
      [g, U.taghread],
      'you_blocked_them',
    );
    await w.taghread.raises(
      `select public.add_group_member($1, $2)`,
      [g, U.omar],
      'group_not_found',
    ); // not a member
    await w.mustapha.raises(
      `select public.add_group_member($1, $2)`,
      [g, U.sarah],
      'group_not_found',
    );
    await w.anon.denied(`select public.add_group_member($1, $2)`, [g, U.sarah]);
    await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
    await w.omar.raises(`select public.add_group_member($1, $2)`, [g, U.sarah], 'already_a_member');
    await w.sarah.raises(`select public.add_group_member($1, $2)`, [g, U.mustapha], 'not_friends'); // sarah's friends only
    await befriend(w, U.sarah, U.mustapha);
    await w.sarah.q(`select public.add_group_member($1, $2)`, [g, U.mustapha]); // any member may invite their friend
    assert.equal(
      (await w.omar.rows(`select * from public.group_members where group_id = $1`, [g])).length,
      3,
    );
    await w.omar.raises(`select public.add_group_member($1, null)`, [g], 'invalid_target');
    await w.omar.raises(`select public.add_group_member(null, $1)`, [U.sarah], 'group_not_found');
    await w.omar.raises(
      `select public.add_group_member($1, $2)`,
      [g, NEW_USER],
      'person_unavailable',
    );
  });

  t('rule 3: a person who blocked or was blocked by the friend cannot add them', async (w) => {
    const g = await newGroup(w, 'omar');
    await w.sarah.q(`select public.block_user($1)`, [U.omar]);
    await w.omar.raises(
      `select public.add_group_member($1, $2)`,
      [g, U.sarah],
      'person_unavailable',
    );
  });

  t('at most 50 members', async (w) => {
    const g = await newGroup(w, 'omar');
    await w.su(
      `with u as (select gen_random_uuid() as id from generate_series(1, 48)),
            a as (insert into auth.users (id) select id from u),
            p as (insert into public.profiles (id, display_name) select id, 'M' || left(id::text, 8) from u)
       insert into public.group_members (group_id, user_id, role) select $1, id, 'member' from u`,
      [g],
    );
    assert.equal(
      await count(w, `select count(*) n from public.group_members where group_id = $1`, [g]),
      49,
    );
    await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]); // the 50th
    await befriend(w, U.omar, U.mustapha);
    await w.omar.raises(`select public.add_group_member($1, $2)`, [g, U.mustapha], 'group_full');
  });

  t(
    'leaving: a member leaves; the owner of a group with others hands it over; an owner alone closes it',
    async (w) => {
      const g = await newGroup(w, 'omar');
      await befriend(w, U.omar, U.mustapha);
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.mustapha]);
      await w.omar.raises(`select public.leave_group($1)`, [g], 'owner_must_hand_over');
      await w.omar.raises(
        `select public.leave_group($1, $2)`,
        [g, U.omar],
        'successor_not_a_member',
      );
      await w.omar.raises(
        `select public.leave_group($1, $2)`,
        [g, U.taghread],
        'successor_not_a_member',
      ); // not a member
      await w.taghread.raises(`select public.leave_group($1)`, [g], 'group_not_found');
      await w.anon.denied(`select public.leave_group($1)`, [g]);
      await w.mustapha.raises(
        `select public.leave_group($1, $2)`,
        [g, U.sarah],
        'invalid_successor',
      ); // only the owner hands over
      await w.mustapha.q(`select public.leave_group($1)`, [g]);
      assert.equal(
        await count(w, `select count(*) n from public.group_members where group_id = $1`, [g]),
        2,
      );
      await w.omar.q(`select public.leave_group($1, $2)`, [g, U.sarah]);
      const rows = await w.sarah.rows(
        `select user_id, role from public.group_members where group_id = $1`,
        [g],
      );
      assert.deepEqual(rows, [{ user_id: U.sarah, role: 'owner' }]);
      assert.equal(
        (await w.sarah.one(`select owner_id from public.groups where id = $1`, [g])).owner_id,
        U.sarah,
      );
      assert.deepEqual(await w.omar.rows(`select * from public.groups`), []);
      await w.sarah.raises(
        `select public.leave_group($1, $2)`,
        [g, U.omar],
        'successor_not_a_member',
      ); // alone
      await w.sarah.q(`select public.leave_group($1)`, [g]); // alone: the group closes
      assert.equal(await count(w, `select count(*) n from public.groups`), 0);
    },
  );

  t(
    'owner consistency: two owners, an owner who is not groups.owner_id, a group without members',
    async (w) => {
      await w.su(`set constraints all deferred`);
      const g = (
        await w.su(`insert into public.groups (name, owner_id) values ('G', $1) returning id`, [
          U.omar,
        ])
      ).rows[0].id;
      await w.su(
        `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'owner')`,
        [g, U.sarah],
      );
      await assert.rejects(() => w.su(`set constraints all immediate`), { code: '23514' }); // sarah owns the seat, groups says omar
      await w.su(`delete from public.groups where id = $1`, [g]);
      const g2 = (
        await w.su(`insert into public.groups (name, owner_id) values ('G2', $1) returning id`, [
          U.omar,
        ])
      ).rows[0].id;
      await w.su(
        `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'owner')`,
        [g2, U.omar],
      );
      await assert.rejects(
        () =>
          w.su(
            `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'owner')`,
            [g2, U.sarah],
          ),
        { code: '23505' },
      ); // one owner seat per group
      await w.su(
        `insert into public.group_members (group_id, user_id, role) values ($1, $2, 'member')`,
        [g2, U.sarah],
      );
      await w.su(`delete from public.group_members where group_id = $1 and role = 'owner'`, [g2]);
      await assert.rejects(() => w.su(`set constraints all immediate`), { code: '23514' }); // the owner seat is gone
      await w.su(`delete from public.groups where id = $1`, [g2]);
    },
  );

  t(
    'rule 9: the leaderboard sums new pages for the period, ties share a rank, silent members show 0',
    async (w) => {
      const g = await newGroup(w, 'omar');
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      await befriend(w, U.omar, U.mustapha);
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.mustapha]);
      await w.su(`delete from public.daily_readings`);
      await w.su(
        `insert into public.daily_readings (user_id, day, new_pages) values
         ($1, private.today(), 10), ($1, private.today() - 1, 5),
         ($2, private.today(), 15), ($2, private.today() - 40, 600)`,
        [U.omar, U.sarah],
      );
      const board = await w.omar.rows(
        `select * from public.group_leaderboard($1, ${TODAY} - 6, ${TODAY})`,
        [g],
      );
      assert.deepEqual(
        board.map((r) => [r.display_name, Number(r.total_pages), Number(r.rank)]),
        [
          ['Omar', 15, 1],
          ['Sarah', 15, 1],
          ['Mustapha', 0, 3],
        ], // equal sums: by identifier
      );
      const month = await w.sarah.rows(
        `select * from public.group_leaderboard($1, ${TODAY} - 59, ${TODAY})`,
        [g],
      );
      assert.deepEqual(
        month.map((r) => [r.display_name, Number(r.total_pages), Number(r.rank)]),
        [
          ['Sarah', 615, 1],
          ['Omar', 15, 2],
          ['Mustapha', 0, 3],
        ],
      );
      await w.taghread.raises(
        `select * from public.group_leaderboard($1, ${TODAY}, ${TODAY})`,
        [g],
        'group_not_found',
      );
      await w.anon.denied(`select * from public.group_leaderboard($1, ${TODAY}, ${TODAY})`, [g]);
      await w.omar.raises(
        `select * from public.group_leaderboard($1, ${TODAY}, ${TODAY} - 1)`,
        [g],
        'invalid_period',
      );
      await w.omar.raises(
        `select * from public.group_leaderboard($1, ${TODAY} - 400, ${TODAY})`,
        [g],
        'invalid_period',
      );
      await w.omar.raises(
        `select * from public.group_leaderboard($1, null, ${TODAY})`,
        [g],
        'invalid_period',
      );
    },
  );
});

// ---------------------------------------------------------------------------
describe('daily_readings (rule 9)', () => {
  t('owner writes, changes and deletes their own days', async (w) => {
    await w.omar.q(
      `insert into public.daily_readings (user_id, day, new_pages) values ($1, ${TODAY} - 1, 604)`,
      [U.omar],
    );
    await w.omar.q(
      `update public.daily_readings set new_pages = 0 where user_id = $1 and day = ${TODAY} - 1`,
      [U.omar],
    );
    assert.equal((await w.omar.rows(`select * from public.daily_readings`)).length, 2);
    assert.equal(
      (await w.omar.q(`delete from public.daily_readings where day = ${TODAY} - 1`)).rowCount,
      1,
    );
    await w.omar.q(
      `insert into public.daily_readings (user_id, day, new_pages) values ($1, ${TODAY} + 1, 0)`,
      [U.omar],
    );
    await w.omar.q(
      `insert into public.daily_readings (user_id, day, new_pages) values ($1, '2020-01-01', 3)`,
      [U.omar],
    );
  });

  t(
    'bounds: 0..604 pages; no day in the future (beyond one day), none before 2020; one row per day',
    async (w) => {
      for (const n of [-1, 605, 100000])
        await w.omar.fails(
          `update public.daily_readings set new_pages = $1 where user_id = $2`,
          [n, U.omar],
          '23514',
        );
      await w.omar.fails(
        `insert into public.daily_readings (user_id, day, new_pages) values ($1, ${TODAY} + 2, 1)`,
        [U.omar],
        '23514',
      );
      await w.omar.fails(
        `insert into public.daily_readings (user_id, day, new_pages) values ($1, '2019-12-31', 1)`,
        [U.omar],
        '23514',
      );
      await w.omar.fails(
        `insert into public.daily_readings (user_id, day, new_pages) values ($1, ${TODAY}, 1)`,
        [U.omar],
        '23505',
      );
    },
  );

  t("nobody writes someone else's reading", async (w) => {
    for (const actor of ['sarah', 'mustapha', 'taghread']) {
      await w
        .as(actor)
        .denied(
          `insert into public.daily_readings (user_id, day, new_pages) values ($1, ${TODAY} - 3, 604)`,
          [U.omar],
        );
      assert.equal(
        (
          await w
            .as(actor)
            .q(`update public.daily_readings set new_pages = 604 where user_id = $1`, [U.omar])
        ).rowCount,
        0,
      );
      assert.equal(
        (await w.as(actor).q(`delete from public.daily_readings where user_id = $1`, [U.omar]))
          .rowCount,
        0,
      );
    }
    await w.omar.denied(`update public.daily_readings set user_id = $1 where user_id = $2`, [
      U.sarah,
      U.omar,
    ]);
    await w.omar.denied(`update public.daily_readings set day = ${TODAY} - 1`);
    assert.equal(
      (
        await w.suRows(`select new_pages from public.daily_readings where user_id = $1`, [U.omar])
      )[0].new_pages,
      12,
    );
    await w.anon.denied(
      `insert into public.daily_readings (user_id, day, new_pages) values ($1, current_date, 1)`,
      [U.omar],
    );
  });

  t(
    "nobody reads someone else's days, not even a friend or a member of the same group",
    async (w) => {
      const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      for (const actor of ['sarah', 'mustapha', 'taghread'])
        assert.deepEqual(await w.as(actor).rows(`select * from public.daily_readings`), []);
      await w.anon.denied(`select * from public.daily_readings`);
      const board = await w.sarah.rows(
        `select * from public.group_leaderboard($1, ${TODAY}, ${TODAY})`,
        [g],
      );
      assert.equal(Number(board.find((r) => r.display_name === 'Omar').total_pages), 12); // only the sum
      assert.deepEqual(Object.keys(board[0]).sort(), [
        'display_name',
        'rank',
        'total_pages',
        'user_id',
      ]);
    },
  );
});

// ---------------------------------------------------------------------------
describe('badges', () => {
  t('owner reads and writes their own badges', async (w) => {
    await w.omar.q(
      `insert into public.badges (user_id, khatm_number, completed_on) values ($1, 2, ${TODAY})`,
      [U.omar],
    );
    await w.omar.q(`update public.badges set completed_on = ${TODAY} - 1 where khatm_number = 2`);
    assert.equal((await w.omar.rows(`select * from public.badges`)).length, 2);
    assert.equal((await w.omar.q(`delete from public.badges where khatm_number = 2`)).rowCount, 1);
    for (const n of [0, -1])
      await w.omar.fails(
        `insert into public.badges (user_id, khatm_number, completed_on) values ($1, $2, ${TODAY})`,
        [U.omar, n],
        '23514',
      );
    await w.omar.fails(
      `insert into public.badges (user_id, khatm_number, completed_on) values ($1, 5, ${TODAY} + 3)`,
      [U.omar],
      '23514',
    );
    await w.omar.fails(
      `insert into public.badges (user_id, khatm_number, completed_on) values ($1, 1, ${TODAY})`,
      [U.omar],
      '23505',
    );
  });

  t(
    'rule 4: an accepted friend reads the badges when level is shown, and not otherwise',
    async (w) => {
      assert.equal(
        (await w.sarah.rows(`select * from public.badges where user_id = $1`, [U.omar])).length,
        1,
      );
      await w.omar.q(`update public.profiles set show_level = false`);
      assert.deepEqual(
        await w.sarah.rows(`select * from public.badges where user_id = $1`, [U.omar]),
        [],
      );
      await w.omar.q(`update public.profiles set show_level = true, show_garden = false`); // garden hidden, level shown
      assert.equal(
        (await w.sarah.rows(`select * from public.badges where user_id = $1`, [U.omar])).length,
        1,
      );
    },
  );

  t('a stranger, a blocked person, a blocked friend and anon read none', async (w) => {
    for (const actor of ['mustapha', 'taghread'])
      assert.deepEqual(await w.as(actor).rows(`select * from public.badges`), []);
    await w.anon.denied(`select * from public.badges`);
    await w.omar.q(`select public.block_user($1)`, [U.sarah]);
    assert.deepEqual(await w.sarah.rows(`select * from public.badges`), []);
    // pending is not a friend
    await w.mustapha.q(`select public.send_friend_request($1)`, [U.omar]);
    assert.deepEqual(await w.mustapha.rows(`select * from public.badges`), []);
  });

  t("nobody writes someone else's badges, a friend included", async (w) => {
    for (const actor of ['sarah', 'mustapha', 'taghread']) {
      await w
        .as(actor)
        .denied(
          `insert into public.badges (user_id, khatm_number, completed_on) values ($1, 9, current_date)`,
          [U.omar],
        );
      assert.equal(
        (
          await w
            .as(actor)
            .q(`update public.badges set completed_on = current_date where user_id = $1`, [U.omar])
        ).rowCount,
        0,
      );
      assert.equal(
        (await w.as(actor).q(`delete from public.badges where user_id = $1`, [U.omar])).rowCount,
        0,
      );
    }
    await w.anon.denied(
      `insert into public.badges (user_id, khatm_number, completed_on) values ($1, 9, current_date)`,
      [U.omar],
    );
    assert.equal(await count(w, `select count(*) n from public.badges`), 1);
  });
});

// ---------------------------------------------------------------------------
describe('reading_backups (owner only)', () => {
  t('owner reads, replaces and deletes their backup', async (w) => {
    const row = await w.omar.one(`select * from public.reading_backups`);
    assert.deepEqual(row.journal.days['2026-11-01'], [1, 2, 3]);
    await w.omar.q(`update public.reading_backups set journal = '{"version":2}'::jsonb`);
    assert.equal(
      (await w.omar.one(`select journal from public.reading_backups`)).journal.version,
      2,
    );
    assert.equal((await w.omar.q(`delete from public.reading_backups`)).rowCount, 1);
    await w.omar.q(`insert into public.reading_backups (user_id, journal) values ($1, '{}')`, [
      U.omar,
    ]);
  });

  t(
    'a friend, a stranger, a blocked person, a member of the same group: nothing to read, nothing to write',
    async (w) => {
      const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      for (const actor of ['sarah', 'mustapha', 'taghread']) {
        const a = w.as(actor);
        assert.deepEqual(
          await a.rows(`select * from public.reading_backups where user_id = $1`, [U.omar]),
          [],
        );
        assert.deepEqual(await a.rows(`select * from public.reading_backups`), []);
        await a.denied(
          `insert into public.reading_backups (user_id, journal) values ($1, '{"x":1}')`,
          [U.omar],
        );
        assert.equal(
          (
            await a.q(`update public.reading_backups set journal = '{"x":1}' where user_id = $1`, [
              U.omar,
            ])
          ).rowCount,
          0,
        );
        assert.equal(
          (await a.q(`delete from public.reading_backups where user_id = $1`, [U.omar])).rowCount,
          0,
        );
      }
      assert.equal(
        await count(w, `select count(*) n from public.reading_backups where journal ? 'version'`),
        1,
      );
    },
  );

  t('anon cannot touch it', async (w) => {
    await w.anon.denied(`select * from public.reading_backups`);
    await w.anon.denied(`insert into public.reading_backups (user_id, journal) values ($1, '{}')`, [
      U.omar,
    ]);
    await w.anon.denied(`update public.reading_backups set journal = '{}'`);
    await w.anon.denied(`delete from public.reading_backups`);
  });

  t(
    'the journal must be a JSON object of at most 2 MB; the owner cannot hand the row to another person',
    async (w) => {
      for (const bad of ['[]', '"text"', '12', 'null'])
        await w.omar.fails(`update public.reading_backups set journal = $1::jsonb`, [bad], '23514');
      await w.omar.fails(
        `update public.reading_backups set journal = jsonb_build_object('x', repeat('a', 2100000))`,
        [],
        '23514',
      );
      await w.omar.q(
        `update public.reading_backups set journal = jsonb_build_object('x', repeat('a', 1900000))`,
      );
      await w.omar.denied(`update public.reading_backups set user_id = $1`, [U.sarah]);
    },
  );
});

// ---------------------------------------------------------------------------
describe('account deletion (rule 10)', () => {
  const tablesWithPerson = [
    ['profiles', 'id'],
    ['garden_summaries', 'user_id'],
    ['friendships', 'requester_id'],
    ['friendships', 'addressee_id'],
    ['blocks', 'blocker_id'],
    ['blocks', 'blocked_id'],
    ['invites', 'owner_id'],
    ['invite_attempts', 'user_id'],
    ['search_attempts', 'user_id'],
    ['nudges', 'from_id'],
    ['nudges', 'to_id'],
    ['groups', 'owner_id'],
    ['group_members', 'user_id'],
    ['daily_readings', 'user_id'],
    ['badges', 'user_id'],
    ['reading_backups', 'user_id'],
  ];
  const traces = async (w, uid) => {
    const left = [];
    for (const [table, col] of tablesWithPerson)
      if (await count(w, `select count(*) n from public.${table} where ${col} = $1`, [uid]))
        left.push(`${table}.${col}`);
    return left;
  };
  const fill = async (w) => {
    await w.sarah.q(`select public.send_nudge($1, 'encourage')`, [U.omar]);
    await w.omar.q(`select public.send_nudge($1, 'encourage')`, [U.sarah]);
    await w.omar.q(`select * from public.create_invite()`);
    await w.mustapha.q(`select public.accept_invite('AAAAAAAA')`);
    await w.su(`insert into public.invite_attempts (user_id) values ($1)`, [U.omar]);
    await w.su(`insert into public.search_attempts (user_id) values ($1)`, [U.omar]);
    await w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
      U.mustapha,
      U.omar,
    ]);
    await w.su(
      `insert into public.daily_readings (user_id, day, new_pages) values ($1, private.today(), 20)`,
      [U.sarah],
    );
  };

  t('delete_my_account removes everything of the person and nothing of anybody else', async (w) => {
    await fill(w);
    const g = (await w.omar.one(`select public.create_group('Seul') as id`)).id; // owned alone: disappears
    assert.ok((await traces(w, U.omar)).length >= 14);
    await w.omar.q(`select public.delete_my_account()`);
    assert.deepEqual(await traces(w, U.omar), []);
    assert.equal(await count(w, `select count(*) n from auth.users where id = $1`, [U.omar]), 0);
    assert.equal(await count(w, `select count(*) n from public.groups where id = $1`, [g]), 0);
    for (const who of [U.sarah, U.mustapha, U.taghread])
      assert.equal(
        await count(w, `select count(*) n from public.profiles where id = $1`, [who]),
        1,
      );
    assert.equal(
      await count(w, `select count(*) n from public.daily_readings where user_id = $1`, [U.sarah]),
      1,
    );
    assert.equal(await count(w, `select count(*) n from public.nudges`), 0); // both nudges involved omar
  });

  t("another person's account cannot be deleted, and anon cannot delete anything", async (w) => {
    await w.sarah.q(`select public.delete_my_account()`);
    assert.equal(
      await count(w, `select count(*) n from public.profiles where id = $1`, [U.omar]),
      1,
    );
    assert.deepEqual(await traces(w, U.sarah), []);
    await w.anon.denied(`select public.delete_my_account()`);
  });

  t('a group whose owner leaves goes to the oldest member', async (w) => {
    const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
    await befriend(w, U.omar, U.mustapha);
    await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.mustapha]);
    await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
    // make mustapha older than sarah, whatever the order of the inserts above
    await w.su(
      `update public.group_members set joined_on = private.today() - 2 where user_id = $1`,
      [U.mustapha],
    );
    await w.su(
      `update public.group_members set joined_on = private.today() - 1 where user_id = $1`,
      [U.sarah],
    );
    await w.omar.q(`select public.delete_my_account()`);
    assert.equal(
      (await w.mustapha.one(`select owner_id from public.groups where id = $1`, [g])).owner_id,
      U.mustapha,
    );
    const roles = await w.mustapha.rows(
      `select user_id, role from public.group_members where group_id = $1 order by role desc`,
      [g],
    );
    assert.deepEqual(roles, [
      { user_id: U.mustapha, role: 'owner' },
      { user_id: U.sarah, role: 'member' },
    ]);
  });

  t(
    'a group whose owner leaves: members who joined the same day are told apart by the lowest identifier',
    async (w) => {
      const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
      await befriend(w, U.omar, U.mustapha);
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.mustapha]);
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      await w.su(
        `update public.group_members set joined_on = private.today() - 3 where role = 'member'`,
      );
      await w.omar.q(`select public.delete_my_account()`);
      assert.equal(
        (await w.su(`select owner_id from public.groups where id = $1`, [g])).rows[0].owner_id,
        U.sarah,
      ); // ...0002 < ...0003
    },
  );

  t(
    'the same holds when the account is removed from outside (administrator, Edge Function)',
    async (w) => {
      const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
      await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
      await fill(w);
      await w.su(`delete from auth.users where id = $1`, [U.omar]);
      assert.deepEqual(await traces(w, U.omar), []);
      assert.equal(
        (await w.sarah.one(`select owner_id from public.groups where id = $1`, [g])).owner_id,
        U.sarah,
      );
    },
  );

  t('a member who leaves the app leaves the group and the group stays', async (w) => {
    const g = (await w.omar.one(`select public.create_group('Famille') as id`)).id;
    await w.omar.q(`select public.add_group_member($1, $2)`, [g, U.sarah]);
    await w.sarah.q(`select public.delete_my_account()`);
    assert.equal(
      (await w.omar.one(`select owner_id from public.groups where id = $1`, [g])).owner_id,
      U.omar,
    );
    assert.equal(
      await count(w, `select count(*) n from public.group_members where group_id = $1`, [g]),
      1,
    );
  });
});

// ---------------------------------------------------------------------------
describe('search by name (rule 11, D36)', () => {
  const search = (actor, query) => actor.rows(`select * from public.search_profiles($1)`, [query]);
  const names = async (actor, query) => (await search(actor, query)).map((r) => r.display_name);
  const rename = (w, n, name) =>
    w.su(`update public.profiles set display_name = $2 where id = $1`, [idOf(n), name]);

  t(
    'the owner finds a friend with the relation, a stranger with none, never themself',
    async (w) => {
      assert.deepEqual(await search(w.omar, 'sa'), [
        { id: U.sarah, display_name: 'Sarah', relation: 'friend' },
      ]);
      assert.deepEqual(await search(w.omar, 'mus'), [
        { id: U.mustapha, display_name: 'Mustapha', relation: 'none' },
      ]);
      assert.deepEqual(await search(w.omar, 'om'), []); // omar himself
    },
  );

  t('a stranger finds the owner by name: the name and the relation, no other column', async (w) => {
    const found = await search(w.mustapha, 'om');
    assert.deepEqual(found, [{ id: U.omar, display_name: 'Omar', relation: 'none' }]);
    assert.deepEqual(Object.keys(found[0]), ['id', 'display_name', 'relation']);
    assert.deepEqual(await names(w.mustapha, 'sar'), ['Sarah']);
  });

  t('a person whose request is waiting shows the direction', async (w) => {
    await w.su(
      `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
      [U.mustapha, U.omar],
    );
    assert.equal((await search(w.omar, 'mus'))[0].relation, 'request-received');
    assert.equal((await search(w.mustapha, 'om'))[0].relation, 'request-sent');
  });

  t('a declined request shows as none for both, nothing tells the sender', async (w) => {
    await w.su(
      `insert into public.friendships (requester_id, addressee_id, status, responded_on)
       values ($1, $2, 'declined', private.today())`,
      [U.mustapha, U.omar],
    );
    assert.equal((await search(w.mustapha, 'om'))[0].relation, 'none');
    assert.equal((await search(w.omar, 'mus'))[0].relation, 'none');
  });

  t(
    'the blocker does not find the blocked person, and the blocked person does not find the blocker',
    async (w) => {
      assert.deepEqual(await search(w.omar, 'tag'), []);
      assert.deepEqual(await search(w.taghread, 'om'), []);
      // Both directions at once, and the same answer as for a name nobody has.
      await w.su(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
        U.taghread,
        U.omar,
      ]);
      assert.deepEqual(await search(w.omar, 'tag'), []);
      assert.deepEqual(await search(w.taghread, 'om'), await search(w.taghread, 'zzzz'));
      // Other people still find both.
      assert.deepEqual(await names(w.mustapha, 'tag'), ['Taghread']);
      assert.deepEqual(await names(w.mustapha, 'om'), ['Omar']);
    },
  );

  t('someone blocked by a friend of mine is not hidden from me', async (w) => {
    assert.deepEqual(await names(w.sarah, 'tag'), ['Taghread']);
  });

  t('anon cannot search, and a signed-in person without a profile is refused', async (w) => {
    await w.anon.denied(`select * from public.search_profiles('om')`);
    await w.su(`insert into auth.users (id) values ($1)`, [NEW_USER]);
    await w
      .as(NEW_USER)
      .raises(`select * from public.search_profiles('om')`, [], 'profile_required');
  });

  t('the function is offered to signed-in users only and runs with its owner rights', async (w) => {
    const r = await w.suRows(
      `select prosecdef, has_function_privilege('anon', oid, 'EXECUTE') as anon_ok,
              has_function_privilege('authenticated', oid, 'EXECUTE') as auth_ok,
              has_function_privilege('public', oid, 'EXECUTE') as public_ok
       from pg_proc where proname = 'search_profiles'`,
    );
    assert.deepEqual(r, [{ prosecdef: true, anon_ok: false, auth_ok: true, public_ok: false }]);
  });

  t('the query is trimmed, 2 to 30 characters, with no control character', async (w) => {
    assert.deepEqual(await names(w.mustapha, '  om  '), ['Omar']);
    assert.deepEqual(await names(w.mustapha, '　om '), ['Omar']);
    for (const bad of [null, '', ' ', 'o', ' o ', '😀', 'ـ', '-.', 'é́-'])
      await w.mustapha.raises(
        `select * from public.search_profiles($1)`,
        [bad],
        'search_query_too_short',
      );
    await w.mustapha.raises(
      `select * from public.search_profiles($1)`,
      ['a'.repeat(31)],
      'search_query_too_long',
    );
    assert.deepEqual(await search(w.mustapha, 'a'.repeat(30)), []);
    for (const bad of ['om\nar', 'om\u0000'.replace('\u0000', '\u0007'), 'om‮ar', 'om\u0085'])
      await w.mustapha.raises(
        `select * from public.search_profiles($1)`,
        [bad],
        'search_query_forbidden_character',
      );
  });

  t('case and accents are ignored, in the query and in the name', async (w) => {
    await rename(w, 3, 'Éloïse');
    assert.deepEqual(await names(w.omar, 'ELOI'), ['Éloïse']);
    assert.deepEqual(await names(w.omar, 'éloï'), ['Éloïse']);
    assert.deepEqual(await names(w.omar, 'élo'), ['Éloïse']);
  });

  t('Arabic: marks, alef forms, ya, ta marbuta and tatweel are ignored', async (w) => {
    await rename(w, 3, 'أَحْمَد');
    assert.deepEqual(await names(w.omar, 'احمد'), ['أَحْمَد']);
    assert.deepEqual(await names(w.omar, 'إحم'), ['أَحْمَد']);
    await rename(w, 3, 'فاطمة');
    assert.deepEqual(await names(w.omar, 'فاطمه'), ['فاطمة']);
    await rename(w, 3, 'مصطفى');
    assert.deepEqual(await names(w.omar, 'مصطفي'), ['مصطفى']);
    await rename(w, 3, 'محمد');
    assert.deepEqual(await names(w.omar, 'محـم'), ['محمد']);
    assert.deepEqual(await search(w.omar, 'omar'), []); // Latin does not match Arabic
  });

  t('the prefix of any word matches, the middle of a word does not', async (w) => {
    await rename(w, 3, 'Mary Anne Al-Sayed');
    for (const q of ['ma', 'mary', 'ann', 'sayed', 'al', 'mary an', 'anne   al-s', 'al sayed'])
      assert.deepEqual(await names(w.omar, q), ['Mary Anne Al-Sayed'], q);
    for (const q of ['ary', 'yed', 'nne', 'mary al', 'sayed mary'])
      assert.deepEqual(await names(w.omar, q), [], q);
    await rename(w, 3, "Sean O'Brien");
    assert.deepEqual(await names(w.omar, 'brien'), ["Sean O'Brien"]);
  });

  t('the characters of a database pattern are plain characters', async (w) => {
    for (const q of ['%%', 'm%', 'ma%', '\\\\m', '%ar'])
      assert.deepEqual(await names(w.omar, q), [], q);
  });

  t('the server normalises exactly as the app does (shared list of cases)', async (w) => {
    for (const [text, expected] of sharedNormalization.cases) {
      const r = await w.suRows(`select private.search_normalize($1) as n`, [text]);
      assert.equal(r[0].n, expected, JSON.stringify(text));
    }
  });

  t('at most 20 results, the first 20 by name then id', async (w) => {
    for (let n = 0; n < 25; n++) await addUser(w, 100 + n, `Sam ${String.fromCharCode(97 + n)}`);
    const found = await search(w.omar, 'sam');
    assert.equal(found.length, 20);
    assert.equal(found[0].display_name, 'Sam a');
    assert.equal(found[19].display_name, 'Sam t');
    await addUser(w, 200, 'Sam');
    await addUser(w, 201, 'Sam');
    const ties = (await search(w.omar, 'sam')).slice(0, 2);
    assert.deepEqual(
      ties.map((r) => r.id),
      [idOf(200), idOf(201)],
    );
  });

  t('rate limit: 30 searches per minute per account, the 31st is refused', async (w) => {
    for (let i = 0; i < 30; i++) await search(w.mustapha, 'om');
    await w.mustapha.raises(`select * from public.search_profiles('om')`, [], 'too_many_searches');
    await w.mustapha.raises(`select * from public.search_profiles('zz')`, [], 'too_many_searches');
    // Another account is not affected.
    assert.deepEqual(await names(w.sarah, 'om'), ['Omar']);
    // A minute later the account can search again.
    await w.su(
      `update public.search_attempts set attempted_at = now() - interval '61 seconds' where user_id = $1`,
      [U.mustapha],
    );
    assert.deepEqual(await names(w.mustapha, 'om'), ['Omar']);
  });

  t('rate limit: a refused query is not counted, and old attempts are forgotten', async (w) => {
    for (let i = 0; i < 40; i++)
      await w.mustapha.raises(
        `select * from public.search_profiles('o')`,
        [],
        'search_query_too_short',
      );
    assert.equal(await count(w, `select count(*) n from public.search_attempts`), 0);
    for (let i = 0; i < 30; i++) await search(w.mustapha, 'om');
    assert.equal(
      await count(w, `select count(*) n from public.search_attempts where user_id = $1`, [
        U.mustapha,
      ]),
      30,
    );
    await w.su(`update public.search_attempts set attempted_at = now() - interval '2 hours'`);
    await search(w.mustapha, 'om');
    assert.equal(
      await count(w, `select count(*) n from public.search_attempts where user_id = $1`, [
        U.mustapha,
      ]),
      1,
    );
  });

  t('the attempts table cannot be read or written by anyone', async (w) => {
    await search(w.mustapha, 'om');
    assert.equal(await count(w, `select count(*) n from public.search_attempts`), 1);
    for (const actor of ACTORS) {
      await w.as(actor).denied(`select * from public.search_attempts`);
      await w.as(actor).denied(`delete from public.search_attempts`);
      await w
        .as(actor)
        .denied(`insert into public.search_attempts (user_id) values ($1)`, [U.omar]);
    }
  });

  t('a result has three columns: no flag, no creation day, no garden', async (w) => {
    const r = await w.suRows(
      `select pg_get_function_result(oid) as result from pg_proc where proname = 'search_profiles'`,
    );
    assert.equal(r[0].result, 'TABLE(id uuid, display_name text, relation text)');
  });
});
