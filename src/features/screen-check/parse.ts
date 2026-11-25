/**
 * What the iOS check can ask of the app to photograph a screen (docs/BUILD.md, "Contrôle des
 * écrans"). Everything here is pure and takes `enabled`: the build flag is read in one place
 * (`door.ts`), and with it off every function answers "nothing asked".
 */

/** The screens the check can open, named by a word: no address travels through a launch argument. */
export const CHECK_SCREENS = [
  'onboarding',
  'garden',
  'quran',
  'reader',
  'listening',
  'friends',
  'friend',
  'profile',
  'settings',
] as const;

export type CheckScreen = (typeof CHECK_SCREENS)[number];

export const CHECK_SCRIPTS = ['uthmani', 'imlaei'] as const;
export type CheckScript = (typeof CHECK_SCRIPTS)[number];

/** The friend whose garden page the check opens: a person of the demonstration. */
export const CHECK_FRIEND_ID = 'demo-mustapha';

/** The page of the reader the check opens when none is asked: an ordinary page of Al-Baqara. */
export const CHECK_READER_PAGE = 3;

/** What a launch of the check asks for. */
export interface CheckLaunch {
  readonly screen: CheckScreen;
  /** The introduction's page (1 to the number of pages) or the reader's page; null if unasked. */
  readonly page: number | null;
  readonly script: CheckScript | null;
  /** True: fill the app with the made-up reading history and the demonstration friends first. */
  readonly seedsDemo: boolean;
}

/** The names of the launch arguments, `-screenCheckGo garden` and so on. */
export const CHECK_ARGUMENTS = {
  screen: 'screenCheckGo',
  page: 'screenCheckPage',
  script: 'screenCheckScript',
  seed: 'screenCheckSeed',
} as const;

function firstText(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  return typeof value === 'string' ? value : null;
}

/**
 * A page asked by an address or an argument (`?page=3`): a whole number from 1 to `count`, or
 * null. With the check off the parameter is ignored, whatever it holds.
 */
export function parseCheckPage(raw: unknown, enabled: boolean, count: number): number | null {
  if (!enabled) return null;
  const text = firstText(raw);
  if (text === null || !/^[0-9]{1,4}$/.test(text)) return null;
  const page = Number(text);
  return page >= 1 && page <= count ? page : null;
}

/**
 * The launch the check asked for, read through `read` (one launch argument by name). Null when
 * the check is off, when nothing is asked, or when the screen asked for is not one the check knows.
 */
export function parseCheckLaunch(
  read: (argument: string) => unknown,
  enabled: boolean,
): CheckLaunch | null {
  if (!enabled) return null;
  const screen = firstText(read(CHECK_ARGUMENTS.screen));
  if (screen === null || !(CHECK_SCREENS as readonly string[]).includes(screen)) return null;
  const script = firstText(read(CHECK_ARGUMENTS.script));
  return {
    screen: screen as CheckScreen,
    // The upper bound is the reader's (604); the introduction narrows it again where it is used.
    page: parseCheckPage(read(CHECK_ARGUMENTS.page), true, 604),
    script: (CHECK_SCRIPTS as readonly (string | null)[]).includes(script)
      ? (script as CheckScript)
      : null,
    seedsDemo: firstText(read(CHECK_ARGUMENTS.seed)) === 'demo',
  };
}

/** The address that shows a screen of the check. */
export function checkAddress({ screen, page }: CheckLaunch): string {
  switch (screen) {
    case 'onboarding':
      return page === null ? '/onboarding' : `/onboarding?page=${page}`;
    case 'garden':
      return '/(tabs)';
    case 'quran':
      return '/(tabs)/quran';
    case 'reader':
      return `/reader/${page ?? CHECK_READER_PAGE}`;
    case 'listening':
      return '/listening';
    case 'friends':
      return '/(tabs)/friends';
    case 'friend':
      return `/(tabs)/friends/${CHECK_FRIEND_ID}`;
    case 'profile':
      return '/(tabs)/profile';
    case 'settings':
      return '/settings';
  }
}

/** Whether the screen sits over the tabs (pushed), so the tabs are put behind it first. */
export function isPushedOverTabs({ screen }: CheckLaunch): boolean {
  return (
    screen === 'reader' || screen === 'listening' || screen === 'friend' || screen === 'settings'
  );
}
