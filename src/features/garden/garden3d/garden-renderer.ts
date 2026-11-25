/**
 * three.js on the GL context of expo-gl. On a phone the context has no canvas: three.js gets a
 * stand-in with the size of the drawing buffer. In a browser it gets the real canvas.
 */

import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

interface CanvasStandIn {
  width: number;
  height: number;
  style: Record<string, string>;
  addEventListener: () => void;
  removeEventListener: () => void;
  getContext: () => ExpoWebGLRenderingContext;
}

function canvasOf(gl: ExpoWebGLRenderingContext): HTMLCanvasElement | CanvasStandIn {
  const canvas = (gl as { canvas?: unknown }).canvas;
  if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement)
    return canvas;
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getContext: () => gl,
  };
}

/**
 * A renderer for the garden: transparent (the garden sits on the screen's own background, as the
 * pictures do), the pictures' shadows, no tone mapping. The shadow map is drawn only when asked:
 * the sun and the garden do not move when the camera turns.
 */
export function createGardenRenderer(gl: ExpoWebGLRenderingContext): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    // The stand-in has what three.js reads of a canvas.
    canvas: canvasOf(gl) as HTMLCanvasElement,
    context: gl,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return renderer;
}

/**
 * Draws one frame at the size of the drawing buffer, which expo-gl keeps at the view's size in
 * pixels, then hands it to the screen.
 */
export function drawFrame(
  renderer: THREE.WebGLRenderer,
  gl: ExpoWebGLRenderingContext,
  scene: THREE.Scene,
  camera: THREE.Camera,
  fade?: { scene: THREE.Scene; camera: THREE.Camera; isVisible: () => boolean },
): void {
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== gl.drawingBufferWidth || size.y !== gl.drawingBufferHeight) {
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  }
  renderer.render(scene, camera);
  if (fade?.isVisible()) {
    // Over the garden, without clearing it: the edges dissolve into the page.
    renderer.autoClear = false;
    renderer.render(fade.scene, fade.camera);
    renderer.autoClear = true;
  }
  gl.endFrameEXP();
}
