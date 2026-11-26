/**
 * One source for the writing direction of the interface (owner's report: after Arabic → French,
 * half the screens stayed right to left). React Native lays the app out once per start, from
 * `I18nManager`; the language settings restart the app when the direction changes. A component
 * that took its direction from anywhere else (the language shown, which changes at once, or a
 * value read when its module loads) could disagree with the rest of the screen.
 */

// The project compiles without Node's type definitions: the functions needed are typed here.
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
}>('node:fs');
const { join, relative, resolve } = jest.requireActual<{
  join: (...segments: string[]) => string;
  relative: (from: string, to: string) => string;
  resolve: (...segments: string[]) => string;
}>('node:path');

/** The `src` folder, from this test file. */
const SRC = resolve(expect.getState().testPath ?? '', '../../../..');

/** Every source file of the app, tests and test support left out. */
function sourceFiles(directory: string = SRC): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'test-support') continue;
      files.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

const files = sourceFiles().map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, 'utf8'),
}));

describe('the writing direction of the interface', () => {
  it('is read from React Native in two places only: the interface and the language settings', () => {
    const readers = files
      .filter(({ text }) => /\bI18nManager\b/.test(text))
      .map(({ path }) => path)
      .sort();
    expect(readers).toEqual(['features/settings/writing-direction.ts', 'ui/direction.ts']);
  });

  it('never follows the language shown, which changes before the layout does', () => {
    const users = files
      .filter(({ text }) => /\bisRightToLeftLanguage\(/.test(text))
      .map(({ path }) => path)
      .sort();
    expect(users).toEqual(['features/settings/writing-direction.ts', 'i18n/index.ts']);
  });

  it('is never read when a module loads, only while a component draws', () => {
    // A call at the start of a line is a top-level statement or declaration of the module.
    const atModuleLevel = files.filter(({ text }) =>
      text
        .split('\n')
        .some((line: string) =>
          /^(export\s+)?(const|let|var)\b.*getWritingDirection\(\)/.test(line),
        ),
    );
    expect(atModuleLevel.map(({ path }) => path)).toEqual([]);
  });
});
