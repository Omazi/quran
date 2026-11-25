import { StyleSheet, Text, View } from 'react-native';

import type { FollowState } from '@/domain/listening';
import {
  fontFamily,
  listeningOpacity,
  listeningShape,
  spacing,
  useColors,
  useColorValues,
  useHighContrast,
  useUpcomingInk,
} from '@/ui';

import { verseMarkText } from '../passage-words';
import type { FollowLine } from './follow-lines';

export interface FollowPageProps {
  readonly lines: readonly FollowLine[];
  readonly follow: FollowState;
  /** The first word followed: the words before it are read as they are, in ink. */
  readonly startIndex: number;
  /** The inner width of the page, to size its text. */
  readonly width: number;
  /** The size of the text in points, when it is not the reader's share of the width. */
  readonly textSize?: number;
  readonly testID?: string;
}

type WordLook = 'read' | 'current' | 'reread' | 'upcoming';

function lookOf(index: number, follow: FollowState, startIndex: number): WordLook {
  if (index === follow.reread) return 'reread';
  if (index === follow.current) return 'current';
  if (index < startIndex || index < follow.next) return 'read';
  return 'upcoming';
}

/**
 * The page of the mushaf as the voice follows it (voix.png): the fifteen lines of the page in a
 * double gold frame, each line set from edge to edge as printed. The words recited are in ink,
 * the word just recited on a light gold, the word to read again in red on rose, and the words
 * still to come are faint (full ink when the person asks for more contrast). The
 * text is exactly the data layer's; nothing is added to it.
 */
export function FollowPage({
  lines,
  follow,
  startIndex,
  width,
  textSize,
  testID,
}: FollowPageProps) {
  const colors = useColors();
  const palette = useColorValues();
  const isHighContrast = useHighContrast();
  // The Hafs font's own line height is 1.76 em; 1.9 keeps the marks of two lines apart, as the
  // reader does.
  const fontSize = textSize ?? Math.round(width * listeningShape.followTextOfWidth);
  const lineHeight = Math.round(fontSize * listeningShape.followLineHeightEm);
  const upcomingInk = useUpcomingInk();
  const upcomingOpacity = isHighContrast ? 1 : listeningOpacity.upcomingMarks;

  const wordStyle = (look: WordLook) => {
    switch (look) {
      case 'reread':
        return { color: palette.followRereadInk, backgroundColor: palette.followRereadBack };
      case 'current':
        return { color: colors.ink, backgroundColor: palette.followCurrentBack };
      case 'read':
        return { color: colors.ink };
      case 'upcoming':
        return { color: upcomingInk };
    }
  };

  return (
    <View style={[styles.outer, { borderColor: palette.followFrame }]} testID={testID}>
      <View
        style={[styles.inner, { borderColor: palette.followFrame, backgroundColor: colors.paper }]}
      >
        {lines.map((line, lineIndex) => (
          <View key={lineIndex} style={styles.line}>
            {line.words.map(({ index, word }, position) => {
              const look = lookOf(index, follow, startIndex);
              const verseEnd = line.verseEnds.find((end) => end.afterWordIndex === position);
              return (
                <View key={index} style={styles.wordGroup}>
                  <Text
                    accessibilityLanguage="ar"
                    style={[
                      styles.word,
                      { fontFamily: fontFamily.quran, fontSize, lineHeight },
                      wordStyle(look),
                    ]}
                    testID={`follow-word-${index}`}
                  >
                    {word.text}
                  </Text>
                  {verseEnd === undefined ? null : (
                    <Text
                      style={[
                        {
                          fontFamily: fontFamily.quran,
                          fontSize,
                          lineHeight,
                          color: colors.ornament,
                        },
                        look === 'upcoming' && { opacity: upcomingOpacity },
                      ]}
                    >
                      {verseMarkText(verseEnd.verse)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    borderWidth: listeningShape.followOuterRule,
    borderRadius: listeningShape.followFrameRadius,
    padding: listeningShape.followRuleGap,
  },
  inner: {
    flex: 1,
    borderWidth: listeningShape.followInnerRule,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  // A line reads right to left in every interface, and runs from edge to edge, as printed.
  line: { flexDirection: 'row', direction: 'rtl', justifyContent: 'space-between' },
  wordGroup: { flexDirection: 'row', direction: 'rtl', alignItems: 'center' },
  word: {
    writingDirection: 'rtl',
    borderRadius: listeningShape.wordPillRadius,
    overflow: 'hidden',
  },
});
