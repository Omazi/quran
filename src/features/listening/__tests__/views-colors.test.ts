import ar from '@/i18n/locales/ar/listening.json';
import en from '@/i18n/locales/en/listening.json';
import fr from '@/i18n/locales/fr/listening.json';

// The project compiles without Node's type definitions: the functions needed are typed here.
const { readdirSync, readFileSync } = jest.requireActual<{
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

const FEATURE = resolve(expect.getState().testPath ?? '', '../..');
const DRAWN = ['views', 'scene', 'follow'].flatMap((folder) =>
  readdirSync(resolve(FEATURE, folder))
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => `${folder}/${name}`),
);

describe('the listening screens take their look from the tokens', () => {
  it('reads the drawn files of the feature', () => {
    expect(DRAWN.length).toBeGreaterThanOrEqual(10);
  });

  // Colours come from `src/ui` (the listening palette, measured on the mockups), never from a
  // literal in the feature.
  it.each(DRAWN)('%s writes no colour of its own', (name) => {
    const source = readFileSync(resolve(FEATURE, name), 'utf8');
    expect(source).not.toMatch(/['"]#[0-9A-Fa-f]{3,8}['"]/);
    expect(source).not.toMatch(/rgba?\(/);
  });

  // The system's secondary and tertiary labels do not reach 4.5:1 on the scene or the paper.
  it.each(DRAWN)('%s uses no system label colour', (name) => {
    const source = readFileSync(resolve(FEATURE, name), 'utf8');
    expect(source).not.toMatch(/['"](secondaryLabel|tertiaryLabel|quaternaryLabel)['"]/);
  });
});

describe('the strings of the listening screens', () => {
  it.each([
    ['fr', fr],
    ['en', en],
    ['ar', ar],
  ])('%s: has every string of the mockups', (_name, strings) => {
    expect(strings.listening.heading).not.toBe('');
    expect(strings.listening.prompt).not.toBe('');
    expect(strings.found.label).not.toBe('');
    expect(strings.found.open).not.toBe('');
    expect(strings.follow.title).not.toBe('');
    expect(strings.follow.reread).not.toBe('');
    expect(strings.page).toMatch(/\{\{page\}\}/);
  });
});
