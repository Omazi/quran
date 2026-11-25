/**
 * The iOS implementation. Under Jest a SwiftUI view is a stub that keeps its props: these tests
 * check which system component each control asks for, with which style, label and colour, and
 * that events reach the caller. They cannot check how iOS draws the result.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform, PlatformColor, Text as RNText } from 'react-native';

import {
  Button,
  ButtonPairRow,
  ButtonRow,
  ChoiceRow,
  ContentRow,
  ContentUnavailable,
  Gauge,
  GroupedList,
  Icon,
  LabelRow,
  ListRow,
  ListSection,
  Pager,
  ProgressIndicator,
  StepperRow,
  SwitchRow,
  TimePickerRow,
} from '../native/ios';
import * as pagerSettings from '../native/ios/pager-settings';
import type { IconSymbol } from '../native/types';
import {
  APPEARANCES_AND_DIRECTIONS,
  iosAppColor,
  iosPaletteColor,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  swiftUIViewsWithoutHost,
  withDescendants,
  type RenderedElement,
} from '../test-support/environment';
import { touchTargets } from '../tokens';

const ON_ACTION = { type: 'color', color: iosPaletteColor('onAction') };
const ACTION_TINT = { type: 'color', color: iosPaletteColor('actionTint') };
const BOOK: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const DROP: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
/** A decorative icon is hidden from screen readers, and so from the default queries. */
const HIDDEN = { includeHiddenElements: true };
const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
] as const;

interface Modifier {
  $type: string;
  [parameter: string]: unknown;
}

/** The SwiftUI modifiers of an element, in the order they are applied. */
function modifiersOf(element: RenderedElement): Modifier[] {
  // Host elements expose untyped props; Expo UI puts its modifier records there.
  return (element.props.modifiers as Modifier[] | undefined) ?? [];
}

function modifierOf(element: RenderedElement, type: string): Modifier | undefined {
  return modifiersOf(element).find((modifier) => modifier.$type === type);
}

/** The SwiftUI hosts: the views that carry the writing direction. */
function hosts(): RenderedElement[] {
  return screen.container.queryAll(({ props }) => props.layoutDirection !== undefined);
}

/** The strings shown by SwiftUI `Text` views below an element. */
function swiftUITexts(element: RenderedElement): string[] {
  return withDescendants(element)
    .map(({ props }) => props.text as unknown)
    .filter((text): text is string => typeof text === 'string');
}

function firstChild(element: RenderedElement): RenderedElement {
  const child = element.children[0];
  if (child === undefined || typeof child === 'string') throw new Error('No child element.');
  return child;
}

/** A row lives in a list: a test of one row puts it alone in one. */
function InList({ children }: { children: ReactNode }) {
  return (
    <GroupedList>
      <ListSection>{children}</ListSection>
    </GroupedList>
  );
}

afterEach(resetDeviceConditions);

describe('iOS hosts', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'pass the writing direction to SwiftUI and leave the appearance to the system ($scheme, right to left: $rightToLeft)',
    async ({ scheme, rightToLeft }) => {
      setDeviceConditions({ scheme, rightToLeft });
      await render(
        <>
          <Button label="Lire et arroser" onPress={jest.fn()} />
          <GroupedList>
            <ListSection>
              <SwitchRow label="Rappel du jour" value onChange={jest.fn()} />
            </ListSection>
          </GroupedList>
          <ProgressIndicator value={0.5} accessibilityLabel="Téléchargement" />
          <Gauge value={0.5} label="Santé" valueLabel="Bonne" />
        </>,
      );
      expect(hosts()).toHaveLength(4);
      for (const host of hosts()) {
        expect(host).toHaveProp('layoutDirection', rightToLeft ? 'rightToLeft' : 'leftToRight');
        expect(host.props.colorScheme).toBeUndefined();
        // The action colour is given once, to the host, as the tint of everything below.
        expect(host).toHaveProp('seedColor', iosPaletteColor('actionTint'));
      }
    },
  );

  it('do not nest: a control inside a grouped list uses the list as its host', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <Button label="Revoir la présentation" variant="plain" onPress={jest.fn()} />
          <Gauge value={0.5} label="Santé" valueLabel="Bonne" />
          <ProgressIndicator value={0.5} accessibilityLabel="Téléchargement" />
        </ListSection>
      </GroupedList>,
    );
    expect(hosts()).toHaveLength(1);
  });
});

