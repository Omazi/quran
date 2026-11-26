import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { previewGardenState } from '../../garden-preview';
import { showLanguage } from '../../test-support/screen-conditions';
import { GardenView3D } from '../garden-view-3d';
import { forgetGardenModel } from '../use-garden-model';
import { shippedGardenBytes } from '../test-support/shipped-model';

jest.mock('../load-garden-model', () => ({ loadGardenModelBytes: jest.fn() }));
jest.mock('@/data/storage', () => {
  const values = new Map<string, string>();
  return {
    deviceStorage: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        values.delete(key);
      }),
    },
  };
});

const { loadGardenModelBytes } = jest.requireMock<{ loadGardenModelBytes: jest.Mock }>(
  '../load-garden-model',
);

beforeEach(async () => {
  forgetGardenModel();
  loadGardenModelBytes.mockReset();
  await showLanguage('fr');
});

const garden = previewGardenState({ hizbCompleted: 24 });

/** The view is laid out: the GL view is only made once it has a size. */
const layOut = () =>
  fireEvent(screen.getByTestId('garden-3d'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 272 } },
  });

describe('GardenView3D before its first frame (no GL context under Jest)', () => {
  it('shows the picture of the garden while the model loads: never a blank box', async () => {
    loadGardenModelBytes.mockReturnValue(new Promise(() => undefined));
    await render(<GardenView3D state={garden} />);
    expect(screen.getByTestId('garden-scene', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('is one image for VoiceOver, described in words, the picture hidden behind it', async () => {
    loadGardenModelBytes.mockReturnValue(new Promise(() => undefined));
    await render(<GardenView3D state={garden} />);
    const images = screen.getAllByRole('image');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAccessibleName(/^Jardin, 24 hizb sur 60/);
  });

  it('mounts the GL view once the model is read, and keeps the picture until it draws', async () => {
    loadGardenModelBytes.mockResolvedValue(shippedGardenBytes());
    await render(<GardenView3D state={garden} />);
    await layOut();
    expect(await screen.findByTestId('garden-3d-gl')).toBeOnTheScreen();
    expect(screen.getByTestId('garden-scene', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('keeps the picture when the model cannot be read', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    loadGardenModelBytes.mockRejectedValue(new Error('no file'));
    await render(<GardenView3D state={garden} />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByTestId('garden-3d-gl')).toBeNull();
    expect(screen.getByTestId('garden-scene', { includeHiddenElements: true })).toBeOnTheScreen();
    warn.mockRestore();
  });

  it('shows no hint and offers no action before the garden can turn', async () => {
    loadGardenModelBytes.mockResolvedValue(shippedGardenBytes());
    await render(<GardenView3D state={garden} hintPlacement="below" />);
    await layOut();
    await screen.findByTestId('garden-3d-gl');
    expect(screen.queryByTestId('garden-3d-hint', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('image').props.accessibilityActions).toBeUndefined();
  });
});
