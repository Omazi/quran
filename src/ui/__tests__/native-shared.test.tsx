import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { DynamicColorIOS, PlatformColor, processColor } from 'react-native';

import * as ui from '..';
import * as entry from '../native';
import * as defaultControls from '../native/default';
import { Icon } from '../native/icon';
import * as iosControls from '../native/ios';
import { PageIndicator } from '../native/page-indicator';
import type { IconSymbol } from '../native/types';
import { dateToTimeOfDay, timeOfDayToDate } from '../native/validation';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
} from '../test-support/environment';
import { appColors, fallbackSystemColors, textStyles, touchTargets } from '../tokens';

const DROP: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };

afterEach(resetDeviceConditions);

describe('entry of the native controls', () => {
  it('gives tests the default implementation, which they can query', () => {
    expect(entry.Button).toBe(defaultControls.Button);
    expect(entry.GroupedList).toBe(defaultControls.GroupedList);
    expect(entry.Button).not.toBe(iosControls.Button);
  });

  it('is the iOS file for Jest as for an iPhone: outside tests it gives the SwiftUI controls', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    jest.isolateModules(() => {
      const entryOutsideTests = jest.requireActual<typeof entry>('../native');
      const swiftUI = jest.requireActual<typeof iosControls>('../native/ios');
      const fallback = jest.requireActual<typeof defaultControls>('../native/default');
      expect(entryOutsideTests.Button).toBe(swiftUI.Button);
      expect(entryOutsideTests.GroupedList).toBe(swiftUI.GroupedList);
      expect(entryOutsideTests.Button).not.toBe(fallback.Button);
    });
  });

  it('has the same controls in both implementations', () => {
    expect(Object.keys(iosControls).sort()).toEqual(Object.keys(defaultControls).sort());
  });

  it('exports every control, the icon and the page indicator', () => {
    for (const name of [...Object.keys(defaultControls), 'Icon', 'PageIndicator']) {
      expect(entry).toHaveProperty(name);
      expect(ui).toHaveProperty(name);
    }
  });

  it('no longer exports the hand-made button styles and the shadowed card', () => {
    for (const name of ['Card', 'elevation', 'palette', 'typography']) {
      expect(ui).not.toHaveProperty(name);
    }
  });

  it('exports no colour value: a colour is obtained from useColors or by its role', () => {
    for (const name of ['appColors', 'fallbackSystemColors', 'iosSystemColorNames']) {
      expect(ui).not.toHaveProperty(name);
    }
    expect(ui).toHaveProperty('useColors');
  });
});

describe('Icon', () => {
  /** A decorative icon is hidden from screen readers, and so from the default queries. */
  function icon(testID: string) {
    return screen.getByTestId(testID, { includeHiddenElements: true });
  }

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'asks each platform for its own symbol ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await render(<Icon symbol={DROP} testID="icon" />);
      // Under Jest the iOS view of expo-symbols is used: it receives the SF Symbol name.
      expect(icon('icon')).toHaveProp('name', 'drop.fill');
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('takes the size and weight of the neighbouring text', async () => {
    setDeviceConditions();
    await render(
      <>
        <Icon symbol={DROP} testID="body" />
        <Icon symbol={DROP} textStyle="headline" testID="headline" />
        <Icon symbol={DROP} textStyle="footnote" testID="footnote" />
      </>,
    );
    expect(styleOf(icon('body'))).toMatchObject({ width: 17, height: 17 });
    expect(icon('body')).toHaveProp('weight', 'regular');
    expect(icon('headline')).toHaveProp('weight', 'semibold');
    expect(styleOf(icon('footnote'))).toMatchObject({ width: 13, height: 13 });
  });

  it('grows with the text size setting', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(<Icon symbol={DROP} testID="icon" />);
    const expected = textStyles.body.fontSize * LARGEST_FONT_SCALE;
    expect(styleOf(icon('icon')).width).toBeCloseTo(expected);
    expect(styleOf(icon('icon')).height).toBeCloseTo(expected);
  });

  it('is tinted with a colour role', async () => {
    setDeviceConditions();
    await render(
      <>
        <Icon symbol={DROP} testID="default" />
        <Icon symbol={DROP} color="accent" testID="accent" />
      </>,
    );
    // expo-symbols hands the colour to the native view in React Native's processed form.
    expect(icon('default')).toHaveProp('tint', processColor(PlatformColor('label')));
    expect(icon('accent')).toHaveProp('tint', processColor(DynamicColorIOS(appColors.accent)));
  });

  it('is hidden from screen readers when it only decorates', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} testID="icon" />);
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(icon('icon')).toHaveProp('accessibilityElementsHidden', true);
    expect(icon('icon')).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('is an image with a name when it carries meaning', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} accessibilityLabel="L’eau coule" />);
    expect(screen.getByRole('image', { name: 'L’eau coule' })).toBeOnTheScreen();
  });
});

