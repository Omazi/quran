import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { encode } from 'uqr';

import { qrCodeColors } from '../tokens';

/**
 * The light margin a QR code needs around it to be found by a camera: four modules, the quiet
 * zone of the QR standard (ISO/IEC 18004).
 */
const QUIET_ZONE_MODULES = 4;

/**
 * Medium error correction: about 15 % of the code can be hidden or dirty and still be read
 * (a reflection on a screen), for a code that stays small.
 */
const ERROR_CORRECTION = 'M';

export interface QrCodeProps {
  /** The text the code carries, such as a link. */
  value: string;
  /** What a screen reader says: what the code is for, never the text it carries. */
  accessibilityLabel: string;
  /** Size and position only. The code is square and fills the width it is given. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The modules of a code: a square of booleans, true for a dark module, with its quiet zone. */
export function qrCodeModules(value: string): readonly (readonly boolean[])[] {
  return encode(value, { ecc: ERROR_CORRECTION, border: QUIET_ZONE_MODULES }).data;
}

/**
 * The dark modules as one vector path, a rectangle per run of dark modules in a row: fewer edges
 * than one square per module, so no hairline appears between two dark neighbours.
 */
function modulesPath(modules: readonly (readonly boolean[])[]): string {
  let commands = '';
  modules.forEach((row, y) => {
    let runStart: number | null = null;
    row.forEach((isDark, x) => {
      if (isDark && runStart === null) runStart = x;
      const isRunOver = runStart !== null && (!isDark || x === row.length - 1);
      if (isRunOver && runStart !== null) {
        const runEnd = isDark ? x + 1 : x;
        commands += `M${runStart} ${y}h${runEnd - runStart}v1h${runStart - runEnd}z`;
        runStart = null;
      }
    });
  });
  return commands;
}

/**
 * A QR code, drawn as a vector path. It is drawn at a whole number of points per module, centred
 * in the square it is given, so that every module has sharp edges on screen. It is an image for
 * screen readers, labelled by what it is for.
 */
export function QrCode({ value, accessibilityLabel, style, testID }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const modules = qrCodeModules(value);
    return { size: modules.length, path: modulesPath(modules) };
  }, [value]);
  const [width, setWidth] = useState(0);
  // Before the square is measured, the code fills it; once measured, it snaps to whole points.
  const drawnSize = width === 0 ? '100%' : Math.max(1, Math.floor(width / size)) * size;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[style, styles.square]}
    >
      <Svg width={drawnSize} height={drawnSize} viewBox={`0 0 ${size} ${size}`}>
        <Rect width={size} height={size} fill={qrCodeColors.ground} />
        <Path d={path} fill={qrCodeColors.module} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  square: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
});
