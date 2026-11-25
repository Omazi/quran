import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, AccessibilityInfo } from 'react-native';

import {
  Button,
  ContentUnavailable,
  ProgressIndicator,
  AppText,
  Screen,
  layout,
  readerShapes,
  spacing,
  useColors,
  useReducedMotion,
  useSafeInsets,
  type IconSymbol,
} from '@/ui';
import { splitVerseWords, type VerseRef } from '@/domain/quran';
// Deep import: the listening feature's index imports the reader (its Quran font), so importing
// that index here would make a cycle. The bar is a leaf component of the listening screens.
import { FollowBar } from '@/features/listening/follow/follow-bar';

import { READER_CONFIG } from './config';
import { followStartVerse, verseLook } from './follow-model';
import { FeedbackPill, PageProgressLine, ReaderBottomBar, ReaderHeader } from './reader-bar';
import { ReaderScroll } from './reader-scroll';
import type { ReadingFeedback } from './reading-feedback';
import type { ReaderActions, ReaderModel } from './use-reader';
import type { QuranFontStatus } from './use-quran-font';
import type { RecitationFollow } from './use-recitation-follow';
import type { ScriptTexts } from './use-script-texts';

const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const FONT_SYMBOL: IconSymbol = { ios: 'textformat', android: 'text_fields' };
const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };
/** The bottom bar runs under the home indicator and keeps it clear itself. */
const TOP_AND_SIDES = ['top', 'left', 'right'] as const;

export { surahDisplayName } from './surah-name';

export interface ReaderScreenProps {
  model: ReaderModel;
  actions: ReaderActions;
  fontStatus: QuranFontStatus;
  texts: ScriptTexts;
  /** The page the reader opened on: the scroll starts there. */
  initialPage: number;
  /** Leaves the reader for the table of contents. */
  openContents: () => void;
  /** Leaves the reader for where the person came from. */
  close: () => void;
  /** The recitation followed from the microphone (spec 3b). */
  follow: RecitationFollow;
}

/**
 * The reader (spec 2, D41), on the validated mockup (docs/design/mushaf.png) without its book
 * page: on the warm ground, the bar (a round back button, the surah and place being read, a round
 * bookmark button), the row of the watered pill, then the Quran as one continuous vertical scroll
 * on the paper of the page: verses flowing down, a cartouche and the basmala where a surah
 * begins, a page number where a page of the mushaf ends. At the bottom, the mockup's bar: the
 * script choice, the microphone and the text size. A tap on the text hides the bars and brings
 * them back (going-full-screen.md › Prioritize content by temporarily hiding toolbars); they keep
 * their room, so the text never jumps.
 *
 * When a page counts (spec 3), the watered pill shows in its own row under the title for a few
 * seconds: status feedback near what it is about, not an alert (feedback.md › Consider
 * integrating status feedback into your interface).
 */
