import { createSuppression } from '@/data/feedback';
import { createTestAppStore } from '@/store/test-support/test-store';

import { startFeedback, type AppStateSource } from '../start-feedback';

function rig(settings: { soundsEnabled?: boolean; hapticsEnabled?: boolean } = {}) {
  const store = createTestAppStore({ settings });
  const service = { configure: jest.fn(), prepare: jest.fn(() => Promise.resolve()) };
  const suppression = createSuppression();
  let listener: ((state: string) => void) | null = null;
  const appState: AppStateSource = {
    currentState: 'active',
    addEventListener: (_type, handler) => {
      listener = handler;
      return {
        remove: () => {
          listener = null;
        },
      };
    },
  };
  const stop = startFeedback({ store, service, suppression, appState });
  return {
    store,
    service,
    suppression,
    stop,
    send: (state: string) => listener?.(state),
    isListening: () => listener !== null,
  };
}

describe('starting the feedback with the app', () => {
  it('applies the settings at once and prepares the sounds', () => {
    const { service } = rig({ soundsEnabled: false });
    expect(service.configure).toHaveBeenLastCalledWith({
      soundsEnabled: false,
      hapticsEnabled: true,
    });
    expect(service.prepare).toHaveBeenCalledTimes(1);
  });

  it('follows the switches as the person changes them', () => {
    const { store, service } = rig();
    store.getState().setHapticsEnabled(false);
    expect(service.configure).toHaveBeenLastCalledWith({
      soundsEnabled: true,
      hapticsEnabled: false,
    });
    store.getState().setSoundsEnabled(false);
    expect(service.configure).toHaveBeenLastCalledWith({
      soundsEnabled: false,
      hapticsEnabled: false,
    });
  });

  it('is not told about changes of other settings', () => {
    const { store, service } = rig();
    const calls = service.configure.mock.calls.length;
    store.getState().setShowLevel(false);
    expect(service.configure).toHaveBeenCalledTimes(calls);
  });

  it('stays silent while the app is not the one in front, and speaks again when it returns', () => {
    const { suppression, send } = rig();
    expect(suppression.isSuppressed()).toBe(false);
    send('inactive');
    expect(suppression.isSuppressed()).toBe(true);
    send('background');
    expect(suppression.isSuppressed()).toBe(true);
    send('active');
    expect(suppression.isSuppressed()).toBe(false);
  });

  it('starts silent when the app launches in the background', () => {
    const store = createTestAppStore();
    const suppression = createSuppression();
    startFeedback({
      store,
      service: { configure: jest.fn(), prepare: jest.fn(() => Promise.resolve()) },
      suppression,
      appState: {
        currentState: 'background',
        addEventListener: () => ({ remove: () => undefined }),
      },
    });
    expect(suppression.isSuppressed()).toBe(true);
  });

  it('takes an app whose state is not known yet to be in front', () => {
    const suppression = createSuppression();
    startFeedback({
      store: createTestAppStore(),
      service: { configure: jest.fn(), prepare: jest.fn(() => Promise.resolve()) },
      suppression,
      appState: { currentState: null, addEventListener: () => ({ remove: () => undefined }) },
    });
    expect(suppression.isSuppressed()).toBe(false);
  });

  it('lets go of everything when stopped', () => {
    const { store, service, stop, isListening } = rig();
    stop();
    const calls = service.configure.mock.calls.length;
    store.getState().setSoundsEnabled(false);
    expect(service.configure).toHaveBeenCalledTimes(calls);
    expect(isListening()).toBe(false);
  });
});
