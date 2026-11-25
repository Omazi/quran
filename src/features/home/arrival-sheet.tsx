import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  AppText,
  IconTile,
  layout,
  pieceSizes,
  radius,
  spacing,
  useColors,
  useSafeInsets,
  useReducedMotion,
} from '@/ui';

import type { Arrival } from './arrival';
import { ELEMENT_SYMBOLS, HOME_SYMBOLS } from './config';

export interface ArrivalSheetProps {
  arrival: Arrival;
  onDismiss: () => void;
  onShare: (message: string) => void;
}

/**
 * A hizb just finished (nouveau.png): a sheet over the dimmed home screen with the element it
 * grew, its name in a serif title and the next element to come, then "Voir dans mon jardin",
 * which closes it, and a quieter button to share. It follows the system sheet: a grabber, a swipe
 * down or a tap outside closes it (sheets.md › Mobile: include a grabber, support swiping to
 * dismiss), and the grabber is a close button for VoiceOver. Drawn here to keep the mockup's
 * card and its size (SKILLS.md, deviation 74). With reduced motion it appears without sliding.
 *
 * The mockup also shows the verse that inspired the element: none is validated by a teacher yet
 * (`displayableVerse`), so none is shown.
 */
export function ArrivalSheet({ arrival, onDismiss, onShare }: ArrivalSheetProps) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const colors = useColors();
  const insets = useSafeInsets();
  const reducedMotion = useReducedMotion();
  // One value for the life of the sheet: the distance it is dragged down.
  const [drag] = useState(() => new Animated.Value(0));
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, { dy }) => dy > spacing.sm,
        onPanResponderMove: (_event, { dy }) => drag.setValue(Math.max(0, dy)),
        onPanResponderRelease: (_event, { dy }) => {
          if (dy > pieceSizes.sheetDismissDistance) {
            onDismiss();
            return;
          }
          if (reducedMotion) drag.setValue(0);
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, onDismiss, reducedMotion],
  );
  const next = arrival.next;
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View
          {...responder.panHandlers}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              marginBottom: insets.bottom + spacing.sm,
              transform: [{ translateY: drag }],
            },
          ]}
          testID="home-arrival"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('arrival.close')}
            onPress={onDismiss}
            style={styles.grabberArea}
            testID="home-arrival-close"
          >
            <View style={[styles.grabber, { backgroundColor: colors.dotEmpty }]} />
          </Pressable>
          <IconTile
            symbol={ELEMENT_SYMBOLS[arrival.element.kind]}
            tone="waterStrong"
            size="large"
          />
          <View style={styles.words}>
            <AppText variant="subheadEmphasized" color="actionTint" align="center">
              {t('arrival.hizb', { hizb: arrival.hizb })}
            </AppText>
            <AppText variant="title1" color="heading" align="center">
              {tGarden(`arrival.${arrival.element.kind}`)}
            </AppText>
            {next === null ? null : (
              <AppText variant="footnote" color="muted" align="center">
                {t('arrival.next', {
                  hizb: next.hizb,
                  element: tGarden(`kinds.${next.kind}`),
                })}
              </AppText>
            )}
          </View>
          <View style={styles.actions}>
            <ActionButton
              symbol={HOME_SYMBOLS.share}
              variant="tonal"
              accessibilityLabel={t('arrival.share')}
              fullWidth={false}
              onPress={() => onShare(t('arrival.shareMessage', { hizb: arrival.hizb }))}
              testID="home-arrival-share"
            />
            <View style={styles.mainAction}>
              <ActionButton
                label={t('arrival.see')}
                onPress={onDismiss}
                testID="home-arrival-see"
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    marginHorizontal: spacing.sm,
    borderRadius: pieceSizes.sheetRadius,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    rowGap: spacing.md,
  },
  grabberArea: {
    alignSelf: 'stretch',
    minHeight: layout.touchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: pieceSizes.grabberWidth,
    height: pieceSizes.grabberHeight,
    borderRadius: radius.full,
  },
  words: { alignSelf: 'stretch', rowGap: spacing.sm },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
    marginTop: spacing.sm,
  },
  mainAction: { flex: 1 },
});
