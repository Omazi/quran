import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { markOpenedInApp } from '@/features/listening';
import { ContentsScreen, useContentsModel } from '@/features/reader';

/** The Quran tab: the table of contents. It only composes. */
export default function QuranRoute() {
  const router = useRouter();
  const openPage = useCallback((page: number) => router.push(`/reader/${page}`), [router]);
  const { model, actions } = useContentsModel(openPage);
  const openRecognition = useCallback(() => {
    markOpenedInApp('listening');
    router.push('/listening');
  }, [router]);
  return <ContentsScreen model={model} actions={actions} onRecognize={openRecognition} />;
}
