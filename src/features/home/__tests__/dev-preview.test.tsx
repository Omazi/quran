import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeRoute from '@/app/(tabs)/index';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { renderOnIOS, resetDeviceConditions } from '@/ui/test-support/environment';

import { getDevPreviewChoice, setDevPreviewChoice } from '../dev-preview/dev-preview';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

afterEach(async () => {
  setDevPreviewChoice('store');
  await resetDeviceConditions();
});

async function renderHome(store: AppStore) {
  await showLanguage('fr');
  await render(
    <AppStoreProvider store={store}>
      <HomeRoute />
    </AppStoreProvider>,
  );
}

describe('the developer preview of the home screen (development only)', () => {
  it('is the last part of the screen and starts on the real data', async () => {
    expect(__DEV__).toBe(true);
    await renderHome(createTestAppStore());
    expect(screen.getByRole('header', { name: 'Aperçu des états' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Mes vraies données' })).toBeChecked();
    // A new person: the real data is a bare earth.
    expect(screen.getByRole('image', { name: /^Terre nue/ })).toBeOnTheScreen();
    // Nine choices: the real data and every state of the garden.
    expect(screen.getAllByRole('radio')).toHaveLength(9);
  });

  const previews: readonly (readonly [string, RegExp])[] = [
    ['Florissant (hizb 24)', /^Jardin, 24 hizb sur 60, l’eau coule$/],
    ['Assoiffé (3 jours)', /^Jardin assoiffé, 24 hizb sur 60/],
    ['Fané (6 jours)', /^Jardin fané, 24 hizb sur 60/],
    ['Mourant (10 jours)', /^Jardin mourant, 24 hizb sur 60/],
    ['Terre morte (14 jours)', /^Terre morte, 24 hizb sur 60 acquis/],
    ['Ranimé (une page après 14 jours)', /^Jardin ranimé, 24 hizb sur 60, l’eau coule$/],
    ['Khatma terminée', /^Jardin complet, 60 hizb sur 60/],
    ['Terre nue', /^Terre nue, aucun hizb terminé$/],
  ];

  it.each(previews)('shows "%s" without touching the stored data', async (choice, sceneLabel) => {
    const store = createTestAppStore();
    const before = store.getState();
    const changed = jest.fn();
    store.subscribe(changed);
    await renderHome(store);

    await fireEvent.press(screen.getByRole('radio', { name: choice }));
    expect(screen.getByRole('radio', { name: choice })).toBeChecked();
    expect(screen.getByRole('image', { name: sceneLabel })).toBeOnTheScreen();

    // The store was neither written nor replaced: same journal, same settings, no change told.
    expect(changed).not.toHaveBeenCalled();
    expect(store.getState().journal).toBe(before.journal);
    expect(store.getState().settings).toBe(before.settings);
    expect(store.getState().journal).toHaveLength(0);
  });

  it('comes back to the real data when asked', async () => {
    await renderHome(createTestAppStore());
    await fireEvent.press(screen.getByRole('radio', { name: 'Assoiffé (3 jours)' }));
    expect(getDevPreviewChoice()).toBe('thirsty');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mes vraies données' }));
    expect(getDevPreviewChoice()).toBe('store');
    expect(screen.getByRole('image', { name: /^Terre nue/ })).toBeOnTheScreen();
  });

  it('renders on an iPhone', async () => {
    await showLanguage('fr');
    await renderOnIOS(
      <AppStoreProvider store={createTestAppStore()}>
        <HomeRoute />
      </AppStoreProvider>,
    );
  });
});
