import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { useGenderedTranslation } from '@/features/gender';
import {
  AppText,
  Button,
  AppearanceScope,
  ContentUnavailable,
  ProgressIndicator,
  Screen,
  layout,
  readerShapes,
  spacing,
  textStyles,
  useBackdropGradient,
  useReducedMotion,
  useSafeInsets,
  type IconSymbol,
} from '@/ui';
import { splitVerseWords, type VerseRef } from '@/domain/quran';
// Deep import: the listening feature's index imports the reader (its Quran font), so importing
// that index here would make a cycle. The bar is a leaf component of the listening screens.
import { FollowBar } from '@/features/listening/follow/follow-bar';

import { READER_CONFIG } from './config';
import { ReaderGlass } from './reader-glass';
import type { Point } from './drop-moment';
import { pillCopy } from './drop-pill-copy';
import { DropOverlay } from './drop-overlay';
import { DropPill, usePillLine, usePillSpoken } from './drop-pill';
import { followStartVerse, verseLook } from './follow-model';
import { ReaderBottomBar, ReaderTopBar, TextSizePanel } from './reader-chrome';
import { dropStartY, readerGeometry, type ReaderGeometry } from './reader-geometry';
import { ReaderScroll } from './reader-scroll';
import { ThreadStoreContext } from './thread-store';
import { useDropMoment } from './use-drop-moment';
import type { CountedPageEvent, ReaderActions, ReaderModel } from './use-reader';
import type { QuranFontStatus } from './use-quran-font';
import type { RecitationFollow } from './use-recitation-follow';
import type { ScriptTexts } from './use-script-texts';

const NOT_FOUND_SYMBOL: IconSymbol = { ios: 'book.closed', android: 'book_2' };
const FONT_SYMBOL: IconSymbol = { ios: 'textformat', android: 'text_fields' };
const ERROR_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };
/** The middle of the water thread, across the screen (`page-thread-view.tsx`). */
const THREAD_X = readerShapes.pageMarginThread - readerShapes.threadFromText;
/** Between the end of a page's thread and the end of its section: the page number and its air. */
const PAGE_FOOTER_ROOM = spacing.md * 2 + textStyles.footnote.lineHeight + readerShapes.threadInset;

export { surahDisplayName } from './surah-name';

export interface ReaderScreenProps {
  model: ReaderModel;
  actions: ReaderActions;
  fontStatus: QuranFontStatus;
  texts: ScriptTexts;
  /** Leaves the reader for the table of contents. */
  openContents: () => void;
  /** Leaves the reader for where the person came from. */
  close: () => void;
  /** The recitation followed from the microphone (spec 3b). */
  follow: RecitationFollow;
}

/**
 * The reader, on the validated mockup of 27 November 2026 (docs/design/maquette-wow, shots 14 to
 * 16 and 20 to 22): the Quran alone, one continuous scroll the full height of the screen, on the
 * cream paper by day and the warm night page at night (owner's decision: the reader follows the
 * hour and the phone's dark appearance). No garden while reading: it would distract (owner). The
 * controls float over the text in glass, and the text fades under them (liquid-glass.md › Review
 * checklist, 6: content fades where it meets a bar): at the top the back button, the title pill
 * and the page's actions (bookmark, text size); at the bottom the water given today, the script
 * choice and the microphone. A tap on the text hides them and brings them back
 * (going-full-screen.md › Prioritize content by temporarily hiding toolbars).
 *
 * Each page has its water thread in the margin; when a page counts (spec 3), a single drop forms
 * at the end of its thread and falls into a small glass pill, which says what grew.
 */
export function ReaderScreen(props: ReaderScreenProps) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pageAppearance = props.model.paper === 'night' ? 'dark' : 'light';
  // The night page while the phone is light: the reader's own appearance (SKILLS.md, deviation).
  const fixed = pageAppearance === systemScheme ? null : pageAppearance;
  return (
    <AppearanceScope appearance={fixed}>
      <ReaderPage {...props} />
    </AppearanceScope>
  );
}

