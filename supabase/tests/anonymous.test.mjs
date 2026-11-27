// Anonymous accounts (supabase/migrations/20261127120000_anonymous_accounts.sql), run for real on
// PostgreSQL 17 (embedded-postgres) after every migration before it, in the order Supabase
// applies them. An anonymous account is an ordinary user whose token says is_anonymous: true
// (`asAnonymous` in harness.mjs). Actors: omar, sarah (friends), mustapha (stranger), anon
// (signed-out visitor), and NEW / OTHER, two new phones.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startDb,
  U,
  MIGRATION,
  SYNC_MIGRATION,
  SYNC_DEVICE_MIGRATION,
  GENDER_MIGRATION,
  ANONYMOUS_MIGRATION,
} from './harness.mjs';

let db;
before(async () => {
  db = await startDb({
    migrations: [
      MIGRATION,
      SYNC_MIGRATION,
      SYNC_DEVICE_MIGRATION,
      GENDER_MIGRATION,
      ANONYMOUS_MIGRATION,
    ],
  });
  process.stdout.write(`# PostgreSQL ${db.version}; migrations ${db.migration}\n`);
});
after(async () => {
  await db?.stop();
});

const t = (name, fn) => it(name, () => db.tx(fn));
const NEW = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000a2';

/** A new phone: an anonymous row of auth.users, then its own profile, as the app makes it. */
async function newPhone(w, id, name) {
  await w.su(`insert into auth.users (id, is_anonymous) values ($1, true)`, [id]);
  const me = w.asAnonymous(id);
  if (name !== undefined) {
    await me.q(`insert into public.profiles (id, display_name) values ($1, $2)`, [id, name]);
  }
  return me;
}

const today = () => new Date().toISOString().slice(0, 10);
const pageEvent = (date = '2026-11-20') => ({
  id: `p.1.3.${date}`,
  event: { kind: 'page', khatm: 1, page: 3, date },
});

describe('an anonymous account uses the Proches tab like any account', () => {
  t('it creates its own profile, and only its own', async (w) => {
    const me = await newPhone(w, NEW);
    await me.denied(`insert into public.profiles (id, display_name) values ($1, 'X')`, [
      U.mustapha,
    ]);
    await me.q(`insert into public.profiles (id, display_name) values ($1, 'Nour')`, [NEW]);
    assert.deepEqual(await me.rows(`select id, display_name from public.profiles`), [
      { id: NEW, display_name: 'Nour' },
    ]);
  });

  t('without a profile, the functions say profile_required', async (w) => {
    const me = await newPhone(w, NEW);
    await me.raises(`select * from public.create_invite()`, [], 'profile_required');
    await me.raises(`select * from public.list_friends()`, [], 'profile_required');
  });

  t('a code made by one anonymous phone is accepted by another: both see each other', async (w) => {
    const a = await newPhone(w, NEW, 'Nour');
    const b = await newPhone(w, OTHER, 'Yacine');
    const { code } = await a.one(`select * from public.create_invite()`);
    assert.equal((await b.one(`select public.accept_invite($1) as r`, [code])).r, 'accepted');
    assert.deepEqual(
      (await a.rows(`select friend_id, display_name from public.list_friends()`)).map(
        (r) => r.display_name,
      ),
      ['Yacine'],
    );
    assert.deepEqual(
      (await b.rows(`select friend_id from public.list_friends()`)).map((r) => r.friend_id),
      [NEW],
    );
  });

  t('an anonymous phone and a permanent account become friends by code', async (w) => {
    const a = await newPhone(w, NEW, 'Nour');
    const { code } = await w.omar.one(`select * from public.create_invite()`);
    assert.equal((await a.one(`select public.accept_invite($1) as r`, [code])).r, 'accepted');
    const names = (await w.omar.rows(`select display_name from public.list_friends()`)).map(
      (r) => r.display_name,
    );
    assert.deepEqual(names.sort(), ['Nour', 'Sarah']);
  });

  t('the garden a friend publishes is visible, hidden parts stay hidden', async (w) => {
    const a = await newPhone(w, NEW, 'Nour');
    const b = await newPhone(w, OTHER, 'Yacine');
    const { code } = await a.one(`select * from public.create_invite()`);
    await b.q(`select public.accept_invite($1)`, [code]);
    await a.q(
      `insert into public.garden_summaries
         (user_id, level, hizb_completed, health, last_watered_on, streak_days, badge_count)
       values ($1, 1, 7, 0.9, $2, 3, 0)`,
      [NEW, today()],
    );
    const [seen] = await b.rows(`select * from public.get_friend_garden($1)`, [NEW]);
    assert.equal(seen.hizb_completed, 7);
    assert.equal(seen.level, 1);
    await a.q(`update public.profiles set show_level = false where id = $1`, [NEW]);
    const [hidden] = await b.rows(`select * from public.get_friend_garden($1)`, [NEW]);
    assert.equal(hidden.hizb_completed, 7);
    assert.equal(hidden.level, null);
    // A stranger, anonymous or not, reads no garden.
    const stranger = await newPhone(w, '00000000-0000-4000-8000-0000000000a3', 'Inconnu');
    assert.deepEqual(await stranger.rows(`select * from public.get_friend_garden($1)`, [NEW]), []);
    assert.deepEqual(await stranger.rows(`select * from public.garden_summaries`), []);
  });

  t('the sync keeps each anonymous account to its own events', async (w) => {
    const a = await newPhone(w, NEW);
    const b = await newPhone(w, OTHER);
    const answer = (
      await a.one(`select public.sync_push($1::jsonb) as r`, [JSON.stringify([pageEvent()])])
    ).r;
    assert.equal(answer.accepted, 1);
    const mine = (await a.one(`select public.sync_pull(0, 100) as r`)).r;
    const theirs = (await b.one(`select public.sync_pull(0, 100) as r`)).r;
    assert.equal(theirs.events.length, 0);
    assert.equal(mine.events.length, answer.accepted);
    assert.deepEqual(await b.rows(`select * from public.sync_events`), []);
  });

  t('the visitor without any account still gets nothing', async (w) => {
    await w.anon.denied(`select * from public.create_invite()`);
    await w.anon.denied(`select public.accept_invite('ABCDEFGH')`);
    await w.anon.denied(`select public.sync_pull(0, 10)`);
  });
});

