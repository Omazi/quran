import type { TextFieldKind } from './types';

/**
 * What each kind of text field asks of the keyboard, the same on every platform
 * (text-fields.md › Best practices: show the appropriate keyboard type).
 */
export interface TextFieldBehaviour {
  readonly keyboard: 'default' | 'email-address' | 'number-pad' | 'web-search';
  readonly capitalization: 'none' | 'words' | 'sentences' | 'characters';
  /** Suggestions and corrections: off for anything that must be typed exactly. */
  readonly autocorrect: boolean;
  /** What the system may offer to fill in: an address from the contact card, a code from Messages. */
  readonly content: 'none' | 'name' | 'emailAddress' | 'oneTimeCode';
  readonly returnKey: 'done' | 'search' | 'go';
}

export const TEXT_FIELD_BEHAVIOURS: Readonly<Record<TextFieldKind, TextFieldBehaviour>> = {
  text: {
    keyboard: 'default',
    capitalization: 'sentences',
    autocorrect: true,
    content: 'none',
    returnKey: 'done',
  },
  name: {
    keyboard: 'default',
    capitalization: 'words',
    autocorrect: false,
    content: 'name',
    returnKey: 'done',
  },
  email: {
    keyboard: 'email-address',
    capitalization: 'none',
    autocorrect: false,
    content: 'emailAddress',
    returnKey: 'go',
  },
  emailCode: {
    keyboard: 'number-pad',
    capitalization: 'none',
    autocorrect: false,
    content: 'oneTimeCode',
    returnKey: 'go',
  },
  // An invitation code has capitals only (docs/specs/social.md, rule 6): the keyboard starts in
  // capitals, and nothing is corrected.
  inviteCode: {
    keyboard: 'default',
    capitalization: 'characters',
    autocorrect: false,
    content: 'none',
    returnKey: 'go',
  },
  search: {
    keyboard: 'web-search',
    capitalization: 'none',
    autocorrect: false,
    content: 'none',
    returnKey: 'search',
  },
};
