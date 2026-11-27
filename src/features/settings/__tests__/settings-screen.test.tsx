import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import {
  createInertNotificationPermissions,
  type NotificationPermissions,
} from '@/data/notifications';
import { DEFAULT_REMINDERS } from '@/store';
import {
  APPEARANCES_AND_DIRECTIONS,
  LARGEST_FONT_SCALE,
  directionDependentStyles,
  fixedHeightsAroundText,
  iosPaletteColor,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  withDescendants,
} from '@/ui/test-support/environment';

import { playFeedback } from '@/features/feedback';
import type { ConfirmAction, ConfirmActionOptions } from '@/ui';

import { SettingsScreen } from '../settings-screen';
import {
  createFixedDirection,
  renderWithStore,
  returnToApp,
  type RenderWithStoreOptions,
} from '../test-support/render-with-store';
import { useSettings } from '../use-settings';
import type { WritingDirectionPlatform } from '../writing-direction';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () =>
  jest
    .requireActual<typeof import('@/data/notifications/test-support/quiet-expo-notifications')>(
      '@/data/notifications/test-support/quiet-expo-notifications',
    )
    .loadQuietly(),
);

jest.mock('@/features/feedback', () => ({ playFeedback: jest.fn() }));

const NO_BREAK_SPACE = ' ';

interface SettingsHarnessProps {
  notifications: NotificationPermissions;
  direction: WritingDirectionPlatform;
  confirm: ConfirmAction;
  getDeviceLanguageCodes?: () => readonly (string | null)[];
  openSystemSettings: () => void;
  openIntroduction: () => void;
}

/** The settings tab as its route composes it, with dependencies the test controls. */
function SettingsHarness(dependencies: SettingsHarnessProps) {
  const { model, actions } = useSettings(dependencies);
  return <SettingsScreen model={model} actions={actions} />;
}

interface RenderSettingsOptions extends RenderWithStoreOptions {
  notifications?: NotificationPermissions;
  rightToLeft?: boolean;
  /** The languages of the phone, most wanted first. Defaults to French only. */
  deviceLanguages?: readonly (string | null)[];
}

async function renderSettings({
  notifications = createInertNotificationPermissions({ status: 'granted' }),
  rightToLeft = false,
  deviceLanguages = ['fr'],
  ...options
}: RenderSettingsOptions = {}) {
  const direction = createFixedDirection(rightToLeft);
  const openSystemSettings = jest.fn();
  const openIntroduction = jest.fn();
  // The confirmation the system would show: kept, so that each test answers it.
  const confirm = jest.fn<void, [ConfirmActionOptions]>();
  const store = await renderWithStore(
    <SettingsHarness
      notifications={notifications}
      direction={direction.platform}
      confirm={confirm}
      getDeviceLanguageCodes={() => deviceLanguages}
      openSystemSettings={openSystemSettings}
      openIntroduction={openIntroduction}
    />,
    { settings: { onboardingCompleted: true, ...options.settings }, ...options },
  );
  // The permission is read when the screen appears.
  await waitFor(async () => expect(await notifications.getStatus()).toBeDefined());
  return { store, direction, openSystemSettings, openIntroduction, notifications, confirm };
}

/** The last confirmation asked for. */
function lastConfirmation(confirm: jest.Mock<void, [ConfirmActionOptions]>): ConfirmActionOptions {
  const options = confirm.mock.calls.at(-1)?.[0];
  if (options === undefined) throw new Error('No confirmation was asked for.');
  return options;
}

function stepper() {
  return screen.getByRole('adjustable', { name: 'Pages par jour' });
}

afterEach(resetDeviceConditions);

