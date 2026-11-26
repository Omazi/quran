import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Card, Icon, spacing, useColors, type IconSymbol } from '@/ui';

const EYE: IconSymbol = { ios: 'eye', android: 'visibility' };
const EYE_OFF: IconSymbol = { ios: 'eye.slash', android: 'visibility_off' };

export interface ShowLevelCardProps {
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

/**
 * "Montrer mon niveau" (profile.png, D46): on by default. The system switch (D39: switches stay
 * the system's), its label the title, the line under it saying what friends see now.
 */
export function ShowLevelCard({ value, onChange, testID }: ShowLevelCardProps) {
  const { t } = useTranslation('gardens');
  const colors = useColors();
  const detail = value ? t('showLevel.on') : t('showLevel.off');
  return (
    <Card testID={testID}>
      <View style={styles.row}>
        <Icon symbol={value ? EYE : EYE_OFF} textStyle="headline" color="actionTint" />
        <View style={styles.words}>
          <AppText variant="headline">{t('showLevel.title')}</AppText>
          <AppText variant="subhead" color="muted">
            {detail}
          </AppText>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={t('showLevel.title')}
          accessibilityHint={detail}
          trackColor={{ true: colors.action }}
          testID={testID === undefined ? undefined : `${testID}-switch`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  words: { flex: 1, rowGap: 2 },
});