describe('iOS Button', () => {
  it.each([
    ['primary', 'borderedProminent'],
    ['secondary', 'bordered'],
    ['plain', 'borderless'],
  ] as const)('%s is the system %s style, tinted by its host', async (variant, style) => {
    setDeviceConditions();
    await render(<Button label="Action" variant={variant} onPress={jest.fn()} testID="button" />);
    const button = screen.getByTestId('button');
    expect(modifierOf(button, 'buttonStyle')).toMatchObject({ style });
    // The prominent style is filled with the capsule button's green; the others take the host's.
    if (variant === 'primary') {
      expect(modifierOf(button, 'tint')).toMatchObject({
        tint: { type: 'color', color: iosPaletteColor('action') },
      });
    } else {
      expect(modifierOf(button, 'tint')).toBeUndefined();
    }
    expect(button.props.role).toBeUndefined();
    expect(hosts()[0]).toHaveProp('seedColor', iosPaletteColor('actionTint'));
    expect(swiftUITexts(button)).toEqual(['Action']);
  });

  it.each(['secondary', 'plain'] as const)(
    'a destructive %s button has the system role and the system red',
    async (variant) => {
      setDeviceConditions();
      await render(
        <Button
          label="Tout effacer"
          variant={variant}
          role="destructive"
          onPress={jest.fn()}
          testID="button"
        />,
      );
      const button = screen.getByTestId('button');
      expect(button).toHaveProp('role', 'destructive');
      expect(modifierOf(button, 'tint')).toMatchObject({
        tint: { type: 'color', color: PlatformColor('systemRed') },
      });
    },
  );

  it('draws the label of the prominent style in the charter colour, readable in both appearances', async () => {
    setDeviceConditions();
    await render(<Button label="Lire et arroser" onPress={jest.fn()} testID="button" />);
    const label = firstChild(screen.getByTestId('button'));
    expect(modifierOf(label, 'foregroundStyle')).toMatchObject({ style: ON_ACTION });
  });

  it('writes the other styles in the green that reads on the screen, and leaves a disabled button to the system', async () => {
    setDeviceConditions();
    await render(
      <>
        <Button label="A" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="B" variant="plain" onPress={jest.fn()} testID="plain" />
        <Button label="C" onPress={jest.fn()} disabled testID="disabled" />
      </>,
    );
    for (const testID of ['secondary', 'plain']) {
      const label = firstChild(screen.getByTestId(testID));
      expect(modifierOf(label, 'foregroundStyle')).toMatchObject({ style: ACTION_TINT });
    }
    expect(
      modifierOf(firstChild(screen.getByTestId('disabled')), 'foregroundStyle'),
    ).toBeUndefined();
    expect(modifierOf(screen.getByTestId('disabled'), 'disabled')).toMatchObject({
      disabled: true,
    });
  });

  it('keeps a 44-point target: large bordered controls, a framed borderless label', async () => {
    setDeviceConditions();
    await render(
      <>
        <Button label="A" onPress={jest.fn()} testID="primary" />
        <Button label="B" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="C" variant="plain" onPress={jest.fn()} testID="plain" />
      </>,
    );
    expect(modifierOf(screen.getByTestId('primary'), 'controlSize')).toMatchObject({
      size: 'large',
    });
    expect(modifierOf(screen.getByTestId('secondary'), 'controlSize')).toMatchObject({
      size: 'large',
    });
    const plainLabel = firstChild(screen.getByTestId('plain'));
    expect(modifierOf(plainLabel, 'frame')).toMatchObject({
      minWidth: touchTargets.ios,
      minHeight: touchTargets.ios,
    });
    expect(modifierOf(plainLabel, 'contentShape')).toMatchObject({ shape: 'rectangle' });
  });

  it('calls back when the system button is pressed', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(<Button label="Lire et arroser" onPress={onPress} testID="button" />);
    await fireEvent(screen.getByTestId('button'), 'buttonPress');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hugs its label by default and spans the width when asked', async () => {
    setDeviceConditions();
    await render(<Button label="Court" onPress={jest.fn()} testID="button" />);
    expect(hosts()[0]).toHaveProp('matchContentsHorizontal', true);
    expect(hosts()[0]).toHaveProp('matchContentsVertical', true);
    await screen.unmount();
    await render(<Button label="Court" onPress={jest.fn()} fullWidth testID="button" />);
    expect(hosts()[0]?.props.matchContentsHorizontal).not.toBe(true);
    expect(hosts()[0] && styleOf(hosts()[0]!)).toEqual({ alignSelf: 'stretch' });
    const label = firstChild(screen.getByTestId('button'));
    expect(modifierOf(label, 'frame')).toMatchObject({ maxWidth: Infinity });
  });

  it('is a plain list action inside a grouped list: the row is the button', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <Button label="Revoir" variant="plain" onPress={jest.fn()} testID="button" />
        </ListSection>
      </GroupedList>,
    );
    const button = screen.getByTestId('button');
    expect(modifierOf(button, 'buttonStyle')).toBeUndefined();
    expect(modifierOf(button, 'controlSize')).toBeUndefined();
    expect(modifierOf(firstChild(button), 'frame')).toBeUndefined();
  });
});

