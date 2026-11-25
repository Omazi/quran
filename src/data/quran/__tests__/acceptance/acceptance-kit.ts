/**
 * Tools of the Quran data acceptance tests: direct access to the generated files, so that
 * the tests can compare what the repository answers with what is really on disk, and an
 * independent SHA-256.
 *
 * The project compiles without Node typings. The few Node functions needed are described
 * here and obtained with `jest.requireActual`, which is typed by Jest itself.
 */

interface NodeFileSystem {
  readFileSync(path: string): Uint8Array;
  readFileSync(path: string, encoding: 'utf8'): string;
  writeFileSync(path: string, data: string | Uint8Array): void;
  readdirSync(path: string): string[];
  existsSync(path: string): boolean;
  statSync(path: string): { isDirectory(): boolean };
  unlinkSync(path: string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  mkdtempSync(prefix: string): string;
  cpSync(source: string, destination: string, options: { recursive: boolean }): void;
  symlinkSync(target: string, path: string, type: 'dir'): void;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}

interface NodePath {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
}

interface NodeHash {
  update(data: string | Uint8Array, encoding?: 'utf8'): NodeHash;
  digest(encoding: 'hex'): string;
}

interface NodeCrypto {
  createHash(algorithm: 'sha256'): NodeHash;
}

interface NodeOperatingSystem {
  tmpdir(): string;
}

interface SpawnResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface NodeChildProcess {
  spawnSync(
    command: string,
    args: readonly string[],
    options: { cwd: string; encoding: 'utf8' },
  ): SpawnResult;
}

interface NodeProcess {
  readonly execPath: string;
}

export const nodeFileSystem = jest.requireActual<NodeFileSystem>('node:fs');
export const nodePath = jest.requireActual<NodePath>('node:path');
export const nodeOperatingSystem = jest.requireActual<NodeOperatingSystem>('node:os');
const nodeCrypto = jest.requireActual<NodeCrypto>('node:crypto');
const nodeChildProcess = jest.requireActual<NodeChildProcess>('node:child_process');
const nodeProcess = jest.requireActual<NodeProcess>('node:process');

/** This file is `<root>/src/data/quran/__tests__/acceptance/<name>`: six levels below the root. */
const LEVELS_BELOW_ROOT = 6;
const OWN_FILE_NAME = 'acceptance-kit.ts';

function currentTestPath(): string {
  const testPath: unknown = expect.getState().testPath;
  if (typeof testPath !== 'string') {
    throw new Error('Jest did not give the path of the running test file.');
  }
  return testPath;
}

/** Absolute path of the repository, found from the path of the running test file. */
export function repositoryRoot(): string {
  const upwards = Array.from({ length: LEVELS_BELOW_ROOT }, () => '..');
  return nodePath.resolve(currentTestPath(), ...upwards);
}

export function dataFilePath(relativePath: string): string {
  return nodePath.join(repositoryRoot(), 'assets', 'data', relativePath);
}

export function sha256Hex(data: string | Uint8Array): string {
  return typeof data === 'string'
    ? nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex')
    : nodeCrypto.createHash('sha256').update(data).digest('hex');
}

/** Runs a Node script and waits for it. Never throws on a failing script: read `status`. */
export function runNodeScript(scriptPath: string, workingDirectory: string): SpawnResult {
  return nodeChildProcess.spawnSync(nodeProcess.execPath, [scriptPath], {
    cwd: workingDirectory,
    encoding: 'utf8',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function readJsonFile(absolutePath: string): unknown {
  return JSON.parse(nodeFileSystem.readFileSync(absolutePath, 'utf8'));
}

export type RawVerses = Readonly<Record<string, readonly string[]>>;

/** A verses file exactly as it is on disk: `{ "<surah>": ["verse 1", ...] }`. */
export function readRawVerses(script: 'uthmani' | 'uthmani-minimal' | 'imlaei'): RawVerses {
  const raw = readJsonFile(dataFilePath(`verses/${script}.json`));
  if (!isRecord(raw)) {
    throw new TypeError(`verses/${script}.json is not an object.`);
  }
  const verses: Record<string, readonly string[]> = {};
  for (const [surah, texts] of Object.entries(raw)) {
    if (!isStringArray(texts)) {
      throw new TypeError(`verses/${script}.json: surah ${surah} is not a list of strings.`);
    }
    verses[surah] = texts;
  }
  return verses;
}

export interface RawIntegrity {
  readonly counts: Readonly<Record<string, number>>;
  readonly pagesPerFile: number;
  readonly canonicalText: Readonly<Record<string, string>>;
  readonly files: Readonly<Record<string, string>>;
}

function readStringRecord(value: unknown, name: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new TypeError(`integrity.json: "${name}" is not an object.`);
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      throw new TypeError(`integrity.json: "${name}.${key}" is not a string.`);
    }
    result[key] = item;
  }
  return result;
}

function readNumberRecord(value: unknown, name: string): Record<string, number> {
  if (!isRecord(value)) {
    throw new TypeError(`integrity.json: "${name}" is not an object.`);
  }
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number') {
      throw new TypeError(`integrity.json: "${name}.${key}" is not a number.`);
    }
    result[key] = item;
  }
  return result;
}

export function readRawIntegrity(): RawIntegrity {
  const raw = readJsonFile(dataFilePath('integrity.json'));
  if (!isRecord(raw) || typeof raw.pagesPerFile !== 'number') {
    throw new TypeError('integrity.json does not have the expected shape.');
  }
  return {
    counts: readNumberRecord(raw.counts, 'counts'),
    pagesPerFile: raw.pagesPerFile,
    canonicalText: readStringRecord(raw.canonicalText, 'canonicalText'),
    files: readStringRecord(raw.files, 'files'),
  };
}

/** Every file below `assets/data`, as paths relative to it, sorted. */
export function listDataFiles(): string[] {
  const found: string[] = [];
  const visit = (relativeDirectory: string): void => {
    for (const name of nodeFileSystem.readdirSync(dataFilePath(relativeDirectory))) {
      const relativePath = relativeDirectory === '' ? name : `${relativeDirectory}/${name}`;
      if (nodeFileSystem.statSync(dataFilePath(relativePath)).isDirectory()) {
        visit(relativePath);
      } else {
        found.push(relativePath);
      }
    }
  };
  visit('');
  return found.sort();
}

export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

// Jest runs every file under __tests__ as a suite and the tester may write nowhere else:
// the kit checks itself here, in its own suite only.
if (currentTestPath().endsWith(OWN_FILE_NAME)) {
  describe('acceptance kit', () => {
    it('finds the repository root and the generated data', () => {
      expect(nodeFileSystem.existsSync(nodePath.join(repositoryRoot(), 'package.json'))).toBe(true);
      expect(nodeFileSystem.existsSync(dataFilePath('integrity.json'))).toBe(true);
    });

    it('computes SHA-256 like the published test vectors', () => {
      expect(sha256Hex('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });
}
