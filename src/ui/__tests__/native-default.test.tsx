import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { processColor, Text as RNText } from 'react-native';

import {
  Button,
  ButtonPairRow,
  ButtonRow,
  ChoiceRow,
  ContentRow,
  ContentUnavailable,
  Gauge,
  GroupedList,
  LabelRow,
  ListRow,
  ListSection,
  ProgressIndicator,
  StepperRow,
  SwitchRow,
  TimePickerRow,
} from '../native/default';
import type { IconSymbol } from '../native/types';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  fixedHeightsAroundText,
  iosPaletteColor,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
  withDescendants,
} from '../test-support/environment';
import {
  appColors,
  fallbackSystemColors,
  palette,
  layout,
  stateOpacity,
  textStyles,
  touchTargets,
} from '../tokens';

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
] as const;

const BOOK: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const DROP: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };

/** One of each control, as a settings screen would compose them. */
function EveryControl() {
  return (
    <>
      <GroupedList testID="list">
        <ListSection>
          <ContentRow accessibilityLabel="Ton jardin" testID="scene">
            <RNText>Scène</RNText>
          </ContentRow>
        </ListSection>
        <ListSection>
          <LabelRow
            label="Le jardin a soif"
            detail="Une page suffit à l’arroser."
            symbol={DROP}
            tone="warning"
            testID="notice"
          />
        </ListSection>
        <ListSection>
          <ButtonRow label="Commencer la lecture" onPress={jest.fn()} testID="row-button" />
        </ListSection>
        <ListSection title="Lecture" footer="5 pages par jour : une khatma en 121 jours.">
          <ListRow label="Aujourd’hui" value="3 pages sur 5" testID="today" />
          <ListRow label="Reprendre page 212" onPress={jest.fn()} testID="resume" />
          <StepperRow
            label="Pages par jour"
            value={5}
            valueLabel="5"
            min={1}
            max={60}
            onChange={jest.fn()}
            testID="goal"
          />
          <SwitchRow label="Rappel du jour" value onChange={jest.fn()} testID="reminder" />
          <TimePickerRow
            label="Heure"
            value={{ hour: 20, minute: 30 }}
            onChange={jest.fn()}
            testID="time"
          />
          <ChoiceRow
            label="Langue"
            options={LANGUAGES}
            value="fr"
            onChange={jest.fn()}
            testID="language"
          />
        </ListSection>
      </GroupedList>
      <Button label="Lire et arroser" onPress={jest.fn()} testID="primary" />
      <Button label="Plus tard" variant="secondary" onPress={jest.fn()} testID="secondary" />
      <Button label="Revoir" variant="plain" onPress={jest.fn()} testID="plain" />
      <ProgressIndicator value={0.4} accessibilityLabel="Téléchargement" testID="progress" />
      <ProgressIndicator accessibilityLabel="Préparation" testID="spinner" />
      <Gauge
        value={0.7}
        label="Santé du jardin"
        valueLabel="Bonne"
        minimumLabel="À sec"
        maximumLabel="Florissant"
        testID="gauge"
      />
      <ContentUnavailable
        title="Le Coran arrive bientôt"
        description="La lecture sera disponible dans une prochaine version."
        symbol={BOOK}
        testID="empty"
      />
    </>
  );
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

describe('default controls, together', () => {
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'render in $scheme, right to left: $rightToLeft, without a style tied to a side',
    async (conditions) => {
      setDeviceConditions({ os: 'android', ...conditions });
      await render(<EveryControl />);
      expect(screen.getByText('Lire et arroser')).toBeOnTheScreen();
      expect(directionDependentStyles(screen.container)).toEqual([]);
    },
  );

  it.each(['light', 'dark'] as const)('take their colours from the %s theme', async (scheme) => {
    setDeviceConditions({ os: 'android', scheme });
    await render(<EveryControl />);
    expect(styleOf(screen.getByTestId('primary')).backgroundColor).toBe(palette.action[scheme]);
    expect(styleOf(screen.getByText('Lire et arroser')).color).toBe(palette.onAction[scheme]);
    expect(styleOf(screen.getByText('Plus tard')).color).toBe(palette.actionTint[scheme]);
    expect(styleOf(screen.getByText('3 pages sur 5')).color).toBe(
      fallbackSystemColors.secondaryLabel[scheme],
    );
    expect(styleOf(screen.getByText('Aujourd’hui')).color).toBe(fallbackSystemColors.label[scheme]);
    // The switch, the stepper and the time take the action green too, as on iOS, where the host
    // tints every control with it (deviation 75): the water's teal keeps the water's meaning only.
    const action = palette.actionTint[scheme];
    // React Native hands the track colour to the platform switch under its own name.
    const onTracks = screen.container
      .queryAll(
        ({ props }) => props.trackColorForTrue !== undefined || props.onTintColor !== undefined,
      )
      .map(({ props }) => props.trackColorForTrue ?? props.onTintColor);
    expect(onTracks.length).toBeGreaterThan(0);
    for (const color of onTracks) expect(color).toBe(action);
    const timeTexts = screen
      .getByTestId('time')
      .queryAll(({ type, props }) => type === 'Text' && /30/.test(String(props.children)));
    expect(timeTexts).toHaveLength(1);
    expect(styleOf(timeTexts[0]!).color).toBe(action);
    const stepSymbols = screen
      .getByTestId('goal')
      .queryAll(({ props }) => props.tintColor !== undefined);
    expect(stepSymbols.length).toBe(2);
    for (const symbol of stepSymbols) expect(symbol.props.tintColor).toBe(action);
  });

  it('survive the largest text size: nothing is cut, capped or kept on one line', async () => {
    setDeviceConditions({ os: 'android', fontScale: LARGEST_FONT_SCALE });
    await render(<EveryControl />);
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    for (const text of screen.container.queryAll(({ type }) => type === 'Text')) {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.maxFontSizeMultiplier).toBeUndefined();
      expect(text.props.numberOfLines).toBeUndefined();
    }
  });

  it('let a row wrap its value under its label when both do not fit', async () => {
    setDeviceConditions({ os: 'android', fontScale: LARGEST_FONT_SCALE });
    await render(<EveryControl />);
    const row = screen.getByText('Aujourd’hui').parent;
    expect(row).not.toBeNull();
    expect(row && styleOf(row)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });

  it.each([
    'resume',
    'goal-decrement',
    'goal-increment',
    'reminder',
    'time',
    'primary',
    'plain',
    'row-button',
  ])('give %s a touch target of 44 points at least', async (testID) => {
    setDeviceConditions({ os: 'android' });
    await render(<EveryControl />);
    expect(touchTargetHeight(screen.getByTestId(testID))).toBeGreaterThanOrEqual(touchTargets.ios);
  });

  it('give every radio option a touch target of 44 points at least', async () => {
    setDeviceConditions({ os: 'android' });
    await render(<EveryControl />);
    for (const option of screen.getAllByRole('radio')) {
      expect(touchTargetHeight(option)).toBeGreaterThanOrEqual(touchTargets.ios);
    }
  });
});

