import * as Haptics from 'expo-haptics';

import { appSuppression, deviceFeedback } from '@/data/feedback';
import { playStageHaptic } from '@/features/onboarding/use-stage-engine';

import { playFeedback, playHaptic } from '..';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
  jest.clearAllMocks();
  deviceFeedback.configure({ soundsEnabled: true, hapticsEnabled: true });
});

afterEach(() => {
  appSuppression.set('microphone', false);
  jest.useRealTimers();
});

describe('playFeedback on the phone', () => {
  it('gives the haptic of the event through expo-haptics', () => {
    playFeedback('celebrate');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    jest.advanceTimersByTime(3000);
    playFeedback('error');
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('warning');
    jest.advanceTimersByTime(3000);
    playFeedback('select');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not vibrate when the person switched vibrations off', () => {
    deviceFeedback.configure({ soundsEnabled: true, hapticsEnabled: false });
    playFeedback('celebrate');
    playHaptic('medium');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('does not vibrate while the microphone listens', () => {
    appSuppression.set('microphone', true);
    playFeedback('found');
    playHaptic('light');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('never throws, even for a name nobody knows', () => {
    expect(() => playFeedback('boom' as 'drop')).not.toThrow();
  });
});

describe('the demonstration haptics of the introduction', () => {
  it('keep their three haptics, now behind the same switch', () => {
    playStageHaptic('wrong-word');
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('warning');
    jest.advanceTimersByTime(100);
    playStageHaptic('found');
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
    jest.advanceTimersByTime(100);
    playStageHaptic('heart');
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');

    deviceFeedback.configure({ soundsEnabled: true, hapticsEnabled: false });
    jest.advanceTimersByTime(100);
    playStageHaptic('found');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });
});
