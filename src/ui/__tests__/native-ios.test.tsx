/**
 * The iOS implementation. Under Jest a SwiftUI view is a stub that keeps its props: these tests
 * check which system component each control asks for, with which style, label and colour, and
 * that events reach the caller. They cannot check how iOS draws the result.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { DynamicColorIOS, Platform } from 'react-native';

import {
  Button,
  ChoiceRow,
  ContentUnavailable,
  Gauge,
  GroupedList,
  ListRow,
  ListSection,
  ProgressIndicator,
  StepperRow,
  SwitchRow,
  TimePickerRow,
} from '../native/ios';
import type { IconSymbol } from '../native/types';
import {
  APPEARANCES_AND_DIRECTIONS,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  withDescendants,
  type RenderedElement,
} from '../test-support/environment';
import { appColors, touchTargets } from '../tokens';

const ACCENT = { type: 'color', color: DynamicColorIOS(appColors.accent) };
const ON_ACCENT = { type: 'color', color: DynamicColorIOS(appColors.onAccent) };
const BOOK: IconSymbol = { ios: 'book.closed', android: 'book_2' };
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
  ] as const)('%s is the system %s style, tinted with the accent', async (variant, style) => {
    setDeviceConditions();
    await render(<Button label="Action" variant={variant} onPress={jest.fn()} testID="button" />);
    const button = screen.getByTestId('button');
    expect(modifierOf(button, 'buttonStyle')).toMatchObject({ style });
    expect(modifierOf(button, 'tint')).toMatchObject({ tint: ACCENT });
    expect(swiftUITexts(button)).toEqual(['Action']);
  });

  it('draws the label of the prominent style in the charter colour, readable in both appearances', async () => {
    setDeviceConditions();
    await render(<Button label="Lire et arroser" onPress={jest.fn()} testID="button" />);
    const label = firstChild(screen.getByTestId('button'));
    expect(modifierOf(label, 'foregroundStyle')).toMatchObject({ style: ON_ACCENT });
  });

  it('leaves the label of the other styles, and of a disabled button, to the system', async () => {
    setDeviceConditions();
    await render(
      <>
        <Button label="A" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="B" variant="plain" onPress={jest.fn()} testID="plain" />
        <Button label="C" onPress={jest.fn()} disabled testID="disabled" />
      </>,
    );
    for (const testID of ['secondary', 'plain', 'disabled']) {
      const label = firstChild(screen.getByTestId(testID));
      expect(modifierOf(label, 'foregroundStyle')).toBeUndefined();
    }
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
    expect(modifierOf(plainLabel, 'frame')).toMatchObject({ minHeight: touchTargets.ios });
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
    expect(modifierOf(button, 'tint')).toMatchObject({ tint: ACCENT });
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
});

describe('iOS rows', () => {
  it('SwitchRow is the system toggle, labelled by the row, in the system colour', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(<SwitchRow label="Mon jardin a soif" value onChange={onChange} testID="row" />);
    const toggle = screen.getByTestId('row');
    expect(toggle).toHaveProp('label', 'Mon jardin a soif');
    expect(toggle).toHaveProp('isOn', true);
    expect(modifierOf(toggle, 'tint')).toBeUndefined();
    await fireEvent(toggle, 'isOnChange', { nativeEvent: { isOn: false } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('SwitchRow can be disabled', async () => {
    setDeviceConditions();
    await render(
      <SwitchRow label="Rappel" value={false} onChange={jest.fn()} disabled testID="row" />,
    );
    expect(modifierOf(screen.getByTestId('row'), 'disabled')).toMatchObject({ disabled: true });
  });

  it('StepperRow puts the system stepper next to its written value', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <StepperRow
        label="Pages par jour"
        value={5}
        valueLabel="5 pages"
        min={1}
        max={60}
        onChange={onChange}
        testID="goal"
      />,
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
      <ChoiceRow
        label="Langue"
        options={LANGUAGES}
        value="fr"
        onChange={onChange}
        testID="language"
      />,
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

  it('TimePickerRow is the system compact picker for hours and minutes, in the accent', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <TimePickerRow
        label="Heure du rappel"
        value={{ hour: 20, minute: 30 }}
        onChange={onChange}
        testID="time"
      />,
    );
    const picker = screen.getByTestId('time');
    expect(picker).toHaveProp('title', 'Heure du rappel');
    expect(picker).toHaveProp('displayedComponents', ['hourAndMinute']);
    expect(modifierOf(picker, 'datePickerStyle')).toMatchObject({ style: 'compact' });
    expect(modifierOf(picker, 'tint')).toMatchObject({ tint: ACCENT });
    const shown = new Date(picker.props.selection as string);
    expect([shown.getHours(), shown.getMinutes()]).toEqual([20, 30]);
    await fireEvent(picker, 'dateChange', {
      nativeEvent: { date: new Date(2026, 10, 24, 6, 5).getTime() },
    });
    expect(onChange).toHaveBeenCalledWith({ hour: 6, minute: 5 });
  });
});

describe('iOS status', () => {
  it('ProgressIndicator is the system linear bar, labelled, in the accent', async () => {
    setDeviceConditions();
    await render(
      <ProgressIndicator value={0.4} accessibilityLabel="Téléchargement" testID="bar" />,
    );
    const bar = screen.getByTestId('bar');
    expect(bar).toHaveProp('value', 0.4);
    expect(modifierOf(bar, 'progressViewStyle')).toMatchObject({ style: 'linear' });
    expect(modifierOf(bar, 'tint')).toMatchObject({ tint: ACCENT });
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
      tint: { type: 'color', color: DynamicColorIOS(appColors.growth) },
    });
    expect(swiftUITexts(gauge).sort()).toEqual(
      ['A soif', 'Florissant', 'Santé du jardin', 'À sec'].sort(),
    );
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

describe('iOS invalid values', () => {
  beforeEach(() => {
    // React reports the error thrown by a component on the console; the test asserts on it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('refuses a stepper range SwiftUI would crash on', async () => {
    await expect(
      render(
        <StepperRow label="x" valueLabel="y" value={5} min={10} max={1} onChange={jest.fn()} />,
      ),
    ).rejects.toThrow(RangeError);
  });

  it('refuses a progress, a gauge value or a time out of range', async () => {
    await expect(render(<ProgressIndicator value={2} accessibilityLabel="x" />)).rejects.toThrow(
      RangeError,
    );
    await expect(render(<Gauge value={-1} label="x" valueLabel="y" />)).rejects.toThrow(RangeError);
    await expect(
      render(<TimePickerRow label="x" value={{ hour: 24, minute: 0 }} onChange={jest.fn()} />),
    ).rejects.toThrow(RangeError);
  });
});
