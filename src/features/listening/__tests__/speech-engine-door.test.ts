import type { SpeechEngine } from '@/domain/listening';

import { createFollowEngine, createListeningEngine } from '../speech-engine-door';

const mockDeviceEngine = { name: 'device' } as unknown as SpeechEngine;
const mockCreateDeviceSpeechEngine = jest.fn<SpeechEngine | null, [string]>();

jest.mock('@/data/speech', () => ({
  createDeviceSpeechEngine: (mode: string) => mockCreateDeviceSpeechEngine(mode),
}));

beforeEach(() => {
  mockCreateDeviceSpeechEngine.mockReset();
});

describe('in development and in test builds (the simulation is there)', () => {
  it('plays the scenario named in the address, without touching the microphone', () => {
    mockCreateDeviceSpeechEngine.mockReturnValue(mockDeviceEngine);
    const engine = createListeningEngine('several');
    expect(engine).not.toBeNull();
    expect(engine).not.toBe(mockDeviceEngine);
    expect(mockCreateDeviceSpeechEngine).not.toHaveBeenCalled();
  });

  it('listens for real when no scenario is named and the phone has the engine', () => {
    mockCreateDeviceSpeechEngine.mockReturnValue(mockDeviceEngine);
    expect(createListeningEngine(undefined)).toBe(mockDeviceEngine);
    expect(mockCreateDeviceSpeechEngine).toHaveBeenCalledWith('search');
  });

  it('falls back to the simulation where there is no real engine (the web, Expo Go)', () => {
    mockCreateDeviceSpeechEngine.mockReturnValue(null);
    const engine = createListeningEngine(undefined);
    expect(engine).not.toBeNull();
  });

  it('follows a recitation for real, or plays the simulated one when asked', () => {
    mockCreateDeviceSpeechEngine.mockReturnValue(mockDeviceEngine);
    expect(createFollowEngine(undefined)).toBe(mockDeviceEngine);
    expect(mockCreateDeviceSpeechEngine).toHaveBeenLastCalledWith('follow');
    mockCreateDeviceSpeechEngine.mockClear();
    expect(createFollowEngine('follow')).not.toBe(mockDeviceEngine);
    expect(mockCreateDeviceSpeechEngine).not.toHaveBeenCalled();
  });
});
