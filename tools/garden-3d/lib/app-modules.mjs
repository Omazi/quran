/**
 * The app's own 3D garden code (src/features/garden/garden3d), turned into browser modules for the
 * picture renderer (render.py): the pictures of a level are drawn by the scene the app draws, so
 * that the picture fallback is the 3D garden at rest. TypeScript is only stripped of its types
 * (typescript's transpileModule); the growth of the next element is not needed and is replaced by
 * a stand-in that draws nothing.
 *
 *   node tools/garden-3d/lib/app-modules.mjs <output folder>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SOURCE = join(ROOT, 'src', 'features', 'garden', 'garden3d');
const MODULES = ['glb', 'garden-model', 'garden-three', 'camera-rig', 'config', 'garden-renderer'];
const GROWTH_STAND_IN = `export function buildGrowthView() { return null; }
export function injectGrowth() {}
`;

export function writeAppModules(output) {
  const ts = createRequire(import.meta.url)(join(ROOT, 'node_modules', 'typescript'));
  mkdirSync(output, { recursive: true });
  for (const name of MODULES) {
    const source = readFileSync(join(SOURCE, `${name}.ts`), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
    });
    // Relative imports get their extension, as a browser needs it.
    const js = outputText.replace(/from '(\.\.?\/[^']+)'/g, (_m, path) => `from '${path}.js'`);
    writeFileSync(join(output, `${name}.js`), js);
  }
  writeFileSync(join(output, 'growth-three.js'), GROWTH_STAND_IN);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeAppModules(process.argv[2]);