describe('default Button', () => {
  it('is a button named by its label, and calls back when pressed', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(<Button label="Lire et arroser" onPress={onPress} />);
    await userEvent.press(screen.getByRole('button', { name: 'Lire et arroser' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fills only the main action with the action green', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <>
        <Button label="Principal" onPress={jest.fn()} testID="primary" />
        <Button label="Secondaire" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="Simple" variant="plain" onPress={jest.fn()} testID="plain" />
      </>,
    );
    expect(styleOf(screen.getByTestId('primary')).backgroundColor).toBe(palette.actionTint.light);
    expect(styleOf(screen.getByTestId('secondary')).backgroundColor).toBeUndefined();
    expect(styleOf(screen.getByTestId('secondary')).borderColor).toBe(palette.actionTint.light);
    expect(styleOf(screen.getByTestId('plain')).backgroundColor).toBeUndefined();
    expect(styleOf(screen.getByTestId('plain')).borderWidth).toBeUndefined();
  });

  it('says it is disabled, looks it, and does not call back', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} disabled testID="button" />);
    const button = screen.getByRole('button', { name: 'Continuer' });
    expect(button).toBeDisabled();
    expect(styleOf(screen.getByTestId('button')).opacity).toBe(stateOpacity.disabled);
    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('hugs its label by default and spans the width when asked', async () => {
    setDeviceConditions();
    await render(<Button label="Court" onPress={jest.fn()} testID="button" />);
    expect(screen.getByTestId('button').parent?.props.style).toEqual({ alignItems: 'flex-start' });
    await screen.rerender(<Button label="Court" onPress={jest.fn()} fullWidth testID="button" />);
    expect(screen.getByTestId('button').parent?.props.style).toEqual({ alignSelf: 'stretch' });
  });

  it.each(['secondary', 'plain'] as const)(
    'draws a destructive %s button in red, in both themes',
    async (variant) => {
      setDeviceConditions({ os: 'android', scheme: 'dark' });
      await render(
        <Button
          label="Tout effacer"
          variant={variant}
          role="destructive"
          onPress={jest.fn()}
          testID="button"
        />,
      );
      expect(styleOf(screen.getByText('Tout effacer')).color).toBe(
        fallbackSystemColors.destructive.dark,
      );
      expect(styleOf(screen.getByTestId('button')).backgroundColor).toBeUndefined();
      if (variant === 'secondary') {
        expect(styleOf(screen.getByTestId('button')).borderColor).toBe(
          fallbackSystemColors.destructive.dark,
        );
      }
    },
  );

  it('gives every variant a target of 44 points in both directions', async () => {
    setDeviceConditions();
    await render(
      <>
        <Button label="A" onPress={jest.fn()} testID="primary" />
        <Button label="B" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="C" variant="plain" onPress={jest.fn()} testID="plain" />
      </>,
    );
    for (const testID of ['primary', 'secondary', 'plain']) {
      const { minWidth, minHeight } = styleOf(screen.getByTestId(testID));
      expect(minWidth).toBeGreaterThanOrEqual(touchTargets.ios);
      expect(minHeight).toBeGreaterThanOrEqual(touchTargets.ios);
    }
  });

  it('uses the larger Material target on Android', () => {
    expect(touchTargets.android).toBe(48);
  });
});

