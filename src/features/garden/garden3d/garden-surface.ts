/**
 * The 3D garden on its GL view, outside React: the renderer, the scene, the stage shown, the size
 * of the view and the camera's controller. `GardenView3D` creates one and tells it what changed;
 * it draws a frame only then (render on demand: idle, it costs nothing).
 */

import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type * as THREE from 'three';

import type { GardenStage } from '../garden-picture';
import type { GrowthSegment } from '../growth-motion';
import type { GardenLife } from '../living/life-rules';
import type { SkyState } from '../sky/sky-state';
import type { FrameAnchor, Orbit } from './camera-rig';
import { GARDEN_3D } from './config';
import type { GardenModel } from './garden-model';
import type * as Renderer from './garden-renderer';
import type * as Three from './garden-three';
import { focusOrbit, shouldGlideOnGrowth } from './glide';
import { GrowthPlayer, type ShownGrowthFrame } from './growth-player';
import {
  OrbitController,
  screenFrames,
  type FrameScheduler,
  type ViewSize,
} from './orbit-controller';

export interface GardenSurfaceOptions {
  /**
   * The first frame is on the screen, drawn into a view that has a size: the 3D garden can
   * replace the picture. Never before, so that the picture is never taken away for nothing.
   */
  readonly onReady: () => void;
  /** Something failed: the picture stays. */
  readonly onFail: (error: unknown) => void;
  /** Where the picture rests in a taller view. Bottom if not given. */
  readonly anchor?: FrameAnchor;
  /**
   * The home garden: alive (water, wind, the sky's lights, fireflies, leaves, earned birds and
   * butterflies), drawn every frame by one render loop while it is active. Off: drawn only when
   * something changes, as the pictures' garden.
   */
  readonly living?: boolean;
  /**
   * The return glide (maquette-wow, owner's decision of 27 November 2026): a growth to play takes
   * the camera to the plant, which grows one step with a ripple of light; then the camera comes
   * back. A touch interrupts it.
   */
  readonly glides?: boolean;
  /** The plant grows on screen during a glide: the moment for the sound and the light haptic. */
  readonly onGrow?: () => void;
  /** A glide starts (true) or ends (false): what floats over the garden can step aside. */
  readonly onGlideChange?: (isGliding: boolean) => void;
  readonly frames?: FrameScheduler;
}

/** The longest frame the living garden moves by: back from the background, it does not jump. */
const MAX_LIFE_STEP_S = 0.064;
const MS_PER_SECOND = 1000;

interface Glide {
  /** Where the camera was: it comes back there. */
  readonly from: Orbit;
  readonly segments: readonly GrowthSegment[];
  phase: 'to' | 'grow' | 'hold' | 'back';
  /** The wait between the growth and the way back. */
  holdFrame: number | null;
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
  /** A frame has been drawn into a buffer with a size, and `onReady` has been told. */
  private hasDrawnFrame = false;
  /** The element growing on screen, and how far: what the player or `setGrowth` last said. */
  private growth: ShownGrowthFrame | null = null;
  private readonly player: GrowthPlayer;
  private readonly frames: FrameScheduler;
  /** The screen is in front and the app in the foreground: the living garden may move. */
  private isActive = true;
  /** The render loop of the living garden, while it runs. */
  private loopFrame: number | null = null;
  private lastLoopTime = 0;
  /** Seconds of life: the wind, the water, the fireflies. */
  private lifeTime = 0;
  private sky: SkyState | null = null;
  private life: GardenLife | null = null;
  private glide: Glide | null = null;
  private onGrow: (() => void) | undefined;
  private onGlideChange: ((isGliding: boolean) => void) | undefined;
  /**
   * Set when the view goes. A GL context that arrives later (expo-gl calls `onContextCreate`
   * from the native side, possibly after the screen closed) is never drawn into: the native
   * context goes with its view, and a call into a context that is gone ends the app.
   */
  private isDisposed = false;