describe('iOS GroupedList', () => {
  it('is the system form, filling its place, with titled sections and footers', async () => {
    setDeviceConditions();
    await render(
      <GroupedList testID="list">
        <ListSection title="Rappels" footer="Tu peux les changer dans les réglages.">
          <ListRow label="Vendredi : sourate Al-Kahf" testID="row" />
        </ListSection>
      </GroupedList>,
    );
    expect(styleOf(hosts()[0]!)).toEqual({ flex: 1 });
    const section = firstChild(screen.getByTestId('list'));
    expect(section).toHaveProp('title', 'Rappels');
    expect(swiftUITexts(section)).toEqual([
      'Tu peux les changer dans les réglages.',
      'Vendredi : sourate Al-Kahf',
    ]);
  });

  it('in the garden appearance, keeps the system form over the warm canvas, its rows on white cards', async () => {
    setDeviceConditions();
    await render(
      <GroupedList appearance="garden" testID="list">
        <ListSection title="Rappels">
          <ListRow label="Vendredi : sourate Al-Kahf" />
        </ListSection>
      </GroupedList>,
    );
    const form = screen.getByTestId('list');
    expect(modifierOf(form, 'scrollContentBackground')).toMatchObject({ visible: 'hidden' });
    expect(modifierOf(firstChild(form), 'listRowBackground')).toMatchObject({
      color: iosPaletteColor('surface'),
    });
  });

  it('leaves the system backgrounds alone by default', async () => {
    setDeviceConditions();
    await render(
      <GroupedList testID="list">
        <ListSection title="Rappels">
          <ListRow label="Vendredi : sourate Al-Kahf" />
        </ListSection>
      </GroupedList>,
    );
    const form = screen.getByTestId('list');
    expect(modifierOf(form, 'scrollContentBackground')).toBeUndefined();
    expect(modifierOf(firstChild(form), 'listRowBackground')).toBeUndefined();
  });

  it('shows a value at the trailing side of a row with the system labelled content', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <ListRow label="Aujourd’hui" value="3 pages sur 5" testID="row" />
        </ListSection>
      </GroupedList>,
    );
    const row = screen.getByTestId('row');
    expect(row).toHaveProp('label', 'Aujourd’hui');
    expect(swiftUITexts(row)).toEqual(['3 pages sur 5']);
  });

  it('gives a row that opens something a button and the forward disclosure indicator', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(
      <GroupedList>
        <ListSection>
          <ListRow label="Reprendre" value="Page 212" onPress={onPress} testID="row" />
        </ListSection>
      </GroupedList>,
    );
    const row = screen.getByTestId('row');
    expect(swiftUITexts(row)).toEqual(['Reprendre', 'Page 212']);
    const indicators = row.queryAll(({ props }) => props.systemName === 'chevron.forward');
    expect(indicators).toHaveLength(1);
    expect(modifierOf(indicators[0]!, 'accessibilityHidden')).toMatchObject({ hidden: true });
    await fireEvent(row, 'buttonPress');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('puts the symbol of a row before its words with the system label, the words in the label colour', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <ListRow label="Réglages" symbol={BOOK} onPress={jest.fn()} testID="row" />
        </ListSection>
      </GroupedList>,
    );
    const row = screen.getByTestId('row');
    const symbols = row.queryAll(({ props }) => props.systemName === 'book.closed');
    expect(symbols).toHaveLength(1);
    // Decorative: VoiceOver reads the words of the row.
    expect(modifierOf(symbols[0]!, 'accessibilityHidden')).toMatchObject({ hidden: true });
    expect(swiftUITexts(row)).toEqual(['Réglages']);
    expect(row.queryAll(({ props }) => props.systemName === 'chevron.forward')).toHaveLength(1);
  });

  it('gives an abbreviated value the words VoiceOver should say', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <ListRow
            label="Temps de lecture"
            value="1 h 35 min"
            valueAccessibilityLabel="1 heure 35 minutes"
            testID="row"
          />
        </ListSection>
      </GroupedList>,
    );
    const value = screen.getByTestId('row').queryAll(({ props }) => props.text === '1 h 35 min')[0];
    expect(value).toBeDefined();
    expect(modifierOf(value!, 'accessibilityLabel')).toMatchObject({ label: '1 heure 35 minutes' });
  });
});

describe('iOS rows', () => {
  it('SwitchRow is the system toggle, labelled by the row, kept in the system green', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <SwitchRow label="Mon jardin a soif" value onChange={onChange} testID="row" />
      </InList>,
    );
    const toggle = screen.getByTestId('row');
    expect(toggle).toHaveProp('label', 'Mon jardin a soif');
    expect(toggle).toHaveProp('isOn', true);
    // Stated on the switch, because the host tints everything else with the accent.
    expect(modifierOf(toggle, 'tint')).toMatchObject({
      tint: { type: 'color', color: PlatformColor('systemGreen') },
    });
    await fireEvent(toggle, 'isOnChange', { nativeEvent: { isOn: false } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('SwitchRow can be disabled', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <SwitchRow label="Rappel" value={false} onChange={jest.fn()} disabled testID="row" />
      </InList>,
    );
    expect(modifierOf(screen.getByTestId('row'), 'disabled')).toMatchObject({ disabled: true });
  });

  it('StepperRow puts the system stepper next to its written value', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <StepperRow
          label="Pages par jour"
          value={5}
          valueLabel="5 pages"
          min={1}
          max={60}
          onChange={onChange}
          testID="goal"
        />
      </InList>,
    );
    const stepper = screen.getByTestId('goal');
    expect(stepper.props).toMatchObject({ value: 5, min: 1, max: 60, step: 1 });
    expect(stepper).toHaveProp('label', 'Pages par jour');
    expect(modifierOf(stepper, 'accessibilityValue')).toMatchObject({ value: '5 pages' });
    expect(swiftUITexts(screen.container)).toEqual(['5 pages']);
    await fireEvent(stepper, 'valueChange', { nativeEvent: { value: 6 } });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('ChoiceRow is the system pop-up button with one tagged option per choice', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <ChoiceRow
          label="Langue"
          options={LANGUAGES}
          value="fr"
          onChange={onChange}
          testID="language"
        />
      </InList>,
    );
    const picker = screen.getByTestId('language');
    expect(picker).toHaveProp('label', 'Langue');
    expect(picker).toHaveProp('selection', 'fr');
    expect(modifierOf(picker, 'pickerStyle')).toMatchObject({ style: 'menu' });
    expect(swiftUITexts(picker)).toEqual(['Français', 'العربية']);
    const tags = withDescendants(picker).map((element) => modifierOf(element, 'tag')?.tag);
    expect(tags.filter((tag) => tag !== undefined)).toEqual(['fr', 'ar']);
    await fireEvent(picker, 'selectionChange', { nativeEvent: { selection: 'ar' } });
    expect(onChange).toHaveBeenCalledWith('ar');
  });

  it('TimePickerRow is the system compact picker for hours and minutes, tinted by its host', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <TimePickerRow
          label="Heure du rappel"
          value={{ hour: 20, minute: 30 }}
          onChange={onChange}
          testID="time"
        />
      </InList>,
    );
    const picker = screen.getByTestId('time');
    expect(picker).toHaveProp('title', 'Heure du rappel');
    expect(picker).toHaveProp('displayedComponents', ['hourAndMinute']);
    expect(modifierOf(picker, 'datePickerStyle')).toMatchObject({ style: 'compact' });
    expect(modifierOf(picker, 'tint')).toBeUndefined();
    expect(hosts()[0]).toHaveProp('seedColor', iosPaletteColor('actionTint'));
    const shown = new Date(picker.props.selection as string);
    expect([shown.getHours(), shown.getMinutes()]).toEqual([20, 30]);
    await fireEvent(picker, 'dateChange', {
      nativeEvent: { date: new Date(2026, 10, 24, 6, 5).getTime() },
    });
    expect(onChange).toHaveBeenCalledWith({ hour: 6, minute: 5 });
  });
});