describe('default GroupedList', () => {
  it('scrolls, and names each section with a heading and a footer', async () => {
    setDeviceConditions();
    await render(
      <GroupedList testID="list">
        <ListSection title="Rappels" footer="Tu peux les changer dans les réglages.">
          <ListRow label="Vendredi : sourate Al-Kahf" />
        </ListSection>
      </GroupedList>,
    );
    expect(screen.getByTestId('list').type).toBe('RCTScrollView');
    expect(screen.getByRole('header', { name: 'Rappels' })).toBeOnTheScreen();
    expect(screen.getByText('Tu peux les changer dans les réglages.')).toBeOnTheScreen();
    expect(screen.getByText('Vendredi : sourate Al-Kahf')).toBeOnTheScreen();
  });

  it('in the garden appearance, lays each section on a white card over the warm canvas', async () => {
    setDeviceConditions();
    await render(
      <GroupedList appearance="garden" testID="list">
        <ListSection title="Rappels" footer="Tu peux les changer dans les réglages.">
          <ListRow label="Vendredi : sourate Al-Kahf" />
        </ListSection>
      </GroupedList>,
    );
    // Under Jest the platform is iOS: the colour is the dynamic one of the palette.
    const surface = JSON.stringify(iosPaletteColor('surface'));
    const cards = withDescendants(screen.getByTestId('list')).filter(
      (element) => JSON.stringify(styleOf(element).backgroundColor) === surface,
    );
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(styleOf(card).borderRadius).toBeGreaterThan(0);
    expect(card).toHaveTextContent('Vendredi : sourate Al-Kahf');
    // The header and the footer stay on the canvas, outside the card, as on iOS.
    expect(card).not.toHaveTextContent(/Rappels|Tu peux/);
    expect(screen.getByRole('header', { name: 'Rappels' })).toBeOnTheScreen();
    expect(directionDependentStyles(screen.getByTestId('list'))).toEqual([]);
  });

  it('shows a section without header or footer', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <ListRow label="Seule" />
        </ListSection>
      </GroupedList>,
    );
    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(screen.getByText('Seule')).toBeOnTheScreen();
  });

  it('reads a row and its value as one element', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ListRow label="Aujourd’hui" value="3 pages sur 5" testID="row" />
      </InList>,
    );
    expect(screen.getByTestId('row')).toHaveProp('accessible', true);
    expect(screen.getByTestId('row')).toHaveTextContent('Aujourd’hui3 pages sur 5');
  });

  it('makes a row with an action a button', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(
      <InList>
        <ListRow label="Revoir la présentation" onPress={onPress} />
      </InList>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Revoir la présentation' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('puts a decorative symbol before the words of a row, in the action green', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(
      <InList>
        <ListRow label="Réglages" symbol={BOOK} onPress={onPress} testID="row" />
      </InList>,
    );
    const button = screen.getByRole('button', { name: 'Réglages' });
    const icons = button.queryAll(({ props }) => props.tintColor !== undefined);
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveProp('accessibilityElementsHidden', true);
    await userEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reads a value the way it is said when its written form is abbreviated', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ListRow
          label="Temps de lecture"
          value="1 h 35 min"
          valueAccessibilityLabel="1 heure 35 minutes"
          testID="row"
        />
      </InList>,
    );
    expect(screen.getByTestId('row')).toHaveProp(
      'accessibilityLabel',
      'Temps de lecture, 1 heure 35 minutes',
    );
    expect(screen.getByText('1 h 35 min')).toBeOnTheScreen();
  });
});

