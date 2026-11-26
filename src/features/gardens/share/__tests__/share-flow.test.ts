import { cardUnit, shareCardImage, type ShareFlowDependencies } from '../share-flow';

function dependencies(overrides: Partial<ShareFlowDependencies> = {}): ShareFlowDependencies {
  return {
    isAvailable: jest.fn(() => Promise.resolve(true)),
    capture: jest.fn(() => Promise.resolve('file:///cache/card.png')),
    share: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
    ...overrides,
  };
}

describe('sharing the image of a card', () => {
  it('captures the card, opens the share sheet on the file, then deletes the file', async () => {
    const calls: string[] = [];
    const deps = dependencies({
      isAvailable: jest.fn(async () => {
        calls.push('available');
        return true;
      }),
      capture: jest.fn(async () => {
        calls.push('capture');
        return 'file:///cache/card.png';
      }),
      share: jest.fn(async () => {
        calls.push('share');
      }),
      release: jest.fn(() => {
        calls.push('release');
      }),
    });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'shared' });
    expect(calls).toEqual(['available', 'capture', 'share', 'release']);
    expect(deps.share).toHaveBeenCalledWith('file:///cache/card.png');
    expect(deps.release).toHaveBeenCalledWith('file:///cache/card.png');
  });

  it('says so, and draws nothing, when the device cannot share', async () => {
    const deps = dependencies({ isAvailable: jest.fn(() => Promise.resolve(false)) });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'unavailable' });
    expect(deps.capture).not.toHaveBeenCalled();
    expect(deps.share).not.toHaveBeenCalled();
  });

  it('fails without sharing when the capture fails', async () => {
    const error = new Error('The content size must not be zero or negative.');
    const deps = dependencies({ capture: jest.fn(() => Promise.reject(error)) });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'failed', error });
    expect(deps.share).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
  });

  it('fails, and still deletes the file, when the share sheet cannot open', async () => {
    const error = new Error('no activity');
    const deps = dependencies({ share: jest.fn(() => Promise.reject(error)) });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'failed', error });
    expect(deps.release).toHaveBeenCalledWith('file:///cache/card.png');
  });

  it('fails when the availability of sharing cannot be read', async () => {
    const error = new Error('native module missing');
    const deps = dependencies({ isAvailable: jest.fn(() => Promise.reject(error)) });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'failed', error });
    expect(deps.capture).not.toHaveBeenCalled();
  });

  it('shares even when deleting the file fails afterwards', async () => {
    const deps = dependencies({
      release: jest.fn(() => {
        throw new Error('already gone');
      }),
    });
    await expect(shareCardImage(deps)).resolves.toEqual({ status: 'shared' });
  });
});

describe('the size of one design unit of the card', () => {
  it('is one pixel of the finished image, whatever the density of the screen', () => {
    expect(cardUnit(3)).toBeCloseTo(1 / 3);
    expect(cardUnit(2)).toBe(0.5);
    expect(cardUnit(1)).toBe(1);
  });

  it('refuses a density that is not a positive number', () => {
    expect(() => cardUnit(0)).toThrow(RangeError);
    expect(() => cardUnit(Number.NaN)).toThrow(RangeError);
  });
});