describe('iOS status', () => {
  it('ProgressIndicator is the system linear bar, labelled, tinted by its host', async () => {
    setDeviceConditions();
    await render(
      <ProgressIndicator value={0.4} accessibilityLabel="Téléchargement" testID="bar" />,
    );
    const bar = screen.getByTestId('bar');
    expect(bar).toHaveProp('value', 0.4);
    expect(modifierOf(bar, 'progressViewStyle')).toMatchObject({ style: 'linear' });
    expect(modifierOf(bar, 'tint')).toBeUndefined();
    expect(hosts()[0]).toHaveProp('seedColor', iosPaletteColor('actionTint'));
    expect(modifierOf(bar, 'accessibilityLabel')).toMatchObject({ label: 'Téléchargement' });
  });

  it('ProgressIndicator without a value is the system activity indicator, untinted', async () => {
    setDeviceConditions();
    await render(<ProgressIndicator accessibilityLabel="Préparation" testID="spinner" />);
    const spinner = screen.getByTestId('spinner');
    expect(spinner.props.value).toBeUndefined();
    expect(modifierOf(spinner, 'progressViewStyle')).toMatchObject({ style: 'circular' });
    expect(modifierOf(spinner, 'tint')).toBeUndefined();
    expect(modifierOf(spinner, 'accessibilityLabel')).toMatchObject({ label: 'Préparation' });
  });

  it('Gauge is the system linear capacity gauge with a label for the value and both ends', async () => {
    setDeviceConditions();
    await render(
      <Gauge
        value={0.25}
        label="Santé du jardin"
        valueLabel="A soif"
        minimumLabel="À sec"
        maximumLabel="Florissant"
        tone="growth"
        testID="gauge"
      />,
    );
    const gauge = screen.getByTestId('gauge');
    expect(gauge).toHaveProp('value', 0.25);
    expect(modifierOf(gauge, 'gaugeStyle')).toMatchObject({ style: 'linearCapacity' });
    expect(modifierOf(gauge, 'tint')).toMatchObject({
      tint: { type: 'color', color: iosAppColor('growth') },
    });
    expect(swiftUITexts(gauge).sort()).toEqual(
      ['A soif', 'Florissant', 'Santé du jardin', 'À sec'].sort(),
    );
  });

  it('Gauge takes the accent from its host unless a tone is given', async () => {
    setDeviceConditions();
    await render(
      <>
        <Gauge value={0.5} label="Lecture" valueLabel="Moitié" testID="accent" />
        <Gauge value={0.2} label="Eau" valueLabel="A soif" tone="warning" testID="warning" />
      </>,
    );
    expect(modifierOf(screen.getByTestId('accent'), 'tint')).toBeUndefined();
    expect(modifierOf(screen.getByTestId('warning'), 'tint')).toMatchObject({
      tint: { type: 'color', color: PlatformColor('systemOrange') },
    });
    // The tone tints the gauge; the words are plain SwiftUI texts, left to the system's colours.
    for (const text of screen.getByTestId('warning').queryAll(({ props }) => 'text' in props)) {
      expect(modifierOf(text, 'foregroundStyle')).toBeUndefined();
    }
  });

  it('ContentUnavailable is the system empty state, with an SF Symbol', async () => {
    setDeviceConditions();
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue('27.1');
    await render(
      <ContentUnavailable
        title="Le Coran arrive bientôt"
        description="Bientôt disponible."
        symbol={BOOK}
        testID="empty"
      />,
    );
    expect(screen.getByTestId('empty').props).toMatchObject({
      title: 'Le Coran arrive bientôt',
      description: 'Bientôt disponible.',
      systemImage: 'book.closed',
    });
    expect(hosts()).toHaveLength(1);
  });

  it('ContentUnavailable falls back to the default one on iOS 16, which has no system one', async () => {
    setDeviceConditions();
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue('16.7');
    await render(
      <ContentUnavailable title="Le Coran arrive bientôt" symbol={BOOK} testID="empty" />,
    );
    expect(screen.getByRole('header', { name: 'Le Coran arrive bientôt' })).toBeOnTheScreen();
    expect(hosts()).toHaveLength(0);
  });
});

