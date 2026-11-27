/**
 * The picture of the garden stays until the 3D garden has really drawn a first frame (loading.md ›
 * Show something as soon as possible). The friend's page of the 683ad8d pictures showed neither:
 * the view said "ready" without a frame, took the picture away, and left an empty area.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

import { previewGardenState } from '../../garden-preview';
import { showLanguage } from '../../test-support/screen-conditions';
import { GardenView3D } from '../garden-view-3d';
import { forgetGardenModel } from '../use-garden-model';
import { shippedGardenBytes } from '../test-support/shipped-model';

/** The GL view the screen mounted: what a test needs to give it a context, as the phone does. */
const mockGl: { createContext: ((gl: ExpoWebGLRenderingContext) => void) | null } = {
  createContext: null,
};
/** Whether the renderer's frames reach a buffer that has a size (a view made at 0 by 0 does not). */
const mockBuffer = { isEmpty: false };

jest.mock('expo-gl', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GLView: ({
      onContextCreate,
      testID,
    }: {
      onContextCreate: (gl: ExpoWebGLRenderingContext) => void;
      testID?: string;
    }) => {
      mockGl.createContext = onContextCreate;
      return createElement(View, { testID });
    },
  };
});
jest.mock('../garden-renderer', () => ({
  createGardenRenderer: () => ({ shadowMap: { needsUpdate: false }, dispose: () => undefined }),
  drawFrame: () => !mockBuffer.isEmpty,
}));
jest.mock('../load-garden-model', () => ({ loadGardenModelBytes: jest.fn() }));
jest.mock('@/data/storage', () => ({
  deviceStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

const { loadGardenModelBytes } = jest.requireMock<{ loadGardenModelBytes: jest.Mock }>(
  '../load-garden-model',
);

const GARDEN = previewGardenState({ hizbCompleted: 42 });
const GL = {} as ExpoWebGLRenderingContext;

beforeEach(async () => {
  mockGl.createContext = null;
  mockBuffer.isEmpty = false;
  forgetGardenModel();
  loadGardenModelBytes.mockReset();
  loadGardenModelBytes.mockResolvedValue(shippedGardenBytes());
  await showLanguage('fr');
});

const layout = (width: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});
const picture = () => screen.queryByTestId('garden-scene', { includeHiddenElements: true });

/** Gives the view its size, then lets the frame that applies it run. */
async function resize(width: number, height: number) {
  await fireEvent(screen.getByTestId('garden-3d'), 'layout', layout(width, height));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

describe('GardenView3D, filling its parent, until its first frame', () => {
  it('makes no GL context for a view that has no size yet: the picture is there', async () => {
    await render(<GardenView3D state={GARDEN} fill hintPlacement="below" />);
    await resize(390, 0);
    expect(screen.queryByTestId('garden-3d-gl')).toBeNull();
    expect(picture()).toBeOnTheScreen();
  });

  it('mounts the GL view once the view has a size, and keeps the picture until a frame is drawn', async () => {
    await render(<GardenView3D state={GARDEN} fill hintPlacement="below" />);
    await resize(390, 640);
    expect(await screen.findByTestId('garden-3d-gl')).toBeOnTheScreen();
    expect(picture()).toBeOnTheScreen();
    expect(screen.queryByTestId('garden-3d-hint', { includeHiddenElements: true })).toBeNull();
  });

  it('keeps the picture, and shows no hint, while the frames reach an empty buffer', async () => {
    mockBuffer.isEmpty = true;
    await render(<GardenView3D state={GARDEN} fill hintPlacement="below" />);
    await resize(390, 640);
    await screen.findByTestId('garden-3d-gl');
    await act(async () => mockGl.createContext?.(GL));

    expect(picture()).toBeOnTheScreen();
    expect(screen.queryByTestId('garden-3d-hint', { includeHiddenElements: true })).toBeNull();
  });

  it('still shows the picture two seconds later when GL never draws', async () => {
    mockBuffer.isEmpty = true;
    await render(<GardenView3D state={GARDEN} fill hintPlacement="below" />);
    await resize(390, 640);
    await screen.findByTestId('garden-3d-gl');
    await act(async () => mockGl.createContext?.(GL));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });
    expect(picture()).toBeOnTheScreen();
  });

  it('hands over to the 3D garden at its first real frame, and the hint appears', async () => {
    mockBuffer.isEmpty = true;
    await render(<GardenView3D state={GARDEN} fill hintPlacement="below" />);
    await resize(390, 640);
    await screen.findByTestId('garden-3d-gl');
    await act(async () => mockGl.createContext?.(GL));
    expect(picture()).toBeOnTheScreen();

    // The view grows to its real size: the next frame has pixels.
    mockBuffer.isEmpty = false;
    await resize(390, 700);

    await waitFor(() => expect(picture()).toBeNull());
    const hint = await screen.findByTestId('garden-3d-hint', { includeHiddenElements: true });
    expect(hint).toBeOnTheScreen();
    // Under the garden, the hint keeps the same air above and below: on the iPhone it touched
    // the card that follows (0.7 point between the two: photo of 27 November 2026).
    expect(hint).toHaveStyle({ paddingVertical: 8 });
  });
});