describe('PageIndicator', () => {
  function renderIndicator(index: number, onChange = jest.fn(), count = 16) {
    return render(
      <PageIndicator
        count={count}
        index={index}
        onChange={onChange}
        accessibilityLabel="Page"
        accessibilityValue={`Page ${index + 1} sur ${count}`}
        testID="pages"
      />,
    );
  }

  /** The dots: the views that have a size and a colour of their own. */
  function dots() {
    return screen
      .getByTestId('pages')
      .queryAll((element) => typeof styleOf(element).borderRadius === 'number');
  }

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'shows one dot per page, the current one solid, in neutral colours ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderIndicator(2);
      expect(dots()).toHaveLength(16);
      const colors = dots().map((dot) => styleOf(dot).backgroundColor);
      expect(colors[2]).toEqual(PlatformColor('label'));
      expect(colors.filter((color) => color !== colors[2])).toHaveLength(15);
      expect(new Set(colors.map((color) => JSON.stringify(color))).size).toBe(2);
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it('lays its dots out in a row, which the platform mirrors in a right-to-left interface', async () => {
    setDeviceConditions({ rightToLeft: true });
    await renderIndicator(0);
    const row = dots()[0]?.parent;
    expect(row && styleOf(row).flexDirection).toBe('row');
  });

  it('is centred and never coloured with the accent', async () => {
    setDeviceConditions({ os: 'android', scheme: 'dark' });
    await renderIndicator(0);
    expect(styleOf(screen.getByTestId('pages')).alignSelf).toBe('center');
    const colors = dots().map((dot) => styleOf(dot).backgroundColor);
    expect(colors[0]).toBe(fallbackSystemColors.label.dark);
    expect(colors[1]).toBe(fallbackSystemColors.tertiaryLabel.dark);
    expect(colors).not.toContain(appColors.accent.dark);
  });

  it('is one adjustable element that says where the person is', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(2, onChange);
    const indicator = screen.getByRole('adjustable', { name: 'Page' });
    expect(indicator).toHaveAccessibilityValue({ text: 'Page 3 sur 16' });
    await fireEvent(indicator, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent(indicator, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('shows the previous or next page when one of its halves is pressed', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(2, onChange);
    await userEvent.press(screen.getByTestId('pages-next'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.press(screen.getByTestId('pages-previous'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('does not go before the first page or past the last one', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderIndicator(0, onChange, 3);
    await userEvent.press(screen.getByTestId('pages-previous'));
    await fireEvent(screen.getByTestId('pages'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    await screen.unmount();
    await renderIndicator(2, onChange, 3);
    await userEvent.press(screen.getByTestId('pages-next'));
    await fireEvent(screen.getByTestId('pages'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is a touch target of 44 points, twice as wide so that each half is one too', async () => {
    setDeviceConditions();
    await renderIndicator(0, jest.fn(), 2);
    expect(touchTargetHeight(screen.getByTestId('pages'))).toBeGreaterThanOrEqual(touchTargets.ios);
    expect(styleOf(screen.getByTestId('pages')).minWidth).toBeGreaterThanOrEqual(
      2 * touchTargets.ios,
    );
  });

  it.each([
    { count: 0, index: 0 },
    { count: 3, index: 3 },
    { count: 3, index: -1 },
    { count: 2.5, index: 0 },
  ])('refuses the position $index of $count', async ({ count, index }) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(
        <PageIndicator
          count={count}
          index={index}
          onChange={jest.fn()}
          accessibilityLabel="Page"
          accessibilityValue="Page"
        />,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe('time of day', () => {
  it.each([
    { hour: 0, minute: 0 },
    { hour: 12, minute: 30 },
    { hour: 23, minute: 59 },
  ])('$hour:$minute survives the trip through a date', (time) => {
    expect(dateToTimeOfDay(timeOfDayToDate(time))).toEqual(time);
  });

  it('reads the local hours and minutes of any date', () => {
    expect(dateToTimeOfDay(new Date(2026, 10, 24, 5, 7, 59))).toEqual({ hour: 5, minute: 7 });
  });
});