describe('iOS Icon', () => {
  it('is an SF Symbol set in the text style and weight of the neighbouring text', async () => {
    setDeviceConditions();
    await render(
      <>
        <Icon symbol={DROP} testID="body" />
        <Icon symbol={DROP} textStyle="headline" testID="headline" />
        <Icon symbol={DROP} textStyle="largeTitle" testID="title" />
      </>,
    );
    expect(screen.getByTestId('body', HIDDEN)).toHaveProp('systemName', 'drop.fill');
    expect(modifierOf(screen.getByTestId('body', HIDDEN), 'font')).toMatchObject({
      textStyle: 'body',
      weight: 'regular',
    });
    expect(modifierOf(screen.getByTestId('headline', HIDDEN), 'font')).toMatchObject({
      textStyle: 'headline',
      weight: 'semibold',
    });
    expect(modifierOf(screen.getByTestId('title', HIDDEN), 'font')).toMatchObject({
      textStyle: 'largeTitle',
      weight: 'semibold',
    });
  });

  it('leaves its size to Dynamic Type: no fixed size, whatever the text size setting', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(<Icon symbol={DROP} testID="icon" />);
    const icon = screen.getByTestId('icon', HIDDEN);
    expect(icon.props.size).toBeUndefined();
    expect(modifierOf(icon, 'frame')).toBeUndefined();
    expect(modifierOf(icon, 'font')?.size).toBeUndefined();
  });

  it('has a host of its size when alone, and none inside a list', async () => {
    setDeviceConditions();
    await render(<Icon symbol={DROP} testID="icon" />);
    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]).toHaveProp('matchContentsHorizontal', true);
    expect(hosts()[0]).toHaveProp('matchContentsVertical', true);
    await screen.unmount();
    await render(
      <GroupedList>
        <ListSection>
          <Icon symbol={DROP} testID="icon" />
        </ListSection>
      </GroupedList>,
    );
    expect(hosts()).toHaveLength(1);
  });

  it('is coloured by a role and hidden from VoiceOver unless it has a label', async () => {
    setDeviceConditions();
    await render(
      <>
        <Icon symbol={DROP} testID="decorative" />
        <Icon symbol={DROP} color="warning" accessibilityLabel="Le jardin a soif" testID="thirst" />
      </>,
    );
    const decorative = screen.getByTestId('decorative', HIDDEN);
    expect(modifierOf(decorative, 'foregroundStyle')).toMatchObject({
      style: { type: 'color', color: PlatformColor('label') },
    });
    expect(modifierOf(decorative, 'accessibilityHidden')).toMatchObject({ hidden: true });
    const thirst = screen.getByTestId('thirst', HIDDEN);
    expect(modifierOf(thirst, 'foregroundStyle')).toMatchObject({
      style: { type: 'color', color: PlatformColor('systemOrange') },
    });
    expect(modifierOf(thirst, 'accessibilityLabel')).toMatchObject({ label: 'Le jardin a soif' });
    expect(modifierOf(thirst, 'accessibilityHidden')).toBeUndefined();
  });
});