function ReaderPage({
  model,
  actions,
  fontStatus,
  texts,
  openContents,
  close,
  follow,
}: ReaderScreenProps) {
  const { t } = useGenderedTranslation('reader');
  const isMotionReduced = useReducedMotion();
  const insets = useSafeInsets();
  const { width, height } = useWindowDimensions();
  const geometry = useMemo(
    () => readerGeometry({ windowHeight: height, insets }),
    [height, insets],
  );
  const [isTextSizeOpen, setTextSizeOpen] = useState(false);
  const [ringX, setRingX] = useState<number | null>(null);
  const isFollowing = follow.status === 'starting' || follow.status === 'following';
  const followMessage =
    follow.status === 'denied'
      ? t('follow.denied')
      : follow.status === 'failed'
        ? t(followFailureKey(follow.failure))
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

  const geometryOfDrop = useCallback(
    (event: CountedPageEvent) => ({
      fromY: dropStartY(
        event.pageEndOnScreen === null ? null : event.pageEndOnScreen - PAGE_FOOTER_ROOM,
        geometry,
      ),
      toY: geometry.pillCenterY,
    }),
    [geometry],
  );
  const { moment, fall } = useDropMoment(model.counted, isMotionReduced, geometryOfDrop);

  // Heard once, when the drop has landed (feedback.md › Make sure all feedback is accessible).
  const lineOf = usePillLine();
  const spokenOf = usePillSpoken();
  const landed = moment.phase === 'received' ? pillCopy(moment.feedback, 'received') : null;
  const spoken = landed === null ? null : spokenOf(lineOf(landed.title), lineOf(landed.detail));
  useEffect(() => {
    if (spoken !== null) AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);

  const { toggleBars } = actions;
  const onTapText = useCallback(() => {
    if (isTextSizeOpen) setTextSizeOpen(false);
    else toggleBars();
  }, [isTextSizeOpen, toggleBars]);

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

  const to: Point = { x: ringX ?? width / 2, y: geometry.pillCenterY };
  // The counter shows the count before the page while its drop falls, the new one when it lands.
  const todayShown =
    moment.phase === 'falling' ? moment.feedback.todayBefore : model.today.pagesRead;

  return (
    <View style={styles.root} testID="reader">
      <PageStatusBar isNight={model.paper === 'night'} />
      <PageBackground />
      <View style={styles.text} testID="reader-text">
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
          <ThreadStoreContext.Provider value={model.threads}>
            <ReaderScroll
              // The page being read: the page opened at first, and after a change of script
              // (whose text is loaded, then drawn in a new scroll) the place reached.
              initialPage={model.page}
              script={texts.script}
              textScale={model.textScale}
              textOf={texts.textOf}
              onObserve={actions.observe}
              onTap={onTapText}
              accessibilityLabel={t('page.scroll')}
              lookOfVerse={lookOfVerse}
              followTarget={follow.target}
              isMotionReduced={isMotionReduced}
              contentInset={{ top: geometry.contentTop, bottom: geometry.contentBottom }}
            />
          </ThreadStoreContext.Provider>
        )}
      </View>
      <EdgeFades geometry={geometry} />
      <ReaderTopBar
        surah={model.surah}
        page={model.page}
        juz={model.juz}
        hizb={model.hizb}
        isBookmarked={model.isBookmarked}
        isTextSizeOpen={isTextSizeOpen}
        isVisible={model.barsVisible}
        top={geometry.topBarTop}
        onBack={close}
        onToggleBookmark={actions.toggleBookmark}
        onToggleTextSize={() => setTextSizeOpen((open) => !open)}
      />
      {isTextSizeOpen && model.barsVisible ? (
        <TextSizePanel
          step={model.textSizeStep}
          stepCount={READER_CONFIG.textSizeScales.length}
          canShrinkText={model.canShrinkText}
          canEnlargeText={model.canEnlargeText}
          onShrinkText={actions.shrinkText}
          onEnlargeText={actions.enlargeText}
          onChooseStep={actions.chooseTextSize}
          value={t('textSize.value', {
            step: model.textSizeStep + 1,
            count: READER_CONFIG.textSizeScales.length,
          })}
          top={geometry.topBarBottom + spacing.sm}
          isMotionReduced={isMotionReduced}
        />
      ) : null}
      {followMessage !== null ? (
        <View style={[styles.messageRoom, { top: geometry.topBarBottom + spacing.sm }]}>
          <ReaderGlass style={styles.message}>
            <AppText
              variant="footnote"
              color="ink"
              align="center"
              accessibilityLiveRegion="polite"
              testID="reader-follow-message"
            >
              {followMessage}
            </AppText>
          </ReaderGlass>
        </View>
      ) : null}
      {moment.phase !== 'idle' ? (
        <DropPill
          moment={moment}
          offset={geometry.pillOffset}
          isMotionReduced={isMotionReduced}
          onRingLayout={setRingX}
        />
      ) : null}
      {moment.phase === 'falling' && fall !== null && !isMotionReduced ? (
        <DropOverlay
          dropId={moment.id}
          from={{ x: THREAD_X, y: fall.fromY }}
          to={to}
          timings={fall.timings}
        />
      ) : null}
      {isFollowing ? (
        <View
          style={[styles.followBar, { bottom: geometry.bottomBarOffset }]}
          testID="reader-follow"
        >
          <FollowBar
            subscribeToLevel={follow.subscribeToLevel}
            reducedMotion={isMotionReduced}
            rereadWord={rereadWord}
            isHearing={follow.isHearing}
            heardWords={follow.heardWords}
            onStop={follow.stop}
          />
        </View>
      ) : (
        <ReaderBottomBar
          isVisible={model.barsVisible}
          bottom={geometry.bottomBarOffset}
          todayPages={todayShown}
          goalPages={model.today.goalPages}
          script={model.script}
          onChooseScript={actions.chooseScript}
          onListen={startFollowing}
          isMotionReduced={isMotionReduced}
        />
      )}
    </View>
  );
}

