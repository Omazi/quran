import { createSuppression } from '../suppression';

describe('the reasons to stay silent', () => {
  it('is open until a reason is given', () => {
    expect(createSuppression().isSuppressed()).toBe(false);
  });

  it('tells its listeners only when a reason really changes', () => {
    const suppression = createSuppression();
    const heard: [string, boolean][] = [];
    suppression.subscribe((reason, active) => heard.push([reason, active]));
    suppression.set('microphone', true);
    suppression.set('microphone', true);
    suppression.set('microphone', false);
    suppression.set('microphone', false);
    expect(heard).toEqual([
      ['microphone', true],
      ['microphone', false],
    ]);
  });

  it('stops telling a listener that unsubscribed', () => {
    const suppression = createSuppression();
    const listener = jest.fn();
    const stop = suppression.subscribe(listener);
    stop();
    suppression.set('interruption', true);
    expect(listener).not.toHaveBeenCalled();
  });
});
