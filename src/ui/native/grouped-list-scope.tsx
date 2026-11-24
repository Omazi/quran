import { createContext, useContext, type ReactNode } from 'react';

/** True below a `GroupedList`, in either implementation. */
const InsideGroupedList = createContext(false);

/** Set by both implementations of `GroupedList` around their content. */
export function GroupedListScope({ children }: { children: ReactNode }) {
  return <InsideGroupedList.Provider value>{children}</InsideGroupedList.Provider>;
}

/**
 * Refuses a section or a row used outside a `GroupedList`. On iOS these are bare SwiftUI views:
 * without the list nothing hosts them and the screen stays empty, while the default
 * implementation would still draw them. Both implementations therefore fail the same way, so a
 * test catches the mistake before an iPhone does.
 */
export function useGroupedListGuard(componentName: string): void {
  if (!useContext(InsideGroupedList)) {
    throw new Error(
      `${componentName} must be inside a GroupedList: on iOS nothing else can display it.`,
    );
  }
}
