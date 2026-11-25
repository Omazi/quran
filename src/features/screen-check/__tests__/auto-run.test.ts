import { createProgressLog } from '../progress-log';
import { runFriendScript, swipePlan, type FriendScriptDependencies } from '../auto-run-script';

describe('the plan of the automatic swipe through the introduction', () => {
  it('turns every page once, first at a calm pace, then fast enough to catch a page still sliding', () => {
    const plan = swipePlan(16);
    expect(plan).toHaveLength(15);
    expect(plan[0]?.pauseMs).toBeGreaterThanOrEqual(1000);
    // A spring settles in about 520 ms: the fast swipes come before it ends.
    expect(plan.at(-1)?.pauseMs).toBeLessThan(520);
    expect(plan.every((swipe) => swipe.pauseMs > 0 && swipe.dragMs > 0)).toBe(true);
  });

  it('has nothing to swipe in a flow of one page', () => {
    expect(swipePlan(1)).toEqual([]);
  });
});

describe('the progress log', () => {
  it('writes one line per step, with the time, and is emptied first', () => {
    const lines: string[] = [];
    let time = Date.parse('2026-11-25T18:00:00.000Z');
    const log = createProgressLog({
      reset: () => {
        lines.length = 0;
      },
      append: (line) => lines.push(line),
      now: () => (time += 1000),
    });
    log.reset();
    log.line('pager: swipe 1/15');
    log.line('pager: swipe 2/15');
    expect(lines).toEqual([
      '2026-11-25T18:00:01.000Z pager: swipe 1/15\n',
      '2026-11-25T18:00:02.000Z pager: swipe 2/15\n',
    ]);
  });

  it('never throws, even when the file cannot be written', () => {
    const log = createProgressLog({
      reset: () => {
        throw new Error('no');
      },
      append: () => {
        throw new Error('no');
      },
      now: () => 0,
    });
    expect(() => {
      log.reset();
      log.line('x');
    }).not.toThrow();
  });
});

describe('the script on the demonstration friend page', () => {
  function makeDeps() {
    const calls: string[] = [];
    const controller = {
      dragStart: () => calls.push('dragStart'),
      dragMove: () => calls.push('dragMove'),
      dragEnd: () => calls.push('dragEnd'),
      pinchStart: () => calls.push('pinchStart'),
      pinchMove: (scale: number) => calls.push(`pinchMove ${scale.toFixed(2)}`),
      pinchEnd: () => calls.push('pinchEnd'),
      doubleTap: () => calls.push('doubleTap'),
    };
    const page = {
      encourage: () => calls.push('encourage'),
      scrollTo: (y: number) => calls.push(`scrollTo ${y}`),
    };
    const logged: string[] = [];
    const deps: FriendScriptDependencies = {
      waitForHandle: async (name: string) =>
        (name === 'garden-controller' ? controller : page) as never,
      sleep: async () => {},
      log: (line) => logged.push(line),
    };
    return { calls, logged, deps };
  }

  it('zooms, turns, presses Encourager and scrolls, in that order, and says it is done', async () => {
    const { calls, logged, deps } = makeDeps();
    await runFriendScript(deps);
    const first = (name: string) => calls.findIndex((call) => call.startsWith(name));
    expect(first('pinchStart')).toBeGreaterThanOrEqual(0);
    expect(first('pinchStart')).toBeLessThan(first('encourage'));
    expect(first('dragStart')).toBeLessThan(first('encourage'));
    expect(first('encourage')).toBeLessThan(first('scrollTo'));
    expect(calls.filter((call) => call === 'pinchEnd').length).toBeGreaterThanOrEqual(2);
    expect(calls).toContain('doubleTap');
    // The zoom really goes in and out.
    const scales = calls
      .filter((c) => c.startsWith('pinchMove'))
      .map((c) => Number(c.split(' ')[1]));
    expect(Math.max(...scales)).toBeGreaterThan(1.5);
    expect(Math.min(...scales)).toBeLessThan(1);
    expect(logged.at(-1)).toBe('friend: done');
  });

  it('goes on, and says so, when the garden or the page never shows up', async () => {
    const { logged, deps } = makeDeps();
    await runFriendScript({ ...deps, waitForHandle: async () => undefined });
    expect(logged.some((line) => line.includes('no garden controller'))).toBe(true);
    expect(logged.some((line) => line.includes('no friend page'))).toBe(true);
    expect(logged.at(-1)).toBe('friend: done');
  });

  it('notes an error thrown by a step and carries on with the next one', async () => {
    const { calls, logged, deps } = makeDeps();
    const failing = {
      ...(await deps.waitForHandle<Record<string, () => void>>('garden-controller', 1)),
      pinchStart: () => {
        throw new Error('boom');
      },
    };
    await runFriendScript({
      ...deps,
      waitForHandle: async (name: string) =>
        (name === 'garden-controller'
          ? failing
          : await makeDeps().deps.waitForHandle(name, 1)) as never,
    });
    expect(logged.some((line) => line.includes('error') && line.includes('boom'))).toBe(true);
    expect(calls).toBeDefined();
    expect(logged.at(-1)).toBe('friend: done');
  });
});
