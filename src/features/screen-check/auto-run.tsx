/**
 * CHECK BUILD ONLY (loaded through `door.ts`; a published bundle does not contain it). The iOS
 * check cannot touch the simulator's screen, so this makes the app do by itself what the owner's
 * two reports describe, through the code paths the fingers take:
 *
 *  1. swipes through the whole first-launch introduction (`pagerDriver`: it calls the pager's own
 *     begin / move / end, on the UI thread, as the pan gesture does, with the real springs; the
 *     introduction's pager is vertical, so the swipes go up);
 *  2. fills the app with the demonstration, opens the demonstration friend's page, pinch-zooms and
 *     turns the 3D garden through its controller, presses "Encourager" and scrolls the page.
 *
 * What it does not do is make a touch: the native gesture recognisers are not exercised. Where
 * it is, step by step, goes to `auto-run-progress.txt` in the app's folder (progress-log.ts); the
 * check reads it, and the diagnostics' record, from the simulator afterwards.
 */

import { File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAnimatedReaction, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import type { PagerDrive } from '@/ui';

import { runFriendScript, swipePlan, type PlannedSwipe } from './auto-run-script';
import { getHandle, openHandles, publishHandle, waitForHandle } from './handles';
import { ScreenCheckLauncher } from './launcher';
import type { CheckLaunch } from './parse';
import { createProgressLog } from './progress-log';

// The screens publish their handles from here on (handles.ts keeps nothing before this).
openHandles();

export const PROGRESS_FILE = 'auto-run-progress.txt';

const progressFile = () => new File(Paths.document, PROGRESS_FILE);
export const progress = createProgressLog({
  reset: () => {
    const file = progressFile();
    if (file.exists) file.delete();
    file.create();
  },
  append: (line) => progressFile().writeSync(line, { append: true }),
  now: Date.now,
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The first thing the app shows after the swipes: the demonstration friend, as the check opens it. */
const FRIEND_LAUNCH: CheckLaunch = {
  screen: 'friend',
  page: null,
  script: null,
  seedsDemo: true,
  seedsGardens: false,
  autoSwipe: false,
  voiceProof: false,
};

/** The pager's driver: what `SwipePager` renders inside itself when it is given this. */
export function pagerDriver(drive: PagerDrive): ReactNode {
  return <AutoSwipe drive={drive} />;
}

function AutoSwipe({ drive }: { drive: PagerDrive }) {
  const fake = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const latest = useRef(drive);
  useEffect(() => {
    latest.current = drive;
  });
  const hasStarted = useRef(false);

  // The finger's position, frame after frame, goes to the pager's own `move`.
  const { move } = drive;
  useAnimatedReaction(
    () => fake.get(),
    (translation) => {
      if (isDragging.get()) move(translation);
    },
  );

  useEffect(() => {
    if (hasStarted.current || drive.length <= 0) return;
    hasStarted.current = true;
    let isCancelled = false;
    const run = async () => {
      const plan: PlannedSwipe[] = swipePlan(drive.pageCount);
      progress.line(`pager: ${plan.length} swipes planned over ${drive.pageCount} pages`);
      await sleep(4000); // the first page is drawn and its scene loaded
      for (const [index, swipe] of plan.entries()) {
        if (isCancelled) return;
        await sleep(swipe.pauseMs);
        const { length, isRightToLeft } = latest.current;
        // Forwards: to the left in a left-to-right interface, or upwards on a vertical pager, as
        // a finger turns the page. Past half a page, so that the page turns even if a slow frame
        // of the simulator counts as a rest before the lift (the first launch's pager then drops
        // the release speed, as for a finger that stopped).
        const reach = (isRightToLeft ? 1 : -1) * 0.55 * length;
        const velocity = reach / (swipe.dragMs / 1000);
        progress.line(
          `pager: swipe ${index + 1}/${plan.length} from page ${latest.current.page + 1}`,
        );
        scheduleOnUI(
          (begin: () => void, end: (v: number, c: boolean) => void) => {
            'worklet';
            begin();
            fake.set(0);
            isDragging.set(true);
            fake.set(
              withTiming(reach, { duration: swipe.dragMs, easing: Easing.linear }, (): void => {
                'worklet';
                isDragging.set(false);
                end(velocity, false);
              }),
            );
          },
          drive.begin,
          drive.end,
        );
      }
      await sleep(2500); // the last spring settles
      progress.line(`pager: done, page ${latest.current.page + 1} of ${drive.pageCount} shown`);
      publishHandle('pager-done', true);
    };
    void run();
    return () => {
      isCancelled = true;
    };
    // One run, started when the pager knows its size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.length]);
  return null;
}

/**
 * Mounted once at the root: waits for the swipes to end, then fills the app and opens the friend's
 * page (the check's launcher does it, as for the friend picture), then runs the script on it.
 */
export function ScreenCheckAutoRun() {
  const [isFriendOpen, setFriendOpen] = useState(false);
  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      progress.reset();
      progress.line('auto-run: start');
      const done = await waitForHandle('pager-done', 15 * 60_000, 500);
      if (isCancelled) return;
      if (done === undefined) {
        progress.line('auto-run: the swipes never ended');
        return;
      }
      progress.line('auto-run: opening the demonstration friend page');
      setFriendOpen(true);
      await runFriendScript({
        waitForHandle: (name, timeoutMs) => waitForHandle(name, timeoutMs, 500),
        sleep,
        log: progress.line,
      });
      progress.line(
        `auto-run: DONE (handles: ${getHandle('friend-page') === undefined ? 'gone' : 'kept'})`,
      );
    };
    void run();
    return () => {
      isCancelled = true;
    };
  }, []);
  return isFriendOpen ? <ScreenCheckLauncher launch={FRIEND_LAUNCH} /> : null;
}
