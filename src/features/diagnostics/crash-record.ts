/**
 * What is kept when the app closes on a JavaScript error, and how it is written down. The record
 * is one small JSON text in a file of the app (record-file.ts); nothing here leaves the phone on
 * its own: the person sees it and chooses to copy or send it.
 */

import type { Breadcrumb, BreadcrumbKind } from './breadcrumbs';

/** `fatal`: the global handler saw it (the app closes after it). `boundary`: an error screen showed it. */
export type CrashSource = 'fatal' | 'boundary';

export interface AppInfo {
  readonly version: string;
  readonly build: string;
  readonly os: string;
  readonly device: string;
}

export interface CrashRecord {
  readonly source: CrashSource;
  readonly message: string;
  readonly stack: string;
  /** The React component stack, when the error came from a render and it is known. */
  readonly componentStack: string | null;
  /** The last messages the app wrote with `console.error`, newest last. */
  readonly recentErrors: readonly string[];
  /** ISO 8601, UTC. */
  readonly time: string;
  /** The last screen opened (its address), null when none was. */
  readonly route: string | null;
  readonly app: AppInfo;
  readonly breadcrumbs: readonly Breadcrumb[];
  /** True once the sheet of the next launch has shown this record (it is shown once). */
  readonly isShown: boolean;
}

export const MAX_STACK_LENGTH = 6000;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_RECENT_ERRORS = 5;
const MAX_RECENT_ERROR_LENGTH = 1500;
const CRUMB_KINDS: readonly BreadcrumbKind[] = ['nav', 'gesture', 'app', 'error'];
const UNKNOWN_APP: AppInfo = { version: '?', build: '?', os: '?', device: '?' };

export function describeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: String(error.message), stack: error.stack ?? '' };
  if (typeof error === 'string') return { message: error, stack: '' };
  try {
    const json = JSON.stringify(error);
    return { message: json === undefined ? String(error) : json, stack: '' };
  } catch {
    return { message: Object.prototype.toString.call(error), stack: '' };
  }
}

export function encodeCrashRecord(record: CrashRecord): string {
  return JSON.stringify({
    ...record,
    message: record.message.slice(0, MAX_MESSAGE_LENGTH),
    stack: record.stack.slice(0, MAX_STACK_LENGTH),
    componentStack: record.componentStack?.slice(0, MAX_STACK_LENGTH) ?? null,
    recentErrors: record.recentErrors
      .slice(-MAX_RECENT_ERRORS)
      .map((text) => text.slice(0, MAX_RECENT_ERROR_LENGTH)),
  });
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function breadcrumbOf(value: unknown): Breadcrumb | null {
  if (typeof value !== 'object' || value === null) return null;
  const { at, kind, label } = value as Record<string, unknown>;
  if (typeof at !== 'number' || typeof label !== 'string') return null;
  if (!CRUMB_KINDS.includes(kind as BreadcrumbKind)) return null;
  return { at, kind: kind as BreadcrumbKind, label };
}

/** The record a text holds, or null. A record of another version is read as far as it goes. */
export function decodeCrashRecord(raw: string | null): CrashRecord | null {
  if (raw === null || raw === '') return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.message !== 'string') return null;
  const app =
    typeof data.app === 'object' && data.app !== null
      ? (data.app as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return {
    source: data.source === 'boundary' ? 'boundary' : 'fatal',
    message: data.message,
    stack: text(data.stack, ''),
    componentStack: typeof data.componentStack === 'string' ? data.componentStack : null,
    recentErrors: Array.isArray(data.recentErrors)
      ? data.recentErrors.filter((entry): entry is string => typeof entry === 'string')
      : [],
    time: text(data.time, ''),
    route: typeof data.route === 'string' ? data.route : null,
    app: {
      version: text(app.version, UNKNOWN_APP.version),
      build: text(app.build, UNKNOWN_APP.build),
      os: text(app.os, UNKNOWN_APP.os),
      device: text(app.device, UNKNOWN_APP.device),
    },
    breadcrumbs: Array.isArray(data.breadcrumbs)
      ? data.breadcrumbs.map(breadcrumbOf).filter((crumb): crumb is Breadcrumb => crumb !== null)
      : [],
    isShown: data.isShown === true,
  };
}

/** The first lines of a stack, for a small screen. */
export function firstLines(stack: string, count: number): string {
  return stack.split('\n').slice(0, count).join('\n');
}

/** The record as one text, for a message to the developer (the owner copies or sends it). */
export function formatCrashRecord(record: CrashRecord): string {
  const { app } = record;
  const lines = [
    `${record.source === 'fatal' ? 'App closed' : 'Error screen'} on ${record.time}`,
    `App ${app.version} (${app.build}), ${app.os}, ${app.device}`,
    `Screen: ${record.route ?? '(none opened)'}`,
    '',
    record.message,
    '',
    record.stack === '' ? '(no stack)' : record.stack,
  ];
  if (record.componentStack !== null) lines.push('', 'Components:', record.componentStack);
  if (record.recentErrors.length > 0)
    lines.push('', 'Recent console errors:', ...record.recentErrors);
  lines.push('', 'Trail (oldest first):');
  for (const crumb of record.breadcrumbs) {
    lines.push(`${new Date(crumb.at).toISOString().slice(11, 23)} ${crumb.kind} ${crumb.label}`);
  }
  return lines.join('\n');
}
