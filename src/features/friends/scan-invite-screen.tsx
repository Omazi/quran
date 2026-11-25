import { CameraView } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActionButton, AppText, Card, Icon, layout, radius, type IconSymbol } from '@/ui';

import { FriendsPage, FriendsRow } from './friends-kit';
import { FriendsLoading } from './screen-states';
import type { ScanInviteActions, ScanInviteModel } from './use-friends';

const CAMERA_SYMBOL: IconSymbol = { ios: 'camera.fill', android: 'photo_camera' };
const CAMERA_OFF_SYMBOL: IconSymbol = { ios: 'video.slash.fill', android: 'no_photography' };

export interface ScanInviteScreenProps {
  model: ScanInviteModel;
  actions: ScanInviteActions;
}

/**
 * Scanning a friend's QR code. The camera shows in a square under the bar, the instructions under
 * it, as a footer of the list (lists-and-tables.md › Style); a code that is not an invitation, or
 * that the rules refuse, is said in the same place, and the camera keeps looking.
 *
 * The camera is asked about on the previous page, when the person taps "Scanner un QR code"
 * (privacy.md › Requesting permission). Refused, this page says how to turn it on in Settings,
 * and that the code can be typed instead. Never asked (a way here other than that button), a
 * single "Continuer" button opens the system question (privacy.md › Pre-alert screens).
 */
export function ScanInviteScreen({ model, actions }: ScanInviteScreenProps) {
  const { t } = useTranslation('friends');
  if (model.camera === 'unknown') return <FriendsLoading testID="scan-loading" />;
  if (model.camera !== 'granted' || model.cameraFailed) {
    const state =
      model.camera === 'askable' ? 'ask' : model.camera === 'blocked' ? 'denied' : 'failed';
    return (
      <FriendsPage isUnderBar testID={`scan-${state}`}>
        <Card contentGap="md">
          <FriendsRow
            label={t(`scan.${state}Title`)}
            detail={t(`scan.${state}Text`)}
            leading={
              <Icon symbol={state === 'ask' ? CAMERA_SYMBOL : CAMERA_OFF_SYMBOL} color="muted" />
            }
          />
          {state === 'ask' ? (
            <ActionButton
              variant="filled"
              label={t('scan.continue')}
              onPress={actions.askForCamera}
              testID="scan-continue"
            />
          ) : state === 'denied' ? (
            <ActionButton
              variant="tonal"
              label={t('scan.openSettings')}
              onPress={actions.openSettings}
              testID="scan-open-settings"
            />
          ) : null}
          <AppText variant="footnote" color="muted">
            {t('scan.typeInstead')}
          </AppText>
        </Card>
      </FriendsPage>
    );
  }
  const footer = model.isBusy
    ? t('scan.adding')
    : model.note === null
      ? t('scan.instructions')
      : model.note === 'not-an-invitation'
        ? t('scan.notAnInvitation')
        : t(`refusals.${model.note}`);
  return (
    <FriendsPage isUnderBar testID="scan">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('scan.preview')}
        style={styles.frame}
        testID="scan-camera"
      >
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={model.isBusy ? undefined : ({ data }) => actions.scanned(data)}
          onMountError={actions.cameraFailed}
        />
      </View>
      <AppText variant="subhead" color="muted" align="center">
        {footer}
      </AppText>
    </FriendsPage>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.xl, overflow: 'hidden', minHeight: layout.touchTarget },
  camera: { aspectRatio: 1, width: '100%' },
});
