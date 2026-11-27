import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { chooseName, type ChooseName } from './choose-name';
import {
  buildShareCardContent,
  type ShareCardContent,
  type ShareCardInput,
} from './share-card-content';
import { ShareCardHost } from './share-card-host';
import type { ShareOutcome } from './share-flow';

export interface BadgeShareOptions {
  /**
   * The name the person gave their account, when they have one. Never on the image unless they say
   * yes, once per share (default: no). Null: no question, no name.
   */
  displayName: string | null;
  /** Asks about the name. Defaults to the system's sheet; tests answer for it. */
  askName?: ChooseName;
  /** Tells the person a share did not happen. Defaults to the system's alert. */
  notify?: (title: string, message: string) => void;
}

export interface BadgeShare {
  /** Starts sharing the badge: the question about the name, the picture, the system share sheet. */
  share: (badge: ShareCardInput) => void;
  /** True from the tap to the end of the share sheet: the buttons that start a share are off. */
  isBusy: boolean;
  /** To render once, beside the screen's content: the card, off screen, while a share runs. */
  host: ReactNode;
}

const alertNotify = (title: string, message: string) => Alert.alert(title, message);

/**
 * Sharing the badge of a khatma as a picture (owner's decision of 26 November 2026): "Partager"
 * on the celebration, on "Mes jardins" and on the badge shelf all use this. The picture is made on
 * the phone, written to the cache, handed to the system share sheet and deleted; no network. A
 * failure is told in words (ux-writing: what happened, what to do), never silent.
 */
export function useBadgeShare({
  displayName,
  askName = chooseName,
  notify = alertNotify,
}: BadgeShareOptions): BadgeShare {
  const { t, i18n } = useTranslation('gardens');
  const { t: tCommon } = useTranslation('common');
  const [content, setContent] = useState<ShareCardContent | null>(null);
  const isBusyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const setBusy = useCallback((value: boolean) => {
    isBusyRef.current = value;
    setIsBusy(value);
  }, []);

  const share = useCallback(
    (badge: ShareCardInput) => {
      // A second tap while the first share runs would stack two sheets.
      if (isBusyRef.current) return;
      setBusy(true);
      const start = async () => {
        let name: string | null = null;
        const known = displayName?.trim() ?? '';
        if (known !== '') {
          const choice = await askName({
            title: t('share.chooseTitle'),
            name: known,
            withLabel: t('share.withName'),
            withoutLabel: t('share.withoutName'),
            cancelLabel: tCommon('actions.cancel'),
          });
          if (choice === 'cancel') {
            setBusy(false);
            return;
          }
          name = choice === 'with' ? known : null;
        }
        setContent(
          buildShareCardContent(badge, {
            t,
            appName: tCommon('appName'),
            language: i18n.language,
            name,
          }),
        );
      };
      start().catch(() => setBusy(false));
    },
    [askName, displayName, i18n.language, setBusy, t, tCommon],
  );

  const onFinished = useCallback(
    (outcome: ShareOutcome) => {
      setContent(null);
      setBusy(false);
      if (outcome.status === 'unavailable') {
        notify(t('share.unavailableTitle'), t('share.unavailableMessage'));
      } else if (outcome.status === 'failed') {
        notify(t('share.errorTitle'), t('share.errorMessage'));
      }
    },
    [notify, setBusy, t],
  );

  return {
    share,
    isBusy,
    host:
      content === null ? null : (
        <ShareCardHost
          content={content}
          dialogTitle={t('share.dialogTitle')}
          onFinished={onFinished}
        />
      ),
  };
}
