import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import {
  ReaderNotFound,
  ReaderScreen,
  parsePageParam,
  useQuranFont,
  useReader,
  useReaderNavigation,
  type ReaderNavigation,
} from '@/features/reader';
import { useAppStore } from '@/store';

/** The reader draws its own bar, the one of the validated mockup (deviation 82). */
const READER_SCREEN_OPTIONS = { headerShown: false } as const;

/**
 * The reader, `/reader/1` to `/reader/604`. Any other address says the page was not found. It
 * only composes: the hooks build the model, the screen shows it.
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
  const fontStatus = useQuranFont();
  return (
    <>
      <Stack.Screen options={READER_SCREEN_OPTIONS} />
      <ReaderScreen
        model={model}
        actions={actions}
        fontStatus={fontStatus}
        initialPage={initialPage}
        openContents={navigation.openContents}
        close={navigation.close}
        openListening={navigation.openListening}
      />
    </>
  );
}
