import { render, screen } from '@testing-library/react-native';

import { BarChart, niceAxisTop, type BarChartBar } from '../components/bar-chart';
import {
  directionDependentStyles,
  iosAppColor,
  iosPaletteColor,
  resetDeviceConditions,
  setDeviceConditions,
  styleOf,
} from '../test-support/environment';

afterEach(resetDeviceConditions);

const bars: BarChartBar[] = [
  { key: 'mon', value: 120, tickLabel: 'L', accessibilityLabel: 'lundi 23 novembre, 120 hasanat' },
  { key: 'tue', value: 0, accessibilityLabel: 'mardi 24 novembre, 0 hasanat' },
  { key: 'wed', value: 330, isCurrent: true, accessibilityLabel: 'mercredi 25 novembre, 330' },
  { key: 'thu', value: 0, isFuture: true, accessibilityLabel: 'jeudi 26 novembre' },
];

describe('niceAxisTop', () => {
  it('rounds the highest value up to 2, 4, 6, 8 or 10 times a power of ten', () => {
    expect(niceAxisTop(330)).toBe(400);
    expect(niceAxisTop(400)).toBe(400);
    expect(niceAxisTop(401)).toBe(600);
    expect(niceAxisTop(9)).toBe(10);
    expect(niceAxisTop(1)).toBe(2);
    expect(niceAxisTop(0.3)).toBe(0.4);
    expect(niceAxisTop(1234567)).toBe(2000000);
  });

  it('has no top when nothing is above zero, and refuses a negative value', () => {
    expect(niceAxisTop(0)).toBeNull();
    expect(() => niceAxisTop(-1)).toThrow(RangeError);
  });
});

describe('BarChart', () => {
  it('gives VoiceOver one element per slot that has happened, with its own label', async () => {
    await render(<BarChart bars={bars} formatValue={String} testID="chart" />);
    expect(screen.getByLabelText('lundi 23 novembre, 120 hasanat')).toBeTruthy();
    expect(screen.getByLabelText('mardi 24 novembre, 0 hasanat')).toBeTruthy();
    expect(screen.queryByLabelText('jeudi 26 novembre')).toBeNull();
  });

  it('writes the axis at 0, its half and its top, hidden from VoiceOver', async () => {
    await render(<BarChart bars={bars} formatValue={(value) => `${value} h`} testID="chart" />);
    for (const label of ['0 h', '200 h', '400 h']) {
      expect(screen.getAllByText(label, { includeHiddenElements: true }).length).toBeGreaterThan(0);
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('draws only the axis line when every value is zero', async () => {
    const empty = bars.map((bar) => ({ ...bar, value: 0 }));
    await render(<BarChart bars={empty} formatValue={String} testID="chart" />);
    expect(screen.queryByText('0', { includeHiddenElements: true })).toBeNull();
  });

  it('refuses a negative value', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(<BarChart bars={[{ ...bars[0]!, value: -1 }]} formatValue={String} />),
    ).rejects.toThrow(RangeError);
  });

  it('draws its bars in water by default, and in the green of growth when asked', async () => {
    setDeviceConditions();
    const barColors = () =>
      screen
        .getByTestId('chart-bar-wed')
        .children.filter((child) => typeof child !== 'string')
        .map((child) => styleOf(child).backgroundColor);
    const view = await render(<BarChart bars={bars} formatValue={String} testID="chart" />);
    expect(barColors()).toEqual([iosAppColor('accent')]);
    await view.rerender(<BarChart bars={bars} formatValue={String} tone="growth" testID="chart" />);
    expect(barColors()).toEqual([iosPaletteColor('actionTint')]);
  });

  it('uses no left or right of its own, so it mirrors in Arabic', async () => {
    await render(<BarChart bars={bars} formatValue={String} testID="chart" />);
    expect(directionDependentStyles(screen.getByTestId('chart'))).toEqual([]);
  });
});
