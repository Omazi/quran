import { deviceGravity } from '../device-gravity';

type Listener = (measurement: { accelerationIncludingGravity: unknown }) => void;

interface MockMotion {
  isAvailableAsync: jest.Mock<Promise<boolean>, []>;
  setUpdateInterval: jest.Mock;
  listener: Listener | null;
  remove: jest.Mock;
  addListener: jest.Mock<{ remove: jest.Mock }, [Listener]>;
}

const mockMotion: MockMotion = {
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  setUpdateInterval: jest.fn(),
  listener: null as Listener | null,
  remove: jest.fn(),
  addListener: jest.fn((listener: Listener): { remove: jest.Mock } => {
    mockMotion.listener = listener;
    return { remove: mockMotion.remove };
  }),
};
jest.mock('expo-sensors', () => ({ DeviceMotion: mockMotion }), { virtual: true });

describe('gravity from the mockMotion sensors', () => {
  it('asks at most the rate it is given, passes gravity on, and stops', async () => {
    const samples: unknown[] = [];
    const stop = deviceGravity.watch((gravity) => samples.push(gravity), 33);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockMotion.setUpdateInterval).toHaveBeenCalledWith(33);
    mockMotion.listener?.({ accelerationIncludingGravity: { x: 1, y: -9, z: 0 } });
    mockMotion.listener?.({ accelerationIncludingGravity: null });
    expect(samples).toEqual([{ x: 1, y: -9, z: 0 }]);
    stop();
    expect(mockMotion.remove).toHaveBeenCalledTimes(1);
  });

  it('starts nothing when stopped before the sensor answered', async () => {
    mockMotion.addListener.mockClear();
    const stop = deviceGravity.watch(() => undefined, 33);
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockMotion.addListener).not.toHaveBeenCalled();
  });
});
