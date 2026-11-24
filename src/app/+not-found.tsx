import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, ContentUnavailable, Screen, layout, spacing, type IconSymbol } from '@/ui';

const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'questionmark.circle', android: 'help' };

/**
 * Shown for an address that leads nowhere, such as a link from an older version: it says so in
 * plain words and offers the way back (writing.md › Best practices: a clear next step on a blank
 * screen), instead of the router's own "Unmatched Route" page.
 */
export default function NotFoundRoute() {
  const { t } = useTranslation('common');
  const router = useRouter();
  return (
    <Screen testID="not-found">
      <ContentUnavailable
        title={t('notFound.title')}
        description={t('notFound.description')}
        symbol={NOT_FOUND_SYMBOL}
      />
      <View style={styles.action}>
        <Button
          label={t('notFound.back')}
          variant="primary"
          fullWidth
          onPress={() => router.replace('/')}
          testID="not-found-back"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
