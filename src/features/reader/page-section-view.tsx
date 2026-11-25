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
import type { VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';
import { AppText, ContentUnavailable, layout, spacing, useColors, type IconSymbol } from '@/ui';

import { READER_CONFIG } from './config';
import { pageSection } from './reading-sections';
import { scriptTextStyle } from './script-fonts';
import { buildSectionBlocks, type SectionBlock, type SectionVerse } from './section-content';
import { SurahCartouche } from './surah-cartouche';

const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };
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
}

/**
 * One page of the mushaf in the scroll (D41): its verses flowing as one paragraph per surah,
 * right to left and justified like a printed page, each followed by its mark; a surah that begins
 * here opens with its cartouche and the basmala; the page ends with its number between two
 * hairlines, the separator of reading sites' continuous mode (docs/specs/reader.md, comparison).
 * Memoised: the list draws a page once while the person reads around it.
 */
export const PageSectionView = memo(function PageSectionView({
  page,
  script,
  textScale,
  textOf,
  onTap,
  onSegmentLayout,
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
            />
          ))}
        </View>
      ))}
      <PageFooter page={page} />
    </Pressable>
  );
});

interface BlockProps {
  block: SectionBlock;
  script: ReaderScript;
  textSize: number;
  lineHeight: number;
}

const base = scriptTextStyle;

function Block({ block, script, textSize, lineHeight }: BlockProps) {
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
    >
      {block.verses.map((verse, index) => (
        <VerseRun key={verse.verse} verse={verse} isLast={index === block.verses.length - 1} />
      ))}
    </ScriptText>
  );
}

/** A verse inside the paragraph: its text, untouched, then its mark in the ornament colour. */
function VerseRun({ verse, isLast }: { verse: SectionVerse; isLast: boolean }) {
  const colors = useColors();
  return (
    <>
      <Text testID={`verse-${verse.surah}:${verse.verse}`}>{verse.text}</Text>
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
}

/**
 * Quran text in the font of its script and nothing else (spec, "Exigence absolue"). It follows the
 * person's text size through the Title 1 ramp (typography.md › Supporting Dynamic Type), times the
 * reader's own factor; it reads right to left whatever the interface, and VoiceOver reads it in
 * Arabic.
 */
function ScriptText({ script, textSize, lineHeight, align, children, testID }: ScriptTextProps) {
  const colors = useColors();
  const { fontFamily, ramp } = scriptTextStyle(script);
  return (
    <View style={styles.rightToLeft}>
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
 * The page number between two hairlines: where one page of the mushaf ends. The hairlines take the
 * light gold of the cartouche's inner rule, the one ornament of the scroll besides the headers.
 */
function PageFooter({ page }: { page: number }) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  return (
    <View
      style={styles.footer}
      accessible
      accessibilityLabel={t('page.footerSpoken', { page })}
      testID={`page-footer-${page}`}
    >
      <View style={[styles.hairline, { backgroundColor: colors.frameInner }]} />
      <AppText variant="footnote" color="inkSecondary" align="center">
        {t('page.footer', { page })}
      </AppText>
      <View style={[styles.hairline, { backgroundColor: colors.frameInner }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: layout.screenMargin },
  rightToLeft: { direction: 'rtl' },
  text: { writingDirection: 'rtl' },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth },
  error: { paddingVertical: spacing.xl, paddingHorizontal: layout.screenMargin },
});
