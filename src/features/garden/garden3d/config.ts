/**
 * Settings of the garden in 3D (decision D40). The camera and the light are those the garden
 * pictures were rendered with (`/home/claude/gen/garden3d/tool/render_app.py` and `garden.js`),
 * so that the 3D garden, at rest, is the picture; the rest are the limits of what a person can
 * do with it. No rule of the garden lives here.
 */

const DEG = Math.PI / 180;

/** The camera of the pictures: an orthographic view of 20.2 m of height for 900 pixels. */
const PICTURE = {
  azimuth: 45 * DEG,
  elevation: 38 * DEG,
  /** Where the camera looks, in metres: the garden's axis, 1.5 m above the ground. */
  target: [0, 1.5, 0] as const,
  viewHeight: 20.2,
  renderPixels: { width: 1200, height: 900 },
  /** The box every picture was cut to (tools/garden-pictures, union of the set plus 16 px). */
  cropBox: { left: 15, top: 79, right: 1185, bottom: 895 },
} as const;

const UNIT = PICTURE.viewHeight / PICTURE.renderPixels.height;

export const GARDEN_3D = {
  picture: PICTURE,
  /** The box of the pictures in metres, relative to the point the camera looks at. */
  frame: {
    width: (PICTURE.cropBox.right - PICTURE.cropBox.left) * UNIT,
    height: (PICTURE.cropBox.bottom - PICTURE.cropBox.top) * UNIT,
    centerX:
      ((PICTURE.cropBox.left + PICTURE.cropBox.right) / 2 - PICTURE.renderPixels.width / 2) * UNIT,
    centerY:
      (PICTURE.renderPixels.height / 2 - (PICTURE.cropBox.top + PICTURE.cropBox.bottom) / 2) * UNIT,
  },
  /** Distance of the camera, and its clipping planes: anything on the plot fits between them. */
  camera: { distance: 120, near: 0.1, far: 400 },
  /**
   * Half the plot's diagonal, in metres (an 18 m square): the rim the finger moves 1:1
   * (gestures skill, "1:1 means 1:1").
   */
  rimRadius: 9 * Math.SQRT2,
  /**
   * How far the camera tilts (radians). Below, the garden flattens to a line; above, it becomes a
   * map. `overshoot`: how far a drag goes past a limit, with resistance, before it springs back
   * (gestures skill, "Rubber-band at the edges").
   */
  elevation: { min: 22 * DEG, max: 58 * DEG, overshoot: 6 * DEG },
  /**
   * What the camera must keep in view when it tilts: the plot's diagonal and the height of the
   * tallest trees, in metres. A higher camera sees the plot deeper, so the frame widens.
   */
  fit: { depth: 18 * Math.SQRT2, height: 5 },
  /** Zoom: 1 is the picture; never smaller. Past a limit, resistance up to `overshoot` times. */
  zoom: { min: 1, max: 2.5, overshoot: 1.25, doubleTap: 2 },
  /**
   * The spin after the finger lets go: the deceleration of a scroll view (0.998 per millisecond,
   * UIScrollView's normal rate), and the speed below which it stops (radians per millisecond).
   */
  spin: { deceleration: 0.998, restVelocity: 0.00005 },
  /**
   * Going back to the default view, or into the limits after a release: an exponential approach,
   * which any touch interrupts. Time constant in milliseconds, and the distance that counts as
   * arrived.
   */
  settle: { timeConstantMs: 90, epsilon: 0.0005 },
  /** One VoiceOver action turns the garden by a quarter. */
  accessibilityTurn: Math.PI / 2,
  /** Movement before a drag starts, in points, so that the page can still scroll vertically. */
  dragActivation: 10,
  /**
   * The light of the pictures (garden.js): a broad sky light and a gentle sun from the left of
   * the picture, with soft shadows. The shadow map is smaller than the pictures' (4096), and drawn
   * again only when the stage changes: the sun does not move.
   */
  light: {
    sky: { color: 0xffffff, ground: 0xcfc3b0, intensity: 1.9 },
    sun: { color: 0xfff3df, intensity: 1.75, position: [-14, 30, 22] as const },
    shadow: {
      mapSize: 2048,
      bounds: { left: -18, right: 18, top: 20, bottom: -18, near: 1, far: 100 },
      bias: -0.0004,
      normalBias: 0.035,
      radius: 4,
      intensity: 0.55,
    },
  },
  /**
   * The picture tool's wilt per foliage stage (render_app.py FOLIAGE): how far living plants have
   * turned from green to straw.
   */
  wiltByFoliage: [0, 0.5, 0.8, 1] as const,
  /** How long the 3D garden takes to replace the picture once its first frame is drawn. */
  revealMs: 200,
} as const;
