/**
 * Every problem found in the data stops the tool with this error. There is no fallback:
 * a message says what is wrong and where, and nothing is written.
 */
export class QuranDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuranDataError';
  }
}

/** @returns {never} */
export function fail(message) {
  throw new QuranDataError(message);
}

/** Runs a command-line tool and turns a QuranDataError into a clear message and exit code 1. */
export function runCommand(name, command) {
  try {
    command();
  } catch (error) {
    if (!(error instanceof QuranDataError)) throw error;
    console.error(`${name} failed: ${error.message}`);
    process.exitCode = 1;
  }
}
