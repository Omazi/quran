/**
 * The two controls added for the Quran tab: a segmented choice and a row of two lines that opens
 * something. Each is checked in its two implementations, as the other controls are: the SwiftUI
 * one by the component and modifiers it asks for, the default one by role, text and touch target.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as defaultControls from '../native/default';
import * as iosControls from '../native/ios';
import {
  APPEARANCES_AND_DIRECTIONS,
  directionDependentStyles,
  fixedHeightsAroundText,
  resetDeviceConditions,
  setDeviceConditions,
  swiftUIViewsWithoutHost,
  touchTargetHeight,
  withDescendants,
  type RenderedElement,
} from '../test-support/environment';
import { touchTargets } from '../tokens';

const VIEWS = [
  { value: 'surahs', label: 'Sourates' },
  { value: 'juz', label: 'Juz' },
] as const;

interface Modifier {
  $type: string;
  [parameter: string]: unknown;
}

function modifierOf(element: RenderedElement, type: string): Modifier | undefined {
  // Host elements expose untyped props; Expo UI puts its modifier records there.
  const modifiers = (element.props.modifiers as Modifier[] | undefined) ?? [];
  return modifiers.find((modifier) => modifier.$type === type);
}

function swiftUITexts(element: RenderedElement): string[] {
  return withDescendants(element)
    .map(({ props }) => props.text as unknown)
    .filter((text): text is string => typeof text === 'string');
}

function hosts(): RenderedElement[] {
  return screen.container.queryAll(({ props }) => props.layoutDirection !== undefined);
}

afterEach(resetDeviceConditions);

describe('SegmentedChoice on iOS', () => {
  const { GroupedList, ListSection, SegmentedChoice } = iosControls;

  it('is the system picker in its segmented style, one tagged segment per option', async () => {
    setDeviceConditions();
    const onChange = jest.fn();
    await render(
      <SegmentedChoice
        label="Afficher"
        options={VIEWS}
        value="surahs"
        onChange={onChange}
        testID="view"
      />,
    );
    const picker = screen.getByTestId('view');
    expect(picker).toHaveProp('label', 'Afficher');
    expect(picker).toHaveProp('selection', 'surahs');
    expect(modifierOf(picker, 'pickerStyle')).toMatchObject({ style: 'segmented' });
    // A segmented control with text needs no introductory text (segmented-controls.md › Content).
    expect(modifierOf(picker, 'labelsHidden')).toBeDefined();
    expect(swiftUITexts(picker)).toEqual(['Sourates', 'Juz']);
    const tags = withDescendants(picker).map((element) => modifierOf(element, 'tag')?.tag);
    expect(tags.filter((tag) => tag !== undefined)).toEqual(['surahs', 'juz']);
    await fireEvent(picker, 'selectionChange', { nativeEvent: { selection: 'juz' } });
    expect(onChange).toHaveBeenCalledWith('juz');
  });

  it('has a host of its own alone on a screen, and uses the list as its host in a list', async () => {
    setDeviceConditions();
    await render(
      <SegmentedChoice label="Afficher" options={VIEWS} value="juz" onChange={jest.fn()} />,
    );
    expect(hosts()).toHaveLength(1);
    expect(swiftUIViewsWithoutHost()).toEqual([]);

    await render(
      <GroupedList>
        <ListSection>
          <SegmentedChoice label="Afficher" options={VIEWS} value="juz" onChange={jest.fn()} />
        </ListSection>
      </GroupedList>,
    );
    expect(hosts()).toHaveLength(1);
    expect(swiftUIViewsWithoutHost()).toEqual([]);
  });

  it('refuses fewer than two options, or a value that is not one of them', async () => {
    setDeviceConditions();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(
        <SegmentedChoice
          label="Afficher"
          options={[VIEWS[0]]}
          value="surahs"
          onChange={jest.fn()}
        />,
      ),
    ).rejects.toThrow(RangeError);
    await expect(
      render(
        <SegmentedChoice
          label="Afficher"
          options={VIEWS}
          // Deliberately outside the options: the type alone cannot stop an untyped caller.
          value={'pages' as 'juz'}
          onChange={jest.fn()}
        />,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe('DetailRow on iOS', () => {
  const { DetailRow, GroupedList, ListSection } = iosControls;

  it('is a button with its label, its detail line, a value and the disclosure indicator', async () => {
    setDeviceConditions();
    const onPress = jest.fn();
    await render(
      <GroupedList>
        <ListSection>
          <DetailRow
            label="18. Al-Kahf"
            detail="Mecquoise · 110 versets"
            value="Page 293"
            onPress={onPress}
            testID="row"
          />
        </ListSection>
      </GroupedList>,
    );
    const row = screen.getByTestId('row');
    expect(swiftUITexts(row)).toEqual(['18. Al-Kahf', 'Mecquoise · 110 versets', 'Page 293']);
    const indicators = row.queryAll(({ props }) => props.systemName === 'chevron.forward');
    expect(indicators).toHaveLength(1);
    expect(modifierOf(indicators[0]!, 'accessibilityHidden')).toMatchObject({ hidden: true });
    await fireEvent(row, 'buttonPress');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(swiftUIViewsWithoutHost()).toEqual([]);
  });

  it('can do without a value', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <DetailRow label="Reprendre" detail="Page 293" onPress={jest.fn()} testID="row" />
        </ListSection>
      </GroupedList>,
    );
    expect(swiftUITexts(screen.getByTestId('row'))).toEqual(['Reprendre', 'Page 293']);
  });

  it('must be inside a GroupedList', async () => {
    setDeviceConditions();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(<DetailRow label="Seule" detail="Perdue" onPress={jest.fn()} />),
    ).rejects.toThrow('DetailRow must be inside a GroupedList');
  });
});

describe('SegmentedChoice, default implementation', () => {
  const { SegmentedChoice } = defaultControls;

  it('is a group of radio buttons named by its label', async () => {
    setDeviceConditions({ os: 'android' });
    const onChange = jest.fn();
    await render(
      <SegmentedChoice label="Afficher" options={VIEWS} value="surahs" onChange={onChange} />,
    );
    expect(screen.getByLabelText('Afficher')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByRole('radio', { name: 'Sourates' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Juz' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Juz' }));
    expect(onChange).toHaveBeenCalledWith('juz');
  });

  // The touch target is chosen when the tokens load, under Jest as on iOS: 44 points (the
  // existing default controls are checked the same way).
  it.each(APPEARANCES_AND_DIRECTIONS)(
    'gives each segment a full touch target and mirrors ($scheme, rtl: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions({ os: 'android', ...conditions });
      await render(
        <SegmentedChoice
          label="Afficher"
          options={VIEWS}
          value="juz"
          onChange={jest.fn()}
          testID="view"
        />,
      );
      for (const segment of screen.getAllByRole('radio')) {
        expect(touchTargetHeight(segment)).toBeGreaterThanOrEqual(touchTargets.ios);
      }
      expect(directionDependentStyles(screen.getByTestId('view'))).toEqual([]);
      expect(fixedHeightsAroundText(screen.getByTestId('view'))).toEqual([]);
    },
  );
});

describe('DetailRow, default implementation', () => {
  const { DetailRow, GroupedList, ListSection } = defaultControls;

  function InList({ children }: { children: ReactNode }) {
    return (
      <GroupedList>
        <ListSection>{children}</ListSection>
      </GroupedList>
    );
  }

  it('is one button that says its label, value and detail', async () => {
    setDeviceConditions({ os: 'android' });
    const onPress = jest.fn();
    await render(
      <InList>
        <DetailRow
          label="18. Al-Kahf"
          detail="Mecquoise · 110 versets"
          value="Page 293"
          onPress={onPress}
          testID="row"
        />
      </InList>,
    );
    const row = screen.getByRole('button', {
      name: '18. Al-Kahf, Page 293, Mecquoise · 110 versets',
    });
    expect(screen.getByText('Mecquoise · 110 versets')).toBeOnTheScreen();
    expect(touchTargetHeight(row)).toBeGreaterThanOrEqual(touchTargets.ios);
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(APPEARANCES_AND_DIRECTIONS)(
    'mirrors and never fixes a height around its text ($scheme, rtl: $rightToLeft)',
    async (conditions) => {
      setDeviceConditions({ os: 'android', ...conditions });
      await render(
        <InList>
          <DetailRow label="Reprendre" detail="Page 293" onPress={jest.fn()} testID="row" />
        </InList>,
      );
      expect(directionDependentStyles(screen.getByTestId('row'))).toEqual([]);
      expect(fixedHeightsAroundText(screen.getByTestId('row'))).toEqual([]);
    },
  );

  it('must be inside a GroupedList', async () => {
    setDeviceConditions({ os: 'android' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(<DetailRow label="Seule" detail="Perdue" onPress={jest.fn()} />),
    ).rejects.toThrow('DetailRow must be inside a GroupedList');
  });
});

describe('the kit', () => {
  it('exports both controls from the shared entry', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const kit = require('../index') as Record<string, unknown>;
    expect(typeof kit.SegmentedChoice).toBe('function');
    expect(typeof kit.DetailRow).toBe('function');
  });
});
