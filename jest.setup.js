/**
 * Jest setup for the gestures of the reader (zoom of the page).
 *
 * Gesture Handler's own mocks replace its native module and views. Reanimated and Worklets run
 * their web implementation under Jest (the resolver in package.json), which has no UI runtime:
 * Gesture Handler's attempt to bind to that runtime when it loads is skipped here.
 */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));
