/**
 * Gravity as the phone measures it, from expo-sensors' DeviceMotion (MIT): the one place the app
 * reads the motion sensors. On iOS it is Core Motion's device motion (`CMMotionManager`), which
 * asks no permission: the motion permission of expo-sensors is the pedometer's, never requested
 * here (app.json sets `motionPermission: false`, so no unused usage string ships).
 */

/** Gravity in m/s², in the screen's axes. */
export interface Gravity {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Watches gravity; returns a function that stops. Never throws. */
export interface GravitySource {
  watch(onSample: (gravity: Gravity) => void, intervalMs: number): () => void;
}

/** The part of expo-sensors' `DeviceMotion` used here (expo-sensors 58, build/DeviceMotion.d.ts). */
interface DeviceMotionModule {
  isAvailableAsync(): Promise<boolean>;
  setUpdateInterval(intervalMs: number): void;
  addListener(listener: (measurement: { accelerationIncludingGravity: Gravity | null }) => void): {
    remove(): void;
  };
}

function deviceMotion(): DeviceMotionModule | null {
  try {
    // Loaded when first watched: a screen without the living garden never starts the sensors.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sensors = require('expo-sensors') as { DeviceMotion?: DeviceMotionModule };
    return sensors.DeviceMotion ?? null;
  } catch {
    return null;
  }
}

export const deviceGravity: GravitySource = {
  watch(onSample, intervalMs) {
    const motion = deviceMotion();
    if (motion === null) return () => undefined;
    let isWatching = true;
    let subscription: { remove(): void } | null = null;
    motion.isAvailableAsync().then(
      (isAvailable) => {
        if (!isWatching || !isAvailable) return;
        try {
          motion.setUpdateInterval(intervalMs);
          subscription = motion.addListener((measurement) => {
            const gravity = measurement.accelerationIncludingGravity;
            if (gravity !== null) onSample(gravity);
          });
        } catch (error) {
          console.warn('The motion sensors could not be read; the light stays still.', error);
        }
      },
      () => undefined,
    );
    return () => {
      isWatching = false;
      subscription?.remove();
      subscription = null;
    };
  },
};
