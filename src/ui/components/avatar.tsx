import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import { avatarRoles, pieceSizes, radius, textStyles } from '../tokens';
import { useColors } from '../use-colors';

export interface AvatarProps {
  /** The person's initial; or a symbol when there is no name to take it from. */
  content: { readonly initial: string } | { readonly symbol: IconSymbol };
  /** `self`: the person using the app, in green. A number: a friend, by their place in a list. */
  color: 'self' | number;
  /** `large`: a friend's page and a row of people. `medium`: the header. `small`: a garden card. */
  size: 'large' | 'medium' | 'small';
  testID?: string;
}

/**
 * A round avatar with an initial (accueil.png: "Y" in the header, "I", "B", "S" on friends'
 * gardens). It only decorates a name written beside it, or a button that carries the label, so
 * screen readers skip it. The colours of friends follow `avatarRoles`, in turn.
 */
export function Avatar({ content, color, size, testID }: AvatarProps) {
  const colors = useColors();
  const diameter = DIAMETER[size];
  const background =
    color === 'self'
      ? colors.avatarSelf
      : colors[avatarRoles[color % avatarRoles.length] ?? 'avatarSelf'];
  const textStyle = size === 'small' ? textStyles.footnote : textStyles.headline;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID}
      style={[
        styles.avatar,
        { minWidth: diameter, minHeight: diameter, backgroundColor: background },
      ]}
    >
      {'initial' in content ? (
        // The initial stays inside its circle at every text size: it is a shape, not a text to read.
        <Text
          allowFontScaling={false}
          style={[styles.initial, { fontSize: textStyle.fontSize, color: colors.onAction }]}
        >
          {content.initial}
        </Text>
      ) : (
        <Icon
          symbol={content.symbol}
          textStyle={size === 'small' ? 'footnote' : 'headline'}
          color="onAction"
        />
      )}
    </View>
  );
}

const DIAMETER = {
  large: pieceSizes.avatarLarge,
  medium: pieceSizes.avatarMedium,
  small: pieceSizes.avatarSmall,
} as const satisfies Record<AvatarProps['size'], number>;

const styles = StyleSheet.create({
  avatar: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '600', textAlign: 'center' },
});
