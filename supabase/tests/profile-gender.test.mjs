// The gender of a profile (supabase/migrations/20261126120000_profile_gender.sql), run for real on
// PostgreSQL 17 (embedded-postgres), with the social migration and then the gender one, in the
// order Supabase applies them. Actors (harness.mjs): omar (owner of the rows), sarah (accepted
// friend of omar), mustapha (stranger), taghread (blocked by omar), anon (signed-out visitor).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, U, MIGRATION, GENDER_MIGRATION } from './harness.mjs';

let db;
before(async () => {
  db = await startDb({ migrations: [MIGRATION, GENDER_MIGRATION] });
  process.stdout.write(`# PostgreSQL ${db.version}; migrations ${db.migration}\n`);
});
after(async () => {
  await db?.stop();
});

const t = (name, fn) => it(name, () => db.tx(fn));
const NEW_USER = '00000000-0000-4000-8000-0000000000f1';

describe('the column', () => {
  t('is null until the person says it: nobody is given a gender', async (w) => {
    const me = await w.omar.one(`select gender from public.profiles`);
    assert.equal(me.gender, null);
    const [row] = await w.sarah.rows(`select * from public.list_friends()`);
    assert.equal(row.gender, null);
  });

  t('accepts male, female and null, and nothing else (a check constraint)', async (w) => {
    for (const value of ['male', 'female', null, 'male']) {
      await w.omar.q(`update public.profiles set gender = $2 where id = $1`, [U.omar, value]);
      assert.equal((await w.omar.one(`select gender from public.profiles`)).gender, value);
    }
    for (const bad of ['', 'Male', 'other', 'f', ' male', 'male ', 'unknown']) {
      await w.omar.fails(
        `update public.profiles set gender = $2 where id = $1`,
        [U.omar, bad],
        '23514',
      );
    }
  });

  t('a new account may say it when it creates its own profile', async (w) => {
    await w.su(`insert into auth.users (id) values ($1)`, [NEW_USER]);
    await w
      .as(NEW_USER)
      .q(`insert into public.profiles (id, display_name, gender) values ($1, 'Nour', 'female')`, [
        NEW_USER,
      ]);
    assert.equal((await w.as(NEW_USER).one(`select gender from public.profiles`)).gender, 'female');
  });
});

