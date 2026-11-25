import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { COPY, copyFor } from '../copy';
import { DiagnosticBoundary } from '../diagnostic-boundary';
import { createDiagnostics } from '../diagnostics';
import { ErrorFallback } from '../error-fallback';
import { createMemoryRecordFile } from '../record-file';
import { setActiveDiagnostics } from '../active';

const APP = { version: '0.1.0', build: '57', os: 'ios 26.1', device: 'iPhone 15' };

function makeDiagnostics() {
  return createDiagnostics({ file: createMemoryRecordFile(), now: () => 0, app: APP });
}

afterEach(() => {
  setActiveDiagnostics(null);
  jest.restoreAllMocks();
});

describe('the words of the recovery screens', () => {
  it('exist in French, English and Arabic, with the same keys', () => {
    expect(Object.keys(COPY.en).sort()).toEqual(Object.keys(COPY.fr).sort());
    expect(Object.keys(COPY.ar).sort()).toEqual(Object.keys(COPY.fr).sort());
    for (const language of ['fr', 'en', 'ar'] as const) {
      for (const text of Object.values(COPY[language])) expect(text.trim()).not.toBe('');
    }
    expect(COPY.fr.title).toBe('Un problème est survenu.');
    expect(COPY.fr.retry).toBe('Réessayer');
    expect(COPY.fr.sheetTitle).toBe("L'app s'est fermée la dernière fois");
  });

  it('follows a language, and falls back to French for any other', () => {
    expect(copyFor('en')).toBe(COPY.en);
    expect(copyFor('de')).toBe(COPY.fr);
    expect(copyFor(null)).toBe(COPY.fr);
  });
});

describe('the error screen', () => {
  const error = Object.assign(new TypeError('x.map is not a function'), {
    stack: [
      'TypeError: x.map is not a function',
      ...Array.from({ length: 20 }, (_, i) => `    at frame${i} (main.jsbundle:1:${i})`),
    ].join('\n'),
  });

  it('says calmly that something went wrong, with the message and the first lines of the stack', async () => {
    await render(
      <ErrorFallback
        error={error}
        componentStack={'\n    at FriendScreen\n    at Route'}
        retry={jest.fn()}
        language="fr"
      />,
    );
    expect(screen.getByText('Un problème est survenu.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    const details = screen.getByTestId('error-details');
    expect(details.props.selectable).toBe(true);
    const text = String(details.props.children);
    expect(text).toContain('x.map is not a function');
    expect(text).toContain('at frame0');
    expect(text).toContain('at FriendScreen');
    // Only the first lines: the screen is a photograph, not a log.
    expect(text).not.toContain('at frame19');
  });

  it('tries again when the person asks', async () => {
    const retry = jest.fn();
    await render(<ErrorFallback error={error} retry={retry} language="fr" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers to copy or send everything, through the system sheet', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await render(<ErrorFallback error={error} retry={jest.fn()} language="en" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Copy or send' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0].message).toContain('x.map is not a function');
    expect(share.mock.calls[0]?.[0].message).toContain('at frame19');
  });

  it('survives a failing share sheet', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no sheet'));
    await render(<ErrorFallback error={error} retry={jest.fn()} language="fr" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Copier ou envoyer' }));
    expect(screen.getByText('Un problème est survenu.')).toBeOnTheScreen();
  });

  it('copes with an error that is not an Error', async () => {
    await render(
      <ErrorFallback error={'just text' as unknown as Error} retry={jest.fn()} language="fr" />,
    );
    expect(String(screen.getByTestId('error-details').props.children)).toContain('just text');
  });
});

describe('the boundary around a navigator', () => {
  let shouldThrow = true;
  function Bomb() {
    if (shouldThrow) throw new Error('render failed');
    return <></>;
  }

  beforeEach(() => {
    shouldThrow = true;
    // React reports a caught error with console.error: not what this test is about.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows the error screen instead of letting the render error end the app', async () => {
    await render(
      <DiagnosticBoundary language="fr">
        <Bomb />
      </DiagnosticBoundary>,
    );
    expect(screen.getByText('Un problème est survenu.')).toBeOnTheScreen();
    expect(String(screen.getByTestId('error-details').props.children)).toContain('render failed');
  });

  it('keeps the error and the component stack for the next launch, and shows the stack', async () => {
    const diagnostics = makeDiagnostics();
    const spy = jest.spyOn(diagnostics, 'recordBoundaryError');
    setActiveDiagnostics(diagnostics);
    await render(
      <DiagnosticBoundary language="fr">
        <Bomb />
      </DiagnosticBoundary>,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1]).toContain('Bomb');
    expect(String(screen.getByTestId('error-details').props.children)).toContain('Bomb');
  });

  it('shows the content again after "Réessayer" once the cause is gone', async () => {
    await render(
      <DiagnosticBoundary language="fr">
        <Bomb />
      </DiagnosticBoundary>,
    );
    shouldThrow = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(screen.queryByText('Un problème est survenu.')).toBeNull();
  });

  it('shows the error screen again when the cause is still there', async () => {
    await render(
      <DiagnosticBoundary language="fr">
        <Bomb />
      </DiagnosticBoundary>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(screen.getByText('Un problème est survenu.')).toBeOnTheScreen();
  });

  it('does nothing visible when nothing fails', async () => {
    shouldThrow = false;
    await render(
      <DiagnosticBoundary language="fr">
        <Bomb />
      </DiagnosticBoundary>,
    );
    expect(screen.queryByText('Un problème est survenu.')).toBeNull();
    await act(async () => {});
  });
});