  constructor(private readonly options: GardenSurfaceOptions) {
    this.frames = options.frames ?? screenFrames;
    this.onGrow = options.onGrow;
    this.onGlideChange = options.onGlideChange;
    this.player = new GrowthPlayer({
      frames: options.frames,
      onFrame: (frame) => this.showGrowthFrame(frame),
      // The stage takes the finished plant back.
      onDone: () => this.refresh(),
    });
    this.controller = new OrbitController({
      size: () => this.size,
      onChange: () => this.draw(),
      onUse: () => this.onUse(),
      isMotionReduced: () => this.motionReduced,
      anchor: () => options.anchor ?? 'bottom',
      onFingerDown: () => this.interruptGlide(),
      frames: options.frames,
    });
  }

  setMotionReduced(isReduced: boolean): void {
    this.motionReduced = isReduced;
    this.updateLoop();
  }

  /**
   * The screen is in front and the app in the foreground (true), or not: the render loop stops,
   * and a glide in progress ends at once.
   */
  setActive(isActive: boolean): void {
    this.isActive = isActive;
    if (!isActive) this.finishGlideAtOnce();
    this.updateLoop();
  }

  /** Who is told of the return glide: the plant grows (feedback), the glide starts or ends. */
  setGlideListeners(listeners: {
    readonly onGrow?: () => void;
    readonly onGlideChange?: (isGliding: boolean) => void;
  }): void {
    this.onGrow = listeners.onGrow;
    this.onGlideChange = listeners.onGlideChange;
  }

  /** Whether the render loop of the living garden runs: for the tests and the screen check. */
  get isLooping(): boolean {
    return this.loopFrame !== null;
  }

  /** The sky of the hour: its light on the garden, its lights behind it. */
  setSky(sky: SkyState): void {
    this.sky = sky;
    const engine = this.engine;
    if (engine === null) return;
    try {
      if (engine.three.setSky(sky)) engine.renderer.shadowMap.needsUpdate = true;
      this.draw();
    } catch (error) {
      this.fail(error);
    }
  }

  /** What lives in the garden. */
  setLife(life: GardenLife): void {
    this.life = life;
    this.engine?.three.setLife(life);
  }

  setOnUse(onUse: () => void): void {
    this.onUse = onUse;
  }

  setSize(size: ViewSize): void {
    this.size = size;
    this.tellView();
    this.draw();
  }

