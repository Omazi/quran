import { createSuppression } from '@/data/feedback';
import type { SpeechEngine } from '@/domain/listening';

import { silenceWhileListening } from '../microphone-silence';

function fakeEngine() {
  let onEnd: (() => void) | null = null;
  const engine: SpeechEngine = {
    getMicrophonePermission: jest.fn(() => Promise.resolve('granted' as const)),
    requestMicrophonePermission: jest.fn(() => Promise.resolve('granted' as const)),
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    onLevel: jest.fn(() => () => undefined),
    onWords: jest.fn(() => () => undefined),
    onEnd: jest.fn((listener) => {
      onEnd = () => listener('finished');
      return () => undefined;
    }),
  };
  return { engine, end: () => onEnd?.() };
}

describe('the feedback is silent while the microphone is open', () => {
  it('goes silent when the engine listens and speaks again when it stops', async () => {
    const suppression = createSuppression();
    const { engine } = fakeEngine();
    const wrapped = silenceWhileListening(engine, suppression);
    expect(suppression.isSuppressed()).toBe(false);
    await wrapped.start();
    expect(suppression.isSuppressed()).toBe(true);
    await wrapped.stop();
    expect(suppression.isSuppressed()).toBe(false);
  });

  it('is silent from the moment the microphone opens, before start resolves', async () => {
    const suppression = createSuppression();
    const { engine } = fakeEngine();
    let during = false;
    (engine.start as jest.Mock).mockImplementation(() => {
      during = suppression.isSuppressed();
      return Promise.resolve();
    });
    await silenceWhileListening(engine, suppression).start();
    expect(during).toBe(true);
  });

  it('speaks again when the engine fails to start', async () => {
    const suppression = createSuppression();
    const { engine } = fakeEngine();
    (engine.start as jest.Mock).mockRejectedValue(new Error('no microphone'));
    await expect(silenceWhileListening(engine, suppression).start()).rejects.toThrow(
      'no microphone',
    );
    expect(suppression.isSuppressed()).toBe(false);
  });

  it('speaks again when the engine stops by itself', async () => {
    const suppression = createSuppression();
    const { engine, end } = fakeEngine();
    await silenceWhileListening(engine, suppression).start();
    expect(suppression.isSuppressed()).toBe(true);
    end();
    expect(suppression.isSuppressed()).toBe(false);
  });

  it('gives the engine back as it was: same other methods, same answers', async () => {
    const suppression = createSuppression();
    const { engine } = fakeEngine();
    const wrapped = silenceWhileListening(engine, suppression);
    await expect(wrapped.getMicrophonePermission()).resolves.toBe('granted');
    wrapped.onWords(() => undefined);
    expect(engine.onWords).toHaveBeenCalledTimes(1);
  });
  it('keeps the audio check of the engine, so the second chance still runs (D49)', async () => {
    const suppression = createSuppression();
    const { engine } = fakeEngine();
    const checkHeard = jest.fn(async () => null);
    const wrapped = silenceWhileListening({ ...engine, checkHeard }, suppression);
    expect(wrapped.checkHeard).toBeDefined();
    await wrapped.checkHeard?.(['a']);
    expect(checkHeard).toHaveBeenCalledWith(['a']);
  });
});