describe('the search by name', () => {
  t('is refused to an anonymous account', async (w) => {
    const me = await newPhone(w, NEW, 'Nour');
    await me.raises(`select * from public.search_profiles('Sa')`, [], 'permanent_account_required');
  });

  t('still works for a permanent account, with the same answers as before', async (w) => {
    const rows = await w.mustapha.rows(`select * from public.search_profiles('Sa')`);
    assert.deepEqual(
      rows.map((r) => [r.display_name, r.relation]),
      [['Sarah', 'none']],
    );
    await w.mustapha.raises(
      `select * from public.search_profiles('S')`,
      [],
      'search_query_too_short',
    );
  });

  t('the function behind the guard cannot be called through the API', async (w) => {
    await w.mustapha.denied(`select * from private.search_profiles_unguarded('Sa')`);
    const me = await newPhone(w, NEW, 'Nour');
    await me.denied(`select * from private.search_profiles_unguarded('Sa')`);
    await w.anon.denied(`select * from public.search_profiles('Sa')`);
  });

  t('the public function keeps the shape of every function the API offers', async (w) => {
    const [row] = await w.suRows(
      `select p.prosecdef, p.proconfig,
              has_function_privilege('authenticated', p.oid, 'execute') as signed_in,
              has_function_privilege('anon', p.oid, 'execute') as visitor
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'search_profiles'`,
    );
    assert.equal(row.prosecdef, true);
    assert.deepEqual(row.proconfig, ['search_path=""']);
    assert.equal(row.signed_in, true);
    assert.equal(row.visitor, false);
  });
});

describe('the cleanup of abandoned anonymous accounts', () => {
  const OLD = "now() - interval '120 days'";
  const cleanup = (w, days = 90) =>
    w
      .su(`select private.delete_abandoned_anonymous_users($1) as n`, [days])
      .then((r) => r.rows[0].n);

  t('deletes an anonymous account without profile, silent for more than 90 days', async (w) => {
    await w.su(`insert into auth.users (id, is_anonymous, created_at) values ($1, true, ${OLD})`, [
      NEW,
    ]);
    assert.equal(await cleanup(w), 1);
    assert.deepEqual(await w.suRows(`select id from auth.users where id = $1`, [NEW]), []);
  });

  t('keeps an account that refreshed its token recently, or signed in', async (w) => {
    await w.su(`insert into auth.users (id, is_anonymous, created_at) values ($1, true, ${OLD})`, [
      NEW,
    ]);
    await w.su(
      `insert into auth.sessions (user_id, created_at, refreshed_at) values ($1, ${OLD}, (now() at time zone 'utc') - interval '2 days')`,
      [NEW],
    );
    await w.su(
      `insert into auth.users (id, is_anonymous, created_at, last_sign_in_at) values ($1, true, ${OLD}, now() - interval '5 days')`,
      [OTHER],
    );
    assert.equal(await cleanup(w), 0);
  });

  t('never deletes an account with a profile: its friends would lose it', async (w) => {
    await w.su(`insert into auth.users (id, is_anonymous, created_at) values ($1, true, ${OLD})`, [
      NEW,
    ]);
    await w.su(`insert into public.profiles (id, display_name) values ($1, 'Nour')`, [NEW]);
    assert.equal(await cleanup(w), 0);
  });

  t('never deletes a permanent account, however old', async (w) => {
    await w.su(`insert into auth.users (id, is_anonymous, created_at) values ($1, false, ${OLD})`, [
      NEW,
    ]);
    assert.equal(await cleanup(w), 0);
  });

  t('deletes the sync copy with the account (cascade)', async (w) => {
    await w.su(`insert into auth.users (id, is_anonymous, created_at) values ($1, true, ${OLD})`, [
      NEW,
    ]);
    await w
      .asAnonymous(NEW)
      .q(`select public.sync_push($1::jsonb)`, [JSON.stringify([pageEvent()])]);
    assert.equal(await cleanup(w), 1);
    assert.deepEqual(
      await w.suRows(`select * from public.sync_events where user_id = $1`, [NEW]),
      [],
    );
  });

  t('refuses a delay shorter than 30 days, and nobody can call it through the API', async (w) => {
    await assert.rejects(() => cleanup(w, 7), /idle_days_too_short/);
    for (const actor of ['omar', 'mustapha', 'anon']) {
      await w.as(actor).denied(`select private.delete_abandoned_anonymous_users(90)`);
    }
    await w.asAnonymous(U.omar).denied(`select private.delete_abandoned_anonymous_users(90)`);
  });
});
