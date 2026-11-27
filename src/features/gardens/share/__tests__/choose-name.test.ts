import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { chooseName } from '../choose-name';

const options = {
  title: 'Ajouter ton nom à l’image ?',
  name: 'Omar',
  withLabel: 'Avec mon nom',
  withoutLabel: 'Sans mon nom',
  cancelLabel: 'Annuler',
};

afterEach(() => {
  jest.restoreAllMocks();
});

function onPlatform(os: 'ios' | 'android' | 'web') {
  jest.replaceProperty(Platform, 'OS', os);
}

describe('asking whether the picture carries the name', () => {
  it('on iOS, is the action sheet with "without" first, "with" second, Cancel last', async () => {
    onPlatform('ios');
    const show = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_settings, callback) => callback(1));
    await expect(chooseName(options)).resolves.toBe('with');
    expect(show).toHaveBeenCalledWith(
      {
        title: options.title,
        message: 'Omar',
        options: ['Sans mon nom', 'Avec mon nom', 'Annuler'],
        cancelButtonIndex: 2,
      },
      expect.any(Function),
    );
  });

  it('on iOS, maps the first choice to "without" and Cancel to "cancel"', async () => {
    onPlatform('ios');
    const show = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    show.mockImplementationOnce((_settings, callback) => callback(0));
    await expect(chooseName(options)).resolves.toBe('without');
    show.mockImplementationOnce((_settings, callback) => callback(2));
    await expect(chooseName(options)).resolves.toBe('cancel');
  });

  it('on Android, is the platform dialog, and a dismissed dialog cancels', async () => {
    onPlatform('android');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Avec mon nom')?.onPress?.();
    });
    await expect(chooseName(options)).resolves.toBe('with');
    expect(alert).toHaveBeenCalledWith(
      options.title,
      'Omar',
      [
        expect.objectContaining({ text: 'Annuler', style: 'cancel' }),
        expect.objectContaining({ text: 'Sans mon nom' }),
        expect.objectContaining({ text: 'Avec mon nom' }),
      ],
      expect.objectContaining({ cancelable: true }),
    );
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, _buttons, alertOptions) => {
      alertOptions?.onDismiss?.();
    });
    await expect(chooseName(options)).resolves.toBe('cancel');
  });

  it('on the web, where nothing can be shared, never puts the name on', async () => {
    onPlatform('web');
    await expect(chooseName(options)).resolves.toBe('without');
  });
});