describe('iOS Pager', () => {
  function renderPager(page: number, onPageChange = jest.fn(), pageCount = 3) {
    return render(
      <Pager
        pageCount={pageCount}
        page={page}
        onPageChange={onPageChange}
        renderPage={(index) => (
          <>
            <RNText>{`Page ${index + 1}`}</RNText>
            <Icon symbol={DROP} testID={`drop-${index}`} />
          </>
        )}
        accessibilityLabel="Page"
        accessibilityValue={`Page ${page + 1} sur ${pageCount}`}
        testID="pager"
      />,
    );
  }

  it('tells every page how far the system indicator lies over its bottom', async () => {
    setDeviceConditions();
    const renderPage = jest.fn(() => <RNText>Une page</RNText>);
    await render(
      <Pager
        pageCount={2}
        page={0}
        onPageChange={jest.fn()}
        renderPage={renderPage}
        accessibilityLabel="Page"
        testID="pager"
      />,
    );
    expect(renderPage).toHaveBeenCalledWith(0, touchTargets.ios);
  });

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'is the system paged tab view with the system page indicator ($scheme, right to left: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions(conditions);
      await renderPager(1);
      const pager = screen.getByTestId('pager');
      expect(modifierOf(pager, 'tabViewStyle')).toMatchObject({
        type: 'page',
        indexDisplayMode: 'always',
      });
      expect(modifierOf(pager, 'indexViewStyle')).toMatchObject({
        backgroundDisplayMode: 'always',
      });
      expect(pager).toHaveProp('selection', '1');
      // One tab per page, and the system mirrors them from the direction of the host.
      expect(
        pager.children.map((tab) => (typeof tab === 'string' ? tab : tab.props.value)),
      ).toEqual(['0', '1', '2']);
      expect(hosts()[0]).toHaveProp(
        'layoutDirection',
        conditions.rightToLeft ? 'rightToLeft' : 'leftToRight',
      );
    },
  );

  it('does not colour the indicator and draws none of its own', async () => {
    setDeviceConditions();
    await renderPager(0);
    const pager = screen.getByTestId('pager');
    expect(modifierOf(pager, 'tint')).toBeUndefined();
    expect(modifierOf(pager, 'foregroundStyle')).toBeUndefined();
    expect(screen.queryByRole('adjustable')).not.toBeOnTheScreen();
  });

  it('fills its place and shows every page as React Native content', async () => {
    setDeviceConditions();
    await renderPager(0);
    expect(styleOf(hosts()[0]!)).toEqual({ flex: 1 });
    for (const text of ['Page 1', 'Page 2', 'Page 3']) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
  });

  it('gives a control inside a page a host of its own', async () => {
    setDeviceConditions();
    await renderPager(0);
    // One host for the pager, one for the icon of each of the three pages.
    expect(hosts()).toHaveLength(4);
    expect(swiftUIViewsWithoutHost()).toEqual([]);
  });

  it('reports the page the person swiped to', async () => {
    setDeviceConditions();
    const onPageChange = jest.fn();
    await renderPager(0, onPageChange);
    await fireEvent(screen.getByTestId('pager'), 'selectionChange', {
      nativeEvent: { selection: '2' },
    });
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('falls back to the default pager when the system one is switched off', async () => {
    setDeviceConditions();
    jest.replaceProperty(pagerSettings, 'IOS_USES_SYSTEM_PAGER', false);
    await renderPager(1);
    expect(screen.getByRole('adjustable', { name: 'Page' })).toHaveAccessibilityValue({
      text: 'Page 2 sur 3',
    });
    expect(modifierOf(screen.getByTestId('pager'), 'tabViewStyle')).toBeUndefined();
  });

  it('refuses a page that does not exist', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderPager(3)).rejects.toThrow(RangeError);
  });
});

describe('iOS LabelRow', () => {
  it('is the system label: the system draws the symbol itself, in the accent of the list', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <LabelRow label="Lecture du jour" symbol={BOOK} testID="row" />
      </InList>,
    );
    const row = screen.getByTestId('row');
    expect(row.props).toMatchObject({ title: 'Lecture du jour', systemImage: 'book.closed' });
    // No image of the app and no colour of the app: both are the system's.
    expect(row.queryAll(({ props }) => props.systemName !== undefined)).toHaveLength(0);
    expect(modifiersOf(row)).toEqual([]);
  });

  it.each([
    ['warning', { type: 'color', color: PlatformColor('systemOrange') }],
    ['growth', { type: 'color', color: iosAppColor('growth') }],
    ['secondaryLabel', { type: 'hierarchical', hierarchical: 'secondary' }],
  ] as const)(
    'a %s tone colours the symbol, which still grows with the text',
    async (tone, style) => {
      setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
      await render(
        <InList>
          <LabelRow label="Le jardin a soif" symbol={DROP} tone={tone} testID="row" />
        </InList>,
      );
      const row = screen.getByTestId('row');
      expect(row.props.systemImage).toBeUndefined();
      const symbols = row.queryAll(({ props }) => props.systemName === 'drop.fill');
      expect(symbols).toHaveLength(1);
      // A text style, not the 24 points Expo UI gives an image without a font.
      expect(modifiersOf(symbols[0]!).filter(({ $type }) => $type === 'font')).toEqual([
        { $type: 'font', textStyle: 'body' },
      ]);
      expect(modifierOf(symbols[0]!, 'foregroundStyle')).toMatchObject({ style });
      expect(modifierOf(symbols[0]!, 'accessibilityHidden')).toMatchObject({ hidden: true });
    },
  );

  it('puts a second line under the label, and never colours the words with the tone', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <LabelRow
          label="Le jardin a soif"
          detail="Une page suffit à l’arroser."
          symbol={DROP}
          tone="warning"
          testID="row"
        />
      </InList>,
    );
    const row = screen.getByTestId('row');
    expect(row.props.title).toBeUndefined();
    expect(swiftUITexts(row)).toEqual(['Le jardin a soif', 'Une page suffit à l’arroser.']);
    const [label, detail] = row.queryAll(({ props }) => 'text' in props);
    expect(label?.parent?.props).toMatchObject({ alignment: 'leading' });
    expect(modifiersOf(label!)).toEqual([]);
    expect(modifiersOf(detail!)).toEqual([
      { $type: 'font', textStyle: 'subheadline' },
      { $type: 'foregroundStyle', style: { type: 'hierarchical', hierarchical: 'secondary' } },
    ]);
  });
});

/** The modifiers of a row that gives up the margins, background and separator of the list. */
const BARE_ROW = [
  { $type: 'listRowInsets', top: 0, leading: 0, bottom: 0, trailing: 0 },
  { $type: 'listRowBackground', color: 'clear' },
  { $type: 'listRowSeparator', visibility: 'hidden' },
];

