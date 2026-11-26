/**
 * Where a tap on a reminder leads (docs/specs/reminders.md, "Toucher une notification"): the reader
 * on the page the text names, never with the microphone; Al-Kahf on Friday; the home screen for a
 * dead garden.
 */
import { AL_KAHF_PAGE } from '../config';
import { hrefOfTarget } from '../notification-routes';

describe('hrefOfTarget', () => {
  it('opens the reader on the page to resume', () => {
    expect(hrefOfTarget('resume', 12)).toBe('/reader/12');
  });

  it('opens the reader only: no recitation follow, so the microphone never starts by itself', () => {
    for (const target of ['resume', 'al-kahf', 'home'] as const) {
      expect(hrefOfTarget(target, 12)).not.toMatch(/[?&]follow=|listening|voice-follow/);
    }
  });

  it('opens Al-Kahf on Friday, whatever the page to resume', () => {
    expect(hrefOfTarget('al-kahf', 12)).toBe(`/reader/${AL_KAHF_PAGE}`);
  });

  it('opens the home screen for a dead garden', () => {
    expect(hrefOfTarget('home', 12)).toBe('/(tabs)');
  });
});
