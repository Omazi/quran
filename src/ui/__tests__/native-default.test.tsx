import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

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
} from '../native/default';
import type { IconSymbol } from '../native/types';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  fixedHeightsAroundText,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
  touchTargetHeight,
} from '../test-support/environment';
import { appColors, fallbackSystemColors, stateOpacity, touchTargets } from '../tokens';

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
] as const;

const BOOK: IconSymbol = { ios: 'book.closed', android: 'book_2' };

/** One of each control, as a settings screen would compose them. */
function EveryControl() {
  return (
    <>
      <GroupedList testID="list">
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
    expect(styleOf(screen.getByTestId('primary')).backgroundColor).toBe(appColors.accent[scheme]);
    expect(styleOf(screen.getByText('Lire et arroser')).color).toBe(appColors.onAccent[scheme]);
    expect(styleOf(screen.getByText('Plus tard')).color).toBe(appColors.accent[scheme]);
    expect(styleOf(screen.getByText('3 pages sur 5')).color).toBe(
      fallbackSystemColors.secondaryLabel[scheme],
    );
    expect(styleOf(screen.getByText('Aujourd’hui')).color).toBe(fallbackSystemColors.label[scheme]);
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

  it.each(['resume', 'goal-decrement', 'goal-increment', 'reminder', 'time', 'primary', 'plain'])(
    'give %s a touch target of 44 points at least',
    async (testID) => {
      setDeviceConditions({ os: 'android' });
      await render(<EveryControl />);
      expect(touchTargetHeight(screen.getByTestId(testID))).toBeGreaterThanOrEqual(
        touchTargets.ios,
      );
    },
  );

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

  it('fills only the main action with the accent', async () => {
    setDeviceConditions({ os: 'android' });
    await render(
      <>
        <Button label="Principal" onPress={jest.fn()} testID="primary" />
        <Button label="Secondaire" variant="secondary" onPress={jest.fn()} testID="secondary" />
        <Button label="Simple" variant="plain" onPress={jest.fn()} testID="plain" />
      </>,
    );
    expect(styleOf(screen.getByTestId('primary')).backgroundColor).toBe(appColors.accent.light);
    expect(styleOf(screen.getByTestId('secondary')).backgroundColor).toBeUndefined();
    expect(styleOf(screen.getByTestId('secondary')).borderColor).toBe(appColors.accent.light);
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

  it('shows a section without header or footer', async () => {
    setDeviceConditions();
    await render(
      <ListSection>
        <ListRow label="Seule" />
      </ListSection>,
    );
    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(screen.getByText('Seule')).toBeOnTheScreen();
  });

  it('reads a row and its value as one element', async () => {
    setDeviceConditions();
    await render(<ListRow label="Aujourd’hui" value="3 pages sur 5" testID="row" />);
    expect(screen.getByTestId('row')).toHaveProp('accessible', true);
    expect(screen.getByTestId('row')).toHaveTextContent('Aujourd’hui3 pages sur 5');
  });

  it('makes a row with an action a button', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(<ListRow label="Revoir la présentation" onPress={onPress} />);
    await userEvent.press(screen.getByRole('button', { name: 'Revoir la présentation' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('default SwitchRow', () => {
  it('is one switch named by the row, which the whole row toggles', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(<SwitchRow label="Mon jardin a soif" value={false} onChange={onChange} />);
    const row = screen.getByRole('switch', { name: 'Mon jardin a soif' });
    expect(row).not.toBeChecked();
    await userEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports its state and passes on a change made on the switch itself', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(<SwitchRow label="Rappel du jour" value onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Rappel du jour' })).toBeChecked();
    const platformSwitch = screen.container.queryAll(({ type }) => type === 'RCTSwitch')[0];
    expect(platformSwitch).toBeDefined();
    await fireEvent(platformSwitch!, 'valueChange', false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does nothing when disabled', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(<SwitchRow label="Rappel du jour" value onChange={onChange} disabled />);
    const row = screen.getByRole('switch', { name: 'Rappel du jour' });
    expect(row).toBeDisabled();
    await userEvent.press(row);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('default StepperRow', () => {
  function renderStepper(value: number, onChange = jest.fn()) {
    return render(
      <StepperRow
        label="Pages par jour"
        value={value}
        valueLabel={`${value} pages`}
        min={1}
        max={60}
        onChange={onChange}
        testID="goal"
      />,
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
      <StepperRow
        label="Pages par jour"
        value={60}
        valueLabel="60 pages"
        min={1}
        max={60}
        onChange={onChange}
        testID="goal"
      />,
    );
    await userEvent.press(screen.getByTestId('goal-increment'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('default ChoiceRow', () => {
  it('offers the options as a named radio group and marks the current one', async () => {
    setDeviceConditions();
    await render(<ChoiceRow label="Langue" options={LANGUAGES} value="en" onChange={jest.fn()} />);
    // The group is a container, not an element of its own: its options stay reachable.
    expect(screen.getByLabelText('Langue')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Français' })).not.toBeChecked();
  });

  it('calls back with the chosen value', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(<ChoiceRow label="Langue" options={LANGUAGES} value="fr" onChange={onChange} />);
    await userEvent.press(screen.getByRole('radio', { name: 'العربية' }));
    expect(onChange).toHaveBeenCalledWith('ar');
  });

  it('tells the options apart by shape as well as colour', async () => {
    setDeviceConditions();
    await render(<ChoiceRow label="Langue" options={LANGUAGES} value="fr" onChange={jest.fn()} />);
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
    await render(<TimePickerRow label="Heure du rappel" value={evening} onChange={jest.fn()} />);
    expect(screen.getByText(eveningAsWritten)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Heure du rappel' })).toHaveAccessibilityValue({
      text: eveningAsWritten,
    });
  });

  it('opens the platform picker in place when pressed, and reports the chosen time', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <TimePickerRow label="Heure du rappel" value={evening} onChange={onChange} testID="time" />,
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
});

describe('invalid values', () => {
  beforeEach(() => {
    // React reports the error thrown by a component on the console; the test asserts on it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
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
      render(<StepperRow label="x" valueLabel="y" onChange={jest.fn()} {...range} />),
    ).rejects.toThrow(RangeError);
  });

  it('a stepper with a fractional value is refused', async () => {
    await expect(
      render(
        <StepperRow label="x" valueLabel="y" onChange={jest.fn()} value={1.5} min={1} max={60} />,
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
      render(<TimePickerRow label="x" value={time} onChange={jest.fn()} />),
    ).rejects.toThrow(RangeError);
  });
});
