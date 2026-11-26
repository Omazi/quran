/**
 * The two in-app doors to the recognition (maquettes 2026-11-26, 3A and 3C) go through one hook:
 * it marks the opening as the app's own before it navigates, so that the microphone starts by
 * itself only after a tap in the app, never after a link (docs/SECURITY.md).
 */
import { renderHook } from '@testing-library/react-native';

import { forgetOpenedInApp, wasOpenedInApp } from '../in-app-open';
import { useOpenRecognition } from '../use-open-recognition';

afterEach(forgetOpenedInApp);

describe('useOpenRecognition', () => {
  it('marks the listening screen as opened in the app, then navigates to it', async () => {
    const order: string[] = [];
    const navigate = jest.fn(() => {
      order.push(wasOpenedInApp('listening') ? 'marked, then pushed' : 'pushed unmarked');
    });
    const { result } = await renderHook(() => useOpenRecognition(navigate));
    expect(wasOpenedInApp('listening')).toBe(false);
    result.current();
    expect(navigate).toHaveBeenCalledWith('/listening');
    expect(order).toEqual(['marked, then pushed']);
  });

  it('does not mark the reader: only the recognition may start by itself', async () => {
    const { result } = await renderHook(() => useOpenRecognition(jest.fn()));
    result.current();
    expect(wasOpenedInApp('reader-follow')).toBe(false);
  });
});