export function ReaderScreen({
  model,
  actions,
  fontStatus,
  texts,
  initialPage,
  openContents,
  close,
  follow,
}: ReaderScreenProps) {
  const { t } = useTranslation('reader');
  const colors = useColors();
  const isMotionReduced = useReducedMotion();
  const insets = useSafeInsets();
  const feedbackText = useFeedbackText(model.feedback);
  const isFollowing = follow.status === 'starting' || follow.status === 'following';
  const followMessage =
    follow.status === 'denied'
      ? t('follow.denied')
      : follow.status === 'failed'
        ? t('follow.failed')
        : null;
  const { track, state } = follow;
  const script = texts.status === 'ready' ? texts.script : model.script;
  const lookOfVerse = useMemo(
    () =>
      track.length === 0
        ? null
        : (ref: VerseRef, wordCount: number) => verseLook(track, state, ref, script, wordCount),
    [script, state, track],
  );
  // The word to read again in the script shown: in the simple script, the word at the same place
  // of the verse when both spellings count its words alike, otherwise the Uthmani word.
  const rereadWord = useMemo(() => {
    const reread = state.reread === null ? undefined : track[state.reread];
    if (reread === undefined || texts.status !== 'ready' || texts.script === 'uthmani') {
      return follow.rereadWord;
    }
    const uthmaniCount = track.filter(
      (word) => word.surah === reread.surah && word.verse === reread.verse,
    ).length;
    const simpleWords = splitVerseWords(texts.textOf(reread));
    return simpleWords.length === uthmaniCount
      ? (simpleWords[reread.word] ?? follow.rereadWord)
      : follow.rereadWord;
  }, [follow.rereadWord, state.reread, texts, track]);
  const { page, surah } = model;
  const startFollowing = useCallback(
    () => follow.start(followStartVerse(page, surah)),
    [follow, page, surah],
  );

  // Heard once, wherever the pill shows (feedback.md › Make sure all feedback is accessible).
  useEffect(() => {
    if (feedbackText !== null) AccessibilityInfo.announceForAccessibility(feedbackText);
  }, [feedbackText]);

  if (fontStatus === 'failed') {
    return (
      <ReaderUnavailable
        title={t('fontMissing.title')}
        description={t('fontMissing.description')}
        actionLabel={t('fontMissing.action')}
        symbol={FONT_SYMBOL}
        onAction={openContents}
        testID="reader-font-missing"
      />
    );
  }

  return (
    <Screen background="pageGround" edges={TOP_AND_SIDES} testID="reader">
      <ReaderHeader
        model={model}
        isVisible={model.barsVisible}
        onBack={close}
        onToggleBookmark={actions.toggleBookmark}
      />
      <View style={styles.pillRow} testID="reader-pill-row">
        {feedbackText !== null ? (
          <FeedbackPill key={feedbackText} text={feedbackText} />
        ) : followMessage !== null ? (
          <AppText
            variant="footnote"
            color="inkSecondary"
            align="center"
            accessibilityLiveRegion="polite"
            testID="reader-follow-message"
          >
            {followMessage}
          </AppText>
        ) : (
          <PageProgressLine progress={model.pageProgress} />
        )}
      </View>
      <View style={[styles.text, { backgroundColor: colors.paper }]} testID="reader-text">
        {texts.status === 'error' ? (
          <View style={styles.centred} testID="reader-text-error">
            <ContentUnavailable
              title={t('page.error.title')}
              description={t('page.error.description')}
              symbol={ERROR_SYMBOL}
            />
          </View>
        ) : // No text before its font: the Quran is never shown in another one (spec).
        texts.status === 'loading' || fontStatus !== 'ready' ? (
          <View style={styles.centred}>
            <ProgressIndicator accessibilityLabel={t('page.loading', { page: model.page })} />
          </View>
        ) : (
          <ReaderScroll
            initialPage={initialPage}
            script={texts.script}
            textScale={model.textScale}
            textOf={texts.textOf}
            onObserve={actions.observe}
            onTap={actions.toggleBars}
            accessibilityLabel={t('page.scroll')}
            lookOfVerse={lookOfVerse}
            followTarget={follow.target}
            isMotionReduced={isMotionReduced}
          />
        )}
      </View>
      <ReaderBottomBar
        // While a voice is followed, the floating bar of voix.png takes its place; its room stays.
        isVisible={model.barsVisible && !isFollowing}
        onListen={startFollowing}
        script={model.script}
        onChooseScript={actions.chooseScript}
        canShrinkText={model.canShrinkText}
        canEnlargeText={model.canEnlargeText}
        onShrinkText={actions.shrinkText}
        onEnlargeText={actions.enlargeText}
        textSizeValue={t('textSize.value', {
          step: model.textSizeStep + 1,
          count: READER_CONFIG.textSizeScales.length,
        })}
      />
      {isFollowing ? (
        <View
          style={[styles.followBar, { bottom: insets.bottom + spacing.sm }]}
          testID="reader-follow"
        >
          <FollowBar
            subscribeToLevel={follow.subscribeToLevel}
            reducedMotion={isMotionReduced}
            rereadWord={rereadWord}
            onStop={follow.stop}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** What the page just left gave, in words, or null when there is nothing to say. */
function useFeedbackText(feedback: ReadingFeedback | null): string | null {
  const { t } = useTranslation(['reader', 'garden']);
  if (feedback === null) return null;
  if (feedback.kind === 'hizb-completed') {
    return t('reader:feedback.hizbCompleted', {
      element: t(`garden:kinds.${feedback.elementKind}`),
    });
  }
  // What the page grows, by name ("+1 page, ton grenadier grandit"); the garden when nothing does.
  return feedback.growingKind === null
    ? t('reader:feedback.pageCounted')
    : t('reader:feedback.pageGrows', {
        growth: t(`reader:feedback.grows.${feedback.growingKind}`),
      });
}

interface ReaderUnavailableProps {
  title: string;
  description: string;
  actionLabel: string;
  symbol: IconSymbol;
  onAction: () => void;
  testID: string;
}

/**
 * A reader with nothing to show: the system's empty state says why and what to do, and one button
 * leads to the table of contents (writing.md › Best practices: clear next steps on a blank screen).
 */
export function ReaderUnavailable({
  title,
  description,
  actionLabel,
  symbol,
  onAction,
  testID,
}: ReaderUnavailableProps) {
  return (
    <Screen background="pageGround" testID={testID}>
      <View style={styles.barRoom} />
      <ContentUnavailable title={title} description={description} symbol={symbol} />
      <View style={styles.action}>
        <Button label={actionLabel} onPress={onAction} fullWidth testID={`${testID}-action`} />
      </View>
    </Screen>
  );
}

/** The page asked for does not exist: only 1 to 604 do. */
export function ReaderNotFound({ openContents }: { openContents: () => void }) {
  const { t } = useTranslation('reader');
  return (
    <ReaderUnavailable
      title={t('notFound.title')}
      description={t('notFound.description')}
      actionLabel={t('notFound.action')}
      symbol={NOT_FOUND_SYMBOL}
      onAction={openContents}
      testID="reader-not-found"
    />
  );
}

const styles = StyleSheet.create({
  // The room of the system navigation bar, which floats over a reader that has nothing to show.
  barRoom: { height: Platform.select(READER_CONFIG.navigationBarHeight) },
  // The row of the watered pill, kept when it is empty, so the page does not move.
  pillRow: {
    minHeight: readerShapes.pillRowHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  text: { flex: 1 },
  // Floating over the bottom of the page, as in voix.png, where the bottom bar keeps its room.
  followBar: {
    position: 'absolute',
    start: layout.screenMargin,
    end: layout.screenMargin,
  },
  centred: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenMargin },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