describe('who can change it (policies unchanged)', () => {
  t('only the owner changes it: no one else, nobody signed out', async (w) => {
    for (const actor of ['sarah', 'mustapha', 'taghread']) {
      const r = await w
        .as(actor)
        .q(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
      assert.equal(r.rowCount, 0, `${actor} changed the gender of omar`);
    }
    await w.anon.denied(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
    assert.equal(
      (await w.su(`select gender from public.profiles where id = $1`, [U.omar])).rows[0].gender,
      null,
    );
  });

  t('nobody can create a profile for someone else with a gender', async (w) => {
    await w.su(`insert into auth.users (id) values ($1)`, [NEW_USER]);
    await w
      .as(NEW_USER)
      .denied(
        `insert into public.profiles (id, display_name, gender) values ($1, 'Eve', 'female')`,
        [U.omar.replace(/1$/, '9')],
      );
  });

  t('the other columns keep their grants: the creation day is still not changeable', async (w) => {
    await w.omar.q(
      `update public.profiles set gender = 'male', display_name = 'Omar B' where id = $1`,
      [U.omar],
    );
    await w.omar.denied(`update public.profiles set created_on = '2020-01-01' where id = $1`, [
      U.omar,
    ]);
  });
});

describe('who can read it (rule 4)', () => {
  t(
    'only the owner reads the table; a friend reads the gender through list_friends() and get_friend_garden()',
    async (w) => {
      await w.omar.q(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
      assert.deepEqual(
        await w.sarah.rows(`select gender from public.profiles where id = $1`, [U.omar]),
        [],
      );
      const [viaList] = await w.sarah.rows(`select * from public.list_friends()`);
      assert.equal(viaList.friend_id, U.omar);
      assert.equal(viaList.gender, 'male');
      const viaOne = await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar]);
      assert.equal(viaOne.gender, 'male');
      assert.equal(viaOne.display_name, 'Omar');
    },
  );

  t('a friend sees it even when the garden and the level are hidden', async (w) => {
    await w.omar.q(
      `update public.profiles set gender = 'female', show_garden = false, show_level = false where id = $1`,
      [U.omar],
    );
    const row = await w.sarah.one(`select * from public.get_friend_garden($1)`, [U.omar]);
    assert.deepEqual(
      [row.gender, row.garden_visible, row.level_visible, row.hizb_completed, row.level],
      ['female', false, false, null, null],
    );
  });

  t('a stranger, a blocked person and a signed-out visitor never see it', async (w) => {
    await w.omar.q(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
    for (const actor of ['mustapha', 'taghread']) {
      assert.deepEqual(
        await w.as(actor).rows(`select * from public.get_friend_garden($1)`, [U.omar]),
        [],
      );
      assert.deepEqual(await w.as(actor).rows(`select * from public.list_friends()`), []);
      assert.deepEqual(
        await w.as(actor).rows(`select gender from public.profiles where id = $1`, [U.omar]),
        [],
      );
    }
    await w.anon.denied(`select * from public.list_friends()`);
    await w.anon.denied(`select * from public.get_friend_garden($1)`, [U.omar]);
    await w.anon.denied(`select gender from public.profiles`);
  });

  t('the name lookups still give the name and nothing else, whoever asks', async (w) => {
    await w.omar.q(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
    for (const actor of ['sarah', 'mustapha']) {
      const rows = await w
        .as(actor)
        .rows(`select * from public.get_public_profiles($1)`, [[U.omar]]);
      assert.deepEqual(Object.keys(rows[0]).sort(), ['display_name', 'id']);
      const found = await w.as(actor).rows(`select * from public.search_profiles('Om')`);
      assert.equal(found.length, 1);
      assert.ok(!('gender' in found[0]), `${actor}: search result holds a gender`);
    }
  });

  t('once omar blocks a friend, that friend no longer sees it', async (w) => {
    await w.omar.q(`update public.profiles set gender = 'male' where id = $1`, [U.omar]);
    await w.omar.q(`select public.block_user($1)`, [U.sarah]);
    assert.deepEqual(
      await w.sarah.rows(`select * from public.get_friend_garden($1)`, [U.omar]),
      [],
    );
  });
});

describe('the functions made again', () => {
  t(
    'the API keeps its 18 functions, all security definer with an empty search_path, for signed-in users only',
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
      const fns = await w.suRows(
        `select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')`,
      );
      for (const f of fns) {
        assert.equal(
          (await w.suRows(`select has_function_privilege('anon', $1, 'EXECUTE') as ok`, [f.sig]))[0]
            .ok,
          false,
          `anon can run ${f.sig}`,
        );
        assert.equal(
          (
            await w.suRows(`select has_function_privilege('public', $1, 'EXECUTE') as ok`, [f.sig])
          )[0].ok,
          false,
          `everyone can run ${f.sig}`,
        );
      }
      for (const sig of ['public.list_friends()', 'public.get_friend_garden(uuid)']) {
        assert.equal(
          (
            await w.suRows(`select has_function_privilege('authenticated', $1, 'EXECUTE') as ok`, [
              sig,
            ])
          )[0].ok,
          true,
          `signed-in users cannot run ${sig}`,
        );
      }
    },
  );

  t('list_friends() still orders by name and hides the same things as before', async (w) => {
    const row = await w.sarah.one(`select * from public.list_friends()`);
    assert.deepEqual(
      [
        row.display_name,
        row.garden_visible,
        row.level_visible,
        row.level,
        row.hizb_completed,
        row.streak_days,
      ],
      ['Omar', true, true, 2, 14, 5],
    );
  });
});
