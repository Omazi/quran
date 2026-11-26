import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DEFAULT_GARDEN_CONFIG, type GardenState } from '@/domain/garden';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { GARDEN_PICTURE_ASPECT_RATIO, MAX_TRANSITION_MS, STEP_DURATION_MS } from '../config';
import { baseAsset, waterAsset } from '../garden-images';
import { previewGardenState } from '../garden-preview';
import { GARDEN_SPRITES } from '../garden-sprites.generated';
import { pictureStep } from '../growth-pose';
import { GardenScene } from '../garden-scene';
import { showLanguage } from '../test-support/screen-conditions';

// The native image is a stub under Jest that keeps none of its props: this stand-in keeps them,
// so that a test can read which picture each layer shows and how it changes.
jest.mock('expo-image', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return { Image: (props: object) => createElement('MockImage', props) };
});

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

const { droughtDaysToDeath } = DEFAULT_GARDEN_CONFIG;
const garden = (hizbCompleted: number, daysWithoutReading = 0): GardenState =>
  previewGardenState({ hizbCompleted, daysWithoutReading });

/** The assets of the images the scene draws now, in order, whatever the host calls them. */
function drawnImages() {
  return screen.getByTestId('garden-scene').queryAll(({ type }) => type === 'MockImage');
}

function drawnAssets(): unknown[] {
  return drawnImages().map(({ props }) => props.source);
}

describe('GardenScene with its pictures', () => {
  it('shows the dry garden and its water, and says the state in words', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24)} size="band" />);
    expect(
      screen.getByRole('image', { name: 'Jardin, 24 hizb sur 60, l’eau coule' }),
    ).toBeOnTheScreen();
    expect(drawnAssets()).toEqual([baseAsset('h24-f0'), waterAsset('h24-f0-w2')]);
    // No placeholder: the picture is the scene.
    expect(screen.queryByText('Jardin au hizb 24')).toBeNull();
  });

  it('lays a provisional tint over the garden, never over its water, when asked (D46)', async () => {
    await showLanguage('fr');
    await render(
      <GardenScene state={garden(24)} size="band" tint={{ color: '#123456', opacity: 0.2 }} />,
    );
    const images = drawnImages();
    expect(images.map(({ props }) => props.source)).toEqual([
      baseAsset('h24-f0'),
      baseAsset('h24-f0'),
      waterAsset('h24-f0-w2'),
    ]);
    expect(images[1]?.props).toMatchObject({ tintColor: '#123456' });
    expect(images[1]?.props.style).toEqual(expect.arrayContaining([{ opacity: 0.2 }]));
    expect(images[0]?.props.tintColor).toBeUndefined();
  });

  it('loads only the pictures the state needs: no water on a dry garden', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24, 3)} size="band" />);
    expect(drawnAssets()).toEqual([baseAsset('h24-f1')]);
  });

  it('shows the dead earth for a dead garden and the bare earth for no hizb', async () => {
    await showLanguage('fr');
    const dead = await render(<GardenScene state={garden(24, droughtDaysToDeath)} size="band" />);
    expect(drawnAssets()).toEqual([baseAsset('h00-f3')]);
    await dead.unmount();
    await render(<GardenScene state={garden(0)} size="band" />);
    expect(drawnAssets()).toEqual([baseAsset('h00-f0')]);
  });

  it('draws the element of the hizb in progress from its first page, smaller while it grows', async () => {
    await showLanguage('fr');
    const base = garden(24);
    if (base.nextElement === null) throw new Error('The test needs a next element.');
    const state = { ...base, nextElement: { ...base.nextElement, growth: 0.4 } };
    await render(<GardenScene state={state} size="band" />);
    await fireEvent(screen.getByTestId('garden-scene'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 272 } },
    });
    expect(drawnAssets()).toEqual([
      baseAsset('h24-f0'),
      waterAsset('h24-f0-w2'),
      GARDEN_SPRITES[25]?.asset,
    ]);
    expect(screen.getByTestId('garden-growing-sprite')).toHaveStyle({
      transform: [{ scale: pictureStep(0.4)?.scale }],
    });
  });

  it('draws nothing growing before the first counted page', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24)} size="band" />);
    await fireEvent(screen.getByTestId('garden-scene'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 272 } },
    });
    expect(screen.queryByTestId('garden-growing-sprite')).toBeNull();
    expect(drawnAssets()).toEqual([baseAsset('h24-f0'), waterAsset('h24-f0-w2')]);
  });

  it('keeps the proportions of the picture, and the whole space of a page for the other size', async () => {
    await showLanguage('fr');
    const band = await render(<GardenScene state={garden(24)} size="band" />);
    expect(screen.getByTestId('garden-scene')).toHaveStyle({
      alignSelf: 'stretch',
      aspectRatio: GARDEN_PICTURE_ASPECT_RATIO,
    });
    await band.unmount();
    await render(<GardenScene state={garden(24)} size="fill" />);
    expect(screen.getByTestId('garden-scene')).toHaveStyle({ flex: 1 });
  });

  it('shows the picture whole, never cropped', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24)} size="fill" />);
    const images = drawnImages();
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image.props.contentFit).toBe('contain');
  });

  it('rests the picture on the bottom edge of a taller box, so the words follow the garden (D31)', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24)} size="fill" />);
    const images = drawnImages();
    expect(images.length).toBeGreaterThan(1);
    for (const image of images) expect(image.props.contentPosition).toBe('bottom center');
  });

  it('shows a placeholder, not a broken image, when the set lacks the picture', async () => {
    await showLanguage('fr');
    const base = new Set(['h00-f0']);
    await render(
      <GardenScene state={garden(24)} size="band" images={{ base, water: new Set() }} />,
    );
    expect(screen.getByText('Jardin au hizb 24')).toBeOnTheScreen();
    expect(drawnAssets()).toEqual([]);
  });
});

