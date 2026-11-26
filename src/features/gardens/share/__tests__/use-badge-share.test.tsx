import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Pressable, Text } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import type { LocalDate } from '@/domain/shared/local-date';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';

import type { NameChoice } from '../choose-name';
import { CAPTURE_SETTLE_MS, CAPTURE_TIMEOUT_MS } from '../share-card-host';
import type { ShareCardInput } from '../share-card-content';
import { useBadgeShare } from '../use-badge-share';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));

const BADGE: ShareCardInput = {
  khatm: 2,
  styleId: 'oasis',
  completedOn: '2026-04-02' as LocalDate,
  days: 31,
};
const FILE = 'file:///cache/ReactNative-snapshot-image-1.png';

function Probe({
  displayName,
  askName,
  notify,
}: {
  displayName: string | null;
  askName?: () => Promise<NameChoice>;
  notify: (title: string, message: string) => void;
}) {
  const sharing = useBadgeShare({ displayName, askName, notify });
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="share"
        disabled={sharing.isBusy}
        onPress={() => sharing.share(BADGE)}
      />
      <Text testID="busy">{sharing.isBusy ? 'busy' : 'idle'}</Text>
      {sharing.host}
    </>
  );
}

/** The card is hidden from VoiceOver on purpose: the queries must look at hidden elements too. */
const HIDDEN = { includeHiddenElements: true } as const;
const byId = (id: string) => screen.getByTestId(id, HIDDEN);
const findById = (id: string) => screen.findByTestId(id, HIDDEN);
const queryById = (id: string) => screen.queryByTestId(id, HIDDEN);
const hasText = (text: string) => screen.queryByText(text, HIDDEN);

/** Lays the card out and decodes its icon, then lets the settling time pass. */
async function drawCard() {
  await fireEvent(byId('share-card-host'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 450 } },
  });
  await fireEvent(byId('share-card-icon'), 'load', {
    nativeEvent: { source: { width: 1024, height: 1024 } },
  });
  await act(async () => {
    jest.advanceTimersByTime(CAPTURE_SETTLE_MS);
  });
}

async function start(props: Partial<Parameters<typeof Probe>[0]> = {}) {
  const notify = jest.fn();
  await render(<Probe displayName={null} notify={notify} {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'share' }));
  return { notify };
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  jest.mocked(captureRef).mockResolvedValue(FILE);
  jest.mocked(releaseCapture).mockClear();
  await showLanguage('fr');
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('sharing a badge as a picture', () => {
  it('draws the card off screen, takes a PNG, opens the share sheet on it, then deletes it', async () => {
    await start();
    expect(await findById('share-card')).toBeOnTheScreen();
    expect(screen.getByText('Khatma n°2 terminée', HIDDEN)).toBeOnTheScreen();
    expect(byId('share-card-host')).toHaveProp('accessibilityElementsHidden', true);
    expect(captureRef).not.toHaveBeenCalled();

    await drawCard();

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(FILE, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Partager mon badge',
    });
    expect(releaseCapture).toHaveBeenCalledWith(FILE);
    expect(queryById('share-card')).not.toBeOnTheScreen();
    expect(byId('busy')).toHaveTextContent('idle');
  });

  it('waits for the card to be laid out and its icon decoded before drawing', async () => {
    await start();
    await act(async () => {
      jest.advanceTimersByTime(CAPTURE_SETTLE_MS * 2);
    });
    expect(captureRef).not.toHaveBeenCalled();
  });

  it('puts no name on the picture and asks no question when the person has no name', async () => {
    const askName = jest.fn();
    await start({ askName });
    expect(askName).not.toHaveBeenCalled();
    expect(await findById('share-card')).toBeOnTheScreen();
    expect(queryById('share-card-name')).not.toBeOnTheScreen();
  });

  it('asks about the name, offering the name itself, and leaves it out when told to', async () => {
    const askName = jest.fn(() => Promise.resolve<NameChoice>('without'));
    await start({ displayName: 'Omar', askName });
    expect(askName).toHaveBeenCalledWith({
      title: 'Ajouter ton nom à l’image ?',
      name: 'Omar',
      withLabel: 'Avec mon nom',
      withoutLabel: 'Sans mon nom',
      cancelLabel: 'Annuler',
    });
    expect(await findById('share-card')).toBeOnTheScreen();
    expect(queryById('share-card-name')).not.toBeOnTheScreen();
    expect(hasText('Omar')).not.toBeOnTheScreen();
  });

  it('writes the name on the picture only when the person chose to', async () => {
    await start({ displayName: 'Omar', askName: () => Promise.resolve('with') });
    expect(await findById('share-card-name')).toHaveTextContent('Omar');
  });

  it('does nothing, and stays ready to start again, when the person cancels the question', async () => {
    await start({ displayName: 'Omar', askName: () => Promise.resolve('cancel') });
    await act(async () => {
      jest.advanceTimersByTime(CAPTURE_TIMEOUT_MS);
    });
    expect(queryById('share-card')).not.toBeOnTheScreen();
    expect(captureRef).not.toHaveBeenCalled();
    expect(byId('busy')).toHaveTextContent('idle');
  });

  it('takes a second tap for nothing while the first share runs', async () => {
    const askName = jest.fn(() => new Promise<NameChoice>(() => undefined));
    await start({ displayName: 'Omar', askName });
    expect(byId('busy')).toHaveTextContent('busy');
    await fireEvent.press(screen.getByRole('button', { name: 'share' }));
    expect(askName).toHaveBeenCalledTimes(1);
  });

  it('tells the person, and draws nothing, when the device cannot share', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    const { notify } = await start();
    await drawCard();
    expect(notify).toHaveBeenCalledWith(
      'Partage indisponible',
      'Ton appareil ne peut pas partager d’image ici.',
    );
    expect(captureRef).not.toHaveBeenCalled();
    expect(queryById('share-card')).not.toBeOnTheScreen();
    expect(byId('busy')).toHaveTextContent('idle');
  });

  it('tells the person what happened and what to do when the picture cannot be taken', async () => {
    jest.mocked(captureRef).mockRejectedValue(new Error('The content size must not be zero'));
    const { notify } = await start();
    await drawCard();
    expect(notify).toHaveBeenCalledWith(
      'Le badge n’a pas pu être partagé',
      'Réessaie dans un instant.',
    );
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(byId('busy')).toHaveTextContent('idle');
  });

  it('tells the person when the share sheet cannot open, and still deletes the file', async () => {
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('no activity'));
    const { notify } = await start();
    await drawCard();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(releaseCapture).toHaveBeenCalledWith(FILE);
  });

  it('gives up with a message when the card is never laid out', async () => {
    const { notify } = await start();
    expect(await findById('share-card')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(CAPTURE_TIMEOUT_MS);
    });
    expect(notify).toHaveBeenCalledWith(
      'Le badge n’a pas pu être partagé',
      'Réessaie dans un instant.',
    );
    expect(queryById('share-card')).not.toBeOnTheScreen();
  });

  it('lets the share sheet stay open as long as the person likes', async () => {
    jest.mocked(Sharing.shareAsync).mockReturnValue(new Promise(() => undefined));
    const { notify } = await start();
    await drawCard();
    await act(async () => {
      jest.advanceTimersByTime(CAPTURE_TIMEOUT_MS * 3);
    });
    expect(notify).not.toHaveBeenCalled();
    expect(byId('busy')).toHaveTextContent('busy');
  });

  it('writes the card in the language of the app', async () => {
    await showLanguage('en');
    await start();
    expect(await screen.findByText('Khatma no. 2 complete', HIDDEN)).toBeOnTheScreen();
  });
});
