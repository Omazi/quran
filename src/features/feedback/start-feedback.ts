import type { FeedbackPreferences, FeedbackService, Suppression } from '@/data/feedback';
import type { AppStore } from '@/store';

/** The part of React Native's `AppState` that is used. */
export interface AppStateSource {
  /** Null or undefined before React Native knows: the app is then taken to be in front. */
  readonly currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

export interface StartFeedbackOptions {
  readonly store: AppStore;
  readonly service: Pick<FeedbackService, 'configure' | 'prepare'>;
  readonly suppression: Suppression;
  readonly appState: AppStateSource;
}

/** True when the app is known not to be the one in front. */
const isAway = (state: string | null | undefined): boolean =>
  state !== null && state !== undefined && state !== 'active';

const preferencesOf = (store: AppStore): FeedbackPreferences => {
  const { soundsEnabled, hapticsEnabled } = store.getState().settings;
  return { soundsEnabled, hapticsEnabled };
};

/**
 * Connects the feedback to the app: the person's two switches (read now, and again each time they
 * change), the sounds loaded in advance, and silence while the app is not the one in front (a
 * call banner, Control Center, the background). Returns the way to disconnect.
 */
export function startFeedback({
  store,
  service,
  suppression,
  appState,
}: StartFeedbackOptions): () => void {
  let applied = preferencesOf(store);
  service.configure(applied);
  void service.prepare();

  const unsubscribe = store.subscribe(() => {
    const next = preferencesOf(store);
    if (
      next.soundsEnabled === applied.soundsEnabled &&
      next.hapticsEnabled === applied.hapticsEnabled
    ) {
      return;
    }
    applied = next;
    service.configure(next);
  });

  suppression.set('app-inactive', isAway(appState.currentState));
  const subscription = appState.addEventListener('change', (state) => {
    suppression.set('app-inactive', state !== 'active');
  });

  return () => {
    unsubscribe();
    subscription.remove();
    suppression.set('app-inactive', false);
  };
}