describe('iOS ButtonPairRow', () => {
  const pair = (onAccept = jest.fn(), onDecline = jest.fn()) => (
    <InList>
      <ButtonPairRow
        preferred={{
          label: 'Accepter',
          accessibilityLabel: 'Accepter Yacine',
          onPress: onAccept,
          testID: 'accept',
        }}
        other={{
          label: 'Refuser',
          accessibilityLabel: 'Refuser Yacine',
          onPress: onDecline,
          testID: 'decline',
        }}
      />
    </InList>
  );

  it('puts two system buttons side by side at the same width: prominent, then borderless', async () => {
    setDeviceConditions();
    await render(pair());
    const accept = screen.getByTestId('accept');
    const decline = screen.getByTestId('decline');
    expect(modifierOf(accept, 'buttonStyle')).toMatchObject({ style: 'borderedProminent' });
    expect(modifierOf(firstChild(accept), 'foregroundStyle')).toMatchObject({ style: ON_ACTION });
    expect(modifierOf(accept, 'tint')).toMatchObject({
      tint: { type: 'color', color: iosPaletteColor('action') },
    });
    // Each states its style: in a list row, buttons without one would press together.
    expect(modifierOf(decline, 'buttonStyle')).toMatchObject({ style: 'borderless' });
    for (const button of [accept, decline]) {
      expect(modifierOf(button, 'controlSize')).toMatchObject({ size: 'large' });
      expect(modifierOf(firstChild(button), 'frame')).toMatchObject({ maxWidth: Infinity });
    }
    expect(modifierOf(firstChild(decline), 'frame')).toMatchObject({
      minHeight: touchTargets.ios,
    });
    expect(accept.parent).toBe(decline.parent);
    // An ordinary row: the list's background and insets, in the card of the request.
    expect(accept.parent?.parent && modifiersOf(accept.parent.parent)).toEqual([]);
    expect(modifierOf(accept, 'accessibilityLabel')).toMatchObject({ label: 'Accepter Yacine' });
    expect(modifierOf(decline, 'accessibilityLabel')).toMatchObject({ label: 'Refuser Yacine' });
    expect(hosts()).toHaveLength(1);
    expect(swiftUIViewsWithoutHost(screen.container)).toEqual([]);
  });

  it('calls back the button pressed, and only that one', async () => {
    setDeviceConditions();
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    await render(pair(onAccept, onDecline));
    await fireEvent(screen.getByTestId('decline'), 'buttonPress');
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('stacks the two buttons at the largest text size', async () => {
    setDeviceConditions();
    await render(pair());
    // Under Jest both stacks are the same stub: the row (HStack) is the one aligned on centres.
    expect(screen.getByTestId('accept').parent).toHaveProp('alignment', 'center');
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await render(pair());
    expect(screen.getByTestId('accept').parent).not.toHaveProp('alignment', 'center');
    expect(screen.getByTestId('decline').parent).toBe(screen.getByTestId('accept').parent);
  });
});

describe('iOS ButtonRow', () => {
  it.each([
    ['primary', 'borderedProminent'],
    ['secondary', 'bordered'],
  ] as const)(
    'a %s button is the row itself: the system style, as wide as the row, 44 points at least',
    async (variant, style) => {
      setDeviceConditions();
      await render(
        <InList>
          <ButtonRow
            label="Lire et arroser"
            variant={variant}
            onPress={jest.fn()}
            testID="button"
          />
        </InList>,
      );
      const button = screen.getByTestId('button');
      expect(modifierOf(button, 'buttonStyle')).toMatchObject({ style });
      expect(modifierOf(button, 'controlSize')).toMatchObject({ size: 'large' });
      expect(modifierOf(firstChild(button), 'frame')).toMatchObject({ maxWidth: Infinity });
      expect(button.parent && modifiersOf(button.parent)).toEqual(BARE_ROW);
      // The list is the host: the button brings none.
      expect(hosts()).toHaveLength(1);
    },
  );

  it('a plain button keeps the row of the list, which is the button', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ButtonRow label="Revoir" variant="plain" onPress={jest.fn()} testID="button" />
      </InList>,
    );
    const button = screen.getByTestId('button');
    expect(modifierOf(button, 'buttonStyle')).toBeUndefined();
    expect(button.parent && modifiersOf(button.parent)).toEqual([]);
    expect(modifierOf(firstChild(button), 'frame')).toBeUndefined();
  });

  it('is the primary button by default and calls back when pressed', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(
      <InList>
        <ButtonRow label="Lire et arroser" onPress={onPress} testID="button" />
      </InList>,
    );
    const button = screen.getByTestId('button');
    expect(modifierOf(button, 'buttonStyle')).toMatchObject({ style: 'borderedProminent' });
    expect(modifierOf(firstChild(button), 'foregroundStyle')).toMatchObject({ style: ON_ACTION });
    await fireEvent(button, 'buttonPress');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['secondary', 'plain'] as const)(
    'keeps the roles and states of the button: destructive %s, disabled',
    async (variant) => {
      setDeviceConditions();
      await render(
        <InList>
          <ButtonRow
            label="Tout effacer"
            variant={variant}
            role="destructive"
            disabled
            onPress={jest.fn()}
            testID="button"
          />
        </InList>,
      );
      const button = screen.getByTestId('button');
      expect(button).toHaveProp('role', 'destructive');
      expect(modifierOf(button, 'tint')).toMatchObject({
        tint: { type: 'color', color: PlatformColor('systemRed') },
      });
      expect(modifierOf(button, 'disabled')).toMatchObject({ disabled: true });
    },
  );
});

