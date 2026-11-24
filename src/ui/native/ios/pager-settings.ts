/**
 * Whether the pager of iOS is the system's: SwiftUI's paged `TabView`, with the system page
 * indicator, hosting the React Native pages.
 *
 * That path could not be tried on a device when it was written. If it misbehaves on an iPhone
 * (pages that do not fill, touches lost, invisible indicator), set this to `false`: iOS then
 * uses the default pager, a paging scroll view with the drawn page indicator, which is the one
 * the tests exercise. Nothing else has to change.
 */
export const IOS_USES_SYSTEM_PAGER: boolean = true;
