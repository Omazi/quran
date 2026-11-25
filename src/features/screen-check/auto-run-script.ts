/**
 * CHECK BUILD ONLY. What the automatic run does, as plain functions of what they are given, so
 * that a test can run them: the plan of the swipe through the introduction, and the script on the
 * demonstration friend page (the path of the owner's second report: pinch-zoom the garden, press
 * "Encourager", scroll).
 */

export interface PlannedSwipe {
  /** The wait before the swipe, from the end of the last one. */
  pauseMs: number;
  /** How long the finger takes to cross. */
  dragMs: number;
}

/** The pace at which the first swipes go, and then the fast one that catches a page still sliding. */
const CALM_PAUSE_MS = 1300;
const FAST_PAUSE_MS = 380;
const DRAG_MS = 240;

/**
 * One swipe per page change. The first half is calm, as a person who reads; the second half comes
 * faster than the release spring settles (520 ms), so each swipe catches the pages still sliding.
 */
export function swipePlan(pageCount: number): PlannedSwipe[] {
  const swipes = Math.max(0, pageCount - 1);
  return Array.from({ length: swipes }, (_, index) => ({
    pauseMs: index < swipes / 2 ? CALM_PAUSE_MS : FAST_PAUSE_MS,
    dragMs: DRAG_MS,
  }));
}

/** The calls of the 3D garden's controller the script makes (the gestures' own). */
export interface GardenControllerHandle {
  dragStart: () => void;
  dragMove: (dx: number, dy: number) => void;
  dragEnd: (velocityX: number, isCanceled: boolean) => void;
  pinchStart: (focal: { x: number; y: number }) => void;
  pinchMove: (scale: number, focal: { x: number; y: number }) => void;
  pinchEnd: () => void;
  doubleTap: (point: { x: number; y: number }) => void;
}

export interface FriendPageHandle {
  encourage: () => void;
  scrollTo: (y: number) => void;
}

export interface FriendScriptDependencies {
  waitForHandle: <T>(name: string, timeoutMs: number) => Promise<T | undefined>;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

const FOCAL = { x: 190, y: 260 };
const FRAME_MS = 16;
const GARDEN_WAIT_MS = 90_000;
const PAGE_WAIT_MS = 30_000;
/** The garden's first frame, its model and its reveal. */
const GARDEN_SETTLE_MS = 6000;

export async function runFriendScript({
  waitForHandle,
  sleep,
  log,
}: FriendScriptDependencies): Promise<void> {
  const step = async (name: string, run: () => Promise<void> | void) => {
    log(`friend: ${name}`);
    try {
      await run();
    } catch (error) {
      log(`friend: error in ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const pinch = (controller: GardenControllerHandle, from: number, to: number) => async () => {
    controller.pinchStart(FOCAL);
    const frames = 40;
    for (let frame = 1; frame <= frames; frame += 1) {
      controller.pinchMove(from + ((to - from) * frame) / frames, FOCAL);
      await sleep(FRAME_MS);
    }
    controller.pinchEnd();
    await sleep(700);
  };

  const controller = await waitForHandle<GardenControllerHandle>(
    'garden-controller',
    GARDEN_WAIT_MS,
  );
  const page = await waitForHandle<FriendPageHandle>('friend-page', PAGE_WAIT_MS);
  if (controller === undefined) log('friend: no garden controller (the garden did not mount)');
  if (page === undefined) log('friend: no friend page (the page did not mount)');
  await sleep(GARDEN_SETTLE_MS);

  if (controller !== undefined) {
    await step('pinch in', pinch(controller, 1, 2.6));
    await step('drag to turn', async () => {
      controller.dragStart();
      for (let frame = 1; frame <= 30; frame += 1) {
        controller.dragMove(frame * 6, frame * 1.5);
        await sleep(FRAME_MS);
      }
      controller.dragEnd(900, false);
      await sleep(1500);
    });
    await step('double tap', async () => {
      controller.doubleTap(FOCAL);
      await sleep(900);
      controller.doubleTap(FOCAL);
      await sleep(900);
    });
    await step('pinch out', pinch(controller, 1, 0.7));
  }
  if (page !== undefined) {
    await step('press Encourager', async () => {
      page.encourage();
      await sleep(2000);
    });
    await step('scroll down and up', async () => {
      for (const y of [150, 400, 700, 400, 0]) {
        page.scrollTo(y);
        await sleep(900);
      }
    });
  }
  if (controller !== undefined)
    await step('pinch again after the scroll', pinch(controller, 1, 2.2));
  await sleep(2000);
  log('friend: done');
}
