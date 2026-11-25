import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import {
  ReaderNotFound,
  ReaderScreen,
  parsePageParam,
  useQuranFont,
  useReader,
  useReaderHeaderOptions,
} from '@/features/reader';
import { useAppStore } from '@/store';

/**
 * The reader, `/reader/1` to `/reader/604`. Any other address says the page was not found. It
 * only composes: the hooks build the model, the screen shows it.
 */
export default function ReaderRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const router = useRouter();
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  const openContents = useCallback(() => router.replace('/(tabs)/quran'), [router]);
  const initialPage = parsePageParam(page);

  // A link that opens the reader must not skip the introduction.
  if (!hasFinishedIntroduction) return <Redirect href="/onboarding" />;
  if (initialPage === null) return <ReaderNotFound openContents={openContents} />;
  return <OpenReader key={initialPage} initialPage={initialPage} openContents={openContents} />;
}

function OpenReader({
  initialPage,
  openContents,
}: {
  initialPage: number;
  openContents: () => void;
}) {
  const { model, actions } = useReader(initialPage);
  const fontStatus = useQuranFont();
  const headerOptions = useReaderHeaderOptions(model);
  return (
    <>
      <Stack.Screen options={headerOptions} />
      <ReaderScreen
        model={model}
        actions={actions}
        fontStatus={fontStatus}
        initialPage={initialPage}
        openContents={openContents}
      />
    </>
  );
}
