import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PlatformColor } from 'react-native';

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
  resetDeviceConditions,
  setDeviceConditions,
  touchTargetHeight,
} from '@/ui/test-support/environment';

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

const NO_BREAK_SPACE = ' ';

interface SettingsHarnessProps {
  notifications: NotificationPermissions;
  direction: WritingDirectionPlatform;
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
}

async function renderSettings({
  notifications = createInertNotificationPermissions({ status: 'granted' }),
  rightToLeft = false,
  ...options
}: RenderSettingsOptions = {}) {
  const direction = createFixedDirection(rightToLeft);
  const openSystemSettings = jest.fn();
  const openIntroduction = jest.fn();
  const store = await renderWithStore(
    <SettingsHarness
      notifications={notifications}
      direction={direction.platform}
      openSystemSettings={openSystemSettings}
      openIntroduction={openIntroduction}
    />,
    { settings: { onboardingCompleted: true, ...options.settings }, ...options },
  );
  // The permission is read when the screen appears.
  await waitFor(async () => expect(await notifications.getStatus()).toBeDefined());
  return { store, direction, openSystemSettings, openIntroduction, notifications };
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

      expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
      expect(screen.getByTestId('language')).toHaveProp('accessibilityLabel', 'Langue');
      expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
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
      expect(screen.getByRole('button', { name: 'Heure' })).toBeOnTheScreen();
      expect(screen.getByRole('switch', { name: 'Quand le jardin a soif' })).toBeChecked();
      expect(
        screen.getByRole('switch', { name: `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf` }),
      ).toBeChecked();

      expect(screen.getByRole('button', { name: 'Revoir la présentation' })).toBeOnTheScreen();
      expect(directionDependentStyles(screen.getByTestId('settings'))).toEqual([]);
    },
  );

  it('is written in Arabic, mirrored, for a person who reads Arabic', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderSettings({ language: 'ar', rightToLeft: true, settings: { language: 'ar' } });
    expect(screen.getByRole('header', { name: 'الإعدادات' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'العربية' })).toBeChecked();
    expect(screen.getByRole('adjustable', { name: 'الصفحات في اليوم' })).toBeOnTheScreen();
    expect(screen.getByText('5 صفحات في اليوم، أي نصف حزب: ختمة في 121 يومًا.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'تذكير اليوم' })).toBeChecked();
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
      screen.getByRole('radio', { name: 'English' }),
      screen.getByRole('switch', { name: 'Rappel du jour' }),
      screen.getByRole('button', { name: 'Heure' }),
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

  it('sits on the grouped background, as a screen that shows a grouped list', async () => {
    await renderSettings();
    expect(screen.getByTestId('settings')).toHaveStyle({
      backgroundColor: PlatformColor('systemGroupedBackground'),
    });
  });
});

describe('language setting', () => {
  it('switches to a language written in the same direction at once, with nothing to restart', async () => {
    const { store, direction } = await renderSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));

    expect(store.getState().settings.language).toBe('en');
    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(direction.recorded()).toBe(false);
    expect(screen.queryByTestId('restart-app')).toBeNull();
  });

  it('shows Arabic at once, says that the direction waits for a restart, and offers it', async () => {
    const { store, direction } = await renderSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));

    expect(store.getState().settings.language).toBe('ar');
    // The texts are in Arabic, so the note can be read by the person who chose it.
    expect(screen.getByRole('header', { name: 'الإعدادات' })).toBeOnTheScreen();
    expect(
      screen.getByText('سيتغيّر اتجاه الكتابة عند تشغيل التطبيق في المرة القادمة.'),
    ).toBeOnTheScreen();
    // The direction is recorded for the next start, and nothing restarts by itself.
    expect(direction.recorded()).toBe(true);
    expect(direction.platform.restart).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'إعادة تشغيل التطبيق' }));
    expect(direction.platform.restart).toHaveBeenCalledTimes(1);
  });

  it('withdraws the restart when the person returns to a language of the running direction', async () => {
    const { direction } = await renderSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    expect(screen.getByTestId('restart-app')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
    expect(screen.queryByTestId('restart-app')).toBeNull();
    expect(direction.recorded()).toBe(false);
    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
  });

  it('says a restart is needed when the app runs in the other direction than its language', async () => {
    // French chosen, but the app was started right to left and could not restart.
    await renderSettings({ rightToLeft: true, settings: { language: 'fr' } });
    expect(
      screen.getByText('Le sens d’écriture changera au prochain démarrage de l’appli.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Redémarrer l’appli' })).toBeOnTheScreen();
  });

  it('keeps the note when the restart fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { direction } = await renderSettings();
    jest.mocked(direction.platform.restart).mockRejectedValue(new Error('no reload'));
    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    await fireEvent.press(screen.getByTestId('restart-app'));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByTestId('restart-app')).toBeOnTheScreen();
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
    expect(screen.getByRole('button', { name: 'Heure' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Quand le jardin a soif' }));
    expect(store.getState().settings.reminders).toEqual({
      ...DEFAULT_REMINDERS,
      dailyEnabled: false,
      thirstyGardenEnabled: false,
    });
    expect(screen.queryByRole('button', { name: 'Heure' })).toBeNull();

    expect(screen.getByRole('button', { name: 'Heure du vendredi' })).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('switch', { name: `Le vendredi${NO_BREAK_SPACE}: sourate Al-Kahf` }),
    );
    expect(screen.queryByRole('button', { name: 'Heure du vendredi' })).toBeNull();

    await fireEvent.press(screen.getByRole('switch', { name: 'Rappel du jour' }));
    expect(screen.getByRole('button', { name: 'Heure' })).toBeOnTheScreen();
  });

  it('shows each time as the person set it', async () => {
    await renderSettings({
      settings: {
        reminders: {
          ...DEFAULT_REMINDERS,
          dailyTime: { hour: 6, minute: 15 },
          fridayTime: { hour: 11, minute: 40 },
        },
      },
    });
    const shownTime = (name: string) =>
      String(screen.getByRole('button', { name }).props.accessibilityValue?.text);
    expect(shownTime('Heure')).toMatch(/6.15/);
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
        openSystemSettings={jest.fn()}
        openIntroduction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/notification/i)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
  });
});

describe('introduction', () => {
  it('can be opened again from the settings', async () => {
    const { openIntroduction } = await renderSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Revoir la présentation' }));
    expect(openIntroduction).toHaveBeenCalledTimes(1);
  });
});