describe('settings screen', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'shows the language, the daily goal, the reminders and the way back to the introduction ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderSettings({ rightToLeft: conditions.rightToLeft });

      expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
      expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
      // Nothing chosen in the app: it follows the phone (D32).
      expect(screen.getByRole('radio', { name: 'Langue du téléphone' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Français' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'العربية' })).not.toBeChecked();

      expect(screen.getByRole('header', { name: 'Objectif du jour' })).toBeOnTheScreen();
      expect(stepper()).toHaveAccessibilityValue({ text: '5' });
      expect(
        screen.getByText(
          `5 pages par jour, soit un demi-hizb${NO_BREAK_SPACE}: une khatma en 121 jours.`,
        ),
      ).toBeOnTheScreen();

      expect(screen.getByRole('header', { name: 'Rappels' })).toBeOnTheScreen();
      expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Heure des rappels' })).toBeOnTheScreen();
      expect(screen.getByRole('switch', { name: 'Quand le jardin a soif' })).toBeChecked();
      // The Friday reminder is on by default, like the two others (owner, 25 November).
      expect(
        screen.getByRole('switch', { name: `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf` }),
      ).toBeChecked();
      expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();

      expect(screen.getByRole('button', { name: 'Revoir la présentation' })).toBeOnTheScreen();
      expect(directionDependentStyles(screen.getByTestId('settings'))).toEqual([]);
    },
  );

  it('is written in Arabic, mirrored, for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderSettings({ language: 'ar', rightToLeft: true, settings: { language: 'ar' } });
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'اللغة');
    expect(screen.getByRole('radio', { name: 'العربية' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'لغة الهاتف' })).not.toBeChecked();
    expect(screen.getByRole('adjustable', { name: 'الصفحات في اليوم' })).toBeOnTheScreen();
    expect(screen.getByText('5 صفحات في اليوم، أي نصف حزب: ختمة في 121 يومًا.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'التذكير اليومي' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'مشاهدة التعريف من جديد' })).toBeOnTheScreen();
    // The app runs right to left, as Arabic is written: nothing to restart.
    expect(screen.queryByTestId('restart-app')).toBeNull();
    expect(directionDependentStyles(screen.getByTestId('settings'))).toEqual([]);
  });

  it('cuts no text at the largest text size, and keeps every control a full touch target', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await renderSettings();
    expect(fixedHeightsAroundText(screen.getByTestId('settings'))).toEqual([]);
    for (const control of [
      screen.getByRole('radio', { name: 'Langue du téléphone' }),
      screen.getByRole('radio', { name: 'English' }),
      screen.getByRole('switch', { name: 'Rappel du jour' }),
      screen.getByRole('button', { name: 'Heure des rappels' }),
      screen.getByRole('button', { name: 'Revoir la présentation' }),
      stepper(),
    ]) {
      expect(touchTargetHeight(control)).toBeGreaterThanOrEqual(44);
    }
  });

  it('asks an iPhone for system components only, each inside a host', async () => {
    await renderSettings({ onIOS: true });
    expect(screen.getByTestId('settings')).toBeOnTheScreen();
  });

  it('insets nothing above or below its list on an iPhone: the list passes under the bars and insets itself', async () => {
    await renderSettings({ onIOS: true });
    // A second inset here made a band of about 70 points above "Langue" and cut the last note
    // above the home indicator (iOS check of 683ad8d).
    expect(screen.getByTestId('settings')).toHaveProp('edges', {
      top: 'off',
      right: 'additive',
      bottom: 'off',
      left: 'additive',
    });
  });

  it('sits on the warm canvas of the app, its groups on white cards, like the profile that opens it', async () => {
    await renderSettings();
    expect(screen.getByTestId('settings')).toHaveStyle({
      backgroundColor: iosPaletteColor('canvas'),
    });
    const surface = JSON.stringify(iosPaletteColor('surface'));
    const cards = withDescendants(screen.getByTestId('settings-list')).filter(
      (element) => JSON.stringify(styleOf(element).backgroundColor) === surface,
    );
    // Language, gender, daily goal, reminders, sounds and vibrations, introduction, backup status, version.
    expect(cards).toHaveLength(8);
  });
});

