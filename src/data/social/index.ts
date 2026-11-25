/**
 * Social data layer: a demonstration of accounts and friends, in memory, on invented people
 * (docs/specs/social.md, deliverable B). It implements the interfaces of `src/domain/social`
 * and calls the rules of the domain; the server implementation will replace it.
 */
export { DEMO_GROUP_ID, DEMO_SIGNED_IN_USER, DEMO_USERS } from './config';
export { createDemoSocialData } from './demo-data';
export { createDemoSocial, createRepeatableRandomIndex } from './demo-social';
export type { DemoSocial, DemoSocialOptions } from './demo-social';
