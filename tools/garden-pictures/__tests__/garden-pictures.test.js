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

const HAS_PILLOW =
  spawnSync('python3', ['-I', '-c', 'import PIL'], { encoding: 'utf8' }).status === 0;

describe('garden-pictures tool: the cut', () => {
  it('holds the union of what every picture draws', () => {
    const { ok } = inTool('return lib.unionBounds(args.boxes);', {
      boxes: [[100, 150, 900, 700], null, [60, 200, 880, 760], [120, 120, 910, 690]],
    });
    expect(ok).toEqual([60, 120, 910, 760]);
  });

  it('adds the same margin on the four sides', () => {
    const { ok } = inTool(
      'return lib.cropBox([100, 150, 900, 700], { width: 1000, height: 800 }, 16);',
    );
    expect(ok).toEqual([84, 134, 916, 716]);
  });

  it('shrinks the margin on every side, never one side only, when a picture nears an edge', () => {
    const { ok } = inTool(
      'return lib.cropBox([5, 150, 900, 700], { width: 1000, height: 800 }, 16);',
    );
    expect(ok).toEqual([0, 145, 905, 705]);
  });

  it('cuts nothing more than the picture when the set touches the edges', () => {
    const { ok } = inTool(
      'return lib.cropBox([0, 0, 1000, 800], { width: 1000, height: 800 }, 16);',
    );
    expect(ok).toEqual([0, 0, 1000, 800]);
  });

  it('stops on a set where every picture is empty', () => {
    const { error } = inTool('return lib.unionBounds([null, null]);');
    expect(error).toMatch(/every picture is empty/);
  });

  (HAS_PILLOW ? it : it.skip)(
    'cuts synthetic pictures to one box: same size for all, still overlaying exactly',
    () => {
      const work = mkdtempSync(join(tmpdir(), 'garden-synthetic-'));
      try {
        const script = `
import os, sys
from PIL import Image
root = sys.argv[1]
os.makedirs(root + '/base'); os.makedirs(root + '/water')
def picture(path, boxes):
    image = Image.new('RGBA', (200, 100), (0, 0, 0, 0))
    for (l, t, r, b), colour in boxes:
        image.paste(Image.new('RGBA', (r - l, b - t), colour), (l, t))
    image.save(path, 'WEBP', lossless=True)
picture(root + '/base/a.webp', [((40, 30, 120, 70), (200, 0, 0, 255))])
picture(root + '/base/b.webp', [((40, 30, 160, 90), (200, 0, 0, 255))])
picture(root + '/water/a.webp', [((20, 50, 60, 60), (0, 0, 200, 255))])
`;
        expect(spawnSync('python3', ['-I', '-c', script, join(work, 'in')]).status).toBe(0);
        const { ok, error } = inTool(
          `const out = args.out;
           const cut = lib.cropSet(args.root, out, 4);
           const set = lib.setBounds(out);
           return { cut, size: set.size, union: set.union };`,
          { root: join(work, 'in'), out: join(work, 'out') },
        );
        expect(error).toBeUndefined();
        // Union: x 20 to 160, y 30 to 90; plus 4 on each side.
        expect(ok.cut.box).toEqual([16, 26, 164, 94]);
        expect(ok.cut.size).toEqual({ width: 148, height: 68 });
        // Every picture has that size, and what is drawn now sits 4 pixels from the edges.
        expect(ok.size).toEqual({ width: 148, height: 68 });
        expect(ok.union).toEqual([4, 4, 144, 64]);
        // The red block of `base/a` and the blue block of `water/a` are where they were: still aligned.
        const check = spawnSync(
          'python3',
          [
            '-I',
            '-c',
            `import sys
from PIL import Image
a = Image.open(sys.argv[1] + '/base/a.webp').convert('RGBA')
w = Image.open(sys.argv[1] + '/water/a.webp').convert('RGBA')
red = a.getpixel((40 - 16 + 1, 30 - 26 + 1))
blue = w.getpixel((20 - 16 + 1, 50 - 26 + 1))
print(red[0] > 180 and red[1] < 30, blue[2] > 180 and blue[0] < 30)`,
            join(work, 'out'),
          ],
          { encoding: 'utf8' },
        );
        expect(check.stdout.trim()).toBe('True True');
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
  );
});

describe('garden-pictures tool', () => {
  it('knows the names of a complete set: 61 x 4 dry pictures, 60 x 4 x 2 water pictures', () => {
    const { ok } = inTool('const n = lib.expectedNames(); return [n.base.length, n.water.length];');
    expect(ok).toEqual([244, 480]);
  });

  it('accepts the set shipped in the repository', () => {
    expect(withCopy(() => {})).toEqual({ ok: 244 });
  });

  it('gives every shipped picture one size, cut to the set (wider than the 1200x900 render)', () => {
    const { ok } = inTool('return lib.checkSet(args.root).size;', { root: SHIPPED });
    expect(ok.width).toBeLessThan(1200);
    expect(ok.height).toBeLessThan(900);
  });

  it('stops on a picture whose size is not the one of the others', () => {
    // A minimal lossless header: only the size is read, and the size is wrong.
    const odd = Buffer.alloc(40);
    odd.write('RIFF', 0, 'latin1');
    odd.write('WEBP', 8, 'latin1');
    odd.write('VP8L', 12, 'latin1');
    odd.writeUInt32LE(63 | (47 << 14), 21);
    const { error } = withCopy((copy) =>
      require('node:fs').writeFileSync(join(copy, 'base', 'h10-f0.webp'), odd),
    );
    expect(error).toMatch(/h10-f0\.webp: 64x48, expected /);
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
    expect(ok).toMatchObject({ hasAlpha: true });
    expect(ok.width).toBeGreaterThan(ok.height);
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