describe('default SwitchRow', () => {
  it('is one switch named by the row, which the whole row toggles', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <SwitchRow label="Mon jardin a soif" value={false} onChange={onChange} />
      </InList>,
    );
    const row = screen.getByRole('switch', { name: 'Mon jardin a soif' });
    expect(row).not.toBeChecked();
    await userEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports its state and passes on a change made on the switch itself', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <SwitchRow label="Rappel du jour" value onChange={onChange} />
      </InList>,
    );
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
    const platformSwitch = screen.container.queryAll(({ type }) => type === 'RCTSwitch')[0];
    expect(platformSwitch).toBeDefined();
    await fireEvent(platformSwitch!, 'valueChange', false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does nothing when disabled', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <SwitchRow label="Rappel du jour" value onChange={onChange} disabled />
      </InList>,
    );
    const row = screen.getByRole('switch', { name: 'Rappel du jour' });
    expect(row).toBeDisabled();
    await userEvent.press(row);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('default StepperRow', () => {
  function renderStepper(value: number, onChange = jest.fn()) {
    return render(
      <InList>
        <StepperRow
          label="Pages par jour"
          value={value}
          valueLabel={`${value} pages`}
          min={1}
          max={60}
          onChange={onChange}
          testID="goal"
        />
      </InList>,
    );
  }

  it('shows the value it changes, next to its buttons', async () => {
    setDeviceConditions();
    await renderStepper(5);
    expect(screen.getByText('Pages par jour')).toBeOnTheScreen();
    expect(screen.getByText('5 pages')).toBeOnTheScreen();
  });

  it('adds and removes one step with its two buttons', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderStepper(5, onChange);
    await userEvent.press(screen.getByTestId('goal-increment'));
    expect(onChange).toHaveBeenLastCalledWith(6);
    await userEvent.press(screen.getByTestId('goal-decrement'));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('is one adjustable element for screen readers, with its label and value', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderStepper(5, onChange);
    const stepper = screen.getByRole('adjustable', { name: 'Pages par jour' });
    expect(stepper).toHaveAccessibilityValue({ text: '5 pages' });
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(6);
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('stops at its bounds', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await renderStepper(1, onChange);
    await userEvent.press(screen.getByTestId('goal-decrement'));
    expect(onChange).not.toHaveBeenCalled();
    await screen.rerender(
      <InList>
        <StepperRow
          label="Pages par jour"
          value={60}
          valueLabel="60 pages"
          min={1}
          max={60}
          onChange={onChange}
          testID="goal"
        />
      </InList>,
    );
    await userEvent.press(screen.getByTestId('goal-increment'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('default ChoiceRow', () => {
  it('offers the options as a named radio group and marks the current one', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ChoiceRow label="Langue" options={LANGUAGES} value="en" onChange={jest.fn()} />
      </InList>,
    );
    // The group is a container, not an element of its own: its options stay reachable.
    expect(screen.getByLabelText('Langue')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Français' })).not.toBeChecked();
  });

  it('calls back with the chosen value', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <ChoiceRow label="Langue" options={LANGUAGES} value="fr" onChange={onChange} />
      </InList>,
    );
    await userEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    expect(onChange).toHaveBeenCalledWith('ar');
  });

  it('tells the options apart by shape as well as colour', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ChoiceRow label="Langue" options={LANGUAGES} value="fr" onChange={jest.fn()} />
      </InList>,
    );
    const symbolNames = screen.container
      .queryAll(({ props }) => typeof props.name === 'string')
      .map(({ props }) => props.name);
    expect(new Set(symbolNames).size).toBe(2);
  });
});

describe('default TimePickerRow', () => {
  const evening = { hour: 20, minute: 30 };
  const eveningAsWritten = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2001, 0, 1, 20, 30));

  it('shows the time the way the device writes it', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <TimePickerRow label="Heure du rappel" value={evening} onChange={jest.fn()} />
      </InList>,
    );
    expect(screen.getByText(eveningAsWritten)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Heure du rappel' })).toHaveAccessibilityValue({
      text: eveningAsWritten,
    });
  });

  it('opens the platform picker in place when pressed, and reports the chosen time', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <InList>
        <TimePickerRow label="Heure du rappel" value={evening} onChange={onChange} testID="time" />
      </InList>,
    );
    expect(screen.queryByTestId('time-picker')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('time'));
    const picker = screen.getByTestId('time-picker');
    await fireEvent(picker, 'dateChange', {
      nativeEvent: { date: new Date(2001, 0, 1, 6, 5).getTime() },
    });
    expect(onChange).toHaveBeenCalledWith({ hour: 6, minute: 5 });
    expect(screen.queryByTestId('time-picker')).not.toBeOnTheScreen();
  });
});

