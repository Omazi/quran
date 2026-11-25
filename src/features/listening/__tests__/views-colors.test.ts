import en from '@/i18n/locales/en/listening.json';
import fr from '@/i18n/locales/fr/listening.json';

// The project compiles without Node's type definitions: the functions needed are typed here.
const { readdirSync, readFileSync } = jest.requireActual<{
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

const VIEWS = resolve(expect.getState().testPath ?? '', '../../views');
const VIEW_FILES = readdirSync(VIEWS).filter((name) => name.endsWith('.tsx'));

describe('the listening views sit on paper', () => {
  it('reads the views of the folder', () => {
    expect(VIEW_FILES.length).toBeGreaterThanOrEqual(5);
  });

  // The system's secondary and tertiary labels reach 3.35:1 and 1.71:1 on paper; the charter's
  // `inkSecondary` reaches 5.13:1 (brand spec, section 3; accessibility.md › Vision).
  it.each(VIEW_FILES)('%s uses no system label colour for text or icons', (name) => {
    const source = readFileSync(resolve(VIEWS, name), 'utf8');
    expect(source).not.toMatch(/['"](secondaryLabel|tertiaryLabel|quaternaryLabel)['"]/);
  });
});

describe('the buttons of every result', () => {
  // One arrangement everywhere: the prominent button alone on its line, the plain ones in a row
  // under it, drawn by the same component.
  it.each(['found-view.tsx', 'passages-view.tsx', 'outcome-view.tsx'])(
    '%s lays its buttons out with ResultActions',
    (name) => {
      const source = readFileSync(resolve(VIEWS, name), 'utf8');
      expect(source).toMatch(/<ResultActions/);
      expect(source).not.toMatch(/<Button[^>]*fullWidth/);
    },
  );
});

describe('the places of a passage are written like the rest of the app', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s: "Page" has a capital in both the heading and the row', (_name, strings) => {
    expect(strings.found.where).toMatch(/· Page \{\{page\}\}/);
    expect(strings.several.rowValue).toMatch(/· Page \{\{page\}\}/);
  });
});
