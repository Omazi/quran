/**
 * What the glass pill says while the drop falls and once it landed (validated mockup of 27
 * November 2026, shots 21 and 22): "Une goutte pour le grenadier · 3 pages sur 10 du hizb 25",
 * then "Le grenadier a grandi · 4 pages sur 10 du hizb 25", and its small ring, the growth of the
 * element. As translation keys and values, so the words stay in the locale files (writing.md);
 * pure.
 */

import type { GardenElementKind } from '@/domain/garden';

import type { DropMoment } from './drop-moment';
import type { ReadingFeedback } from './reading-feedback';

export type PillLine =
  | { readonly key: `reader:drop.toward.${GardenElementKind}` }
  | { readonly key: `reader:drop.grew.${GardenElementKind}` }
  | { readonly key: 'reader:drop.towardGarden' }
  | { readonly key: 'reader:drop.watered' }
  | { readonly key: 'reader:drop.hizbCompleted'; readonly hizb: number }
  | {
      readonly key: 'reader:drop.hizbPages';
      readonly count: number;
      readonly total: number;
      readonly hizb: number;
    }
  | { readonly key: 'reader:drop.today'; readonly count: number }
  | { readonly key: 'reader:drop.newElement'; readonly element: GardenElementKind };

export interface PillCopy {
  readonly title: PillLine;
  readonly detail: PillLine;
  /** The ring of the pill: how far the element has grown, 0 to 1. */
  readonly ring: number;
}

export function pillCopy(
  feedback: ReadingFeedback,
  phase: Exclude<DropMoment['phase'], 'idle'>,
): PillCopy {
  const isReceived = phase === 'received';
  const { growth } = feedback;
  const pages = growth === null ? null : isReceived ? growth.pagesAfter : growth.pagesBefore;
  const ring =
    growth === null || pages === null || growth.pageCount === 0 ? 1 : pages / growth.pageCount;
  const detail: PillLine =
    growth === null || pages === null
      ? { key: 'reader:drop.today', count: isReceived ? feedback.todayAfter : feedback.todayBefore }
      : { key: 'reader:drop.hizbPages', count: pages, total: growth.pageCount, hizb: growth.hizb };

  if (feedback.kind === 'hizb-completed') {
    return isReceived
      ? {
          title: { key: 'reader:drop.hizbCompleted', hizb: growth?.hizb ?? 0 },
          detail: { key: 'reader:drop.newElement', element: feedback.elementKind },
          ring: 1,
        }
      : { title: { key: `reader:drop.toward.${feedback.elementKind}` }, detail, ring };
  }
  // The element grows only with a page of its hizb; another page waters the garden.
  const grows =
    feedback.growingKind !== null && growth !== null && growth.pagesAfter > growth.pagesBefore;
  const kind = grows ? feedback.growingKind : null;
  const title: PillLine =
    kind === null
      ? { key: isReceived ? 'reader:drop.watered' : 'reader:drop.towardGarden' }
      : isReceived
        ? { key: `reader:drop.grew.${kind}` }
        : { key: `reader:drop.toward.${kind}` };
  return { title, detail, ring };
}