describe('default ProgressIndicator', () => {
  it('is a labelled progress bar with its value when the progress is known', async () => {
    setDeviceConditions();
    await render(<ProgressIndicator value={0.4} accessibilityLabel="Téléchargement" />);
    const bar = screen.getByRole('progressbar', { name: 'Téléchargement' });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 40 });
    const fill = bar.queryAll(({ props }) => styleOf({ props } as typeof bar).width === '40%');
    expect(fill).toHaveLength(1);
  });

  it('is the platform spinner when the progress is unknown', async () => {
    setDeviceConditions();
    await render(<ProgressIndicator accessibilityLabel="Préparation" testID="spinner" />);
    const spinner = screen.getByTestId('spinner');
    expect(spinner.type).toBe('ActivityIndicator');
    expect(spinner).toHaveProp('accessibilityLabel', 'Préparation');
    expect(spinner).toBeBusy();
  });
});

describe('default Gauge', () => {
  it('says what it measures and the current value, in words', async () => {
    setDeviceConditions();
    await render(
      <Gauge
        value={0.25}
        label="Santé du jardin"
        valueLabel="A soif"
        minimumLabel="À sec"
        maximumLabel="Florissant"
        tone="warning"
      />,
    );
    const gauge = screen.getByRole('progressbar', { name: 'Santé du jardin' });
    expect(gauge).toHaveAccessibilityValue({ text: 'A soif' });
    for (const text of ['Santé du jardin', 'A soif', 'À sec', 'Florissant']) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
  });

  it('fills the bar up to the value, in the colour of its tone', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <Gauge value={0.25} label="Santé" valueLabel="A soif" tone="warning" testID="gauge" />,
    );
    const fills = screen
      .getByTestId('gauge')
      .queryAll((element) => styleOf(element).width === '25%');
    expect(fills).toHaveLength(1);
    expect(styleOf(fills[0]!).backgroundColor).toBe(fallbackSystemColors.warning.light);
  });

  it.each(['accent', 'growth'] as const)(
    'takes the colour of the %s tone as well',
    async (tone) => {
      setDeviceConditions({ os: 'android' });
      await render(<Gauge value={0.25} label="Lecture" valueLabel="15 sur 60" tone={tone} />);
      const fills = screen.container.queryAll((element) => styleOf(element).width === '25%');
      expect(styleOf(fills[0]!).backgroundColor).toBe(appColors[tone].light);
    },
  );

  it('has the inset of the other rows as a row of a list, and none elsewhere', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <>
        <InList>
          <ListRow label="Aujourd’hui" value="3 pages" />
          <Gauge value={0.5} label="Santé" valueLabel="Bonne" testID="row" />
        </InList>
        <Gauge value={0.5} label="Eau" valueLabel="Moitié" testID="alone" />
      </>,
    );
    const otherRow = screen.getByText('Aujourd’hui').parent;
    expect(styleOf(screen.getByTestId('row')).paddingHorizontal).toBe(
      otherRow && styleOf(otherRow).paddingHorizontal,
    );
    expect(styleOf(screen.getByTestId('row')).paddingHorizontal).toBe(layout.screenMargin);
    expect(styleOf(screen.getByTestId('alone')).paddingHorizontal).toBeUndefined();
  });
});

