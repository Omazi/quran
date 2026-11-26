import { fireEvent, render, screen } from '@testing-library/react-native';

import { previewGardenState } from '../../garden-preview';
import { showLanguage } from '../../test-support/screen-conditions';
import { GardenSurface } from '../garden-surface';
import { GardenView3D } from '../garden-view-3d';
import { forgetGardenModel } from '../use-garden-model';
import { shippedGardenBytes } from '../test-support/shipped-model';

/** What happened, in order: the GL view leaving, the surface letting its context go. */
const mockEvents: string[] = [];

jest.mock('expo-gl', () => {
  const { Component, createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  // A GL view that says when it leaves: the native context goes with it.
  class GLView extends Component<{ testID?: string }> {
    override componentWillUnmount() {
      mockEvents.push('gl-view-unmounted');
    }
    override render() {
      return createElement(View, { testID: this.props.testID });
    }
  }
  return { GLView };
});
jest.mock('../load-garden-model', () => ({ loadGardenModelBytes: jest.fn() }));
jest.mock('@/data/storage', () => ({
  deviceStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const { loadGardenModelBytes } = jest.requireMock<{ loadGardenModelBytes: jest.Mock }>(
  '../load-garden-model',
);

beforeEach(async () => {
  mockEvents.length = 0;
  forgetGardenModel();
  await showLanguage('fr');
});

describe('GardenView3D leaving the screen', () => {
  it('lets the GL context go in the same commit that removes the GL view, before it leaves', async () => {
    const dispose = jest.spyOn(GardenSurface.prototype, 'dispose').mockImplementation(function (
      this: GardenSurface,
    ) {
      mockEvents.push('surface-disposed');
    });
    loadGardenModelBytes.mockResolvedValue(shippedGardenBytes());
    const { unmount } = await render(
      <GardenView3D state={previewGardenState({ hizbCompleted: 24 })} />,
    );
    await fireEvent(screen.getByTestId('garden-3d'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 272 } },
    });
    await screen.findByTestId('garden-3d-gl');
    await unmount();
    // A passive effect would let the surface go after the view, leaving a moment where a frame
    // (a glide, a gesture event, a layout) draws into a context that is gone.
    expect(mockEvents).toEqual(['surface-disposed', 'gl-view-unmounted']);
    dispose.mockRestore();
  });
});
