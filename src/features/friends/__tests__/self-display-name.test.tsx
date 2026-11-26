import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { demoForTest, signedInDemoForTest, withStore } from '../test-support/demo';
import { useSelfDisplayName } from '../use-self-name';

function Name() {
  const name = useSelfDisplayName();
  return <Text testID="name">{name ?? 'none'}</Text>;
}

describe('the name of the signed-in person', () => {
  it('is the name of their account', async () => {
    const { store, demo } = await signedInDemoForTest();
    const expected = (await demo.repository.getMyProfile()).displayName;
    await render(withStore(store, <Name />));
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent(expected));
  });

  it('is none when nobody is signed in', async () => {
    const { store } = demoForTest();
    await render(withStore(store, <Name />));
    expect(screen.getByTestId('name')).toHaveTextContent('none');
  });
});
