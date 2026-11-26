import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { shareCardShape } from '@/ui';

import { ShareCard } from './share-card';
import type { ShareCardContent } from './share-card-content';
import { cardUnit, shareCardImage, type ShareOutcome } from './share-flow';

/**
 * Time to let the pictures inside the badge (the garden, already decoded for the screen the badge
 * is on) and the icon settle before the picture is taken, once the card is laid out.
 */
export const CAPTURE_SETTLE_MS = 350;
/** After this long without a card laid out, the attempt is given up and reported (never a stuck button). */
export const CAPTURE_TIMEOUT_MS = 8000;

export interface ShareCardHostProps {
  content: ShareCardContent;
  /** The title of the share sheet, on Android. */
  dialogTitle: string;
  onFinished: (outcome: ShareOutcome) => void;
}

/**
 * Draws the card off screen at full resolution, takes the picture, and opens the share sheet. It
 * is mounted for one share only, so a person who never shares pays nothing: no card, no memory.
 * Off screen, not hidden: a view at zero opacity is captured blank. Hidden from VoiceOver.
 */
export function ShareCardHost({ content, dialogTitle, onFinished }: ShareCardHostProps) {
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const unit = useMemo(() => cardUnit(PixelRatio.get()), []);
  const [isLaidOut, setIsLaidOut] = useState(false);
  const [isIconSettled, setIsIconSettled] = useState(false);
  const isReady = isLaidOut && isIconSettled;
  // The callback changes with every render of the screen; the attempt must run once.
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  useEffect(() => {
    // Only while waiting for the card: the share sheet may stay open as long as the person likes.
    if (isReady) return undefined;
    const timeout = setTimeout(
      () => finished.current({ status: 'failed', error: new Error('The card was not ready') }),
      CAPTURE_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return undefined;
    let isCurrent = true;
    const timer = setTimeout(() => {
      void shareCardImage({
        isAvailable: () => Sharing.isAvailableAsync(),
        capture: () => captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' }),
        share: (uri) =>
          Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle }),
        release: releaseCapture,
      }).then((outcome) => {
        if (isCurrent) finished.current(outcome);
      });
    }, CAPTURE_SETTLE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [isReady, dialogTitle]);

  const width = shareCardShape.width * unit;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.offScreen, { width, start: -(width + OFF_SCREEN_MARGIN) }]}
      onLayout={() => setIsLaidOut(true)}
      testID="share-card-host"
    >
      <View ref={cardRef} collapsable={false}>
        <ShareCard
          content={content}
          unit={unit}
          onIconLoad={() => setIsIconSettled(true)}
          onIconError={() => setIsIconSettled(true)}
        />
      </View>
    </View>
  );
}

/** Points between the card and the screen's edge: well out of sight. */
const OFF_SCREEN_MARGIN = 64;

const styles = StyleSheet.create({
  offScreen: { position: 'absolute', top: 0 },
});