/**
 * Light status bar text on the night page, dark on the paper. Drawn again only when the paper
 * changes: the system status bar is updated on every render of its component.
 */
const PageStatusBar = memo(function PageStatusBar({ isNight }: { isNight: boolean }) {
  return <StatusBar style={isNight ? 'light' : 'dark'} />;
});

/** The page under the text: the cream paper by day, the warm night page at night. */
function PageBackground() {
  const stops = useBackdropGradient('readerPage');
  const top = stops[0]?.[1];
  const bottom = stops[stops.length - 1]?.[1];
  return (
    <View
      pointerEvents="none"
      testID="reader-page"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: bottom, backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})` },
      ]}
    />
  );
}

/**
 * The text fades under the glass controls (maquette-wow, the mask of `.rd-scroll`): hidden behind
 * the top controls and fading in below them, fading out above the bottom bar. In the colour of
 * the page at each end, so nothing else changes.
 */
function EdgeFades({ geometry }: { geometry: ReaderGeometry }) {
  const stops = useBackdropGradient('readerPage');
  const top = stops[0]?.[1] ?? '';
  const bottom = stops[stops.length - 1]?.[1] ?? '';
  const { height } = useWindowDimensions();
  const topSolid = (geometry.fadeTopStart / geometry.fadeTopEnd) * 100;
  const bottomHeight = height - geometry.fadeBottomStart;
  const bottomClear = ((geometry.fadeBottomEnd - geometry.fadeBottomStart) / bottomHeight) * 100;
  return (
    <>
      <View
        pointerEvents="none"
        testID="reader-fade-top"
        style={[
          styles.fadeTop,
          {
            height: geometry.fadeTopEnd,
            backgroundImage: `linear-gradient(180deg, ${top} ${topSolid}%, ${top}00 100%)`,
          },
        ]}
      />
      <View
        pointerEvents="none"
        testID="reader-fade-bottom"
        style={[
          styles.fadeBottom,
          {
            height: bottomHeight,
            backgroundImage: `linear-gradient(180deg, ${bottom}00 0%, ${bottom} ${bottomClear}%)`,
          },
        ]}
      />
    </>
  );
}

/** The message of a follow that failed: the fix when the failure names one. */
function followFailureKey(failure: RecitationFollow['failure']): string {
  switch (failure) {
    case 'model-missing':
      return 'follow.failedModelMissing';
    case 'no-audio':
      return 'follow.failedNoAudio';
    case 'microphone-unavailable':
      return 'follow.failedMicrophone';
    default:
      return 'follow.failed';
  }
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
  const { t } = useGenderedTranslation('reader');
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
  root: { flex: 1 },
  // The room of the system navigation bar, which floats over a reader that has nothing to show.
  barRoom: { height: Platform.select(READER_CONFIG.navigationBarHeight) },
  text: { flex: 1 },
  fadeTop: { position: 'absolute', top: 0, start: 0, end: 0 },
  fadeBottom: { position: 'absolute', bottom: 0, start: 0, end: 0 },
  messageRoom: {
    position: 'absolute',
    start: layout.screenMargin,
    end: layout.screenMargin,
    alignItems: 'center',
  },
  message: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  // Floating over the bottom of the page, as in voix.png, where the bottom bar stands.
  followBar: {
    position: 'absolute',
    start: layout.screenMargin,
    end: layout.screenMargin,
  },
  centred: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenMargin },
  action: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
