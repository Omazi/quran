import { loadSoundFiles } from '../device-feedback';
import { SOUND_NAMES } from '../recipes';

// The project compiles without Node's type definitions: what is needed is typed here
// (same as src/ui/__tests__/tokens.test.ts).
const { readdirSync, statSync } = jest.requireActual<{
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { size: number };
}>('node:fs');
const { join } = jest.requireActual<{ join: (...segments: string[]) => string }>('node:path');

const SOUNDS_DIRECTORY = join(expect.getState().testPath ?? '', '../../../../../assets/sounds');

describe('the files of the palette', () => {
  it('has one m4a file for each sound, and nothing else but the notice', () => {
    const files = readdirSync(SOUNDS_DIRECTORY).sort();
    expect(files).toEqual([...SOUND_NAMES.map((name) => `${name}.m4a`), 'NOTICE.txt'].sort());
  });

  it('keeps every file under 30 KB', () => {
    for (const name of SOUND_NAMES) {
      expect(statSync(join(SOUNDS_DIRECTORY, `${name}.m4a`)).size).toBeLessThanOrEqual(30 * 1024);
    }
  });

  it('is loaded for every sound of the recipes', () => {
    const files = loadSoundFiles();
    expect(Object.keys(files).sort()).toEqual([...SOUND_NAMES].sort());
  });
});
