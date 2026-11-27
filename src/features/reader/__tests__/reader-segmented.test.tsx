/**
 * The "Uthmani | Simple" choice of the reader's bottom bar. On iOS (CI photo
 * ecran-lecteur-uthmani-fr-sombre.png) its labels were missing: a segment that keeps `flex: 1`
 * AND asks for `flexBasis: 'auto'` gets a basis of 0 from Yoga (a defined `flex` above 0 wins
 * over `auto`), so it is as wide as its padding and the label has no room. A segment that fits
 * its content must therefore carry no `flex` at all.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { resetDeviceConditions, styleOf } from '@/ui/test-support/environment';

import { ReaderSegmented } from '../contents-parts';

const OPTIONS = [
  { value: 'uthmani', label: 'Uthmani' },
  { value: 'imlaei', label: 'Simple' },
] as const;

afterEach(resetDeviceConditions);

describe('ReaderSegmented', () => {
  it('in a bar, sizes each segment by its label: no flex, so no zero basis', async () => {
    await render(
      <ReaderSegmented
        label="Écriture"
        options={OPTIONS}
        value="uthmani"
        onChange={jest.fn()}
        fitsContent
        tone="glass"
      />,
    );
    for (const name of ['Uthmani', 'Simple']) {
      const style = styleOf(screen.getByRole('radio', { name }));
      expect(style.flex).toBeUndefined();
      expect(style.flexGrow).toBe(0);
      expect(style.flexBasis).toBe('auto');
    }
  });

  it('on a page, shares the width equally between the segments', async () => {
    await render(
      <ReaderSegmented label="Écriture" options={OPTIONS} value="imlaei" onChange={jest.fn()} />,
    );
    for (const name of ['Uthmani', 'Simple']) {
      expect(styleOf(screen.getByRole('radio', { name })).flex).toBe(1);
    }
  });

  it('shows both labels as text and marks the selected one', async () => {
    const onChange = jest.fn();
    await render(
      <ReaderSegmented
        label="Écriture"
        options={OPTIONS}
        value="uthmani"
        onChange={onChange}
        fitsContent
        tone="glass"
      />,
    );
    expect(screen.getByText('Uthmani')).toBeOnTheScreen();
    expect(screen.getByText('Simple')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Uthmani' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Simple' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Simple' }));
    expect(onChange).toHaveBeenCalledWith('imlaei');
  });
});
