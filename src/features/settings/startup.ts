import { useEffect, useRef, useState } from 'react';

import { initI18n, resolveLanguage, setDisplayedLanguage, type AppLanguage } from '@/i18n';
import {
  loadAppStore,
  type AppStore,
  type KeyValueStorage,
  type ProgressBackup,
  type StoredDataPart,
} from '@/store';

import { alignDirectionAtStartup, type WritingDirectionPlatform } from './writing-direction';

export interface StartupDependencies {
  /** Where the settings and the journal are kept. */
  readonly storage: KeyValueStorage;
  /** The copy of the progress outside the app's storage, when the device has one. */
  readonly backup?: ProgressBackup;
  readonly direction: WritingDirectionPlatform;
  /** The languages of the device, most wanted first, as language codes ("fr", "ar"). */
  readonly getDeviceLanguageCodes: () => readonly (string | null)[];
  /** Resolves after the given time. Defaults to a timer. */
  readonly wait?: (milliseconds: number) => Promise<void>;
}

/** The app once it is ready to show its first screen. */
export interface StartedApp {
  readonly store: AppStore;
  /** The language shown: the saved choice, otherwise the device's, otherwise French. */
  readonly language: AppLanguage;
  /** False when the layout could not be given the direction of the language. */
  readonly isLaidOutForLanguage: boolean;
  /** What was found on the device but could not be trusted, and was replaced by a fresh start. */
  readonly discardedStoredData: readonly StoredDataPart[];
  /** True when the device held nothing and the progress came back from its copy. */
  readonly restoredFromBackup: boolean;
}

function waitWithTimer(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Starts the app, in this order: the saved settings and journal, then the language, then the
 * writing direction. Fonts are loaded beside it by the root layout.
 */
export async function startApp({
  storage,
  backup,
  direction,
  getDeviceLanguageCodes,
  wait = waitWithTimer,
}: StartupDependencies): Promise<StartedApp> {
  const { store, discarded, restoredFromBackup } = await loadAppStore({ storage, backup });
  const language = resolveLanguage(store.getState().settings.language, getDeviceLanguageCodes());
  initI18n(language);
  // The copy of the progress may be adopted while the app runs (it can arrive late): the texts
  // then follow its language at once, the layout at the next start, as for a change in Réglages.
  store.subscribe((state, previous) => {
    if (state.settings.language !== previous.settings.language) {
      setDisplayedLanguage(resolveLanguage(state.settings.language, getDeviceLanguageCodes()));
    }
  });
  const isLaidOutForLanguage = await alignDirectionAtStartup(language, {
    platform: direction,
    storage,
    wait,
  });
  return {
    store,
    language,
    isLaidOutForLanguage,
    discardedStoredData: discarded,
    restoredFromBackup,
  };
}

/** Null while the app is starting. */
export type AppStartup = StartedApp | null;

/**
 * Starts the app once for the life of the component and renders again when it is ready.
 * `dependencies` must not change between renders: build them outside the component.
 */
export function useAppStartup(dependencies: StartupDependencies): AppStartup {
  const [startedApp, setStartedApp] = useState<AppStartup>(null);
  const [failure, setFailure] = useState<{ readonly error: unknown } | null>(null);
  // An effect may run twice for one mount in development; the app must still start once, or two
  // user seeds would be drawn and written.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startApp(dependencies).then(setStartedApp, (error: unknown) => setFailure({ error }));
  }, [dependencies]);

  // A start that fails is shown by the error screen of the router, not hidden behind the launch
  // screen for ever.
  if (failure !== null) throw failure.error;
  return startedApp;
}
