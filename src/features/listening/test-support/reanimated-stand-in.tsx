/**
 * A stand-in for `react-native-reanimated` in the listening tests:
 *
 *   jest.mock('react-native-reanimated', () => require('../test-support/reanimated-stand-in'));
 *
 * Reanimated's own mock (`react-native-reanimated/mock`, with `react-native-reanimated/jest/resolver`
 * as the Jest resolver) was tried and kept out: its shared values have no `modify`, which the
 * rosette uses to hand the voice levels to the UI thread, so 37 tests of the listening screen
 * fail with "inbox.modify is not a function". This stand-in covers
 * what the rosette uses, and renders the first frame: animated props and styles are computed once,
 * from the shared values as they are, and frame callbacks are kept so a test can run them.
 */
import { forwardRef, useState, type ComponentType, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

interface StandInSharedValue<Value> {
  value: Value;
  get(): Value;
  set(value: Value): void;
  modify(modifier: (value: Value) => Value): void;
}

function makeSharedValue<Value>(initial: Value): StandInSharedValue<Value> {
  const shared: StandInSharedValue<Value> = {
    value: initial,
    get: () => shared.value,
    set: (value) => {
      shared.value = value;
    },
    modify: (modifier) => {
      shared.value = modifier(shared.value);
    },
  };
  return shared;
}

export function useSharedValue<Value>(initial: Value): StandInSharedValue<Value> {
  const [shared] = useState(() => makeSharedValue(initial));
  return shared;
}

export function useAnimatedProps<Props>(updater: () => Props): Props {
  return updater();
}

export function useAnimatedStyle<Style>(updater: () => Style): Style {
  return updater();
}

type FrameCallback = (frame: { timeSincePreviousFrame: number | null }) => void;

/** The frame callbacks of the components rendered so far. */
export const frameCallbacks: FrameCallback[] = [];

export function useFrameCallback(callback: FrameCallback): void {
  frameCallbacks.push(callback);
}

export function createAnimatedComponent<Props extends object>(
  Component: ComponentType<Props>,
): ComponentType<Props & { animatedProps?: Partial<Props> }> {
  const Animated = forwardRef<unknown, Props & { animatedProps?: Partial<Props> }>(
    ({ animatedProps, ...props }, ref) => (
      // The props of the wrapped component, with the animated ones on top.
      <Component {...(props as Props)} {...animatedProps} ref={ref} />
    ),
  );
  Animated.displayName = `Animated(${Component.displayName ?? Component.name})`;
  // forwardRef's type does not carry the generic props through.
  return Animated as unknown as ComponentType<Props & { animatedProps?: Partial<Props> }>;
}

const AnimatedView = createAnimatedComponent<ViewProps & { children?: ReactNode }>(View);

export default { createAnimatedComponent, View: AnimatedView };
export type SharedValue<Value> = StandInSharedValue<Value>;
