import { useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  layout,
  pieceSizes,
  radius,
  spacing,
  useColors,
  useReducedMotion,
  useSafeInsets,
} from '@/ui';

export interface DismissibleSheetProps {
  onDismiss: () => void;
  /** What VoiceOver says on the grabber, which is a close button. */
  closeLabel: string;
  testID: string;
  closeTestID: string;
  /** How the content is laid out inside the card (the card has the horizontal padding). */
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * A sheet over the dimmed screen, as the system draws one: a card rising from the bottom with a
 * grabber, closed by a swipe down, a tap outside or the grabber (sheets.md › Mobile: include a
 * grabber, support swiping to dismiss), the grabber being a close button for VoiceOver. With
 * reduced motion it appears without sliding. Shared by the arrival of a hizb and the invitation
 * to create an account.
 */
export function DismissibleSheet({
  onDismiss,
  closeLabel,
  testID,
  closeTestID,
  contentStyle,
  children,
}: DismissibleSheetProps) {
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
            contentStyle,
          ]}
          testID={testID}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onDismiss}
            style={styles.grabberArea}
            testID={closeTestID}
          >
            <View style={[styles.grabber, { backgroundColor: colors.dotEmpty }]} />
          </Pressable>
          {children}
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
});
