import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  ActionButton,
  Avatar,
  Card,
  DottedProgress,
  GradientBackdrop,
  Pill,
  ProgressRing,
  SectionHeader,
  AppText,
} from '..';
import { contrastRatio } from '../test-support/contrast';
import {
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  withDescendants,
} from '../test-support/environment';
import {
  backdropGradients,
  contrastThresholds,
  palette,
  highContrastPalette,
  layout,
} from '../tokens';

const DROP = { ios: 'drop.fill', android: 'water_drop' } as const;

afterEach(resetDeviceConditions);

describe('the palette of the validated mockups', () => {
  type Pair = keyof typeof palette;
  /** Each word colour, on every surface the home screen sets it on. */
  const TEXT_ON: readonly (readonly [Pair, readonly Pair[]])[] = [
    ['heading', ['canvas', 'surface']],
    ['muted', ['canvas', 'surface', 'surfaceInset']],
    ['water', ['surface']],
    ['actionTint', ['canvas', 'surface', 'actionTonal']],
    ['onAction', ['action']],
    ['thirst', ['thirstSurface']],
    ['thirstSecondary', ['thirstSurface']],
    ['earth', ['surface']],
    ['earthSecondary', ['surface']],
  ];

  it.each(['light', 'dark'] as const)('keeps every word at 4.5:1 or more (%s)', (appearance) => {
    const failures = TEXT_ON.flatMap(([text, surfaces]) =>
      surfaces
        .map((surface) => ({
          text,
          surface,
          ratio: contrastRatio(palette[text][appearance], palette[surface][appearance]),
        }))
        .filter(({ ratio }) => ratio < contrastThresholds.text),
    );
    expect(failures).toEqual([]);
  });

  /** The words set on each gradient: the header everywhere, the water where it can flow. */
  const ON_GRADIENT: Readonly<
    Record<keyof typeof backdropGradients, readonly (keyof typeof palette)[]>
  > = {
    growing: ['dateLabel', 'heading', 'water', 'drought'],
    thirsty: ['dateLabel', 'heading', 'drought'],
    dead: ['dateLabel', 'heading', 'earth', 'earthSecondary'],
    complete: ['heading', 'muted'],
  };
  /** The completed khatma writes its words under the garden: the lower half of its gradient. */
  const FIRST_STOP_UNDER_TEXT: Readonly<Record<keyof typeof backdropGradients, number>> = {
    growing: 0,
    thirsty: 0,
    dead: 0,
    complete: 0.5,
  };

  it.each(['light', 'dark'] as const)(
    'keeps the words on the gradients readable at every stop (%s)',
    (appearance) => {
      const failures = (Object.keys(ON_GRADIENT) as (keyof typeof ON_GRADIENT)[]).flatMap((name) =>
        backdropGradients[name][appearance]
          .filter(([offset]) => offset >= FIRST_STOP_UNDER_TEXT[name])
          .flatMap(([offset, color]) =>
            ON_GRADIENT[name]
              .filter(
                (text) => contrastRatio(palette[text][appearance], color) < contrastThresholds.text,
              )
              .map((text) => `${text} on ${name} at ${offset}`),
          ),
      );
      expect(failures).toEqual([]);
    },
  );

  it('stands out more with Increase Contrast than without', () => {
    const roles = Object.keys(highContrastPalette) as (keyof typeof highContrastPalette)[];
    for (const role of roles) {
      for (const appearance of ['light', 'dark'] as const) {
        const surface = role === 'action' ? palette.onAction : palette.surface;
        const standard = contrastRatio(palette[role][appearance], surface[appearance]);
        const high = contrastRatio(highContrastPalette[role][appearance], surface[appearance]);
        expect(high).toBeGreaterThan(standard);
      }
    }
  });
});

