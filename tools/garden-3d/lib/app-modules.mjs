/**
 * The app's own 3D garden code (src/features/garden/garden3d), turned into browser modules for the
 * picture renderer (render.py): the pictures of a level are drawn by the scene the app draws, so
 * that the picture fallback is the 3D garden at rest. Starting from the modules render-scene.js
 * imports, every module they import is transpiled in turn (typescript's transpileModule only
 * strips the types; `@/` is the app's src folder). The growth of the next element is not needed
 * and is replaced by a stand-in that draws nothing.
 *
 *   node tools/garden-3d/lib/app-modules.mjs <output folder>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC = join(ROOT, 'src');
const GARDEN3D = join(SRC, 'features', 'garden', 'garden3d');
const ENTRIES = ['glb', 'garden-model', 'garden-three', 'camera-rig', 'config', 'garden-renderer'];
const STAND_INS = {
  [join(GARDEN3D, 'growth-three.ts')]: `export function buildGrowthView() { return null; }
export function injectGrowth() {}
`,
};

function sourceOf(fromDir, specifier) {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : join(fromDir, specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`app-modules: cannot find ${specifier} from ${relative(ROOT, fromDir)}`);
}

export function writeAppModules(output) {
  const ts = createRequire(import.meta.url)(join(ROOT, 'node_modules', 'typescript'));
  const done = new Set();
  const outPath = (file) => join(output, relative(SRC, file).replace(/\.tsx?$/, '.js'));
  const visit = (file) => {
    if (done.has(file)) return;
    done.add(file);
    const target = outPath(file);
    mkdirSync(dirname(target), { recursive: true });
    if (STAND_INS[file] !== undefined) {
      writeFileSync(target, STAND_INS[file]);
      return;
    }
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const js = outputText.replace(/from '((?:\.\.?|@)\/[^']+)'/g, (_m, specifier) => {
      const dependency = sourceOf(dirname(file), specifier);
      visit(dependency);
      let path = relative(dirname(target), outPath(dependency)).split('\\').join('/');
      if (!path.startsWith('.')) path = `./${path}`;
      return `from '${path}'`;
    });
    writeFileSync(target, js);
  };
  for (const name of ENTRIES) visit(join(GARDEN3D, `${name}.ts`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeAppModules(process.argv[2]);
