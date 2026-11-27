// Draws pictures of a baked garden with the app's own scene (src/features/garden/garden3d, made
// browser modules by lib/app-modules.mjs and served under /app/): the picture of a stage is the 3D
// garden at rest, at the default orbit, in the frame of the level-1 pictures (D35, D40).
// The /app/ modules exist only in the page, written when render.py starts.
/* eslint-disable import/no-unresolved */
import { DEFAULT_ORBIT } from '/app/features/garden/garden3d/camera-rig.js';
import { readGardenModel } from '/app/features/garden/garden3d/garden-model.js';
import { createGardenRenderer } from '/app/features/garden/garden3d/garden-renderer.js';
import { buildGardenThree } from '/app/features/garden/garden3d/garden-three.js';
import { parseGlb } from '/app/features/garden/garden3d/glb.js';

let current = null;

window.load = async (url, width, height) => {
  current?.garden.dispose();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const model = readGardenModel(parseGlb(await response.arrayBuffer()));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  gl.endFrameEXP = () => undefined;
  const renderer = createGardenRenderer(gl);
  renderer.setSize(width, height, false);
  const garden = buildGardenThree(model);
  garden.setOrbit(DEFAULT_ORBIT, width / height, 'center');
  current = { canvas, renderer, garden };
  return { meshes: model.meshes.length, textures: model.textures.length, light: model.light };
};

/** A picture of `stage` ({count, water, foliage}), as a PNG data URL with a transparent background. */
window.shot = (stage) => {
  const { canvas, renderer, garden } = current;
  garden.showStage(stage);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(garden.scene, garden.camera);
  return canvas.toDataURL('image/png');
};

window.ready = true;
