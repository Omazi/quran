/**
 * The trail of what the person did just before the app closed: the last 30 screens opened and
 * gestures started, kept in memory (a ring: the oldest goes when the 31st comes). Adding one is a
 * push on an array and never throws, so it can sit on a gesture's first touch. The trail is copied
 * into the record of a fatal error (crash-record.ts) and nowhere else.
 */

export type BreadcrumbKind = 'nav' | 'gesture' | 'app' | 'error';

export interface Breadcrumb {
  /** Milliseconds since 1970, from the clock given to the trail. */
  readonly at: number;
  readonly kind: BreadcrumbKind;
  readonly label: string;
}

export const BREADCRUMB_CAPACITY = 30;
const LABEL_LENGTH = 120;

export interface Breadcrumbs {
  add: (kind: BreadcrumbKind, label: string) => void;
  /** A copy, oldest first. */
  snapshot: () => Breadcrumb[];
  clear: () => void;
}

export function createBreadcrumbs(now: () => number): Breadcrumbs {
  let trail: Breadcrumb[] = [];
  return {
    add: (kind, label) => {
      try {
        trail.push({ at: now(), kind, label: String(label).slice(0, LABEL_LENGTH) });
        if (trail.length > BREADCRUMB_CAPACITY) trail = trail.slice(-BREADCRUMB_CAPACITY);
      } catch {
        // A trail that cannot be written is not worth an error of its own.
      }
    },
    snapshot: () => trail.map((crumb) => ({ ...crumb })),
    clear: () => {
      trail = [];
    },
  };
}
