import { createSuppression } from '../suppression';
import { createFeedbackService, type HapticsPort, type SoundsPort } from '../service';
import type { FeedbackEvent, SoundName } from '../recipes';

interface Rig {
  readonly service: ReturnType<typeof createFeedbackService>;
  readonly suppression: ReturnType<typeof createSuppression>;
  readonly haptics: jest.Mocked<HapticsPort>;
  readonly sounds: jest.Mocked<SoundsPort>;
  readonly advance: (ms: number) => void;
}

function rig(options: { soundsFail?: boolean } = {}): Rig {
  let clock = 10_000;
  const haptics: jest.Mocked<HapticsPort> = { play: jest.fn() };
  const sounds: jest.Mocked<SoundsPort> = {
    configureSession: jest.fn(() => Promise.resolve()),
    prepare: jest.fn((_sounds: readonly SoundName[]) => Promise.resolve()),
    play: jest.fn(),
  };
  if (options.soundsFail === true) {
    sounds.play.mockImplementation(() => {
      throw new Error('no audio');
    });
    haptics.play.mockImplementation(() => {
      throw new Error('no taptic engine');
    });
  }
  const suppression = createSuppression();
  const service = createFeedbackService({ haptics, sounds, suppression, now: () => clock });
  return { service, suppression, haptics, sounds, advance: (ms) => (clock += ms) };
}

describe('what plays for an event', () => {
  it('plays the sound and the haptic of the event', () => {
    const { service, haptics, sounds } = rig();
    service.play('found');
    expect(sounds.play).toHaveBeenCalledWith('found');
    expect(haptics.play).toHaveBeenCalledWith('success');
  });

  it('plays only the haptic for an event without sound, and only the sound for one without haptic', () => {
    const { service, haptics, sounds } = rig();
    service.play('select');
    expect(sounds.play).not.toHaveBeenCalled();
    expect(haptics.play).toHaveBeenCalledWith('selection');
    service.play('drop');
    expect(sounds.play).toHaveBeenCalledWith('drop');
    expect(haptics.play).toHaveBeenCalledTimes(1);
  });

  it('ignores an event it does not know', () => {
    const { service, haptics, sounds } = rig();
    service.play('boom' as FeedbackEvent);
    expect(sounds.play).not.toHaveBeenCalled();
    expect(haptics.play).not.toHaveBeenCalled();
  });

  it('never lets a failing sound or haptic break the caller', () => {
    const { service } = rig({ soundsFail: true });
    expect(() => service.play('found')).not.toThrow();
  });
});

describe('the two settings', () => {
  it('plays both by default (sounds and vibrations are on)', () => {
    const { service, haptics, sounds } = rig();
    service.play('grow');
    expect(sounds.play).toHaveBeenCalledTimes(1);
    expect(haptics.play).toHaveBeenCalledTimes(1);
  });

  it('keeps the sound silent when sounds are off, the haptic stays', () => {
    const { service, haptics, sounds } = rig();
    service.configure({ soundsEnabled: false, hapticsEnabled: true });
    service.play('grow');
    expect(sounds.play).not.toHaveBeenCalled();
    expect(haptics.play).toHaveBeenCalledWith('light');
  });

  it('keeps the haptic still when vibrations are off, the sound stays', () => {
    const { service, haptics, sounds } = rig();
    service.configure({ soundsEnabled: true, hapticsEnabled: false });
    service.play('grow');
    expect(sounds.play).toHaveBeenCalledWith('grow');
    expect(haptics.play).not.toHaveBeenCalled();
  });

  it('does nothing at all when both are off, and takes the change back', () => {
    const { service, haptics, sounds, advance } = rig();
    service.configure({ soundsEnabled: false, hapticsEnabled: false });
    service.play('celebrate');
    expect(sounds.play).not.toHaveBeenCalled();
    expect(haptics.play).not.toHaveBeenCalled();
    advance(10);
    service.configure({ soundsEnabled: true, hapticsEnabled: true });
    service.play('celebrate');
    expect(sounds.play).toHaveBeenCalledWith('celebrate');
    expect(haptics.play).toHaveBeenCalledWith('success');
  });
});

describe('silence while the microphone listens', () => {
  it('plays nothing, sound or haptic, while the microphone is open', () => {
    const { service, suppression, haptics, sounds } = rig();
    suppression.set('microphone', true);
    service.play('found');
    service.play('select');
    expect(sounds.play).not.toHaveBeenCalled();
    expect(haptics.play).not.toHaveBeenCalled();
  });

  it('does not play later what was asked while it was open', () => {
    const { service, suppression, sounds, advance } = rig();
    suppression.set('microphone', true);
    service.play('found');
    suppression.set('microphone', false);
    advance(1000);
    expect(sounds.play).not.toHaveBeenCalled();
  });

  it('plays again once the microphone is closed', () => {
    const { service, suppression, sounds } = rig();
    suppression.set('microphone', true);
    suppression.set('microphone', false);
    service.play('found');
    expect(sounds.play).toHaveBeenCalledWith('found');
  });

  it('stays silent while any reason is still active (microphone, app in the background, interruption)', () => {
    const { service, suppression, sounds } = rig();
    suppression.set('microphone', true);
    suppression.set('interruption', true);
    suppression.set('microphone', false);
    service.play('found');
    expect(sounds.play).not.toHaveBeenCalled();
    suppression.set('interruption', false);
    service.play('found');
    expect(sounds.play).toHaveBeenCalledTimes(1);
  });

  it('puts the audio session back in order when the microphone closes (the microphone changes it)', () => {
    const { suppression, sounds } = rig();
    expect(sounds.configureSession).not.toHaveBeenCalled();
    suppression.set('microphone', true);
    expect(sounds.configureSession).not.toHaveBeenCalled();
    suppression.set('microphone', false);
    expect(sounds.configureSession).toHaveBeenCalledTimes(1);
  });

  it('does not touch the audio session for the other reasons', () => {
    const { suppression, sounds } = rig();
    suppression.set('app-inactive', true);
    suppression.set('app-inactive', false);
    expect(sounds.configureSession).not.toHaveBeenCalled();
  });
});

