import {
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

import { noteGestureStart } from '@/features/diagnostics';

import { GARDEN_3D } from './config';
import type { OrbitController } from './orbit-controller';

/**
 * The gestures of the 3D garden (gestures.md › Standard gestures; gestures skill), handed to the
 * camera's controller:
 *
 * - a drag turns the garden, its rim under the finger, and tilts it within limits. It starts
 *   only once the finger has moved sideways, so that the page still scrolls vertically;
 * - a pinch zooms around the point between the fingers;
 * - a double tap zooms in, or goes back to the default view if it has moved;
 * - any touch stops a garden that is still turning (interruptible).
 *
 * The callbacks run on the JavaScript thread, where three.js draws: a move draws a frame at once,
 * without a React render (gestures skill: "No React state per move event").
 */
export function useGardenGestures(
  controller: OrbitController,
  isEnabled: boolean,
  testID: string,
  /** Full screen, nothing scrolls under the garden: a vertical drag tilts it at once. */
  ownsVerticalDrag = false,
) {
  const pan = usePanGesture({
    testID: `${testID}-pan`,
    runOnJS: true,
    enabled: isEnabled,
    maxPointers: 1,
    minDistance: ownsVerticalDrag ? GARDEN_3D.dragActivation : undefined,
    activeOffsetX: ownsVerticalDrag
      ? undefined
      : [-GARDEN_3D.dragActivation, GARDEN_3D.dragActivation],
    failOffsetY: ownsVerticalDrag
      ? undefined
      : [-GARDEN_3D.dragActivation, GARDEN_3D.dragActivation],
    onBegin: () => {
      noteGestureStart('garden-pan');
      controller.fingerDown();
    },
    onActivate: () => controller.dragStart(),
    onUpdate: (event) => controller.dragMove(event.translationX, event.translationY),
    onDeactivate: (event) => controller.dragEnd(event.velocityX, event.canceled),
  });

  const pinch = usePinchGesture({
    testID: `${testID}-pinch`,
    runOnJS: true,
    enabled: isEnabled,
    onBegin: () => {
      noteGestureStart('garden-pinch');
      controller.fingerDown();
    },
    onActivate: (event) => controller.pinchStart({ x: event.focalX, y: event.focalY }),
    onUpdate: (event) => controller.pinchMove(event.scale, { x: event.focalX, y: event.focalY }),
    onDeactivate: () => controller.pinchEnd(),
  });

  const doubleTap = useTapGesture({
    testID: `${testID}-double-tap`,
    runOnJS: true,
    enabled: isEnabled,
    numberOfTaps: 2,
    onDeactivate: (event) => {
      if (!event.canceled) controller.doubleTap({ x: event.x, y: event.y });
    },
  });

  return useSimultaneousGestures(pan, pinch, doubleTap);
}
