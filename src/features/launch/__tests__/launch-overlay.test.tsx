import { render, screen } from '@testing-library/react-native';

import { launchColors, launchMarkWidth } from '@/ui';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { LaunchOverlay } from '../launch-overlay';
import { LAUNCH_MARK } from '../mark-geometry';

const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

// The overlay is hidden from the accessibility tree: the queries must look at hidden elements.
const hidden = { includeHiddenElements: true } as const;
const overlay = () => screen.getByTestId('launch-overlay', hidden);

afterEach(resetDeviceConditions);

describe('LaunchOverlay', () => {
  it('is a flat water colour before the device has said whether motion is reduced', async () => {
    setDeviceConditions({ scheme: 'light' });
    await render(<LaunchOverlay phase="playing" motion={null} onLayout={jest.fn()} />);
    expect(overlay()).toHaveStyle({
      backgroundColor: launchColors.water.light,
    });
    expect(screen.queryByTestId('launch-mark', hidden)).toBeNull();
  });

  it.each([
    ['light', launchColors.water.light],
    ['dark', launchColors.water.dark],
  ] as const)(
    'is the water of the native launch screen in the %s appearance',
    async (scheme, water) => {
      setDeviceConditions({ scheme });
      await render(<LaunchOverlay phase="playing" motion="full" onLayout={jest.fn()} />);
      expect(overlay()).toHaveStyle({ backgroundColor: water });
    },
  );

  it('is hidden from VoiceOver, says nothing, and holds no text', async () => {
    await render(<LaunchOverlay phase="playing" motion="full" onLayout={jest.fn()} />);
    const root = overlay();
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(root.props.accessible).toBe(false);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('draws the mark: the letters, the drops and the leaf, for either motion', async () => {
    for (const motion of ['full', 'reduced'] as const) {
      const { unmount } = await render(
        <LaunchOverlay phase="playing" motion={motion} onLayout={jest.fn()} />,
      );
      expect(screen.getByTestId('launch-mark', hidden)).toBeTruthy();
      await unmount();
    }
    expect(LAUNCH_MARK.drops.length).toBeGreaterThan(0);
  });

  it('lets touches through only once it is leaving', async () => {
    const { rerender } = await render(
      <LaunchOverlay phase="playing" motion="full" onLayout={jest.fn()} />,
    );
    expect(overlay().props.pointerEvents).toBe('auto');
    await rerender(<LaunchOverlay phase="leaving" motion="full" onLayout={jest.fn()} />);
    expect(overlay().props.pointerEvents).toBe('none');
  });

  it('reports its first layout', async () => {
    const onLayout = jest.fn();
    await render(<LaunchOverlay phase="playing" motion={null} onLayout={onLayout} />);
    overlay().props.onLayout();
    expect(onLayout).toHaveBeenCalledTimes(1);
  });
});

describe('the native launch screen', () => {
  const config = JSON.parse(
    readFileSync(resolve(expect.getState().testPath ?? '', '../../../../../app.json'), 'utf8'),
  ) as {
    expo: { plugins: [string, Record<string, unknown>][] };
  };
  const splash = config.expo.plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  )?.[1] as {
    backgroundColor: string;
    dark: { backgroundColor: string };
  };

  it('is the colour the overlay takes over, in both appearances, so nothing flashes', () => {
    expect(splash.backgroundColor).toBe(launchColors.water.light);
    expect(splash.dark.backgroundColor).toBe(launchColors.water.dark);
  });

  it('shows no picture: the mark is drawn by the overlay, which must start from bare water', () => {
    expect(splash).not.toHaveProperty('image');
    expect(splash.dark).not.toHaveProperty('image');
    expect(launchMarkWidth).toBe(180);
  });
});