  /** The view in points and in pixels: the sky's lights and the fireflies keep their size. */
  private tellView(): void {
    const engine = this.engine;
    if (engine === null || this.size.width === 0) return;
    const ratio =
      engine.gl.drawingBufferWidth > 0 ? engine.gl.drawingBufferWidth / this.size.width : 1;
    engine.three.setView(this.size.width, this.size.height, ratio);
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
      const stage = this.shownStage();
      if (stage !== null) three.showStage(stage);
      three.showGrowth(this.growth);
      const isLiving = this.options.living === true;
      three.setLiving(isLiving);
      if (isLiving && this.sky !== null) three.setSky(this.sky);
      if (isLiving && this.life !== null) three.setLife(this.life);
      this.engine = { gl, renderer, three, drawFrame: modules.renderer.drawFrame };
      this.tellView();
      // Ready is told by the first frame that really draws, now or when the view has its size.
      this.draw();
      this.updateLoop();
    } catch (error) {
      this.fail(error);
    }
  }

  /** A new stage: new ranges, new colours, and the shadows drawn again. */
  setStage(stage: GardenStage): void {
    this.stage = stage;
    this.refresh();
  }

  /**
   * The element of the hizb in progress, shown at once at its growth (or nothing). A growth
   * playing towards the same place goes on; any other stops.
   */
  setGrowth(growth: ShownGrowthFrame | null): void {
    // The same growth asked again while the camera glides to play it: the glide goes on.
    const glidesTo = this.glide?.segments[this.glide.segments.length - 1];
    if (
      glidesTo !== undefined &&
      growth !== null &&
      glidesTo.hizb === growth.hizb &&
      glidesTo.to === growth.growth
    ) {
      return;
    }
    this.finishGlideAtOnce();
    const destination = this.player.destination;
    if (
      destination !== null &&
      growth !== null &&
      destination.hizb === growth.hizb &&
      destination.to === growth.growth
    ) {
      return;
    }
    this.player.stop();
    this.showGrowthFrame(growth);
  }

  /**
   * Plays a growth (growth-motion.ts `growthSegments`), drawn frame by frame. On the home garden,
   * the camera first glides to the plant (`shouldGlideOnGrowth`).
   */
  playGrowth(segments: readonly GrowthSegment[]): void {
    this.finishGlideAtOnce();
    const first = segments[0];
    // The plant is built at its starting growth, so that the camera knows where it stands.
    if (first !== undefined) this.showGrowthFrame({ hizb: first.hizb, growth: first.from });
    const focus = this.engine?.three.growthFocus() ?? null;
    const glides = shouldGlideOnGrowth({
      segments: segments.length,
      isMotionReduced: this.motionReduced,
      isEnabled: this.options.glides === true && this.isActive && this.hasSize,
      hasFocus: focus !== null,
    });
    if (!glides || focus === null) {
      this.player.play(segments);
      return;
    }
    const from = this.controller.orbit;
    const glide: Glide = { from, segments, phase: 'to', holdFrame: null };
    this.glide = glide;
    this.onGlideChange?.(true);
    const target = focusOrbit(from, focus, this.size.width / this.size.height, this.anchor);
    const { toMs, easeInOut } = GARDEN_3D.glide;
    this.controller.glideTo(target, toMs, easeInOut, () => this.growDuringGlide(glide));
  }

  private get hasSize(): boolean {
    return this.size.width > 0 && this.size.height > 0;
  }

  private get anchor(): FrameAnchor {
    return this.options.anchor ?? 'bottom';
  }

  /** Arrived at the plant: it grows one step, with a ripple of light, then the camera goes back. */
  private growDuringGlide(glide: Glide): void {
    if (this.glide !== glide) return;
    glide.phase = 'grow';
    this.engine?.three.rippleAtGrowth(this.lifeTime);
    this.onGrow?.();
    this.player.play(glide.segments, {
      maxMs: GARDEN_3D.glide.growMaxMs,
      onPlayed: () => this.holdThenReturn(glide),
    });
  }

  private holdThenReturn(glide: Glide): void {
    if (this.glide !== glide) return;
    glide.phase = 'hold';
    const start = this.frames.now();
    const wait = (time: number) => {
      if (this.glide !== glide) return;
      if (time - start < GARDEN_3D.glide.holdMs) {
        glide.holdFrame = this.frames.request(wait);
        return;
      }
      glide.holdFrame = null;
      glide.phase = 'back';
      const { backMs, easeOut } = GARDEN_3D.glide;
      this.controller.glideTo(glide.from, backMs, easeOut, () => this.endGlide(glide));
    };
    glide.holdFrame = this.frames.request(wait);
  }

  private endGlide(glide: Glide): void {
    if (this.glide !== glide) return;
    if (glide.holdFrame !== null) this.frames.cancel(glide.holdFrame);
    this.glide = null;
    this.onGlideChange?.(false);
  }

  /** Whether the camera is on its return glide: for the tests and the screen check. */
  get isGliding(): boolean {
    return this.glide !== null;
  }

  /**
   * A touch during a glide (on the garden or on what floats over it): the plant takes its new
   * size at once, the camera comes back, and the person is free (motion.md › Let people cancel
   * motion).
   */
  interruptGlide(): void {
    const glide = this.glide;
    if (glide === null) return;
    this.player.stop();
    const last = glide.segments[glide.segments.length - 1];
    if (last !== undefined) this.showGrowthFrame({ hizb: last.hizb, growth: last.to });
    this.endGlide(glide);
    this.controller.settleTo(glide.from);
  }

  /** The screen goes (the reader opens): the glide ends where it would have, without moving. */
  private finishGlideAtOnce(): void {
    const glide = this.glide;
    if (glide === null) return;
    this.player.stop();
    const last = glide.segments[glide.segments.length - 1];
    if (last !== undefined) this.showGrowthFrame({ hizb: last.hizb, growth: last.to });
    this.endGlide(glide);
    this.controller.jumpTo(glide.from);
  }

  /** Starts or stops the render loop: alive, active, attached, and motion not reduced. */
  private updateLoop(): void {
    const shouldRun =
      this.options.living === true &&
      this.isActive &&
      !this.motionReduced &&
      !this.isDisposed &&
      this.engine !== null;
    if (shouldRun && this.loopFrame === null) {
      this.lastLoopTime = this.frames.now();
      this.loopFrame = this.frames.request(this.loop);
    } else if (!shouldRun && this.loopFrame !== null) {
      this.frames.cancel(this.loopFrame);
      this.loopFrame = null;
      // The still garden where the life stopped.
      this.drawNow();
    }
  }

  private readonly loop = (time: number): void => {
    const engine = this.engine;
    if (engine === null || this.isDisposed) {
      this.loopFrame = null;
      return;
    }
    const dt = Math.min(MAX_LIFE_STEP_S, Math.max(0, (time - this.lastLoopTime) / MS_PER_SECOND));
    this.lastLoopTime = time;
    this.lifeTime += dt;
    try {
      engine.three.tick(this.lifeTime, dt);
    } catch (error) {
      this.fail(error);
      return;
    }
    this.loopFrame = this.frames.request(this.loop);
    this.drawNow();
  };

  /**
   * The stage to draw. While a plant whose hizb was just finished ends its growth, the stage
   * waits without it: the growing plant stands in for it, then the stage takes over at growth 1,
   * where the two are the same.
   */
  private shownStage(): GardenStage | null {
    const stage = this.stage;
    const growth = this.growth;
    if (stage === null || growth === null || !this.player.isPlaying) return stage;
    return stage.count >= growth.hizb ? { ...stage, count: growth.hizb - 1 } : stage;
  }

  private showGrowthFrame(frame: ShownGrowthFrame | null): void {
    this.growth = frame;
    this.refresh();
  }

  /** Shows the stage and the growing element, and draws if anything changed. */
  private refresh(): void {
    const engine = this.engine;
    const stage = this.shownStage();
    if (engine === null || stage === null) return;
    try {
      const stageChanged = engine.three.showStage(stage);
      const growthChanged = engine.three.showGrowth(this.growth);
      if (stageChanged || growthChanged) {
        // The growing element casts its shadow too: drawn again with it.
        engine.renderer.shadowMap.needsUpdate = true;
        this.draw();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  /** Draws now, or in the next frame of the render loop when it runs (one frame drawn per frame). */
  draw(): void {
    if (this.loopFrame !== null) return;
    this.drawNow();
  }

  private drawNow(): void {
    const engine = this.engine;
    if (engine === null || this.size.width === 0 || this.size.height === 0) return;
    try {
      engine.three.setOrbit(
        this.controller.orbit,
        this.size.width / this.size.height,
        this.options.anchor,
      );
      const isDrawn = engine.drawFrame(
        engine.renderer,
        engine.gl,
        engine.three.scene,
        engine.three.camera,
        engine.three.fade,
        engine.three.backdrop,
      );
      if (isDrawn && !this.hasDrawnFrame) {
        this.hasDrawnFrame = true;
        this.options.onReady();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.loopFrame !== null) this.frames.cancel(this.loopFrame);
    this.loopFrame = null;
    if (this.glide !== null && this.glide.holdFrame !== null)
      this.frames.cancel(this.glide.holdFrame);
    this.glide = null;
    this.controller.dispose();
    this.player.stop();
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
