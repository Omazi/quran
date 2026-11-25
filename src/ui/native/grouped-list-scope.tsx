import { createContext, useContext, type ReactNode } from 'react';

import type { GroupedListAppearance, GroupedListBackground } from './types';

/** True below a `GroupedList`, in either implementation. */
const InsideGroupedList = createContext(false);

/** The look of the list the sections are in. */
const ListAppearance = createContext<GroupedListAppearance>('system');

/** The background of the enclosing list (`GroupedListProps.background`). */
const ListBackground = createContext<GroupedListBackground>('system');

/** Set by both implementations of `GroupedList` around their content. */
export function GroupedListScope({
  children,
  appearance = 'system',
  background = 'system',
}: {
  children: ReactNode;
  appearance?: GroupedListAppearance;
  background?: GroupedListBackground;
}) {
  return (
    <InsideGroupedList.Provider value>
      <ListAppearance.Provider value={appearance}>
        <ListBackground.Provider value={background}>{children}</ListBackground.Provider>
      </ListAppearance.Provider>
    </InsideGroupedList.Provider>
  );
}

/** The appearance of the enclosing `GroupedList`, for its sections. */
export function useGroupedListAppearance(): GroupedListAppearance {
  return useContext(ListAppearance);
}

/** The background of the list a section belongs to. */
export function useGroupedListBackground(): GroupedListBackground {
  return useContext(ListBackground);
}

/**
 * Set by both implementations of `ContentRow` around their content. Below it the tree is plain
 * React Native again: on iOS a row placed there would have no list to display it.
 */
export function OutsideGroupedList({ children }: { children: ReactNode }) {
  return <InsideGroupedList.Provider value={false}>{children}</InsideGroupedList.Provider>;
}

/** Whether the caller is a row of a `GroupedList`, for a control that also works outside one. */
export function useIsInsideGroupedList(): boolean {
  return useContext(InsideGroupedList);
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
