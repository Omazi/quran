import { Host, RNHostView, Text as SwiftUIText } from '@expo/ui/swift-ui';
import { render, screen, userEvent } from '@testing-library/react-native';
import { PlatformColor, processColor, View } from 'react-native';

import * as ui from '..';
import * as entry from '../native';
import * as defaultControls from '../native/default';
import { Icon } from '../native/default/icon';
import * as iosControls from '../native/ios';
import type { IconSymbol } from '../native/types';
import { dateToTimeOfDay, timeOfDayToDate } from '../native/validation';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  iosAppColor,
  isSwiftUIHost,
  LARGEST_FONT_SCALE,
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  swiftUIViewsWithoutHost,
} from '../test-support/environment';
import { textStyles } from '../tokens';

const DROP: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };

afterEach(resetDeviceConditions);

describe('entry of the native controls', () => {
  it('gives tests the default implementation, which they can query', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(<entry.Button label="Lire et arroser" onPress={onPress} />);
    await userEvent.press(screen.getByRole('button', { name: 'Lire et arroser' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.container.queryAll(isSwiftUIHost)).toHaveLength(0);
  });

  it('gives a test the SwiftUI implementation when it asks for what an iPhone receives', async () => {
    setDeviceConditions();
    await renderOnIOS(<entry.Button label="Lire et arroser" onPress={jest.fn()} testID="button" />);
    expect(screen.container.queryAll(isSwiftUIHost)).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByTestId('button').type).toBe('ViewManagerAdapter_ExpoUI');
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

  it('exports every control and the page indicator', () => {
    for (const name of [...Object.keys(defaultControls), 'PageIndicator']) {
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

describe('renderOnIOS', () => {
  const settings = (
    <ui.Screen background="groupedBackground">
      <ui.GroupedList>
        <ui.ListSection>
          <ui.ContentRow accessibilityLabel="Ton jardin">
            <ui.AppText variant="largeTitle">Jardin</ui.AppText>
            <ui.Icon symbol={DROP} />
          </ui.ContentRow>
        </ui.ListSection>
        <ui.ListSection>
          <ui.LabelRow
            label="Le jardin a soif"
            detail="Une page suffit."
            symbol={DROP}
            tone="warning"
          />
          <ui.ButtonRow label="Plus tard" variant="plain" onPress={jest.fn()} />
        </ui.ListSection>
        <ui.ListSection>
          <ui.ButtonRow label="Commencer la lecture" onPress={jest.fn()} />
        </ui.ListSection>
        <ui.ListSection title="Rappels" footer="Tu peux les changer plus tard.">
          <ui.SwitchRow label="Rappel du jour" value onChange={jest.fn()} />
          <ui.TimePickerRow label="Heure" value={{ hour: 20, minute: 30 }} onChange={jest.fn()} />
          <ui.StepperRow
            label="Pages par jour"
            value={5}
            valueLabel="5"
            min={1}
            max={60}
            onChange={jest.fn()}
          />
          <ui.ChoiceRow
            label="Langue"
            options={[{ value: 'fr', label: 'Français' }]}
            value="fr"
            onChange={jest.fn()}
          />
          <ui.ListRow label="Revoir la présentation" onPress={jest.fn()} />
          <ui.Gauge value={0.5} label="Santé" valueLabel="Bonne" />
          <ui.Icon symbol={DROP} />
        </ui.ListSection>
      </ui.GroupedList>
      <ui.Button label="Lire et arroser" onPress={jest.fn()} />
      <ui.ProgressIndicator accessibilityLabel="Préparation" />
      <ui.Icon symbol={DROP} accessibilityLabel="L’eau coule" />
      <ui.ContentUnavailable title="Bientôt" symbol={DROP} />
    </ui.Screen>
  );

  it('accepts a screen made of the controls: every SwiftUI view has a host', async () => {
    setDeviceConditions();
    await renderOnIOS(settings);
    // The list, the icon inside its content row, the button, the spinner, the icon and the empty
    // state: one host each.
    expect(screen.container.queryAll(isSwiftUIHost)).toHaveLength(6);
  });

  it('accepts a pager whose pages hold controls: each gets a host inside its page', async () => {
    setDeviceConditions();
    await renderOnIOS(
      <ui.Pager
        pageCount={2}
        page={0}
        onPageChange={jest.fn()}
        renderPage={() => <ui.Button label="Autoriser les rappels" onPress={jest.fn()} />}
        accessibilityLabel="Page"
      />,
    );
    expect(screen.container.queryAll(isSwiftUIHost)).toHaveLength(3);
  });

  it('renders the same tree with the default implementation otherwise', async () => {
    setDeviceConditions();
    await render(settings);
    expect(screen.container.queryAll(isSwiftUIHost)).toHaveLength(0);
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeOnTheScreen();
  });

  it('reports a SwiftUI view that nothing hosts', async () => {
    setDeviceConditions();
    await render(<SwiftUIText testID="lost">Sans hôte</SwiftUIText>);
    expect(swiftUIViewsWithoutHost()).toHaveLength(1);
    expect(swiftUIViewsWithoutHost()[0]).toContain('Sans hôte');
  });

  it('reports a SwiftUI view placed in React Native content without a host of its own', async () => {
    setDeviceConditions();
    await render(
      <Host>
        <RNHostView>
          <View>
            <SwiftUIText>Sans hôte</SwiftUIText>
          </View>
        </RNHostView>
      </Host>,
    );
    expect(swiftUIViewsWithoutHost()).toHaveLength(1);
  });

  it('fails when the tree it renders has such a view', async () => {
    setDeviceConditions();
    await expect(renderOnIOS(<SwiftUIText>Sans hôte</SwiftUIText>)).rejects.toThrow();
  });
});

describe('default Icon', () => {
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
    expect(icon('accent')).toHaveProp('tint', processColor(iosAppColor('accent')));
  });

  it('is hidden from screen readers when it only decorates', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} testID="icon" />);
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(icon('icon')).toHaveProp('accessibilityElementsHidden', true);
    expect(icon('icon')).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('accepts the roles meant for a foreground, orange included, and no surface', async () => {
    setDeviceConditions();
    await render(
      <>
        <Icon symbol={DROP} color="warning" testID="thirst" accessibilityLabel="Soif" />
        {/* @ts-expect-error A background is not a colour for an icon. */}
        <Icon symbol={DROP} color="secondaryBackground" />
        {/* @ts-expect-error A separator is not a colour for an icon. */}
        <Icon symbol={DROP} color="separator" />
        {/* @ts-expect-error Paper is a surface. */}
        <Icon symbol={DROP} color="paper" />
      </>,
    );
    expect(icon('thirst')).toHaveProp('tint', processColor(PlatformColor('systemOrange')));
  });

  it('can sit next to a title as well', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} textStyle="largeTitle" testID="icon" />);
    expect(styleOf(icon('icon'))).toMatchObject({ width: 34, height: 34 });
    expect(icon('icon')).toHaveProp('weight', 'bold');
  });

  it('is an image with a name when it carries meaning', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} accessibilityLabel="L’eau coule" />);
    expect(screen.getByRole('image', { name: 'L’eau coule' })).toBeOnTheScreen();
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