describe('default LabelRow', () => {
  function renderNotice(scheme: 'light' | 'dark' = 'light') {
    setDeviceConditions({ os: 'android', scheme });
    return render(
      <InList>
        <LabelRow
          label="Le jardin a soif"
          detail="Une page suffit à l’arroser."
          symbol={DROP}
          tone="warning"
          testID="notice"
        />
      </InList>,
    );
  }

  it('is one element for screen readers, which hear the words and not the icon', async () => {
    await renderNotice();
    expect(screen.getByTestId('notice')).toHaveProp('accessible', true);
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(screen.getByText('Le jardin a soif')).toBeOnTheScreen();
    expect(screen.getByText('Une page suffit à l’arroser.')).toBeOnTheScreen();
  });

  it.each(['light', 'dark'] as const)(
    'colours the icon with the tone and never the words (%s)',
    async (scheme) => {
      await renderNotice(scheme);
      const icons = screen.getByTestId('notice').queryAll(({ props }) => props.tint !== undefined);
      expect(icons).toHaveLength(1);
      expect(icons[0]).toHaveProp('tint', processColor(fallbackSystemColors.warning[scheme]));
      expect(styleOf(screen.getByText('Le jardin a soif')).color).toBe(
        fallbackSystemColors.label[scheme],
      );
      expect(styleOf(screen.getByText('Une page suffit à l’arroser.')).color).toBe(
        fallbackSystemColors.secondaryLabel[scheme],
      );
    },
  );

  it('takes the accent by default, has the inset of the rows and a full touch target', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <InList>
        <LabelRow label="Lecture du jour" symbol={BOOK} testID="row" />
      </InList>,
    );
    const row = screen.getByTestId('row');
    const icons = row.queryAll(({ props }) => props.tint !== undefined);
    expect(icons[0]).toHaveProp('tint', processColor(appColors.accent.light));
    expect(styleOf(row)).toMatchObject({
      paddingHorizontal: layout.screenMargin,
      minHeight: layout.touchTarget,
    });
  });
});

