import {
  createExpoHaptics,
  createExpoSounds,
  FEEDBACK_VOLUME,
  type ExpoAudioModule,
  type ExpoHapticsModule,
} from '../device-adapters';

function fakeHaptics(): jest.Mocked<ExpoHapticsModule> {
  return {
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn((_style: unknown) => Promise.resolve()),
    notificationAsync: jest.fn((_type: unknown) => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  };
}

describe('the haptics of the phone', () => {
  it('maps each kind to the right expo-haptics call', () => {
    const haptics = fakeHaptics();
    const port = createExpoHaptics(haptics);
    port.play('selection');
    port.play('light');
    port.play('medium');
    port.play('success');
    port.play('warning');
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(haptics.impactAsync).toHaveBeenNthCalledWith(1, 'light');
    expect(haptics.impactAsync).toHaveBeenNthCalledWith(2, 'medium');
    expect(haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'warning');
  });

  it('swallows a rejected haptic (no motor, haptics off in the system)', async () => {
    const haptics = fakeHaptics();
    haptics.impactAsync.mockRejectedValue(new Error('no motor'));
    const port = createExpoHaptics(haptics);
    expect(() => port.play('light')).not.toThrow();
    await Promise.resolve();
  });
});

interface FakePlayer {
  volume: number;
  readonly seekTo: jest.Mock;
  readonly play: jest.Mock;
  readonly remove: jest.Mock;
}

function fakeAudio(): { module: jest.Mocked<ExpoAudioModule>; players: FakePlayer[] } {
  const players: FakePlayer[] = [];
  const module: jest.Mocked<ExpoAudioModule> = {
    setAudioModeAsync: jest.fn((_mode: Parameters<ExpoAudioModule['setAudioModeAsync']>[0]) =>
      Promise.resolve(),
    ),
    createAudioPlayer: jest.fn((_source: number, _options?: object) => {
      const player: FakePlayer = {
        volume: 1,
        seekTo: jest.fn(() => Promise.resolve()),
        play: jest.fn(),
        remove: jest.fn(),
      };
      players.push(player);
      return player;
    }),
  };
  return { module, players };
}

const FILES = { drop: 1, plop: 2, grow: 3 } as const;
const loadFiles = () => FILES;

describe('the sounds of the phone', () => {
  it('sets an ambient session: silent switch respected, other audio keeps playing, no recording', async () => {
    const { module } = fakeAudio();
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.configureSession();
    expect(module.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
    });
  });

  it('loads one player per sound, at the feedback volume', async () => {
    const { module, players } = fakeAudio();
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.prepare(['drop', 'plop']);
    expect(module.createAudioPlayer).toHaveBeenCalledTimes(2);
    expect(module.createAudioPlayer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ keepAudioSessionActive: true }),
    );
    expect(players.every((player) => player.volume === FEEDBACK_VOLUME)).toBe(true);
  });

  it('loads a sound once, even when prepared twice', async () => {
    const { module } = fakeAudio();
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.prepare(['drop']);
    await port.prepare(['drop', 'plop']);
    expect(module.createAudioPlayer).toHaveBeenCalledTimes(2);
  });

  it('plays from the start, every time', async () => {
    const { module, players } = fakeAudio();
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.prepare(['drop']);
    port.play('drop');
    port.play('drop');
    expect(players[0]?.seekTo).toHaveBeenCalledTimes(2);
    expect(players[0]?.seekTo).toHaveBeenCalledWith(0);
    expect(players[0]?.play).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a sound that was never loaded', async () => {
    const { module, players } = fakeAudio();
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.prepare(['drop']);
    expect(() => port.play('grow')).not.toThrow();
    expect(players[0]?.play).not.toHaveBeenCalled();
  });

  it('stays silent, without failing, when the audio module is not there', async () => {
    const port = createExpoSounds({
      loadAudio: () => {
        throw new Error("Cannot find module 'expo-audio'");
      },
      loadFiles,
    });
    await expect(port.configureSession()).resolves.toBeUndefined();
    await expect(port.prepare(['drop'])).resolves.toBeUndefined();
    expect(() => port.play('drop')).not.toThrow();
  });

  it('keeps going when one sound fails to load', async () => {
    const { module, players } = fakeAudio();
    module.createAudioPlayer.mockImplementationOnce(() => {
      throw new Error('bad file');
    });
    const port = createExpoSounds({ loadAudio: () => module, loadFiles });
    await port.prepare(['drop', 'plop']);
    port.play('plop');
    expect(players[0]?.play).toHaveBeenCalledTimes(1);
  });
});
