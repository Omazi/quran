// Test harness: starts a real PostgreSQL (embedded-postgres), installs the test shim and
// the migration, and gives each test a transaction that is rolled back at the end.
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, mkdtempSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
// SOCIAL_MIGRATION lets a test run against a modified copy (used to watch a test fail).
const MIGRATION =
  process.env.SOCIAL_MIGRATION ?? join(here, '..', 'migrations', '20261124230000_social.sql');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const U = {
  omar: id(1), // the owner of the rows
  sarah: id(2), // accepted friend of omar
  mustapha: id(3), // stranger
  taghread: id(4), // blocked by omar
};
export const ACTORS = ['omar', 'sarah', 'mustapha', 'taghread', 'anon'];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

export async function startDb() {
  const dir = mkdtempSync(join(tmpdir(), 'quran-pg-'));
  chmodSync(dir, 0o755); // a server started by root runs as another system user
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(dir, 'data'),
    user: 'postgres',
    password: 'test-only',
    port,
    persistent: false,
    // Supabase databases are UTF8; embedded-postgres would otherwise pick SQL_ASCII here.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    // Postgres refuses to run as root; only matters in containers and CI.
    createPostgresUser: process.getuid?.() === 0,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  try {
    await client.query(readFileSync(join(here, 'shim.sql'), 'utf8'));
    await client.query(readFileSync(MIGRATION, 'utf8'));
  } catch (e) {
    await client.end().catch(() => {});
    await pg.stop().catch(() => {}); // never leave a server running behind a failed setup
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  const version = (await client.query('show server_version')).rows[0].server_version;

  let savepoints = 0;

  // Runs one statement as an actor (a Postgres role plus the token claims of a person).
  // Each statement has its own savepoint, so a refused statement does not end the test.
  async function run(actor, sql, params = []) {
    const sp = `sp${savepoints++}`;
    await client.query(`savepoint ${sp}`);
    try {
      if (actor !== 'su') {
        const role = actor === 'anon' ? 'anon' : 'authenticated';
        const claims = actor === 'anon' ? '' : JSON.stringify({ sub: U[actor] ?? actor, role });
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
        await client.query(`set local role ${role}`);
      }
      const res = await client.query(sql, params);
      await client.query('reset role');
      await client.query(`release savepoint ${sp}`);
      return res;
    } catch (e) {
      await client.query(`rollback to savepoint ${sp}`); // also undoes the role change
      throw e;
    }
  }

  function who(actor) {
    return {
      q: (sql, params) => run(actor, sql, params),
      rows: async (sql, params) => (await run(actor, sql, params)).rows,
      one: async (sql, params) => (await run(actor, sql, params)).rows[0],
      /** the statement must fail with this SQLSTATE (42501 = refused by privilege or policy) */
      async fails(sql, params, expected) {
        const { code, message } = typeof expected === 'string' ? { code: expected } : expected;
        await assert.rejects(
          () => run(actor, sql, params),
          (e) => {
            if (code) assert.equal(e.code, code, `${actor}: ${sql} -> ${e.code} ${e.message}`);
            if (message) assert.match(e.message, message);
            return true;
          },
          `${actor}: expected failure of: ${sql}`,
        );
      },
      /** refused outright (privilege missing, or a policy refuses the row) */
      denied: (sql, params) => who(actor).fails(sql, params, '42501'),
      /** a function raised this machine code */
      raises: (sql, params, message) =>
        who(actor).fails(sql, params, { code: 'P0001', message: new RegExp(`^${message}$`) }),
    };
  }

  async function seed() {
    await client.query(`
      insert into auth.users (id, email) values
        ('${U.omar}', 'omar@example.test'), ('${U.sarah}', 'sarah@example.test'),
        ('${U.mustapha}', 'mustapha@example.test'), ('${U.taghread}', 'taghread@example.test');
      insert into public.profiles (id, display_name) values
        ('${U.omar}', 'Omar'), ('${U.sarah}', 'Sarah'),
        ('${U.mustapha}', 'Mustapha'), ('${U.taghread}', 'Taghread');
      -- omar and sarah are accepted friends; omar blocks taghread
      insert into public.friendships (requester_id, addressee_id, status, responded_on)
        values ('${U.omar}', '${U.sarah}', 'accepted', private.today());
      insert into public.blocks (blocker_id, blocked_id) values ('${U.omar}', '${U.taghread}');
      insert into public.garden_summaries
        (user_id, level, hizb_completed, health, last_watered_on, streak_days, badge_count,
         words_read, verses_read, hasanat_estimate)
        values ('${U.omar}', 2, 14, 0.8, private.today(), 5, 1, 99367, 8000, 4272781);
      insert into public.badges (user_id, khatm_number, completed_on)
        values ('${U.omar}', 1, private.today() - 30);
      insert into public.daily_readings (user_id, day, new_pages)
        values ('${U.omar}', private.today(), 12);
      insert into public.reading_backups (user_id, journal)
        values ('${U.omar}', '{"version":1,"days":{"2026-11-01":[1,2,3]}}');
    `);
  }

  /** Runs fn inside a transaction that is always rolled back. */
  async function tx(fn) {
    await client.query('begin');
    try {
      await seed();
      await fn({
        su: (sql, params) => run('su', sql, params),
        suRows: async (sql, params) => (await run('su', sql, params)).rows,
        as: who,
        omar: who('omar'),
        sarah: who('sarah'),
        mustapha: who('mustapha'),
        taghread: who('taghread'),
        anon: who('anon'),
      });
      // Deferred checks (a group has exactly one owner, its owner) are settled now, because
      // the transaction is never committed: every test also proves the data stayed consistent.
      await client.query('set constraints all immediate');
    } finally {
      await client.query('rollback');
    }
  }

  async function stop() {
    await client.end();
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  }

  return { client, tx, stop, version, migration: MIGRATION };
}
