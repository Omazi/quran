import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';

import { quranStructure } from '@/data/quran';
import { PAGE_COUNT, splitVerseWords, WORD_SEPARATOR, type VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';
import {
  AppText,
  ContentUnavailable,
  Icon,
  layout,
  readerShapes,
  spacing,
  useColors,
  useColorValues,
  type IconSymbol,
} from '@/ui';

import { READER_CONFIG } from './config';
import type { VerseLook, WordLook } from './follow-model';
import { pageSection } from './reading-sections';
import { scriptTextStyle } from './script-fonts';
import { PageThreadView } from './page-thread-view';
import { buildSectionBlocks, type SectionBlock, type SectionVerse } from './section-content';
import { SurahCartouche } from './surah-cartouche';

const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };
/** The small star on each side of the page number (maquette-wow, `.pg-mark`). */
const STAR_SYMBOL: IconSymbol = { ios: 'sparkle', android: 'star' };
/**
 * Between the verse and its mark, the no-break space the publisher prints there (docs/DATA_SOURCES
 * .md, section 1): a mark never starts a line on its own.
 */
const BEFORE_MARK = ' ';
const BETWEEN_VERSES = ' ';

export interface PageSectionViewProps {
  page: number;
  script: ReaderScript;
  /** The reader's text size factor, on top of Dynamic Type. */
  textScale: number;
  textOf: (ref: VerseRef) => string;
  /** A tap on the text shows or hides the bars. */
  onTap: () => void;
  /** Where each surah segment of the page lies inside the section, for the bar. */
  onSegmentLayout: (page: number, index: number, surah: number, frame: LayoutRectangle) => void;
  /** Where the verses of each surah segment lie inside it, for the scroll that follows a voice. */
  onParagraphLayout: (page: number, index: number, frame: LayoutRectangle) => void;
  /**
   * While a recitation is followed (spec 3b): how a verse looks, given its number of words in the
   * script shown; null when the voice has not reached it. Null when nothing is followed.
   */
  lookOfVerse: ((ref: VerseRef, wordCount: number) => VerseLook | null) | null;
}

/** What a verse of a paragraph needs to draw itself. */
type LookOfVerse = PageSectionViewProps['lookOfVerse'];

/**
 * One page of the mushaf in the scroll (D41): its verses flowing as one paragraph per surah,
 * right to left and justified like a printed page, each followed by its mark; a surah that begins
 * here opens with its framed gold title and the basmala; along the page, in the outer margin, its
 * water thread; the page ends with "page n" between two small gold stars and two fading rules
 * (validated mockup of 27 November 2026, shots 14 to 16, 20 to 22). Memoised: the list draws a
 * page once while the person reads around it; its thread redraws alone.
 *
 * The page lays out left to right in every interface language, so that the outer margin and its
 * thread stay on the left, where the Arabic lines end; the text inside reads right to left.
 */
export const PageSectionView = memo(function PageSectionView({
  page,
  script,
  textScale,
  textOf,
  onTap,
  onSegmentLayout,
  onParagraphLayout,
  lookOfVerse,
}: PageSectionViewProps) {
  const { t } = useTranslation('reader');
  const blocks = useMemo((): readonly SectionBlock[] | null => {
    try {
      return buildSectionBlocks(pageSection(quranStructure, page), textOf, script);
    } catch (error) {
      console.error(`Page ${page} cannot be shown.`, error);
      return null;
    }
  }, [page, script, textOf]);
  const base = scriptTextStyle(script);
  const textSize = base.fontSize * textScale;
  const lineHeight = base.lineHeight * textScale;

  if (blocks === null) {
    return (
      <View style={styles.error} testID={`page-section-${page}-error`}>
        <ContentUnavailable
          title={t('page.error.title')}
          description={t('page.error.description')}
          symbol={ERROR_SYMBOL}
        />
      </View>
    );
  }

  // One group per surah segment: its header and basmala, then its verses, which end the group.
  const groups: { surah: number; blocks: SectionBlock[] }[] = [];
  let pending: SectionBlock[] = [];
  for (const block of blocks) {
    pending.push(block);
    if (block.kind === 'verses') {
      groups.push({ surah: block.surah, blocks: pending });
      pending = [];
    }
  }

  return (
    <Pressable
      // The text is not a button: the tap is a shortcut, VoiceOver keeps the bars (spec 2).
      accessible={false}
      onPress={onTap}
      testID={`page-section-${page}`}
      style={styles.section}
    >
      <View style={styles.body}>
        <PageThreadView page={page} />
        {groups.map((group, index) => (
          <View
            key={group.surah}
            testID={`page-${page}-segment-${index}`}
            onLayout={(event: LayoutChangeEvent) =>
              onSegmentLayout(page, index, group.surah, event.nativeEvent.layout)
            }
          >
            {group.blocks.map((block, blockIndex) => (
              <Block
                key={blockIndex}
                block={block}
                script={script}
                textSize={textSize}
                lineHeight={lineHeight}
                lookOfVerse={lookOfVerse}
                onLayout={
                  block.kind === 'verses'
                    ? (event: LayoutChangeEvent) =>
                        onParagraphLayout(page, index, event.nativeEvent.layout)
                    : undefined
                }
              />
            ))}
          </View>
        ))}
      </View>
      <PageFooter page={page} />
    </Pressable>
  );
});

