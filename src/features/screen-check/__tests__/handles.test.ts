import { closeHandles, getHandle, openHandles, publishHandle, waitForHandle } from '../handles';

afterEach(closeHandles);

describe('the handles the automatic run reaches the app through', () => {
  it('keep nothing at all unless the check opened them (a published build never does)', () => {
    const stop = publishHandle('garden', { zoom: 1 });
    expect(getHandle('garden')).toBeUndefined();
    expect(() => stop()).not.toThrow();
  });

  it('hold what a screen publishes, and let it go when the screen goes', () => {
    openHandles();
    const stop = publishHandle('garden', { zoom: 1 });
    expect(getHandle('garden')).toEqual({ zoom: 1 });
    stop();
    expect(getHandle('garden')).toBeUndefined();
  });

  it('do not let an old screen remove the handle of a newer one', () => {
    openHandles();
    const stopOld = publishHandle('garden', { id: 'old' });
    publishHandle('garden', { id: 'new' });
    stopOld();
    expect(getHandle('garden')).toEqual({ id: 'new' });
  });

  it('can be waited for, and give up', async () => {
    openHandles();
    setTimeout(() => publishHandle('friend', { id: 1 }), 5);
    await expect(waitForHandle('friend', 500, 2)).resolves.toEqual({ id: 1 });
    await expect(waitForHandle('missing', 20, 2)).resolves.toBeUndefined();
  });
});
