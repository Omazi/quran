import type { NotificationTarget } from '@/domain/reminders';

import { AL_KAHF_PAGE } from './config';

/** Where a tap leads: a route of the app. */
export type NotificationHref = `/reader/${number}` | '/(tabs)';

/**
 * The route of a target. `resumePage` is where the person left off at the moment of the tap, not
 * when the notification was scheduled: it may have moved since.
 */
export function hrefOfTarget(target: NotificationTarget, resumePage: number): NotificationHref {
  switch (target) {
    case 'resume':
      return `/reader/${resumePage}`;
    case 'al-kahf':
      return `/reader/${AL_KAHF_PAGE}`;
    case 'home':
      return '/(tabs)';
  }
}
