import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import { GARDEN_STEP_COUNT, GardenScene } from '@/features/garden';
import { AppText, ContentRow, ListSection, spacing } from '@/ui';

import { PROFILE_GARDEN_PICTURE_WIDTH } from './config';

export interface ProfileGardenSectionProps {
  garden: GardenState;
}

/**
 * The head of the profile, its one signature: the person's garden, the same picture the home
 * screen and their friends see (D23: a level is recognised by its garden), named after the
 * khatma it grows with, and how far it has grown. Everything under it stays the system's
 * (brand-spec, section 1: the garden is the signature). On the bare earth of a first garden
 * nothing is written under it: the profile never points at a zero.
 */
export function ProfileGardenSection({ garden }: ProfileGardenSectionProps) {
  const { t } = useTranslation('profile');
  const { t: tGarden } = useTranslation('garden');
  const hasWords = garden.hizbCompleted > 0 || garden.variant.cycle > 1;
  const title = t('garden.title', { number: garden.variant.cycle });
  const progress =
    garden.hizbCompleted > 0
      ? tGarden('readout.hizb.value', { hizb: garden.hizbCompleted, total: GARDEN_STEP_COUNT })
      : null;
  return (
    <ListSection isBare>
      <ContentRow>
        <View style={styles.column} testID="profile-garden">
          <View style={styles.picture}>
            <GardenScene state={garden} size="band" />
          </View>
          {hasWords ? (
            <View
              accessible
              accessibilityLabel={progress === null ? title : `${title}, ${progress}`}
              style={styles.words}
            >
              <AppText variant="title2" align="center">
                {title}
              </AppText>
              {progress === null ? null : (
                <AppText variant="subhead" color="secondaryLabel" align="center">
                  {progress}
                </AppText>
              )}
            </View>
          ) : null}
        </View>
      </ContentRow>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  picture: { width: PROFILE_GARDEN_PICTURE_WIDTH },
  words: { alignItems: 'center', gap: spacing.xs },
});