describe('throttling', () => {
  it('drops the same event repeated within its pause, then plays it again after', () => {
    const { service, haptics, sounds, advance } = rig();
    service.play('page');
    service.play('page');
    advance(20);
    service.play('page');
    expect(sounds.play).toHaveBeenCalledTimes(1);
    expect(haptics.play).toHaveBeenCalledTimes(1);
    advance(400);
    service.play('page');
    expect(sounds.play).toHaveBeenCalledTimes(2);
  });

  it('lets two different events through, one after the other', () => {
    const { service, sounds, advance } = rig();
    service.play('drop');
    advance(100);
    service.play('grow');
    expect(sounds.play).toHaveBeenNthCalledWith(1, 'drop');
    expect(sounds.play).toHaveBeenNthCalledWith(2, 'grow');
  });

  it('does not let two haptics fire on top of each other, the sounds still play', () => {
    const { service, haptics, sounds, advance } = rig();
    service.play('grow');
    advance(5);
    service.play('open');
    expect(haptics.play).toHaveBeenCalledTimes(1);
    expect(sounds.play).toHaveBeenCalledTimes(2);
  });

  it('does not use up the pause of an event that played nothing', () => {
    const { service, sounds, advance } = rig();
    service.configure({ soundsEnabled: false, hapticsEnabled: false });
    service.play('grow');
    service.configure({ soundsEnabled: true, hapticsEnabled: true });
    advance(1);
    service.play('grow');
    expect(sounds.play).toHaveBeenCalledTimes(1);
  });

  it('is not stuck when the phone clock goes back', () => {
    const { service, sounds, haptics, advance } = rig();
    service.play('grow');
    advance(-60_000);
    service.play('grow');
    expect(sounds.play).toHaveBeenCalledTimes(2);
    expect(haptics.play).toHaveBeenCalledTimes(2);
  });

  it('survives a hundred events in a burst: no more than one per pause', () => {
    const { service, sounds, advance } = rig();
    for (let i = 0; i < 100; i += 1) {
      service.play('select');
      service.play('page');
      advance(10);
    }
    // 1 second of events: 'page' (sound) can play at most once per its pause.
    expect(sounds.play.mock.calls.length).toBeLessThanOrEqual(1000 / 120 + 1);
  });
});

describe('a haptic alone', () => {
  it('plays the haptic asked, with no sound', () => {
    const { service, haptics, sounds } = rig();
    service.haptic('medium');
    expect(haptics.play).toHaveBeenCalledWith('medium');
    expect(sounds.play).not.toHaveBeenCalled();
  });

  it('follows the vibrations switch, and not the sounds one', () => {
    const { service, haptics, advance } = rig();
    service.configure({ soundsEnabled: false, hapticsEnabled: true });
    service.haptic('light');
    expect(haptics.play).toHaveBeenCalledTimes(1);
    advance(100);
    service.configure({ soundsEnabled: true, hapticsEnabled: false });
    service.haptic('light');
    expect(haptics.play).toHaveBeenCalledTimes(1);
  });

  it('is silent while the microphone listens', () => {
    const { service, suppression, haptics } = rig();
    suppression.set('microphone', true);
    service.haptic('success');
    expect(haptics.play).not.toHaveBeenCalled();
  });

  it('gives one haptic per gesture, even two taps in a row', () => {
    const { service, haptics } = rig();
    service.haptic('light');
    service.haptic('light');
    expect(haptics.play).toHaveBeenCalledTimes(2);
  });

  it('still keeps an event that follows at once from smearing its haptic over it', () => {
    const { service, haptics, sounds, advance } = rig();
    service.haptic('medium');
    advance(5);
    service.play('grow');
    expect(haptics.play).toHaveBeenCalledTimes(1);
    expect(sounds.play).toHaveBeenCalledWith('grow');
  });

  it('never throws', () => {
    const { service } = rig({ soundsFail: true });
    expect(() => service.haptic('warning')).not.toThrow();
  });
});

describe('preparing the sounds', () => {
  it('sets the audio session and loads every sound once, however many times it is asked', async () => {
    const { service, sounds } = rig();
    await Promise.all([service.prepare(), service.prepare()]);
    await service.prepare();
    expect(sounds.configureSession).toHaveBeenCalledTimes(1);
    expect(sounds.prepare).toHaveBeenCalledTimes(1);
    expect(sounds.prepare.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(['drop', 'plop', 'grow', 'open', 'page', 'found']),
    );
  });

  it('does not throw when the audio cannot be prepared', async () => {
    const { service, sounds } = rig();
    sounds.prepare.mockRejectedValueOnce(new Error('no audio'));
    await expect(service.prepare()).resolves.toBeUndefined();
  });
});
