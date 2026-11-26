/**
 * The system bar of a page pushed over the tabs (the settings) takes plain colours of the
 * appearance in use. A dynamic colour given to the navigation bar was resolved once, as light:
 * in the dark appearance the settings had a cream bar over a dark page, with a status bar whose
 * white text could not be read (iOS check of 683ad8d).
 */
import { pushedPageOptions } from '../pushed-page-options';
import { palette } from '../tokens';
import { colorValuesFor } from '../use-colors';

describe('the options of a page pushed over the tabs', () => {
  it.each(['light', 'dark'] as const)(
    'gives the bar plain colours of the %s appearance, never a dynamic colour',
    (appearance) => {
      const options = pushedPageOptions(colorValuesFor(appearance));
      expect(options.headerStyle.backgroundColor).toBe(palette.canvas[appearance]);
      expect(options.headerTitleStyle.color).toBe(palette.heading[appearance]);
      expect(options.headerTintColor).toBe(palette.actionTint[appearance]);
      expect(options.contentStyle.backgroundColor).toBe(palette.canvas[appearance]);
      for (const value of [
        options.headerStyle.backgroundColor,
        options.headerTitleStyle.color,
        options.headerTintColor,
      ]) {
        expect(typeof value).toBe('string');
      }
    },
  );
});
