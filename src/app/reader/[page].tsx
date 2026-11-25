import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import {
  ReaderNotFound,
  ReaderScreen,
  parsePageParam,
  useReader,
  useReaderNavigation,
  useScriptFont,
  useScriptTexts,
  type ReaderNavigation,
} from '@/features/reader';
import { useAppStore } from '@/store';

/** The reader draws its own bar, the one of the validated mockup (deviation 82). */
const READER_SCREEN_OPTIONS = { headerShown: false } as const;

/**
 * The reader, `/reader/1` to `/reader/604`: the continuous scroll of the Quran, opened at that
 * page (D41). Any other address says the page was not found. It only composes: the hooks build
 * the model and load the text of the script chosen, the screen shows it.
 */
export default function ReaderRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const navigation = useReaderNavigation();
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  const initialPage = parsePageParam(page);

  // A link that opens the reader must not skip the introduction.
  if (!hasFinishedIntroduction) return <Redirect href="/onboarding" />;
  if (initialPage === null) return <ReaderNotFound openContents={navigation.openContents} />;
  return <OpenReader key={initialPage} initialPage={initialPage} navigation={navigation} />;
}

function OpenReader({
  initialPage,
  navigation,
}: {
  initialPage: number;
  navigation: ReaderNavigation;
}) {
  const { model, actions } = useReader(initialPage);
  const fontStatus = useScriptFont(model.script);
  const texts = useScriptTexts(model.script);
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
        openListening={navigation.openListening}
      />
    </>
  );
}