describe('iOS ContentRow', () => {
  function renderContentRow(accessibilityLabel?: string) {
    return render(
      <InList>
        <ContentRow accessibilityLabel={accessibilityLabel} testID="content">
          <RNText>Scène du jardin</RNText>
          <Icon symbol={DROP} />
        </ContentRow>
      </InList>,
    );
  }

  it('is React Native content in a row without margins, background or separator', async () => {
    setDeviceConditions();
    await renderContentRow();
    const content = screen.getByTestId('content');
    expect(screen.getByText('Scène du jardin')).toBeOnTheScreen();
    expect(content.parent && modifiersOf(content.parent)).toEqual([]);
    expect(content.parent?.parent && modifiersOf(content.parent.parent)).toEqual(BARE_ROW);
  });

  it('takes the width of the row and gives the row the height of its content', async () => {
    setDeviceConditions();
    await renderContentRow();
    const content = screen.getByTestId('content');
    expect(content.parent?.props).toMatchObject({
      matchContentsHorizontal: false,
      matchContentsVertical: true,
    });
    // No height of its own: a filling content would have none to give.
    expect(styleOf(content)).toEqual({});
  });

  it('gives a control inside it a host of its own', async () => {
    setDeviceConditions();
    await renderContentRow();
    expect(hosts()).toHaveLength(2);
    expect(swiftUIViewsWithoutHost()).toEqual([]);
  });

  it('is one element for VoiceOver when it is given a label, and none otherwise', async () => {
    setDeviceConditions();
    await renderContentRow('Ton jardin : trois arbres en fleurs');
    expect(screen.getByLabelText('Ton jardin : trois arbres en fleurs')).toBe(
      screen.getByTestId('content'),
    );
    await screen.unmount();
    await renderContentRow();
    expect(screen.getByTestId('content')).toHaveProp('accessible', false);
  });
});

describe('iOS rows and sections outside a list', () => {
  beforeEach(() => {
    // React reports the error thrown by a component on the console; the test asserts on it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['ListSection', <ListSection key="section">{null}</ListSection>],
    ['ListRow', <ListRow key="row" label="Seule" />],
    ['SwitchRow', <SwitchRow key="switch" label="Rappel" value onChange={jest.fn()} />],
    [
      'StepperRow',
      <StepperRow
        key="stepper"
        label="Pages"
        value={5}
        valueLabel="5"
        min={1}
        max={60}
        onChange={jest.fn()}
      />,
    ],
    [
      'ChoiceRow',
      <ChoiceRow key="choice" label="Langue" options={LANGUAGES} value="fr" onChange={jest.fn()} />,
    ],
    [
      'TimePickerRow',
      <TimePickerRow
        key="time"
        label="Heure"
        value={{ hour: 8, minute: 0 }}
        onChange={jest.fn()}
      />,
    ],
    ['LabelRow', <LabelRow key="label" label="Seule" symbol={BOOK} />],
    ['ButtonRow', <ButtonRow key="button" label="Lire" onPress={jest.fn()} />],
    ['ContentRow', <ContentRow key="content">{null}</ContentRow>],
  ])('%s is refused: nothing would display it on an iPhone', async (name, element) => {
    await expect(render(element)).rejects.toThrow(`${name} must be inside a GroupedList`);
  });

  it('a row inside the React Native content of a ContentRow is refused too', async () => {
    await expect(
      render(
        <InList>
          <ContentRow>
            <ListRow label="Perdue" />
          </ContentRow>
        </InList>,
      ),
    ).rejects.toThrow('ListRow must be inside a GroupedList');
  });

  it('a ButtonRow refuses what a Button refuses', async () => {
    await expect(
      render(
        <InList>
          <ButtonRow label="Tout effacer" role="destructive" onPress={jest.fn()} />
        </InList>,
      ),
    ).rejects.toThrow(TypeError);
  });
});

describe('iOS invalid values', () => {
  beforeEach(() => {
    // React reports the error thrown by a component on the console; the test asserts on it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('refuses a destructive button in the prominent style', async () => {
    await expect(
      render(<Button label="Tout effacer" role="destructive" onPress={jest.fn()} />),
    ).rejects.toThrow(TypeError);
  });

  it('refuses a stepper range SwiftUI would crash on', async () => {
    await expect(
      render(
        <InList>
          <StepperRow label="x" valueLabel="y" value={5} min={10} max={1} onChange={jest.fn()} />
        </InList>,
      ),
    ).rejects.toThrow(RangeError);
  });

  it('refuses a progress, a gauge value or a time out of range', async () => {
    await expect(render(<ProgressIndicator value={2} accessibilityLabel="x" />)).rejects.toThrow(
      RangeError,
    );
    await expect(render(<Gauge value={-1} label="x" valueLabel="y" />)).rejects.toThrow(RangeError);
    await expect(
      render(
        <InList>
          <TimePickerRow label="x" value={{ hour: 24, minute: 0 }} onChange={jest.fn()} />
        </InList>,
      ),
    ).rejects.toThrow(RangeError);
  });
});
