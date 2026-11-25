import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { GARDEN_STEP_COUNT, GardenScene } from '@/features/garden';
import { AppText, DottedProgress, Icon, layout, spacing } from '@/ui';

import { PROFILE_GARDEN_PICTURE_WIDTH, PROFILE_SYMBOLS } from './config';

export interface ProfileGardenProps {
  garden: GardenState;
}

/**
 * The person's garden under the title, on the gradient of the home screen: the same picture the
 * home screen and their friends see (D23: a level is recognised by its garden), named after the
 * khatma it grows with, then how far it has grown, in words with a leaf and in sixty dots, as
 * under the garden of the home screen (accueil.png). On the bare earth of a first garden nothing
 * is written under it: the profile never points at a zero.
 */
export function ProfileGarden({ garden }: ProfileGardenProps) {
  const { t } = useTranslation('profile');
  const { t: tGarden } = useTranslation('garden');
  const hasWords = garden.hizbCompleted > 0 || garden.variant.cycle > 1;
  const title = t('garden.title', { number: garden.variant.cycle });
  const progress = tGarden('readout.hizb.value', {
    hizb: garden.hizbCompleted,
    total: GARDEN_STEP_COUNT,
  });
  return (
    <View style={styles.column} testID="profile-garden">
      <View style={styles.picture}>
        <GardenScene state={garden} size="band" />
      </View>
      {hasWords ? (
        <View style={styles.words}>
          <AppText variant="title2" color="heading">
            {title}
          </AppText>
          {garden.hizbCompleted > 0 ? (
            <>
              <View style={styles.count} accessible accessibilityLabel={progress}>
                <Icon
                  symbol={PROFILE_SYMBOLS.leaf}
                  textStyle="subheadEmphasized"
                  color="actionTint"
                />
                <AppText variant="subheadEmphasized">{progress}</AppText>
              </View>
              <DottedProgress
                total={GARDEN_STEP_COUNT}
                reached={garden.hizbCompleted}
                hasStepInProgress={garden.nextElement !== null}
                accessibilityLabel={tGarden('readout.hizb.label')}
                accessibilityValue={progress}
                testID="profile-hizb-dots"
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', paddingTop: spacing.sm },
  picture: { width: PROFILE_GARDEN_PICTURE_WIDTH },
  words: {
    alignSelf: 'stretch',
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: spacing.md,
    rowGap: spacing.sm,
  },
  count: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm },
});
