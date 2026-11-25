import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { quranStructure } from '@/data/quran';
import { parseVerseKey, type VerseRef } from '@/domain/quran';
import { createFollowEngine } from '@/features/listening';
import {
  ReaderNotFound,
  ReaderScreen,
  parsePageParam,
  useReader,
  useReaderNavigation,
  useRecitationFollow,
  useScriptFont,
  useScriptTexts,
  type ReaderNavigation,
} from '@/features/reader';
import { useAppStore } from '@/store';

/** The reader draws its own bar, the one of the validated mockup (deviation 82). */
const READER_SCREEN_OPTIONS = { headerShown: false } as const;

/**
 * The reader, `/reader/1` to `/reader/604`: the continuous scroll of the Quran, opened at that
 * page (D41). Any other address says the page was not found. `?follow=1&from=18:10` opens it
 * following a recitation from that verse (where `/voice-follow` leads); `&scenario=…` plays the
 * simulated recitation in development and test builds. It only composes: the hooks build the
 * model, load the texts and follow the voice; the screen shows it.
 */
export default function ReaderRoute() {
  const { page, follow, from, scenario } = useLocalSearchParams<{
    page: string;
    follow?: string;
    from?: string;
    scenario?: string;
  }>();
  const navigation = useReaderNavigation();
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  const initialPage = parsePageParam(page);

  // A link that opens the reader must not skip the introduction.
  if (!hasFinishedIntroduction) return <Redirect href="/onboarding" />;
  if (initialPage === null) return <ReaderNotFound openContents={navigation.openContents} />;
  return (
    <OpenReader
      key={initialPage}
      initialPage={initialPage}
      navigation={navigation}
      followFrom={
        follow === '1' ? (verseOf(from) ?? quranStructure.firstVerseOfPage(initialPage)) : null
      }
      scenario={scenario}
    />
  );
}

/** The verse named by `from=18:10`, or undefined. */
function verseOf(key: string | undefined): VerseRef | undefined {
  if (key === undefined) return undefined;
  try {
    return parseVerseKey(key);
  } catch {
    return undefined;
  }
}

function OpenReader({
  initialPage,
  navigation,
  followFrom,
  scenario,
}: {
  initialPage: number;
  navigation: ReaderNavigation;
  /** Opened in follow mode: the recitation starts from this verse. */
  followFrom: VerseRef | null;
  /** Development and test builds: the simulated recitation to follow (speech-engine-door). */
  scenario: string | undefined;
}) {
  const { model, actions } = useReader(initialPage);
  const fontStatus = useScriptFont(model.script);
  const texts = useScriptTexts(model.script);
  const uthmani = useScriptTexts('uthmani');
  const createEngine = useCallback(() => createFollowEngine(scenario), [scenario]);
  const followFromKey = followFrom === null ? null : `${followFrom.surah}:${followFrom.verse}`;
  // The verse named by the address: a new object for the same verse must not start again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoStartFrom = useMemo(() => followFrom, [followFromKey]);
  const follow = useRecitationFollow({
    createEngine,
    uthmaniTextOf: uthmani.status === 'ready' ? uthmani.textOf : null,
    onPagesFollowed: actions.countPagesReadAloud,
    autoStartFrom,
  });
  return (
    <>
      <Stack.Screen options={READER_SCREEN_OPTIONS} />
      <ReaderScreen
        model={model}
        actions={actions}
        fontStatus={fontStatus}
        texts={texts}
        initialPage={initialPage}
        openContents={navigation.openContents}
        close={navigation.close}
        follow={follow}
      />
    </>
  );
}
