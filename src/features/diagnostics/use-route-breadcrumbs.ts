import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { getActiveDiagnostics } from './active';

/** Writes each screen the person opens (its address) in the trail, and keeps the last one. */
export function useRouteBreadcrumbs(): void {
  const pathname = usePathname();
  useEffect(() => {
    getActiveDiagnostics()?.setRoute(pathname);
  }, [pathname]);
}