describe('default ButtonPairRow', () => {
  const pair = (onAccept = jest.fn()) => (
    <InList>
      <ButtonPairRow
        preferred={{ label: 'Accepter', accessibilityLabel: 'Accepter Yacine', onPress: onAccept }}
        other={{ label: 'Refuser', accessibilityLabel: 'Refuser Yacine', onPress: jest.fn() }}
      />
    </InList>
  );

  it('shares the row between a filled button and a text button, 48 dp each on Android', async () => {
    setDeviceConditions({ os: 'android', fontScale: 1 });
    const onAccept = jest.fn();
    await render(pair(onAccept));
    const accept = screen.getByRole('button', { name: 'Accepter Yacine' });
    const decline = screen.getByRole('button', { name: 'Refuser Yacine' });
    expect(touchTargetHeight(accept)).toBeGreaterThanOrEqual(touchTargets.ios);
    expect(touchTargetHeight(decline)).toBeGreaterThanOrEqual(touchTargets.ios);
    expect(accept).toHaveStyle({ backgroundColor: expect.anything() });
    expect(decline).not.toHaveStyle({ borderWidth: 1 });
    await fireEvent.press(accept);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('stacks them at the largest text size', async () => {
    setDeviceConditions({ os: 'android', fontScale: LARGEST_FONT_SCALE });
    await render(pair());
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
  });
});

describe('default ButtonRow', () => {
  it('is the button, as wide as the row, inside the inset of the rows', async () => {
    setDeviceConditions({ os: 'android' });
    const onPress = jest.fn();
    await render(
      <InList>
        <ButtonRow label="Lire et arroser" onPress={onPress} testID="button" />
      </InList>,
    );
    const button = screen.getByRole('button', { name: 'Lire et arroser' });
    expect(styleOf(button).backgroundColor).toBe(palette.action.light);
    expect(button.parent && styleOf(button.parent)).toEqual({ alignSelf: 'stretch' });
    expect(button.parent?.parent && styleOf(button.parent.parent)).toMatchObject({
      paddingHorizontal: layout.screenMargin,
    });
    expect(touchTargetHeight(button)).toBeGreaterThanOrEqual(touchTargets.ios);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['secondary', 'plain'] as const)(
    'keeps the roles and states of the button: destructive %s, disabled',
    async (variant) => {
      setDeviceConditions({ os: 'android' });
      await render(
        <InList>
          <ButtonRow
            label="Tout effacer"
            variant={variant}
            role="destructive"
            disabled
            onPress={jest.fn()}
          />
        </InList>,
      );
      expect(screen.getByRole('button', { name: 'Tout effacer' })).toBeDisabled();
      expect(styleOf(screen.getByText('Tout effacer')).color).toBe(
        fallbackSystemColors.destructive.light,
      );
    },
  );
});

describe('default ContentRow', () => {
  it('is a block as wide as the list, with the side inset of the rows', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <InList>
        <ContentRow testID="content">
          <RNText>Scène du jardin</RNText>
        </ContentRow>
      </InList>,
    );
    expect(screen.getByText('Scène du jardin')).toBeOnTheScreen();
    expect(styleOf(screen.getByTestId('content'))).toEqual({
      alignSelf: 'stretch',
      paddingHorizontal: layout.screenMargin,
    });
    expect(screen.getByTestId('content')).toHaveProp('accessible', false);
  });

  it('runs to the side edges, with no inset, when it is edge to edge', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <InList>
        <ContentRow isEdgeToEdge testID="content">
          <RNText>Scène du jardin</RNText>
        </ContentRow>
      </InList>,
    );
    expect(styleOf(screen.getByTestId('content'))).toEqual({ alignSelf: 'stretch' });
  });

  it('sits in a bare section with no divider and no padding, unlike a section of rows', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <InList>
        <ListSection isBare>
          <ContentRow testID="bare">
            <RNText>Scène du jardin</RNText>
          </ContentRow>
        </ListSection>
        <ListSection>
          <ContentRow testID="framed">
            <RNText>Un titre</RNText>
          </ContentRow>
        </ListSection>
      </InList>,
    );
    const section = (id: string) => {
      const parent = screen.getByTestId(id).parent;
      if (parent === null) throw new Error('No section.');
      return styleOf(parent);
    };
    expect(section('bare').borderBottomWidth).toBeUndefined();
    expect(section('bare').paddingVertical).toBeUndefined();
    expect(section('framed').borderBottomWidth).toBeGreaterThan(0);
    expect(section('framed').paddingVertical).toBeGreaterThan(0);
  });

  it('is one element for screen readers when it is given a label', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ContentRow accessibilityLabel="Ton jardin : trois arbres en fleurs" testID="content">
          <RNText>Scène du jardin</RNText>
        </ContentRow>
      </InList>,
    );
    expect(screen.getByLabelText('Ton jardin : trois arbres en fleurs')).toBe(
      screen.getByTestId('content'),
    );
  });

  it('holds controls, which are no longer rows: a gauge keeps the inset of the block only', async () => {
    setDeviceConditions();
    await render(
      <InList>
        <ContentRow>
          <Gauge value={0.5} label="Santé" valueLabel="Bonne" testID="gauge" />
          <Button label="Lire" onPress={jest.fn()} />
        </ContentRow>
      </InList>,
    );
    expect(screen.getByRole('button', { name: 'Lire' })).toBeOnTheScreen();
    expect(styleOf(screen.getByTestId('gauge')).paddingHorizontal).toBeUndefined();
  });
});

