import { StyleSheet, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import { pieceSizes, radius, type PaletteRole, type IconColorRole } from '../tokens';
import { useColors, useElevation } from '../use-colors';

/**
 * `water`: a drop on pale teal ("Ajouté au hizb 24"). `thirst`: on the banner of a thirsty garden.
 * `growth`: a leaf on pale green (mort.png). `waterStrong`: the large teal tile of nouveau.png.
 */
export type IconTileTone = 'water' | 'thirst' | 'growth' | 'waterStrong';

export interface IconTileProps {
  symbol: IconSymbol;
  tone: IconTileTone;
  size: 'medium' | 'large';
  testID?: string;
}

const TONES: Readonly<Record<IconTileTone, { background: PaletteRole; symbol: IconColorRole }>> = {
  water: { background: 'waterTrack', symbol: 'waterFill' },
  thirst: { background: 'surface', symbol: 'thirstIcon' },
  growth: { background: 'actionTonal', symbol: 'actionTint' },
  waterStrong: { background: 'waterFill', symbol: 'onAction' },
};

/**
 * A rounded square that holds one symbol, beside a title that says the same thing
 * (sf-symbols.md: a symbol beside text; color.md › Inclusive color: never the colour alone).
 * Screen readers skip it: the title is read instead.
 */
export function IconTile({ symbol, tone, size, testID }: IconTileProps) {
  const colors = useColors();
  const glow = useElevation('floating');
  const side = size === 'medium' ? pieceSizes.tileMedium : pieceSizes.tileLarge;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID}
      style={[
        styles.tile,
        size === 'large' ? styles.large : styles.medium,
        { width: side, height: side, backgroundColor: colors[TONES[tone].background] },
        tone === 'waterStrong' ? { boxShadow: glow } : null,
      ]}
    >
      <Icon
        symbol={symbol}
        textStyle={size === 'large' ? 'title1' : 'subheadEmphasized'}
        color={TONES[tone].symbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  medium: { borderRadius: radius.md },
  large: { borderRadius: radius.xl },
});
