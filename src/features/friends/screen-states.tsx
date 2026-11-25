import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ContentUnavailable, ProgressIndicator, Screen, type IconSymbol } from '@/ui';

const FAILED_SYMBOL: IconSymbol = { ios: 'person.2', android: 'group' };

/**
 * While the data comes: the system's activity indicator, without a duration it cannot know
 * (progress-indicators.md › Best practices). With the demonstration it lasts a moment.
 */
export function FriendsLoading({ testID }: { testID?: string }) {
  const { t } = useTranslation('friends');
  return (
    <Screen background="groupedBackground" testID={testID}>
      <View style={styles.centre}>
        <ProgressIndicator accessibilityLabel={t('loading')} />
      </View>
    </Screen>
  );
}

/** Nothing to show: the system's empty state, with what happened and what to expect. */
export function FriendsUnavailable({
  title,
  description,
  testID,
}: {
  title: string;
  description: string;
  testID?: string;
}) {
  return (
    <Screen background="groupedBackground" testID={testID}>
      <ContentUnavailable title={title} description={description} symbol={FAILED_SYMBOL} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
