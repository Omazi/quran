/**
 * The glass of the floating controls and the fixed appearance of a part of the screen (the
 * reader's night page at night, owner's decision of 27 November 2026).
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ColorAppearance, GlassSurface, useColorValues } from '..';
import {
  changeReducedTransparency,
  iosPaletteColor,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '../test-support/environment';
import { appColors, palette } from '../tokens';

let mockHasSystemGlass = false;
jest.mock('expo-glass-effect', () => ({
  ...jest.requireActual('expo-glass-effect'),
  isLiquidGlassAvailable: () => mockHasSystemGlass,
  isGlassEffectAPIAvailable: () => mockHasSystemGlass,
}));

function Paper({ testID }: { testID: string }) {
  const colors = useColorValues();
  return <Text testID={testID}>{colors.paper}</Text>;
}

beforeEach(() => {
  mockHasSystemGlass = false;
  setDeviceConditions();
});
afterEach(resetDeviceConditions);

describe('a part of the screen in one appearance (ColorAppearance)', () => {
  it('takes the appearance it is given, whatever the device’s', async () => {
    await render(
      <>
        <Paper testID="device" />
        <ColorAppearance appearance="dark">
          <Paper testID="fixed" />
        </ColorAppearance>
        <ColorAppearance appearance={null}>
          <Paper testID="following" />
        </ColorAppearance>
      </>,
    );
    expect(screen.getByTestId('device')).toHaveTextContent(appColors.paper.light);
    expect(screen.getByTestId('fixed')).toHaveTextContent(appColors.paper.dark);
    expect(screen.getByTestId('following')).toHaveTextContent(appColors.paper.light);
  });
});

describe('the glass of a floating control', () => {
  it('is the system’s Liquid Glass on iOS 26, in the appearance of the screen', async () => {
    mockHasSystemGlass = true;
    await render(
      <ColorAppearance appearance="dark">
        <GlassSurface radius={22} isInteractive testID="glass" />
      </ColorAppearance>,
    );
    expect(screen.queryByTestId('glass-glass')).toBeNull();
    const glass = screen.getByTestId('glass').children[0] as { props: Record<string, unknown> };
    expect(glass.props).toEqual(
      expect.objectContaining({
        glassEffectStyle: 'regular',
        colorScheme: 'dark',
        isInteractive: true,
      }),
    );
  });

  it('is drawn translucent with a bright rim where the system glass is not available', async () => {
    setDeviceConditions({ os: 'android' });
    await render(<GlassSurface radius={22} testID="glass" />);
    const look = styleOf(screen.getByTestId('glass-glass'));
    expect(look.backgroundColor).toBe(palette.glassFill.light);
    expect(look.borderColor).toBe(palette.glassEdge.light);
    expect(look.borderRadius).toBe(22);
  });

  it('turns opaque with Reduce Transparency', async () => {
    await render(<GlassSurface radius={22} testID="glass" />);
    await changeReducedTransparency(true);
    expect(styleOf(screen.getByTestId('glass-glass')).backgroundColor).toEqual(
      iosPaletteColor('glassFillOpaque'),
    );
  });

  it('is the night glass on the night page', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <ColorAppearance appearance="dark">
        <GlassSurface radius={22} testID="glass" />
      </ColorAppearance>,
    );
    expect(styleOf(screen.getByTestId('glass-glass')).backgroundColor).toBe(palette.glassFill.dark);
  });
});
