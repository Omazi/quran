import {
  ContentUnavailableView,
  Gauge as SwiftUIGauge,
  ProgressView,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel as accessibilityLabelModifier,
  gaugeStyle,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

import { useColors } from '../../use-colors';
import { ContentUnavailable as DefaultContentUnavailable } from '../default/status';
import type { ContentUnavailableProps, GaugeProps, ProgressIndicatorProps } from '../types';
import { assertFraction } from '../validation';
import { SwiftUIHost } from './swiftui-host';

/** SwiftUI's `ContentUnavailableView` exists from this version of iOS on. */
const CONTENT_UNAVAILABLE_MINIMUM_IOS = 17;

/**
 * The system's progress indicators: a bar when the progress is known, the activity indicator when
 * it is not, and no switching between the two shapes (progress-indicators.md › Best practices).
 * Their colour is the accent, which comes from the host.
 */
export function ProgressIndicator({ value, accessibilityLabel, testID }: ProgressIndicatorProps) {
  const label = accessibilityLabelModifier(accessibilityLabel);
  if (value === undefined) {
    return (
      <SwiftUIHost size="content">
        <ProgressView testID={testID} modifiers={[progressViewStyle('circular'), label]} />
      </SwiftUIHost>
    );
  }
  assertFraction(value, 'value');
  return (
    <SwiftUIHost size="contentHeight">
      <ProgressView
        value={value}
        testID={testID}
        modifiers={[progressViewStyle('linear'), label]}
      />
    </SwiftUIHost>
  );
}

/**
 * The system gauge in its linear capacity style: a fill that stops at the current value
 * (gauges.md › Anatomy). Its labels describe the value and the ends of the range; VoiceOver reads
 * them (gauges.md › Best practices). Its fill is the accent of the host unless a tone is given:
 * a tone tints the gauge, never a word written by the app.
 */
export function Gauge({
  value,
  label,
  valueLabel,
  minimumLabel,
  maximumLabel,
  tone = 'accent',
  testID,
}: GaugeProps) {
  assertFraction(value, 'value');
  const colors = useColors();
  return (
    <SwiftUIHost size="contentHeight">
      <SwiftUIGauge
        value={value}
        currentValueLabel={<Text>{valueLabel}</Text>}
        minimumValueLabel={minimumLabel === undefined ? undefined : <Text>{minimumLabel}</Text>}
        maximumValueLabel={maximumLabel === undefined ? undefined : <Text>{maximumLabel}</Text>}
        testID={testID}
        modifiers={[
          gaugeStyle('linearCapacity'),
          ...(tone === 'accent' ? [] : [tint(colors[tone])]),
        ]}
      >
        <Text>{label}</Text>
      </SwiftUIGauge>
    </SwiftUIHost>
  );
}

/**
 * The system's empty state (SwiftUI Pro, design.md › Standard system styling). It needs iOS 17:
 * on iOS 16, which the app still supports, the default implementation takes its place instead
 * of an empty screen.
 */
export function ContentUnavailable(props: ContentUnavailableProps) {
  const iosMajorVersion = Number.parseInt(String(Platform.Version), 10);
  if (iosMajorVersion < CONTENT_UNAVAILABLE_MINIMUM_IOS) {
    return <DefaultContentUnavailable {...props} />;
  }
  const { title, description, symbol, testID } = props;
  return (
    <SwiftUIHost size="fill">
      <ContentUnavailableView
        title={title}
        description={description}
        systemImage={symbol.ios}
        testID={testID}
      />
    </SwiftUIHost>
  );
}
