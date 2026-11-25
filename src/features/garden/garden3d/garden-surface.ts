/**
 * The 3D garden on its GL view, outside React: the renderer, the scene, the stage shown, the size
 * of the view and the camera's controller. `GardenView3D` creates one and tells it what changed;
 * it draws a frame only then (render on demand: idle, it costs nothing).
 */

import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type * as THREE from 'three';

import type { GardenStage } from '../garden-picture';
import type { GardenModel } from './garden-model';
import type * as Renderer from './garden-renderer';
import type * as Three from './garden-three';
import { OrbitController, type FrameScheduler, type ViewSize } from './orbit-controller';

export interface GardenSurfaceOptions {
  /** The first frame is drawn: the 3D garden can replace the picture. */
  readonly onReady: () => void;
  /** Something failed: the picture stays. */
  readonly onFail: (error: unknown) => void;
  readonly frames?: FrameScheduler;
}

/**
 * three.js is loaded with the first GL context, not with the app: a screen without a 3D garden
 * (and the tests, which have no GL) never runs its code.
 */
function engineModules(): { renderer: typeof Renderer; three: typeof Three } {
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    renderer: require('./garden-renderer') as typeof Renderer,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    three: require('./garden-three') as typeof Three,
  };
}

interface Engine {
  readonly gl: ExpoWebGLRenderingContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly three: Three.GardenThree;
  readonly drawFrame: typeof Renderer.drawFrame;
}

export class GardenSurface {
  readonly controller: OrbitController;
  private engine: Engine | null = null;
  private size: ViewSize = { width: 0, height: 0 };
  private stage: GardenStage | null = null;
  private motionReduced = false;
  private onUse: () => void = () => undefined;
  private failed = false;
  /**
   * Set when the view goes. A GL context that arrives later (expo-gl calls `onContextCreate`
   * from the native side, possibly after the screen closed) is never drawn into: the native
   * context goes with its view, and a call into a context that is gone ends the app.
   */
  private isDisposed = false;

  constructor(private readonly options: GardenSurfaceOptions) {
    this.controller = new OrbitController({
      size: () => this.size,
      onChange: () => this.draw(),
      onUse: () => this.onUse(),
      isMotionReduced: () => this.motionReduced,
      frames: options.frames,
    });
  }

  setMotionReduced(isReduced: boolean): void {
    this.motionReduced = isReduced;
  }

  setOnUse(onUse: () => void): void {
    this.onUse = onUse;
  }

  setSize(size: ViewSize): void {
    this.size = size;
    this.draw();
  }

  /** The GL context is there: builds the scene of `model` and draws its first frame. */
  attach(gl: ExpoWebGLRenderingContext, model: GardenModel): void {
    if (this.failed || this.isDisposed) return;
    // A second context for the same view (its surface was made again): the first one is let go.
    this.releaseEngine();
    try {
      const modules = engineModules();
      const renderer = modules.renderer.createGardenRenderer(gl);
      const three = modules.three.buildGardenThree(model);
      if (this.stage !== null) three.showStage(this.stage);
      this.engine = { gl, renderer, three, drawFrame: modules.renderer.drawFrame };
      this.draw();
      if (this.engine !== null) this.options.onReady();
    } catch (error) {
      this.fail(error);
    }
  }

  /** A new stage: new ranges, new colours, and the shadows drawn again. */
  setStage(stage: GardenStage): void {
    this.stage = stage;
    const engine = this.engine;
    if (engine === null) return;
    try {
      if (engine.three.showStage(stage)) {
        engine.renderer.shadowMap.needsUpdate = true;
        this.draw();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  draw(): void {
    const engine = this.engine;
    if (engine === null || this.size.width === 0 || this.size.height === 0) return;
    try {
      engine.three.setOrbit(this.controller.orbit, this.size.width / this.size.height);
      engine.drawFrame(engine.renderer, engine.gl, engine.three.scene, engine.three.camera);
    } catch (error) {
      this.fail(error);
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.controller.dispose();
    this.releaseEngine();
  }

  private releaseEngine(): void {
    const engine = this.engine;
    this.engine = null;
    if (engine === null) return;
    try {
      engine.three.dispose();
      engine.renderer.dispose();
    } catch {
      // The context may already be gone with its view: nothing left to free.
    }
  }

  private fail(error: unknown): void {
    this.failed = true;
    this.dispose();
    this.options.onFail(error);
  }
}
