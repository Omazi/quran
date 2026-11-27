/**
 * Social data layer: a demonstration of accounts and friends, in memory, on invented people
 * (docs/specs/social.md, deliverable B). It implements the interfaces of `src/domain/social`
 * and calls the rules of the domain. The same interfaces on the Supabase project, with the
 * anonymous account of the phone, are in `supabase-social.ts` (flag `friendsAnonymous`).
 */
export { DEMO_GROUP_ID, DEMO_SIGNED_IN_USER, DEMO_USERS } from './config';
export { createDemoSocialData } from './demo-data';
export { createDemoSocial, createRepeatableRandomIndex } from './demo-social';
export type { DemoSocial, DemoSocialOptions } from './demo-social';
export { createSupabaseSocial } from './supabase-social';
export type { SupabaseSocial, SupabaseSocialOptions } from './supabase-social';
export { SupabaseRequestError } from './supabase-rest';
