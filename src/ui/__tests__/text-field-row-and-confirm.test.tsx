/**
 * The text field row, in its two implementations, and the confirmation of a destructive action.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { confirmAction } from '../components/confirm-action';
import * as defaultControls from '../native/default';
import * as iosControls from '../native/ios';
import {
  directionDependentStyles,
  resetDeviceConditions,
  setDeviceConditions,
  swiftUIViewsWithoutHost,
  touchTargetHeight,
  type RenderedElement,
} from '../test-support/environment';

interface Modifier {
  $type: string;
  [parameter: string]: unknown;
}

function modifierOf(element: RenderedElement, type: string): Modifier | undefined {
  // Host elements expose untyped props; Expo UI puts its modifier records there.
  const modifiers = (element.props.modifiers as Modifier[] | undefined) ?? [];
  return modifiers.find((modifier) => modifier.$type === type);
}

afterEach(resetDeviceConditions);

describe('TextFieldRow on iOS', () => {
  const { GroupedList, ListSection, TextFieldRow } = iosControls;

  it('is the system text field with the keyboard of what it asks for', async () => {
    setDeviceConditions();
    await render(
      <GroupedList>
        <ListSection>
          <TextFieldRow
            label="Adresse e-mail"
            placeholder="nom@exemple.com"
            value=""
            onChange={jest.fn()}
            kind="email"
            testID="email"
          />
          <TextFieldRow
            label="Code d’invitation"
            value=""
            onChange={jest.fn()}
            kind="inviteCode"
            maxLength={9}
            testID="code"
          />
        </ListSection>
      </GroupedList>,
    );
    expect(swiftUIViewsWithoutHost()).toEqual([]);
    const email = screen.getByTestId('email');
    expect(email).toHaveProp('placeholder', 'nom@exemple.com');
    expect(modifierOf(email, 'accessibilityLabel')).toBeDefined();
    expect(modifierOf(email, 'keyboardType')).toMatchObject({ keyboardType: 'email-address' });
    expect(modifierOf(email, 'textContentType')).toMatchObject({ textContentType: 'emailAddress' });
    const code = screen.getByTestId('code');
    expect(code).toHaveProp('maxLength', 9);
    expect(modifierOf(code, 'textInputAutocapitalization')).toMatchObject({
      autocapitalization: 'characters',
    });
    expect(modifierOf(code, 'autocorrectionDisabled')).toBeDefined();
  });

  it('is refused outside a list', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      render(<TextFieldRow label="Nom" value="" onChange={jest.fn()} />),
    ).rejects.toThrow();
  });
});

describe('TextFieldRow, default implementation', () => {
  const { GroupedList, ListSection, TextFieldRow } = defaultControls;

  it('is a labelled field of a full touch target, mirrored in Arabic', async () => {
    setDeviceConditions({ os: 'android', rightToLeft: true });
    const onChange = jest.fn();
    await render(
      <GroupedList>
        <ListSection>
          <TextFieldRow
            label="Nom"
            placeholder="Famille…"
            value=""
            onChange={onChange}
            kind="name"
          />
        </ListSection>
      </GroupedList>,
    );
    const field = screen.getByLabelText('Nom');
    expect(field).toHaveProp('placeholder', 'Famille…');
    expect(field).toHaveProp('autoCapitalize', 'words');
    expect(touchTargetHeight(field)).toBeGreaterThanOrEqual(44);
    expect(directionDependentStyles(screen.container)).toEqual([]);
    await fireEvent.changeText(field, 'Amis');
    expect(onChange).toHaveBeenCalledWith('Amis');
  });

  it('as a search field, carries a clear button while it has text', async () => {
    setDeviceConditions({ os: 'android' });
    const onChange = jest.fn();
    const { rerender } = await render(
      <GroupedList>
        <ListSection>
          <TextFieldRow
            label="Nom à chercher"
            value=""
            onChange={onChange}
            kind="search"
            clearLabel="Effacer"
          />
        </ListSection>
      </GroupedList>,
    );
    expect(screen.queryByRole('button', { name: 'Effacer' })).toBeNull();
    await rerender(
      <GroupedList>
        <ListSection>
          <TextFieldRow
            label="Nom à chercher"
            value="ya"
            onChange={onChange}
            kind="search"
            clearLabel="Effacer"
          />
        </ListSection>
      </GroupedList>,
    );
    const clear = screen.getByRole('button', { name: 'Effacer' });
    expect(touchTargetHeight(clear)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(clear);
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByLabelText('Nom à chercher')).toHaveProp('returnKeyType', 'search');
  });
});

describe('confirmAction', () => {
  const options = {
    title: 'Retirer Sarah de tes proches ?',
    message: 'Vous ne verrez plus vos jardins.',
    confirmLabel: 'Retirer',
    cancelLabel: 'Annuler',
    isDestructive: true,
  };

  it('on iOS, is the system action sheet: destructive first, Cancel last', () => {
    const show = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_settings, callback) => callback(0));
    const onConfirm = jest.fn();
    confirmAction({ ...options, onConfirm });
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: options.title,
        options: ['Retirer', 'Annuler'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      }),
      expect.any(Function),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the person cancels', () => {
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_settings, callback) => callback(1));
    const onConfirm = jest.fn();
    confirmAction({ ...options, onConfirm });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('on Android, is the platform dialog with a destructive button', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      confirmAction({ ...options, onConfirm: jest.fn() });
      expect(alert).toHaveBeenCalledWith(options.title, options.message, [
        { text: 'Annuler', style: 'cancel' },
        expect.objectContaining({ text: 'Retirer', style: 'destructive' }),
      ]);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});
