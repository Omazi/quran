type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Calls `listener` whenever the person answers the system's alert. The reminders are planned
 * again then: they were switched on before the answer, and the answer decides whether they come.
 */
export function subscribeToPermissionChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tells the listeners the permission may have changed. */
export function announcePermissionChange(): void {
  listeners.forEach((listener) => listener());
}
