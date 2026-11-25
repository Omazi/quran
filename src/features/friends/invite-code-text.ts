import { SOCIAL_CONFIG } from '@/domain/social';

/** Where the code is cut in two when it is shown: four characters, a space, four characters. */
const SHOWN_GROUP_LENGTH = SOCIAL_CONFIG.inviteCodeLength / 2;

/**
 * What a person typed in the code field, made ready for `parseInviteCode`: capitals, without the
 * spaces and hyphens people add when they copy a code shown in two groups. The domain stays
 * strict (docs/specs/social.md, rule 6: "c'est l'écran qui met en capitales"); the screen does
 * only this, and the domain refuses everything else.
 */
export function typedInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** A code as it is shown: "ABCD EFGH", easier to read out and to copy. */
export function shownInviteCode(code: string): string {
  return `${code.slice(0, SHOWN_GROUP_LENGTH)} ${code.slice(SHOWN_GROUP_LENGTH)}`;
}
