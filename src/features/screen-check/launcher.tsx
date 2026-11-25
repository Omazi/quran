/**
 * CHECK BUILD ONLY: opens the screen the iOS check asked for, after filling the app with a made-up
 * history when asked. Loaded only through `door.ts`: a published bundle does not contain it.
 */

import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { quranStructure } from '@/data/quran';
import { addDays, type LocalDate } from '@/domain/shared/local-date';
import { useSocialStore } from '@/features/friends';
import { deviceLocalDate } from '@/features/home';
import { buildReadingHistory } from '@/features/home/dev-preview/reading-histories';
import { useAppStore } from '@/store';

import { checkAddress, isPushedOverTabs, type CheckLaunch } from './parse';

/** Days of reading time written for the statistics, today included. */
const TIME_DAYS = 14;

export function ScreenCheckLauncher({ launch }: { launch: CheckLaunch }) {
  const router = useRouter();
  const social = useSocialStore();
  const state = {
    completeOnboarding: useAppStore((s) => s.completeOnboarding),
    setReaderScript: useAppStore((s) => s.setReaderScript),
    setDailyGoalPages: useAppStore((s) => s.setDailyGoalPages),
    recordPageRead: useAppStore((s) => s.recordPageRead),
    addForegroundTime: useAppStore((s) => s.addForegroundTime),
    journalLength: useAppStore((s) => s.journal.length),
    timeDays: useAppStore((s) => Object.keys(s.timeSpent).length),
  };
  const [isReady, setReady] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const run = async () => {
      try {
        if (launch.script !== null) state.setReaderScript(launch.script);
        if (launch.seedsDemo) {
          const today = deviceLocalDate(new Date());
          // Pages already read stay read: the same history on a second launch changes nothing.
          if (state.journalLength === 0) {
            const history = buildReadingHistory('thriving', today, quranStructure.hizbPageRanges());
            state.setDailyGoalPages(history.settings.dailyGoalPages);
            for (const { page, date } of history.journal) state.recordPageRead({ page, date });
          }
          if (state.timeDays === 0) {
            for (let back = 0; back < TIME_DAYS; back += 1) {
              state.addForegroundTime({
                date: addDays(today, -back) as LocalDate,
                appSeconds: 900 + 60 * back,
                readerSeconds: 600 + 40 * back,
              });
            }
          }
          state.completeOnboarding();
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
