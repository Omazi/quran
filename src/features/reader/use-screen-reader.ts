import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether VoiceOver (or TalkBack) is running. The reader keeps its bars on screen then: the back
 * button lives there, and a tap on the page is not how a screen reader user would find them.
 */
export function useScreenReader(): boolean {
  const [isRunning, setRunning] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (isCurrent) setRunning(enabled);
      },
      () => {
        // The device cannot tell: the bars behave as for everyone.
      },
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setRunning);
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, []);
  return isRunning;
}