describe('default ContentUnavailable', () => {
  it('gives a title and what to expect, with a decorative icon', async () => {
    setDeviceConditions();
    await render(
      <ContentUnavailable
        title="Le Coran arrive bientôt"
        description="La lecture sera disponible dans une prochaine version."
        symbol={BOOK}
      />,
    );
    expect(screen.getByRole('header', { name: 'Le Coran arrive bientôt' })).toBeOnTheScreen();
    expect(
      screen.getByText('La lecture sera disponible dans une prochaine version.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
  });

  it('draws its symbol large, as the picture of the state, not at the size of a label', async () => {
    setDeviceConditions();
    await render(<ContentUnavailable title="Rien ici" symbol={BOOK} testID="empty" />);
    const sizes = withDescendants(screen.getByTestId('empty'))
      .map((element) => element.props.size)
      .filter((size): size is number => typeof size === 'number');
    expect(sizes).toEqual([textStyles.displayTitle.fontSize]);
  });
});

describe('default rows and sections outside a list', () => {
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
  ])('%s is refused, as on iOS where nothing would display it', async (name, element) => {
    await expect(render(element)).rejects.toThrow(`${name} must be inside a GroupedList`);
  });

  it('a row inside a ContentRow is refused, as on iOS where it is React Native again', async () => {
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

  it('accepts the other controls anywhere', async () => {
    setDeviceConditions();
    await render(
      <>
        <Button label="Lire" onPress={jest.fn()} />
        <Gauge value={0.5} label="Santé" valueLabel="Bonne" />
        <ProgressIndicator accessibilityLabel="Préparation" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Lire' })).toBeOnTheScreen();
  });
});

describe('invalid values', () => {
  beforeEach(() => {
    // React reports the error thrown by a component on the console; the test asserts on it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('a destructive button in the filled style is refused', async () => {
    await expect(
      render(<Button label="Tout effacer" role="destructive" onPress={jest.fn()} />),
    ).rejects.toThrow(TypeError);
  });

  it.each([-0.1, 1.1, Number.NaN])('a progress of %p is refused', async (value) => {
    await expect(
      render(<ProgressIndicator value={value} accessibilityLabel="x" />),
    ).rejects.toThrow(RangeError);
  });

  it.each([-0.1, 1.1, Number.NaN])('a gauge value of %p is refused', async (value) => {
    await expect(render(<Gauge value={value} label="x" valueLabel="y" />)).rejects.toThrow(
      RangeError,
    );
  });

  it.each([
    { value: 0, min: 1, max: 60 },
    { value: 61, min: 1, max: 60 },
    { value: 5, min: 10, max: 1 },
  ])('a stepper at $value in $min..$max is refused', async (range) => {
    await expect(
      render(
        <InList>
          <StepperRow label="x" valueLabel="y" onChange={jest.fn()} {...range} />
        </InList>,
      ),
    ).rejects.toThrow(RangeError);
  });

  it('a stepper with a fractional value is refused', async () => {
    await expect(
      render(
        <InList>
          <StepperRow label="x" valueLabel="y" onChange={jest.fn()} value={1.5} min={1} max={60} />
        </InList>,
      ),
    ).rejects.toThrow(TypeError);
  });

  it.each([
    { hour: 24, minute: 0 },
    { hour: 8, minute: 60 },
    { hour: -1, minute: 0 },
    { hour: 8.5, minute: 0 },
  ])('the time $hour:$minute is refused', async (time) => {
    await expect(
      render(
        <InList>
          <TimePickerRow label="x" value={time} onChange={jest.fn()} />
        </InList>,
      ),
    ).rejects.toThrow(RangeError);
  });
});