describe('GardenScene changes by steps (D26)', () => {
  it('shows the first picture at once, with no fade', async () => {
    await showLanguage('fr');
    await render(<GardenScene state={garden(24)} size="band" />);
    const image = drawnImages()[0];
    expect(image?.props.transition).toBeNull();
  });

  it('goes through the pictures in between, the water first, then the leaves', async () => {
    jest.useFakeTimers();
    await showLanguage('fr');
    const view = await render(<GardenScene state={garden(24)} size="band" />);
    await view.rerender(<GardenScene state={garden(24, droughtDaysToDeath)} size="band" />);
    const seen: unknown[][] = [];
    const sampleMs = 50;
    for (
      let elapsed = 0;
      elapsed < MAX_TRANSITION_MS + STEP_DURATION_MS.decay;
      elapsed += sampleMs
    ) {
      seen.push(drawnAssets());
      await act(() => jest.advanceTimersByTimeAsync(sampleMs));
    }
    const bases = seen.map((assets) => assets[0]);
    // Water leaves first: the base is still the full-leaf garden when the water is low.
    expect(seen[0]).toEqual([baseAsset('h24-f0'), waterAsset('h24-f0-w1')]);
    expect(bases.indexOf(baseAsset('h24-f1'))).toBeGreaterThan(0);
    expect(bases.indexOf(baseAsset('h24-f3'))).toBeGreaterThan(bases.indexOf(baseAsset('h24-f1')));
    // It ends on the dead earth.
    expect(seen.at(-1)).toEqual([baseAsset('h00-f3')]);
  });

  it('fades between pictures, and takes less time to come back than to dry', async () => {
    jest.useFakeTimers();
    await showLanguage('fr');
    const view = await render(<GardenScene state={garden(24, 3)} size="band" />);
    await view.rerender(<GardenScene state={garden(24)} size="band" />);
    const image = drawnImages()[0];
    expect(image?.props.transition).toMatchObject({
      duration: STEP_DURATION_MS.recovery,
      effect: 'cross-dissolve',
    });
    expect(STEP_DURATION_MS.recovery).toBeLessThan(STEP_DURATION_MS.decay);
  });

  it('starts again from the picture on screen when the state changes during a walk', async () => {
    jest.useFakeTimers();
    await showLanguage('fr');
    const view = await render(<GardenScene state={garden(24)} size="band" />);
    await view.rerender(<GardenScene state={garden(24, droughtDaysToDeath)} size="band" />);
    await act(() => jest.advanceTimersByTimeAsync(STEP_DURATION_MS.decay));
    await view.rerender(<GardenScene state={garden(24)} size="band" />);
    await act(() => jest.advanceTimersByTimeAsync(STEP_DURATION_MS.decay * 20));
    expect(drawnAssets()).toEqual([baseAsset('h24-f0'), waterAsset('h24-f0-w2')]);
  });

  it('shows the final picture at once, with nothing animated, under reduced motion', async () => {
    jest.useFakeTimers();
    setDeviceConditions({ reducedMotion: true });
    await showLanguage('fr');
    const view = await render(<GardenScene state={garden(24)} size="band" />);
    await act(() => jest.advanceTimersByTimeAsync(1));
    await view.rerender(<GardenScene state={garden(24, droughtDaysToDeath)} size="band" />);
    expect(drawnAssets()).toEqual([baseAsset('h00-f3')]);
    const image = drawnImages()[0];
    expect(image?.props.transition).toBeNull();
    // Nothing is scheduled: later, the picture is still the final one.
    await act(() => jest.advanceTimersByTimeAsync(MAX_TRANSITION_MS));
    expect(drawnAssets()).toEqual([baseAsset('h00-f3')]);
  });
});
