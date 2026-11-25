import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { quranStructure } from '@/data/quran';
import {
  subscribeToDeviceNotificationTaps,
  type SubscribeToNotificationTaps,
} from '@/data/notifications';
import { resolveResumePage } from '@/features/reader';
import { useAppStore } from '@/store';

import { hrefOfTarget } from './notification-routes';

export interface NotificationTapsDependencies {
  /** Defaults to the phone's notifications. */
  readonly subscribe?: SubscribeToNotificationTaps;
}

/**
 * Opens the screen a notification leads to when the person taps it, while the app runs and when
 * the tap is what opened it. The page to resume is read at the moment of the tap. Before the
 * introduction is finished, the routes themselves send the person to it.
 */
export function useNotificationTaps({
  subscribe = subscribeToDeviceNotificationTaps,
}: NotificationTapsDependencies = {}): void {
  const router = useRouter();
  const journal = useAppStore((state) => state.journal);
  const lastOpenedPage = useAppStore((state) => state.settings.lastOpenedPage);
  // The subscription lives as long as the app: it reads the latest data through a ref.
  const latest = useRef({ journal, lastOpenedPage });
  useEffect(() => {
    latest.current = { journal, lastOpenedPage };
  }, [journal, lastOpenedPage]);

  useEffect(
    () =>
      subscribe(({ target }) => {
        const resumePage = resolveResumePage({
          ...latest.current,
          hizbPageRanges: quranStructure.hizbPageRanges(),
        });
        router.push(hrefOfTarget(target, resumePage));
      }),
    [subscribe, router],
  );
}
