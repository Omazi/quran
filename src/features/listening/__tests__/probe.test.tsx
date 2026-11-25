import { render, screen } from '@testing-library/react-native';
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Probe() {
  const t = useSharedValue(0);
  useFrameCallback((frame) => {
    t.set(frame.timeSinceFirstFrame);
  });
  const props = useAnimatedProps(() => ({ strokeOpacity: 0.5, d: `M0 0 L${t.get()} 10` }));
  return (
    <Svg testID="svg" width={100} height={100}>
      <AnimatedPath testID="p" animatedProps={props} stroke="red" />
    </Svg>
  );
}

it('renders', async () => {
  await render(<Probe />);
  console.log(typeof scheduleOnUI, JSON.stringify(screen.getByTestId('p').props).slice(0, 400));
});
