import { router } from 'expo-router';

import { HomeScreen, useHomeModel, type HomeActions } from '@/features/home';

/**
 * "Lire et arroser" while the reader does not exist: it opens the Quran tab, which says that
 * reading is coming. It records nothing: no page is added to the journal, so the garden cannot
 * be watered by a page nobody read. When the reader exists, open it here on the page to read.
 */
const actions: HomeActions = {
  readAndWater: () => router.navigate('/quran'),
};

/** The "Jardin" tab. It only composes: the hook builds the model, the screen shows it. */
export default function HomeRoute() {
  const model = useHomeModel();
  return <HomeScreen model={model} actions={actions} />;
}