describe('ActionButton', () => {
  it('is a button named by its label, at least 44 points tall, that calls back', async () => {
    const onPress = jest.fn();
    await render(<ActionButton label="Lire et arroser" symbol={DROP} onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Lire et arroser' });
    expect(touchTargetHeight(button)).toBeGreaterThanOrEqual(layout.touchTarget);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fills the main action with the forest green, the quiet one with pale green', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <>
        <ActionButton label="Nouvelle khatma" onPress={jest.fn()} testID="filled" />
        <ActionButton label="Partager" variant="tonal" onPress={jest.fn()} testID="tonal" />
      </>,
    );
    expect(styleOf(screen.getByTestId('filled')).backgroundColor).toBe(palette.action.light);
    expect(styleOf(screen.getByTestId('tonal')).backgroundColor).toBe(palette.actionTonal.light);
    expect(styleOf(screen.getByText('Nouvelle khatma')).color).toBe(palette.onAction.light);
  });

  it('refuses a button of a symbol alone without a name for VoiceOver', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<ActionButton symbol={DROP} onPress={jest.fn()} />)).rejects.toThrow(
      TypeError,
    );
  });
});

describe('ProgressRing', () => {
  it('is one progress element, heard by its words', async () => {
    await render(
      <ProgressRing
        progress={5 / 8}
        size="large"
        tone="water"
        accessibilityLabel="Arrosage du jour"
        accessibilityValue="5 pages sur 8"
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Arrosage du jour' })).toHaveAccessibilityValue({
      text: '5 pages sur 8',
    });
  });

  it.each([-0.1, 1.2, Number.NaN])('refuses a progress of %p', async (progress) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      render(
        <ProgressRing
          progress={progress}
          size="small"
          tone="growth"
          accessibilityLabel="Hizb 25"
          accessibilityValue="?"
        />,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe('DottedProgress', () => {
  it('draws one dot per step and is heard as "24 hizb sur 60"', async () => {
    await render(
      <DottedProgress
        total={60}
        reached={24}
        hasStepInProgress
        accessibilityLabel="Hizb terminés"
        accessibilityValue="24 hizb sur 60"
        testID="dots"
      />,
    );
    const dots = screen.getByTestId('dots');
    expect(dots.children).toHaveLength(60);
    expect(screen.getByRole('progressbar', { name: 'Hizb terminés' })).toHaveAccessibilityValue({
      min: 0,
      max: 60,
      now: 24,
      text: '24 hizb sur 60',
    });
  });

  it('fills from the leading side, so it mirrors in Arabic by itself', async () => {
    setDeviceConditions({ os: 'android', rightToLeft: true });
    await render(
      <DottedProgress total={60} reached={3} accessibilityLabel="a" accessibilityValue="b" />,
    );
    expect(directionDependentStyles(screen.container)).toEqual([]);
  });

  it.each([
    [0, 0],
    [60, 61],
    [60, -1],
    [60, 2.5],
  ])('refuses %p steps with %p reached', async (total, reached) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      render(
        <DottedProgress
          total={total}
          reached={reached}
          accessibilityLabel="a"
          accessibilityValue="b"
        />,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe('Pill, Avatar, Card, SectionHeader, GradientBackdrop', () => {
  it('a pill is one element, named by what its number means', async () => {
    await render(
      <Pill symbol={DROP} symbolColor="flame" label="12" accessibilityLabel="12 jours de suite" />,
    );
    expect(screen.getByLabelText('12 jours de suite')).toBeOnTheScreen();
  });

  it('an avatar decorates a name: screen readers skip it', async () => {
    await render(<Avatar content={{ initial: 'I' }} color={0} size="small" testID="avatar" />);
    expect(screen.getByTestId('avatar', { includeHiddenElements: true })).toHaveProp(
      'accessibilityElementsHidden',
      true,
    );
  });

  it('a card that is a button is named, 44 points tall at least', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Imane, 38 hizb">
        <AppText>Imane</AppText>
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Imane, 38 hizb' });
    expect(touchTargetHeight(card)).toBeGreaterThanOrEqual(layout.touchTarget);
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a section header is a heading with its link as a button', async () => {
    const onPress = jest.fn();
    await render(
      <SectionHeader title="Jardins voisins" action={{ label: 'Tout voir', onPress }} />,
    );
    expect(screen.getByRole('header', { name: 'Jardins voisins' })).toBeOnTheScreen();
    const link = screen.getByRole('button', { name: 'Tout voir' });
    expect(touchTargetHeight(link)).toBeGreaterThanOrEqual(layout.touchTarget);
    await fireEvent.press(link);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a gradient is a background: hidden from screen readers, touches go through', async () => {
    await render(<GradientBackdrop name="growing" extendUp={100} />);
    const all = withDescendants(screen.container);
    expect(all.some((element) => element.props.pointerEvents === 'none')).toBe(true);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
  });
});