describe('language setting', () => {
  const MISSING_NOTE =
    'L’appli n’est pas encore traduite dans la langue de ton téléphone. Choisis-en une ci-dessus.';

  it('offers the phone’s language first, then the three languages of the app', async () => {
    await renderSettings();
    const languages = within(screen.getByTestId('language'));
    expect(
      languages.getAllByRole('radio').map((option) => option.props.accessibilityLabel),
    ).toEqual(['Langue du téléphone', 'Français', 'English', 'العربية']);
    // The app has the phone's language: nothing to explain, nothing to restart.
    expect(screen.queryByText(MISSING_NOTE)).toBeNull();
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('gives the choice back to the phone, whose language shows at once', async () => {
    const { store, direction } = await renderSettings({
      language: 'en',
      settings: { language: 'en' },
      deviceLanguages: ['fr'],
    });
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Phone Language' }));
    expect(store.getState().settings.language).toBeNull();
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
    expect(screen.getByRole('radio', { name: 'Langue du téléphone' })).toBeChecked();
    expect(direction.recorded()).toBe(false);
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('restarts at once, after asking, when the phone’s language is written the other way', async () => {
    // French was chosen on a phone set to Arabic: the app runs left to right.
    const { store, direction, confirm } = await renderSettings({
      settings: { language: 'fr' },
      deviceLanguages: ['ar'],
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Langue du téléphone' }));

    // Asked in the language that is coming, which the person chose.
    expect(lastConfirmation(confirm)).toMatchObject({
      title: 'إعادة التشغيل بالعربية؟',
      confirmLabel: 'إعادة التشغيل',
      cancelLabel: 'إلغاء',
      isDestructive: false,
    });
    await act(async () => lastConfirmation(confirm).onConfirm());
    expect(store.getState().settings.language).toBeNull();
    expect(direction.recorded()).toBe(true);
    expect(direction.platform.restart).toHaveBeenCalledTimes(1);
  });

  it('says under the choice when the app does not have the phone’s language, until another is chosen', async () => {
    await renderSettings({ deviceLanguages: ['de', 'es'] });
    // The app shows its fallback language, French, and says why.
    expect(screen.getByRole('radio', { name: 'Langue du téléphone' })).toBeChecked();
    expect(screen.getByText(MISSING_NOTE)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    expect(screen.queryByText(MISSING_NOTE)).toBeNull();
    expect(
      screen.queryByText(
        'The app is not translated into your phone’s language yet. Choose one above.',
      ),
    ).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Phone Language' }));
    expect(screen.getByText(MISSING_NOTE)).toBeOnTheScreen();
  });

  it('looks further down the phone’s languages, as the start of the app does', async () => {
    await renderSettings({ language: 'ar', rightToLeft: true, deviceLanguages: ['de', 'ar'] });
    expect(screen.getByRole('radio', { name: 'لغة الهاتف' })).toBeChecked();
    expect(screen.queryByText('لم يُترجَم التطبيق بعد إلى لغة هاتفك. اختر لغة أعلاه.')).toBeNull();
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('says first that a restart is needed when both notes apply', async () => {
    // The phone's language is missing, and the app still runs right to left.
    await renderSettings({ rightToLeft: true, deviceLanguages: ['de'] });
    expect(
      screen.getByText('Le sens d’écriture changera au prochain démarrage de l’appli.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(MISSING_NOTE)).toBeNull();
  });

  it('switches to a language written in the same direction at once, with nothing to restart', async () => {
    const { store, direction } = await renderSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));

    expect(store.getState().settings.language).toBe('en');
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Language');
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(direction.recorded()).toBe(false);
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('never leaves the app half mirrored: Arabic asks first, and changes nothing until the restart', async () => {
    const { store, direction, confirm } = await renderSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));

    // Nothing changed yet: the texts, the language kept and the direction are still French.
    expect(store.getState().settings.language).toBeNull();
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
    expect(direction.platform.setRightToLeft).not.toHaveBeenCalled();
    expect(direction.platform.restart).not.toHaveBeenCalled();
    expect(lastConfirmation(confirm)).toMatchObject({
      title: 'إعادة التشغيل بالعربية؟',
      message: 'سيُعاد تشغيل التطبيق ليظهر كلّه بالعربية، من اليمين إلى اليسار. يبقى تقدّمك محفوظًا.',
    });

    // Confirmed: the language is kept, the direction recorded, then the app starts again.
    await act(async () => lastConfirmation(confirm).onConfirm());
    expect(store.getState().settings.language).toBe('ar');
    expect(direction.recorded()).toBe(true);
    expect(direction.platform.restart).toHaveBeenCalledTimes(1);
  });

  it('saves the language on the phone before restarting', async () => {
    const { store, direction, confirm } = await renderSettings();
    const order: string[] = [];
    let finishSaving: () => void = () => {};
    jest.spyOn(store, 'whenSaved').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSaving = () => {
            order.push('saved');
            resolve();
          };
        }),
    );
    jest.mocked(direction.platform.restart).mockImplementation(async () => {
      order.push('restart');
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    await act(async () => lastConfirmation(confirm).onConfirm());
    expect(direction.platform.restart).not.toHaveBeenCalled();
    await act(async () => finishSaving());
    expect(order).toEqual(['saved', 'restart']);
  });

  it('keeps everything as it was when the person cancels', async () => {
    const { store, direction, confirm } = await renderSettings({ settings: { language: 'fr' } });
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    // Cancel: the system closes the sheet and `onConfirm` is never called.
    expect(store.getState().settings.language).toBe('fr');
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
    expect(direction.platform.setRightToLeft).not.toHaveBeenCalled();
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('from Arabic to French: asks in French, then restarts left to right', async () => {
    const { store, direction, confirm } = await renderSettings({
      language: 'ar',
      rightToLeft: true,
      settings: { language: 'ar' },
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
    expect(store.getState().settings.language).toBe('ar');
    expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'اللغة');
    expect(lastConfirmation(confirm)).toMatchObject({
      title: 'Redémarrer en français ?',
      message:
        'L’appli redémarre pour tout afficher en français, de gauche à droite. Ta progression est gardée.',
      confirmLabel: 'Redémarrer',
      cancelLabel: 'Annuler',
    });
    await act(async () => lastConfirmation(confirm).onConfirm());
    expect(store.getState().settings.language).toBe('fr');
    expect(direction.recorded()).toBe(false);
    expect(direction.platform.restart).toHaveBeenCalledTimes(1);
  });

  it('says a restart is needed when the app runs in the other direction than its language', async () => {
    // French chosen, but the app was started right to left and could not restart.
    await renderSettings({ rightToLeft: true, settings: { language: 'fr' } });
    expect(
      screen.getByText('Le sens d’écriture changera au prochain démarrage de l’appli.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Redémarrer l’appli' })).toBeOnTheScreen();
  });

  it('keeps the note and its button when the restart fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { direction, confirm } = await renderSettings();
    jest.mocked(direction.platform.restart).mockRejectedValue(new Error('no reload'));
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    await act(async () => lastConfirmation(confirm).onConfirm());
    await waitFor(() => expect(warn).toHaveBeenCalled());
    // The layout was not mirrored, so the texts stay in the language of the running direction.
    expect(
      screen.getByText('Le sens d’écriture changera au prochain démarrage de l’appli.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('restart-app'));
    expect(direction.platform.restart).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('gender setting ("Je suis")', () => {
  it('offers a man, a woman or "prefer not to say", the last one chosen until the person says', async () => {
    await renderSettings();

    expect(screen.getByTestId('gender')).toHaveProp('accessibilityLabel', 'Je suis');
    expect(screen.getByRole('radio', { name: 'Un homme' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Une femme' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Préférer ne pas dire' })).toBeChecked();
    // Says why it is asked, and who sees it.
    expect(
      screen.getByText('Pour s’adresser à toi correctement. Tes proches le voient aussi.'),
    ).toBeOnTheScreen();
  });

  it('saves a woman, then a man, and the choice is shown at once', async () => {
    const { store } = await renderSettings();

    await fireEvent.press(screen.getByRole('radio', { name: 'Une femme' }));
    expect(store.getState().settings).toMatchObject({ gender: 'female', genderAsked: true });
    expect(screen.getByRole('radio', { name: 'Une femme' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Un homme' }));
    expect(store.getState().settings.gender).toBe('male');
    expect(screen.getByRole('radio', { name: 'Un homme' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Une femme' })).not.toBeChecked();
  });

  it('goes back to "prefer not to say", which is nothing said and the question answered', async () => {
    const { store } = await renderSettings({ settings: { gender: 'female', genderAsked: true } });
    expect(screen.getByRole('radio', { name: 'Une femme' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Préférer ne pas dire' }));

    expect(store.getState().settings).toMatchObject({ gender: null, genderAsked: true });
    expect(screen.getByRole('radio', { name: 'Préférer ne pas dire' })).toBeChecked();
  });

  it('is written in English and in Arabic', async () => {
    await renderSettings({ language: 'en' });
    expect(screen.getByTestId('gender')).toHaveProp('accessibilityLabel', 'I am');
    expect(screen.getByRole('radio', { name: 'A woman' })).toBeOnTheScreen();
  });

  it('is written in Arabic, with the feminine and masculine nouns', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderSettings({ language: 'ar', rightToLeft: true, settings: { language: 'ar' } });
    expect(screen.getByTestId('gender')).toHaveProp('accessibilityLabel', 'أنا');
    expect(screen.getByRole('radio', { name: 'رجل' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'امرأة' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'أفضّل ألّا أقول' })).toBeChecked();
  });
});

describe('daily goal setting', () => {
  it('changes the goal with the stepper and rewrites the note under it', async () => {
    const { store } = await renderSettings();
    await fireEvent.press(screen.getByTestId('daily-goal-increment'));
    expect(store.getState().settings.dailyGoalPages).toBe(6);
    expect(stepper()).toHaveAccessibilityValue({ text: '6' });
    expect(
      screen.getByText(`6 pages par jour${NO_BREAK_SPACE}: une khatma en 101 jours.`),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('daily-goal-decrement'));
    await fireEvent.press(screen.getByTestId('daily-goal-decrement'));
    expect(store.getState().settings.dailyGoalPages).toBe(4);
  });

  it('lets a screen reader change the goal without the two small buttons', async () => {
    const { store } = await renderSettings();
    await fireEvent(stepper(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(store.getState().settings.dailyGoalPages).toBe(6);
  });

  it.each([
    [1, `1 page par jour${NO_BREAK_SPACE}: une khatma en 604 jours.`],
    [10, `10 pages par jour, soit un hizb${NO_BREAK_SPACE}: une khatma en 61 jours.`],
    [20, `20 pages par jour, soit un juz${NO_BREAK_SPACE}: une khatma en 31 jours.`],
    [60, `60 pages par jour${NO_BREAK_SPACE}: une khatma en 11 jours.`],
  ])('explains a goal of %i pages', async (dailyGoalPages, note) => {
    await renderSettings({ settings: { dailyGoalPages } });
    expect(screen.getByText(note)).toBeOnTheScreen();
  });

  it.each([
    [1, 'daily-goal-decrement'],
    [60, 'daily-goal-increment'],
  ])('stops at %i pages', async (dailyGoalPages, button) => {
    const { store } = await renderSettings({ settings: { dailyGoalPages } });
    await fireEvent.press(screen.getByTestId(button));
    expect(store.getState().settings.dailyGoalPages).toBe(dailyGoalPages);
  });
});

describe('reminder settings', () => {
  it('saves each switch, and shows a time only while a reminder uses it', async () => {
    const { store } = await renderSettings();
    // The garden's reminders come at the same time as the daily one: the time stays.
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(store.getState().settings.reminders.dailyEnabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Heure des rappels' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Quand le jardin a soif' }));
    expect(store.getState().settings.reminders).toEqual({
      ...DEFAULT_REMINDERS,
      dailyEnabled: false,
      thirstyGardenEnabled: false,
    });
    expect(screen.queryByRole('button', { name: 'Heure des rappels' })).toBeNull();

    // Friday starts on, with its own time, which goes when that reminder is switched off.
    const friday = () =>
      screen.getByRole('switch', { name: `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf` });
    expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();
    await fireEvent.press(friday());
    expect(store.getState().settings.reminders.fridayKahfEnabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Heure du vendredi' })).toBeNull();
    await fireEvent.press(friday());
    expect(store.getState().settings.reminders.fridayKahfEnabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(screen.getByRole('button', { name: 'Heure des rappels' })).toBeOnTheScreen();
  });

  it('shows each time as the person set it', async () => {
    await renderSettings({
      settings: {
        reminders: {
          ...DEFAULT_REMINDERS,
          dailyTime: { hour: 6, minute: 15 },
          fridayKahfEnabled: true,
          fridayTime: { hour: 11, minute: 40 },
        },
      },
    });
    const shownTime = (name: string) =>
      String(screen.getByRole('button', { name }).props.accessibilityValue?.text);
    expect(shownTime('Heure des rappels')).toMatch(/6.15/);
    expect(shownTime('Heure du vendredi')).toMatch(/11.40/);
  });

  it('says nothing more when the system allows the notifications', async () => {
    await renderSettings({
      notifications: createInertNotificationPermissions({ status: 'granted' }),
    });
    expect(screen.queryByText(/notification/i)).toBeNull();
    expect(screen.queryByTestId('open-system-settings')).toBeNull();
  });

  it('says when the system blocks the notifications, and opens its settings', async () => {
    const { openSystemSettings } = await renderSettings({
      notifications: createInertNotificationPermissions({ status: 'denied' }),
    });
    expect(
      await screen.findByText(
        'Les notifications de l’appli sont désactivées. Pour recevoir tes rappels, autorise-les dans les réglages du téléphone.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages du téléphone' }));
    expect(openSystemSettings).toHaveBeenCalledTimes(1);
  });

  it('reads the permission again when the person comes back from the system settings', async () => {
    let status: 'denied' | 'granted' = 'denied';
    const notifications: NotificationPermissions = {
      getStatus: async () => status,
      request: async () => status,
    };
    await renderSettings({ notifications });
    expect(await screen.findByTestId('open-system-settings')).toBeOnTheScreen();

    status = 'granted';
    await returnToApp();
    await waitFor(() => expect(screen.queryByTestId('open-system-settings')).toBeNull());
  });

  it('says that no notification will come when every reminder is off', async () => {
    await renderSettings({
      notifications: createInertNotificationPermissions({ status: 'denied' }),
      settings: {
        reminders: {
          ...DEFAULT_REMINDERS,
          dailyEnabled: false,
          thirstyGardenEnabled: false,
          fridayKahfEnabled: false,
        },
      },
    });
    expect(
      await screen.findByText('Sans rappel, l’appli ne t’envoie aucune notification.'),
    ).toBeOnTheScreen();
    // Nothing is blocked while nothing is asked for: no way out to the system settings.
    expect(screen.queryByTestId('open-system-settings')).toBeNull();
  });

  it.each(['granted', 'denied'] as const)(
    'asks for the permission when a first reminder is switched on, and follows the answer: %s',
    async (answer) => {
      const notifications = createInertNotificationPermissions({ status: 'undetermined', answer });
      const request = jest.spyOn(notifications, 'request');
      const { store } = await renderSettings({
        notifications,
        settings: { reminders: { ...DEFAULT_REMINDERS, dailyEnabled: false } },
      });
      // Reminders that are already on do not make the system ask by themselves.
      expect(request).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
      expect(store.getState().settings.reminders.dailyEnabled).toBe(true);
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      if (answer === 'denied') {
        expect(await screen.findByTestId('open-system-settings')).toBeOnTheScreen();
      } else {
        expect(screen.queryByTestId('open-system-settings')).toBeNull();
      }
    },
  );

  const NOT_ASKED =
    'Ton téléphone ne t’a pas encore demandé si l’appli peut t’envoyer des notifications. D’ici là, tes rappels n’arrivent pas.';

  it.each(['granted', 'denied'] as const)(
    'tells the truth when reminders are on but the phone was never asked, and asks from there: %s',
    async (answer) => {
      // As after the progress came back from its copy: the introduction, which asks, was skipped.
      const notifications = createInertNotificationPermissions({ status: 'undetermined', answer });
      const request = jest.spyOn(notifications, 'request');
      const { openSystemSettings } = await renderSettings({ notifications });

      expect(await screen.findByText(NOT_ASKED)).toBeOnTheScreen();
      expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
      expect(screen.queryByTestId('open-system-settings')).toBeNull();
      // Nothing is asked until the person asks for it; the row says that it asks, not "allow".
      expect(request).not.toHaveBeenCalled();
      const ask = screen.getByRole('button', { name: 'Demander l’autorisation' });
      expect(touchTargetHeight(ask)).toBeGreaterThanOrEqual(44);

      await fireEvent.press(ask);
      await waitFor(() => expect(screen.queryByText(NOT_ASKED)).toBeNull());
      expect(request).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('request-notification-permission')).toBeNull();
      if (answer === 'denied') {
        // Refused: the only way left is the phone's settings.
        await fireEvent.press(await screen.findByTestId('open-system-settings'));
        expect(openSystemSettings).toHaveBeenCalledTimes(1);
      } else {
        expect(screen.queryByTestId('open-system-settings')).toBeNull();
        expect(screen.queryByText(/notification/i)).toBeNull();
      }
    },
  );

  it('does not offer to ask while every reminder is off', async () => {
    await renderSettings({
      notifications: createInertNotificationPermissions({ status: 'undetermined' }),
      settings: {
        reminders: {
          ...DEFAULT_REMINDERS,
          dailyEnabled: false,
          thirstyGardenEnabled: false,
          fridayKahfEnabled: false,
        },
      },
    });
    expect(
      await screen.findByText('Sans rappel, l’appli ne t’envoie aucune notification.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('request-notification-permission')).toBeNull();
  });

  it.each([
    ['en', 'Ask for Permission'],
    ['ar', 'طلب الإذن'],
  ] as const)('offers to ask in the language of the person (%s)', async (language, label) => {
    setDeviceConditions({ rightToLeft: language === 'ar', fontScale: LARGEST_FONT_SCALE });
    await renderSettings({
      language,
      rightToLeft: language === 'ar',
      settings: { language },
      notifications: createInertNotificationPermissions({ status: 'undetermined' }),
    });
    expect(await screen.findByRole('button', { name: label })).toBeOnTheScreen();
    expect(fixedHeightsAroundText(screen.getByTestId('settings'))).toEqual([]);
    expect(directionDependentStyles(screen.getByTestId('settings'))).toEqual([]);
  });

  it('asks an iPhone for system components only when the phone was never asked', async () => {
    await renderSettings({
      onIOS: true,
      notifications: createInertNotificationPermissions({ status: 'undetermined' }),
    });
    expect(await screen.findByTestId('request-notification-permission')).toBeOnTheScreen();
  });

  it('does not ask when a reminder is switched off, or once the person has answered', async () => {
    const notifications = createInertNotificationPermissions({ status: 'granted' });
    const request = jest.spyOn(notifications, 'request');
    await renderSettings({ notifications });
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(request).not.toHaveBeenCalled();
  });

  it('shows no notice while the system cannot tell the permission', async () => {
    const notifications: NotificationPermissions = {
      getStatus: () => Promise.reject(new Error('unavailable')),
      request: () => Promise.reject(new Error('unavailable')),
    };
    await renderWithStore(
      <SettingsHarness
        notifications={notifications}
        direction={createFixedDirection(false).platform}
        confirm={jest.fn()}
        openSystemSettings={jest.fn()}
        openIntroduction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/notification/i)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
  });
});

describe('notice about stored data that could not be read back', () => {
  it('says nothing when all is well', async () => {
    await renderSettings();
    expect(screen.queryByRole('header', { name: 'À savoir' })).toBeNull();
    expect(screen.queryByTestId('dismiss-data-reset-notice')).toBeNull();
  });

  it.each([
    [
      'journal',
      `L’appli n’a pas pu relire ton journal de lecture. Ton jardin repart d’une terre nue${NO_BREAK_SPACE}; tes réglages n’ont pas changé.`,
    ],
    [
      'settings',
      `L’appli n’a pas pu relire tes réglages. Ils reprennent leurs valeurs de départ${NO_BREAK_SPACE}; ton journal de lecture n’a pas changé.`,
    ],
    [
      'everything',
      `L’appli n’a pas pu relire ce qu’elle avait enregistré. Elle repart de zéro${NO_BREAK_SPACE}: réglages de départ et jardin en terre nue.`,
    ],
  ] as const)(
    'says in plain words what started again (%s), above the settings, until it is read',
    async (dataResetNotice, wording) => {
      const { store } = await renderSettings({ dataResetNotice });
      expect(screen.getByRole('header', { name: 'À savoir' })).toBeOnTheScreen();
      expect(screen.getByText(wording)).toBeOnTheScreen();
      // No jargon and no blame: nothing about files, errors or what the person did.
      expect(wording).not.toMatch(/erreur|corromp|fichier|JSON|données|tu as/i);

      const dismiss = screen.getByRole('button', { name: 'D’accord' });
      expect(touchTargetHeight(dismiss)).toBeGreaterThanOrEqual(44);
      await fireEvent.press(dismiss);
      expect(store.getState().dataResetNotice).toBeNull();
      expect(screen.queryByRole('header', { name: 'À savoir' })).toBeNull();
      expect(screen.queryByText(wording)).toBeNull();
      // The settings themselves are still there.
      expect(screen.getByRole('radio', { name: 'Français' })).toBeOnTheScreen();
    },
  );

  it.each([
    ['en', 'Good to Know', 'OK'],
    ['ar', 'للعلم', 'حسنًا'],
  ] as const)('is written in the language of the person (%s)', async (language, title, dismiss) => {
    setDeviceConditions({ rightToLeft: language === 'ar' });
    await renderSettings({
      language,
      rightToLeft: language === 'ar',
      settings: { language },
      dataResetNotice: 'journal',
    });
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: dismiss })).toBeOnTheScreen();
    expect(directionDependentStyles(screen.getByTestId('settings'))).toEqual([]);
  });

  it('cuts no text of the notice at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await renderSettings({ dataResetNotice: 'everything' });
    expect(fixedHeightsAroundText(screen.getByTestId('settings'))).toEqual([]);
  });

  it('asks an iPhone for system components only, with the notice shown', async () => {
    await renderSettings({ onIOS: true, dataResetNotice: 'everything' });
    expect(screen.getByTestId('settings')).toBeOnTheScreen();
  });
});

describe('introduction', () => {
  it('can be opened again from the settings', async () => {
    const { openIntroduction } = await renderSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Revoir la présentation' }));
    expect(openIntroduction).toHaveBeenCalledTimes(1);
  });
});

describe('sounds and vibrations settings', () => {
  beforeEach(() => jest.mocked(playFeedback).mockClear());

  it('offers two switches, both on by default, and says when the sounds stay quiet', async () => {
    await renderSettings();
    expect(screen.getByText('Sons et vibrations')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Sons' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibrations' })).toBeChecked();
    expect(
      screen.getByText(
        'Les sons se taisent quand ton téléphone est en silencieux, et pendant l’écoute de ta récitation.',
      ),
    ).toBeOnTheScreen();
  });

  it('saves each switch on its own', async () => {
    const { store } = await renderSettings();
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    expect(store.getState().settings).toMatchObject({ soundsEnabled: false, hapticsEnabled: true });
    expect(screen.getByRole('switch', { name: 'Sons' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Vibrations' }));
    expect(store.getState().settings).toMatchObject({
      soundsEnabled: false,
      hapticsEnabled: false,
    });
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    expect(store.getState().settings.soundsEnabled).toBe(true);
  });

  it('shows what was saved: a switch that was off starts off', async () => {
    await renderSettings({ settings: { soundsEnabled: false } });
    expect(screen.getByRole('switch', { name: 'Sons' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibrations' })).toBeChecked();
  });

  it('lets the person feel what they just switched on, and nothing when they switch off', async () => {
    await renderSettings({ settings: { soundsEnabled: false, hapticsEnabled: false } });
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    expect(playFeedback).toHaveBeenLastCalledWith('drop');
    await fireEvent.press(screen.getByRole('switch', { name: 'Vibrations' }));
    expect(playFeedback).toHaveBeenLastCalledWith('select');
    jest.mocked(playFeedback).mockClear();
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Vibrations' }));
    expect(playFeedback).not.toHaveBeenCalled();
  });

  it('is written in English', async () => {
    await renderSettings({ language: 'en' });
    expect(screen.getByText('Sounds and Vibrations')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Sounds' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibrations' })).toBeChecked();
  });

  it('is written in Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderSettings({ language: 'ar', rightToLeft: true, settings: { language: 'ar' } });
    expect(screen.getByText('الأصوات والاهتزاز')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'الأصوات' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'الاهتزاز' })).toBeChecked();
  });
});
