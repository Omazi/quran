/**
 * The tool is an ES module and Jest runs CommonJS: its functions are called in a separate Node
 * process, as a developer runs the tool, and the result comes back as JSON.
 */
/* global __dirname -- Jest runs this file as CommonJS */
const { spawnSync } = require('node:child_process');
const { cpSync, mkdtempSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const TOOL = join(__dirname, '..');
const ROOT = join(TOOL, '..', '..');
const SHIPPED = join(ROOT, 'assets', 'images', 'garden', 'level-1');
const BUILD = join(TOOL, 'build.mjs');

/** Runs `body` (which may use `lib`, the tool's functions, and `args`) and returns its result. */
function inTool(body, args = {}) {
  const script = `import * as lib from ${JSON.stringify(join(TOOL, 'lib.mjs'))};
    const args = ${JSON.stringify(args)};
    try { const value = await (async () => { ${body} })();
      console.log(JSON.stringify({ ok: value })); }
    catch (e) { console.log(JSON.stringify({ error: e.message })); }`;
  const run = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
  return JSON.parse(run.stdout);
}

function withCopy(damage) {
  const copy = mkdtempSync(join(tmpdir(), 'garden-set-'));
  try {
    cpSync(SHIPPED, copy, { recursive: true });
    damage(copy);
    return inTool('return lib.checkSet(args.root).base.length', { root: copy });
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

describe('garden-pictures tool', () => {
  it('knows the names of a complete set: 61 x 4 dry pictures, 60 x 4 x 2 water pictures', () => {
    const { ok } = inTool('const n = lib.expectedNames(); return [n.base.length, n.water.length];');
    expect(ok).toEqual([244, 480]);
  });

  it('accepts the set shipped in the repository', () => {
    expect(withCopy(() => {})).toEqual({ ok: 244 });
  });

  it('stops on an incomplete set, saying what is missing', () => {
    const { error } = withCopy((copy) => rmSync(join(copy, 'water', 'h24-f0-w2.webp')));
    expect(error).toMatch(/1 picture\(s\) missing, first: h24-f0-w2\.webp/);
  });

  it('stops on a file with a wrong name', () => {
    const { error } = withCopy((copy) =>
      cpSync(join(copy, 'base', 'h00-f0.webp'), join(copy, 'base', 'h61-f0.webp')),
    );
    expect(error).toMatch(/unexpected file\(s\), first: h61-f0\.webp/);
  });

  it('stops on a file that is not a picture of the right size', () => {
    const { error } = withCopy((copy) =>
      require('node:fs').writeFileSync(join(copy, 'base', 'h10-f0.webp'), 'not a picture'),
    );
    expect(error).toMatch(/h10-f0\.webp: not a WebP file/);
  });

  it('stops on a missing folder', () => {
    const { error } = inTool('return lib.checkSet(args.root)', {
      root: join(tmpdir(), 'no-such-garden-set'),
    });
    expect(error).toMatch(/incomplete/);
  });

  it('reads the size and the alpha channel from a WebP header', () => {
    const { ok } = inTool(
      `const { readFileSync } = await import('node:fs');
       return lib.readWebpHeader(readFileSync(args.file));`,
      { file: join(SHIPPED, 'base', 'h00-f0.webp') },
    );
    expect(ok).toEqual({ width: 1200, height: 900, hasAlpha: true });
  });

  it('agrees with the repository: pictures, table and notice are current', () => {
    const run = spawnSync('node', [BUILD, '--verify'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/verified/);
  });

  it('exits with an error, writing nothing, when the source is incomplete', () => {
    const empty = mkdtempSync(join(tmpdir(), 'garden-empty-'));
    try {
      const run = spawnSync('node', [BUILD, '--source', empty], { encoding: 'utf8' });
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/incomplete picture set/);
      expect(readdirSync(SHIPPED)).toEqual(['base', 'water']);
      expect(readdirSync(join(SHIPPED, 'base'))).toHaveLength(244);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
