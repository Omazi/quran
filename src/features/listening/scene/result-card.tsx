import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  QuranText,
  layout,
  listeningShape,
  radius,
  spacing,
  stateOpacity,
  useColors,
  useListeningColors,
  type QuranTextRun,
} from '@/ui';

import { useCardRoom } from './listening-stage';
import { SceneText } from './scene-text';

export interface ResultCardProps {
  /** The small line above the title: "Passage reconnu". */
  readonly label?: string;
  readonly title: string;
  /** The page, in its pill at the trailing edge of the title. */
  readonly pill?: string;
  readonly children?: ReactNode;
  /** The buttons, at the bottom of the card; they never scroll away. */
  readonly actions?: ReactNode;
  readonly testID: string;
}

/**
 * The white card of shazam.png that rises at the bottom of the scene with the result: a label,
 * the title, the page in a pill, what the result shows, then its buttons. At the largest text
 * sizes the content scrolls inside the card and the buttons stay in view.
 */
export function ResultCard({ label, title, pill, children, actions, testID }: ResultCardProps) {
  const colors = useListeningColors();
  // The most the card may grow; its content scrolls past it (layout.md › Adaptability).
  const maxHeight = useCardRoom();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, maxHeight }]}
      testID={testID}
    >
      <ScrollView
        alwaysBounceVertical={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heading}>
          <View style={styles.titles}>
            {label === undefined ? null : (
              <SceneText variant="footnoteStrong" color={colors.cardAccent}>
                {label}
              </SceneText>
            )}
            <SceneText variant="title3" color={colors.cardTitle} isHeading>
              {title}
            </SceneText>
          </View>
          {pill === undefined ? null : <CardPill label={pill} />}
        </View>
        {children}
      </ScrollView>
      {actions === undefined ? null : <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

/** The page in a pill (shazam.png: "Page 294"). */
export function CardPill({ label }: { readonly label: string }) {
  const colors = useListeningColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.cardTint }]}>
      <SceneText variant="footnoteStrong" color={colors.cardAccent}>
        {label}
      </SceneText>
    </View>
  );
}

/** A sentence of the card, under its title. */
export function CardText({ children }: { readonly children: ReactNode }) {
  const colors = useListeningColors();
  return (
    <SceneText variant="subhead" color={colors.cardSecondary}>
      {children}
    </SceneText>
  );
}

export interface CardVerseProps {
  readonly runs: readonly QuranTextRun[];
  readonly variant?: 'verse' | 'openingWords';
  readonly testID?: string;
}

/**
 * Quran text in the cream box of the card: the paper of the mushaf, centred, as the data
 * layer gives it.
 */
export function CardVerse({ runs, variant = 'openingWords', testID }: CardVerseProps) {
  const colors = useColors();
  return (
    <View style={[styles.verse, { backgroundColor: colors.paper }]} testID={testID}>
      <QuranText runs={runs} variant={variant} />
    </View>
  );
}

export interface CardButtonProps {
  readonly label: string;
  readonly accessibilityHint?: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

/**
 * The dark green capsule of the card (shazam.png: "Ouvrir dans le mushaf"): the most likely next
 * step, the one prominent button (buttons.md › Style). Drawn here, with a press state and a
 * 48-point height (buttons.md › Best practices); see SKILLS.md, deviation 86.
 */
export function CardButton({ label, accessibilityHint, onPress, testID }: CardButtonProps) {
  const colors = useListeningColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.capsule,
        { backgroundColor: colors.cardAction },
        pressed && { opacity: stateOpacity.pressed },
      ]}
      testID={testID}
    >
      <SceneText variant="headline" color={colors.onCardAction} align="center">
        {label}
      </SceneText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: listeningShape.cardRadius,
    shadowOpacity: listeningShape.floatingShadow.opacity,
    shadowRadius: listeningShape.floatingShadow.radius,
    shadowOffset: { width: 0, height: listeningShape.floatingShadow.offsetY },
    elevation: listeningShape.floatingShadow.elevation,
  },
  scroll: { flexGrow: 0 },
  content: {
    padding: listeningShape.cardPadding,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titles: { flex: 1, gap: listeningShape.labelGap },
  pill: {
    borderRadius: listeningShape.cardButtonHeight / 2,
    paddingHorizontal: listeningShape.pillPaddingInline,
    paddingVertical: listeningShape.pillPaddingBlock,
  },
  verse: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.controlGap,
    paddingHorizontal: listeningShape.cardPadding,
    paddingBottom: listeningShape.cardPadding,
  },
  capsule: {
    flex: 1,
    minHeight: listeningShape.cardButtonHeight,
    borderRadius: listeningShape.cardButtonHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
