import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { parseEmail, signInProvidersFor, type Session, type SignInProvider } from '@/domain/social';

import { refusalOf, type ShownRefusal } from './refusal';
import { useSocialStore, useSocialVersion } from './social-store';
import { useAsync } from './use-async';

export type SessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly session: Session };

/** Who is signed in, read again after every action of the tab. */
export function useSession(): SessionState {
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const state = useAsync(() => store.client.auth.getSession(), [store, version]);
  if (state.status === 'loading') return { status: 'loading' };
  // A session that cannot be read is no session: the sign-in screen offers to sign in again.
  if (state.status === 'failed' || state.value === null) return { status: 'signed-out' };
  return { status: 'signed-in', session: state.value };
}

/** Where the e-mail way stands: not started, asking for the address, then for the code. */
export type EmailStep = 'closed' | 'address' | 'code';

export interface SignInModel {
  readonly isDemonstration: boolean;
  /** In the order the screen shows them: Apple first on iOS (docs/SECURITY.md, the stores). */
  readonly providers: readonly SignInProvider[];
  readonly emailStep: EmailStep;
  readonly email: string;
  readonly code: string;
  readonly isBusy: boolean;
  readonly refusal: ShownRefusal | null;
}

export interface SignInActions {
  signInWithApple(): void;
  signInWithGoogle(): void;
  openEmail(): void;
  changeEmail(text: string): void;
  requestCode(): void;
  changeCode(text: string): void;
  signInWithEmail(): void;
}

/** The platform's sign-in rules; the web shows what an iPhone shows. */
function signInPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/**
 * The sign-in screen of the tab. In the demonstration, every way opens the same invented
 * session and nothing leaves the phone; the e-mail way still checks the address and the code with
 * the real rules (docs/specs/social.md, section 4).
 */
export function useSignIn(): { model: SignInModel; actions: SignInActions } {
  const store = useSocialStore();
  const { auth } = store.client;
  const [emailStep, setEmailStep] = useState<EmailStep>('closed');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);

  const run = useCallback(
    (work: () => Promise<unknown>, onDone?: () => void) => {
      setIsBusy(true);
      setRefusal(null);
      work().then(
        () => {
          setIsBusy(false);
          onDone?.();
          store.changed();
        },
        (error: unknown) => {
          setIsBusy(false);
          setRefusal(refusalOf(error));
        },
      );
    },
    [store],
  );

  // The field trims, the rules do not (src/domain/social/auth.ts, `parseEmail`).
  const typedEmail = email.trim();
  const actions: SignInActions = {
    signInWithApple: () => run(() => auth.signInWithApple()),
    signInWithGoogle: () => run(() => auth.signInWithGoogle()),
    openEmail: () => {
      setRefusal(null);
      setEmailStep('address');
    },
    changeEmail: (text) => {
      setEmail(text);
      setRefusal(null);
    },
    requestCode: () =>
      run(
        async () => auth.requestEmailCode(parseEmail(typedEmail)),
        () => setEmailStep('code'),
      ),
    changeCode: (text) => {
      setCode(text);
      setRefusal(null);
    },
    signInWithEmail: () => run(() => auth.signInWithEmail(typedEmail, code.trim())),
  };

  return {
    model: {
      isDemonstration: auth.isDemonstration,
      providers: signInProvidersFor(signInPlatform()),
      emailStep,
      email,
      code,
      isBusy,
      refusal,
    },
    actions,
  };
}
