/**
 * Where a screen leaves the few things the iOS check's automatic run needs to reach (the 3D
 * garden's controller, the friend page's actions). This file imports nothing, so a feature can
 * import it without pulling the check in. Until the check opens it (`openHandles`, from the
 * check's own code, only in its build) publishing keeps nothing: in the app people have, it is a
 * single test of a boolean.
 */

const held = new Map<string, unknown>();
let isOpen = false;

export function openHandles(): void {
  isOpen = true;
}

/** For tests. */
export function closeHandles(): void {
  isOpen = false;
  held.clear();
}

/** Publishes a handle; returns what takes it back (only if it is still the one published). */
export function publishHandle(name: string, handle: unknown): () => void {
  if (!isOpen) return noop;
  held.set(name, handle);
  return () => {
    if (held.get(name) === handle) held.delete(name);
  };
}

function noop(): void {}

export function getHandle<T = unknown>(name: string): T | undefined {
  return held.get(name) as T | undefined;
}

/** Waits for a screen to publish a handle, polling; undefined when it has not by `timeoutMs`. */
export async function waitForHandle<T = unknown>(
  name: string,
  timeoutMs: number,
  pollMs = 250,
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const handle = getHandle<T>(name);
    if (handle !== undefined) return handle;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
