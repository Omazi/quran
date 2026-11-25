import type { Session, SocialData } from '@/domain/social';

/**
 * What the demonstration remembers while the app runs: the tables and who is signed in. The
 * sign-in and the repository share one store, as the real ones will share one server.
 */
export interface DemoStore {
  data: SocialData;
  session: Session | null;
  /** Number of the next group, so that two groups never share an identifier. */
  nextGroupNumber: number;
}
