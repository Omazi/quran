/**
 * Whether a reader screen is open: the reader tells it, the foreground time recorder listens
 * (reader time, D37). A count rather than a flag, so that two readers on the stack, or a remount,
 * stay correct.
 */

type Listener = (isOpen: boolean) => void;

let openReaders = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(openReaders > 0);
}

/** A reader opens. Returns what to call when it closes; calling it twice changes nothing. */
export function enterReader(): () => void {
  openReaders += 1;
  if (openReaders === 1) notify();
  let hasLeft = false;
  return () => {
    if (hasLeft) return;
    hasLeft = true;
    openReaders -= 1;
    if (openReaders === 0) notify();
  };
}

export function isReaderOpen(): boolean {
  return openReaders > 0;
}

export function subscribeToReaderPresence(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests, which must not depend on each other. */
export function forgetReaderPresence(): void {
  openReaders = 0;
  notify();
}
