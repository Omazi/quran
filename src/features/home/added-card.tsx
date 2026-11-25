import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenElement } from '@/domain/garden';
import { AppText, Card, IconTile, spacing } from '@/ui';

import { ELEMENT_SYMBOLS } from './config';

export interface AddedCardProps {
  element: GardenElement;
}

/**
 * The last element the garden earned (accueil.png: "Ajouté au hizb 24 · Deux sources
 * jaillissantes"). The mockup also shows the verse that inspired it: a verse is shown only once a
 * teacher has validated its association (docs/specs/ui-lot1.md, B.3; `displayableVerse`), and
 * none is yet, so the card names the element alone.
 */
export function AddedCard({ element }: AddedCardProps) {
  const { t } = useTranslation('home');
  const { t: tGarden } = useTranslation('garden');
  const title = t('added.title', { hizb: element.hizb });
  const name = tGarden(`kinds.${element.kind}`);
  return (
    <Card tone="raised" accessibilityLabel={`${title}, ${name}`} testID="home-added">
      <View style={styles.row}>
        <IconTile symbol={ELEMENT_SYMBOLS[element.kind]} tone="water" size="medium" />
        <View style={styles.text}>
          <AppText variant="subheadEmphasized" color="water">
            {title}
          </AppText>
          <AppText variant="headline">{name}</AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  text: { flex: 1 },
});
