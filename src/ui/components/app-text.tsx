import { Text, type TextProps, type TextStyle } from 'react-native';

import { palette, typography, type ColorToken, type TypographyToken } from '../tokens';

export interface AppTextProps extends TextProps {
  /** Typographic role. Defaults to body text. */
  variant?: TypographyToken;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

/** The only text component features should use: it guarantees tokens are applied. */
export function AppText({ variant = 'body', color = 'ink', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant] as TextStyle, { color: palette[color], textAlign: align }, style]}
    />
  );
}
