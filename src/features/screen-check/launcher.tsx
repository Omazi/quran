/**
 * CHECK BUILD ONLY: opens the screen the iOS check asked for, after filling the app with a made-up
 * history when asked. Loaded only through `door.ts`: a published bundle does not contain it.
 */

import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { quranStructure } from '@/data/quran';
import { useSocialStore } from '@/features/friends';
import { deviceLocalDate } from '@/features/home';
import { useAppStore, useAppStoreApi } from '@/store';

import { seedDemo, seedGardens } from './demo-seed';
import { checkAddress, isPushedOverTabs, type CheckLaunch } from './parse';

export function ScreenCheckLauncher({ launch }: { launch: CheckLaunch }) {
  const router = useRouter();
  const social = useSocialStore();
  const store = useAppStoreApi();
  const setReaderScript = useAppStore((s) => s.setReaderScript);
  const [isReady, setReady] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const run = async () => {
      try {
        if (launch.script !== null) setReaderScript(launch.script);
        if (launch.seedsDemo) {
          // One change, on the device before the picture: every launch starts from the same state.
          const seed = launch.seedsGardens ? seedGardens : seedDemo;
          await seed(store, deviceLocalDate(new Date()), quranStructure.hizbPageRanges());
          // The friends of the demonstration, signed in as the demonstration does.
          await social.client.auth.signInWithApple();
          social.changed();
        }
      } catch (error) {
        // The picture is taken anyway: a screen that fails to fill is a finding, not a stop.
        console.warn('The screen check could not fill the app.', error);
      }
      setReady(true);
    };
    void run();
    // Runs once, for the launch the app was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch, social]);

  useEffect(() => {
    if (!isReady || !isPushedOverTabs(launch)) return;
    // Over the tabs, as a person reaches them: with the back button behind.
    router.replace('/(tabs)');
    router.push(checkAddress(launch) as never);
  }, [isReady, launch, router]);

  if (!isReady || isPushedOverTabs(launch)) return null;
  return <Redirect href={checkAddress(launch) as never} />;
}
