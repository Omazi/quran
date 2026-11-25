import { router } from 'expo-router';
import { useCallback } from 'react';

import { HomeScreen, useHomeModel } from '@/features/home';
import { useResumePage } from '@/features/reader';

/**
 * The "Jardin" tab. It only composes: the hook builds the model, the screen shows it. "Lire et
 * arroser" opens the reader on the page to resume (docs/specs/reader.md, section 4); opening it
 * records nothing, only reading does.
 */
export default function HomeRoute() {
  const { model, retry } = useHomeModel();
  const resumePage = useResumePage();
  const readAndWater = useCallback(() => router.push(`/reader/${resumePage}`), [resumePage]);
  return <HomeScreen model={model} actions={{ readAndWater, retry }} />;
}
