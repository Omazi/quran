import { createTestAppStore } from '@/store/test-support/test-store';

import { createDeviceSync, createSyncClock, type SyncSession } from '..';

const SESSION: SyncSession = {
  getAccount: async () => 'user-1',
  getAccessToken: async () => 'token',
};
const ENVIRONMENT = {
  url: 'https://abc.supabase.co',
  publishableKey: 'sb_publishable_0123456789abcdef',
};

describe('the sync of this phone', () => {
  it.each([
    ['without a project in the build', {}, SESSION],
    ['without a real sign-in', ENVIRONMENT, null],
  ])('stays on the phone %s', async (_name, environment, session) => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const engine = createDeviceSync({
      store: createTestAppStore(),
      clock: createSyncClock(),
      session,
      environment,
    });
    await engine.syncNow();
    expect(engine.getStatus()).toEqual({ state: 'local-only' });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    engine.stop();
  });

  it('talks to the project once both are there', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Network request failed'));
    const engine = createDeviceSync({
      store: createTestAppStore(),
      clock: createSyncClock(),
      session: SESSION,
      environment: ENVIRONMENT,
    });
    await engine.syncNow();
    engine.stop();
    expect(fetch).toHaveBeenCalledWith(
      'https://abc.supabase.co/rest/v1/rpc/sync_pull',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(engine.getStatus()).toMatchObject({ state: 'offline' });
    fetch.mockRestore();
  });
});
