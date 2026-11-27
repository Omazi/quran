import { readdirSync, statSync } from 'fs';
import { join } from 'path';

import { loadSoundFiles } from '../device-feedback';
import { SOUND_NAMES } from '../recipes';

const SOUNDS_DIRECTORY = join(__dirname, '../../../../assets/sounds');

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
