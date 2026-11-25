import { useEffect } from 'react';

import { enterReader } from './reader-presence';

/** Says a reader is open for as long as the calling screen is mounted: reader time (D37). */
export function useReaderPresence(): void {
  useEffect(() => enterReader(), []);
}
