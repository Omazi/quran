import { decodeCrashRecord } from '../crash-record';
import { getActiveDiagnostics, noteGestureStart, setActiveDiagnostics } from '../active';
import { createDeviceRecordFile } from '../device-record-file';
import { startDiagnostics, stopDiagnosticsForTests } from '../start-diagnostics';

/** A phone's document folder, in memory. */
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
        .join('/');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    create() {
      if (mockFiles.has(this.uri)) throw new Error('already exists');
      mockFiles.set(this.uri, '');
    }
    textSync() {
      return mockFiles.get(this.uri) ?? '';
    }
    writeSync(text: string) {
      if (!mockFiles.has(this.uri)) throw new Error('no such file');
      mockFiles.set(this.uri, text);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: 'file:///documents' } } };
});

beforeEach(() => mockFiles.clear());
afterEach(() => stopDiagnosticsForTests());

describe('the file of the record on the phone', () => {
  it('writes, reads and removes, creating the file the first time and overwriting after', () => {
    const file = createDeviceRecordFile();
    expect(file.read()).toBeNull();
    file.write('one');
    file.write('two');
    expect(file.read()).toBe('two');
    file.remove();
    expect(file.read()).toBeNull();
    file.remove(); // nothing to remove: no error
  });
});

describe('starting the diagnostics with the app', () => {
  function fakeGlobals() {
    let handler: (error: unknown, isFatal?: boolean) => void = () => {};
    const errorUtils = {
      getGlobalHandler: () => handler,
      setGlobalHandler: (next: typeof handler) => {
        handler = next;
      },
    };
    return { errorUtils, fatal: (error: unknown) => handler(error, true) };
  }

  it('records a fatal error to the phone, and the next launch finds it', () => {
    const first = fakeGlobals();
    const diagnostics = startDiagnostics({
      errorUtils: first.errorUtils,
      console: { error() {} } as unknown as Console,
    });
    expect(getActiveDiagnostics()).toBe(diagnostics);
    diagnostics.setRoute('/onboarding');
    first.fatal(new Error('boom'));
    const stored = decodeCrashRecord([...mockFiles.values()][0] ?? null);
    expect(stored).toMatchObject({ message: 'boom', route: '/onboarding', source: 'fatal' });

    stopDiagnosticsForTests();
    const second = startDiagnostics({
      errorUtils: fakeGlobals().errorUtils,
      console: { error() {} } as unknown as Console,
    });
    expect(second.getSnapshot().previous?.message).toBe('boom');
    expect(second.getSnapshot().isSheetOpen).toBe(true);
  });

  it('starts once: a second call gives the same diagnostics, and installs nothing twice', () => {
    const globals = fakeGlobals();
    const options = {
      errorUtils: globals.errorUtils,
      console: { error() {} } as unknown as Console,
    };
    const first = startDiagnostics(options);
    const handler = globals.errorUtils.getGlobalHandler();
    expect(startDiagnostics(options)).toBe(first);
    expect(globals.errorUtils.getGlobalHandler()).toBe(handler);
  });

  it('never stops the app from starting, whatever its surroundings lack', () => {
    expect(() => startDiagnostics({ errorUtils: undefined, console: undefined })).not.toThrow();
  });
});

describe('the gesture breadcrumbs', () => {
  it('note a gesture in the trail when the diagnostics run, and do nothing otherwise', () => {
    expect(() => noteGestureStart('garden-pan')).not.toThrow();
    const diagnostics = startDiagnostics({ errorUtils: undefined, console: undefined });
    noteGestureStart('garden-pan');
    expect(diagnostics.breadcrumbs.snapshot().map((crumb) => crumb.label)).toContain('garden-pan');
    setActiveDiagnostics(null);
    expect(() => noteGestureStart('x')).not.toThrow();
  });
});
