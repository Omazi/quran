import type { ExpoWebGLRenderingContext } from 'expo-gl';

import { gardenStage } from '../../garden-picture';
import { previewGardenState } from '../../garden-preview';
import { GardenSurface } from '../garden-surface';
import type { GardenModel } from '../garden-model';

/** A GL context that records every call: none may come once the surface is disposed. */
function recordingGl() {
  const calls: string[] = [];
  const gl = new Proxy(
    {},
    {
      get: (_target, key) => {
        calls.push(String(key));
        return () => undefined;
      },
    },
  ) as ExpoWebGLRenderingContext;
  return { gl, calls };
}

const MODEL = {} as GardenModel;

describe('GardenSurface once its view is gone', () => {
  it('ignores a GL context that arrives after the screen closed: nothing built, nothing told', () => {
    const onReady = jest.fn();
    const onFail = jest.fn();
    const surface = new GardenSurface({ onReady, onFail });
    surface.dispose();
    const { gl, calls } = recordingGl();
    surface.attach(gl, MODEL);
    expect(calls).toEqual([]);
    expect(onReady).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('draws nothing when its size, stage or orbit change after it was disposed', () => {
    const onFail = jest.fn();
    const surface = new GardenSurface({ onReady: jest.fn(), onFail });
    surface.dispose();
    surface.setSize({ width: 390, height: 272 });
    surface.setStage(gardenStage(previewGardenState({ hizbCompleted: 12 })));
    surface.controller.turnBy(1);
    surface.draw();
    expect(onFail).not.toHaveBeenCalled();
  });
});
