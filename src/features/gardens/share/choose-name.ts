import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type NameChoice = 'with' | 'without' | 'cancel';

export interface ChooseNameOptions {
  /** One line: what is asked (action-sheets.md › Best practices). */
  title: string;
  /** The name that would be written on the image, so that the choice is an informed one. */
  name: string;
  withLabel: string;
  withoutLabel: string;
  cancelLabel: string;
}

/** Asks whether the picture carries the person's name. Injected in the hook, so that tests answer. */
export type ChooseName = (options: ChooseNameOptions) => Promise<NameChoice>;

/**
 * Asks the person whether their name goes on the picture they are about to share. A name on an
 * image leaves the app for good, so it is never put there without a question, and "without" is the
 * first choice. On iOS, the system's action sheet: choices about an action the person started,
 * Cancel at the bottom (action-sheets.md › Best practices, › Mobile: an action sheet, not an
 * alert). On Android, the platform's dialog. On the web nothing can be shared, so no name is.
 */
export const chooseName: ChooseName = ({ title, name, withLabel, withoutLabel, cancelLabel }) =>
  new Promise<NameChoice>((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message: name,
          options: [withoutLabel, withLabel, cancelLabel],
          cancelButtonIndex: 2,
        },
        (index) => resolve(index === 0 ? 'without' : index === 1 ? 'with' : 'cancel'),
      );
      return;
    }
    if (Platform.OS === 'web') {
      resolve('without');
      return;
    }
    Alert.alert(
      title,
      name,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve('cancel') },
        { text: withoutLabel, onPress: () => resolve('without') },
        { text: withLabel, onPress: () => resolve('with') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    );
  });
