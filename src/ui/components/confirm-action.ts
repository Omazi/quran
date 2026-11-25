import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface ConfirmActionOptions {
  /** Short, one line: what is about to happen (action-sheets.md › Best practices). */
  title: string;
  /** Only when the title and the context are not enough. */
  message?: string;
  /** The verb of the action ("Retirer"). */
  confirmLabel: string;
  /** Always the platform's word for cancel (alerts.md › Buttons: "Cancel"). */
  cancelLabel: string;
  /** Draws the confirm button in the destructive style. */
  isDestructive: boolean;
  onConfirm: () => void;
}

/** Asks the person to confirm an action they chose. Injected in hooks, so that tests answer it. */
export type ConfirmAction = (options: ConfirmActionOptions) => void;

/**
 * Confirms an action the person chose and that cannot be undone at once (removing a friend,
 * blocking). On iOS, the system's action sheet: choices about an intentional action, the
 * destructive one first and in red, Cancel at the bottom (action-sheets.md › Best practices,
 * › Mobile; alerts.md › Mobile: an action sheet, not an alert). On Android, the platform's
 * dialog. On the web, the browser's own confirmation.
 */
export const confirmAction: ConfirmAction = (options) => {
  const { title, message, confirmLabel, cancelLabel, isDestructive, onConfirm } = options;
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [confirmLabel, cancelLabel],
        destructiveButtonIndex: isDestructive ? 0 : undefined,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) onConfirm();
      },
    );
    return;
  }
  if (Platform.OS === 'web') {
    // react-native-web has no dialog of its own: Alert.alert does nothing there.
    if (globalThis.confirm?.(message === undefined ? title : `${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: isDestructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};