interface BlockProps {
  block: SectionBlock;
  script: ReaderScript;
  textSize: number;
  lineHeight: number;
  lookOfVerse: LookOfVerse;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const base = scriptTextStyle;

function Block({ block, script, textSize, lineHeight, lookOfVerse, onLayout }: BlockProps) {
  if (block.kind === 'surah-header') {
    return (
      <View style={styles.header}>
        <SurahCartouche surah={block.surah} textSize={textSize} lineHeight={lineHeight} />
      </View>
    );
  }
  if (block.kind === 'basmala') {
    return (
      <ScriptText
        script={script}
        textSize={textSize}
        lineHeight={lineHeight}
        align="center"
        testID="basmala"
      >
        {block.text}
      </ScriptText>
    );
  }
  return (
    <ScriptText
      script={script}
      textSize={textSize}
      lineHeight={lineHeight}
      align={
        textSize <= base(script).fontSize * READER_CONFIG.justifyUpToScale ? 'justify' : 'auto'
      }
      testID={`verses-${block.surah}-${block.verses[0]?.verse ?? 0}`}
      onLayout={onLayout}
    >
      {block.verses.map((verse, index) => (
        <VerseRun
          key={verse.verse}
          verse={verse}
          isLast={index === block.verses.length - 1}
          look={lookOfVerse?.(verse, splitVerseWords(verse.text).length) ?? null}
        />
      ))}
    </ScriptText>
  );
}

/**
 * A verse inside the paragraph: its text, untouched, then its mark in the ornament colour. While
 * a voice is followed (voix.png), the word just recited lies on light gold and the word to read
 * again is red on rose; the words are the verse's own, split at its single spaces and joined by
 * them again, so the text stays exactly the data's.
 */
function VerseRun({
  verse,
  isLast,
  look,
}: {
  verse: SectionVerse;
  isLast: boolean;
  look: VerseLook | null;
}) {
  const colors = useColors();
  const values = useColorValues();
  const styleOf = (wordLook: WordLook) =>
    wordLook === 'current'
      ? { backgroundColor: values.followCurrentBack }
      : wordLook === 'reread'
        ? { color: values.followRereadInk, backgroundColor: values.followRereadBack }
        : undefined;
  let text: React.ReactNode = verse.text;
  if (look?.kind === 'verse') {
    text = <Text style={styleOf(look.look)}>{verse.text}</Text>;
  } else if (look?.kind === 'words') {
    text = splitVerseWords(verse.text).map((word, index) => (
      <Text key={index}>
        {index === 0 ? null : WORD_SEPARATOR}
        <Text
          style={styleOf(look.looks[index] ?? 'upcoming')}
          testID={`verse-${verse.surah}:${verse.verse}-word-${index}`}
        >
          {word}
        </Text>
      </Text>
    ));
  }
  return (
    <>
      <Text testID={`verse-${verse.surah}:${verse.verse}`}>{text}</Text>
      <Text style={{ color: colors.ornament }}>{`${BEFORE_MARK}${verse.mark}`}</Text>
      {isLast ? null : BETWEEN_VERSES}
    </>
  );
}

interface ScriptTextProps {
  script: ReaderScript;
  textSize: number;
  lineHeight: number;
  /** `auto`: the paragraph's own direction, the right edge for Arabic in every interface. */
  align: 'center' | 'justify' | 'auto';
  children: React.ReactNode;
  testID: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Quran text in the font of its script and nothing else (spec, "Exigence absolue"). It follows the
 * person's text size through the Title 1 ramp (typography.md › Supporting Dynamic Type), times the
 * reader's own factor; it reads right to left whatever the interface, and VoiceOver reads it in
 * Arabic.
 */
function ScriptText({
  script,
  textSize,
  lineHeight,
  align,
  children,
  testID,
  onLayout,
}: ScriptTextProps) {
  const colors = useColors();
  const { fontFamily, ramp } = scriptTextStyle(script);
  return (
    <View style={styles.rightToLeft} onLayout={onLayout} testID={`${testID}-box`}>
      <Text
        accessibilityLanguage="ar"
        dynamicTypeRamp={ramp}
        testID={testID}
        style={[
          styles.text,
          { fontFamily, fontSize: textSize, lineHeight, color: colors.ink, textAlign: align },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * Where one page of the mushaf ends and the next begins: the number of the page that comes,
 * "page 294", between two small gold stars, and two rules that fade towards the margins
 * (maquette-wow, `.pg-mark`: the mark stands before the page it names), in the light gold of the
 * surah's frame. After the last page, the rules and one star only. VoiceOver hears "Fin de la
 * page 293". The rules take plain colours: they are gradients.
 */
function PageFooter({ page }: { page: number }) {
  const { t } = useTranslation('reader');
  const { ornamentLine } = useColorValues();
  const clear = `${ornamentLine}00`;
  return (
    <View
      style={styles.footer}
      accessible
      accessibilityLabel={t('page.footerSpoken', { page })}
      testID={`page-footer-${page}`}
    >
      <View
        style={[
          styles.rule,
          { backgroundImage: `linear-gradient(90deg, ${clear}, ${ornamentLine})` },
        ]}
      />
      <Icon symbol={STAR_SYMBOL} textStyle="footnote" color="ornament" />
      {page < PAGE_COUNT ? (
        <>
          <AppText variant="footnote" color="inkSecondary" align="center">
            {t('page.footer', { page: page + 1 })}
          </AppText>
          <Icon symbol={STAR_SYMBOL} textStyle="footnote" color="ornament" />
        </>
      ) : null}
      <View
        style={[
          styles.rule,
          { backgroundImage: `linear-gradient(90deg, ${ornamentLine}, ${clear})` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    direction: 'ltr',
    paddingLeft: readerShapes.pageMarginThread,
    paddingRight: readerShapes.pageMarginOther,
  },
  body: { paddingVertical: spacing.xs },
  rightToLeft: { direction: 'rtl' },
  text: { writingDirection: 'rtl' },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.md,
  },
  rule: { flex: 1, height: layout.outlineWidth },
  error: { paddingVertical: spacing.xl, paddingHorizontal: layout.screenMargin },
});
