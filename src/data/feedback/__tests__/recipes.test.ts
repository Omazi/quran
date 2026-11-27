import { FEEDBACK_EVENTS, FEEDBACK_RECIPES, SOUND_NAMES } from '../recipes';

describe('what each event does', () => {
  it('names the eleven events of the mockup', () => {
    expect([...FEEDBACK_EVENTS].sort()).toEqual(
      [
        'celebrate',
        'drop',
        'drop-received',
        'encourage',
        'error',
        'found',
        'grow',
        'open',
        'page',
        'select',
        'splash',
      ].sort(),
    );
  });

  it('maps each event to its sound and its haptic', () => {
    const table = Object.fromEntries(
      FEEDBACK_EVENTS.map((event) => [
        event,
        [FEEDBACK_RECIPES[event].sound, FEEDBACK_RECIPES[event].haptic],
      ]),
    );
    expect(table).toEqual({
      // The drop falling: the sound only, the touch comes when it lands.
      drop: ['drop', null],
      'drop-received': ['plop', 'light'],
      grow: ['grow', 'light'],
      open: ['open', 'light'],
      page: ['page', 'selection'],
      found: ['found', 'success'],
      splash: ['splash', 'light'],
      celebrate: ['celebrate', 'success'],
      encourage: ['encourage', 'success'],
      // A tick under the finger: the haptic alone.
      select: [null, 'selection'],
      error: ['error', 'warning'],
    });
  });

  it('only uses sounds that exist in the palette, and every sound is used', () => {
    const used = FEEDBACK_EVENTS.map((event) => FEEDBACK_RECIPES[event].sound).filter(
      (sound) => sound !== null,
    );
    for (const sound of used) expect(SOUND_NAMES).toContain(sound);
    expect([...new Set(used)].sort()).toEqual([...SOUND_NAMES].sort());
  });

  it('gives every event a pause before it can play again', () => {
    for (const event of FEEDBACK_EVENTS) {
      expect(FEEDBACK_RECIPES[event].minIntervalMs).toBeGreaterThan(0);
    }
  });
});
