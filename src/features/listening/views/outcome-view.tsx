import { StyleSheet, View } from 'react-native';

import { Button, ContentUnavailable, layout, Screen, spacing, type IconSymbol } from '@/ui';

export interface OutcomeViewProps {
  readonly title: string;
  readonly description: string;
  readonly symbol: IconSymbol;
  /** The next step: listen again, or open the settings. */
  readonly action: { readonly label: string; readonly onPress: () => void };
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly testID: string;
}

/**
 * A listening that ends without a passage: the system's empty state says what happened and what
 * to do (writing.md › Best practices: clear next steps, errors without blame), with the one
 * action that helps and a way out.
 */
export function OutcomeView({
  title,
  description,
  symbol,
  action,
  closeLabel,
  onClose,
  testID,
}: OutcomeViewProps) {
  return (
    <Screen testID={testID}>
      <ContentUnavailable title={title} description={description} symbol={symbol} />
      <View style={styles.actions}>
        <Button label={action.label} variant="primary" fullWidth onPress={action.onPress} />
        <Button label={closeLabel} variant="plain" fullWidth onPress={onClose} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.md,
    gap: layout.controlGap,
  },
});
