# Jannatuk onboarding (style « voix ») — motion spec for React Native

Source of truth: `voice-v2/index.html` (prototype). Every value below is the one the prototype runs.
Target stack: `react-native-reanimated` (UI thread), `react-native-gesture-handler`, `react-native-skia`
for the voice canvas, `expo-haptics`.

---

## 0. The rules (read first)

1. **One shared value drives the whole onboarding.** `y` = vertical offset in pt (`page × H`); `p = y / H`
   is the progress in pages (0 … 15). Every element below is a pure function of `p` (plus, for the
   demos, of time since the page settled). Use `useDerivedValue` / `useAnimatedStyle`. **No React state
   per frame, no `runOnJS` per frame.** `runOnJS` only for haptics and for discrete events (page index
   for accessibility).
2. **UI thread only.** All mapping functions are worklets (`'worklet'`). No `Animated` (old API), no
   `setState` in gesture callbacks.
3. **Transform and opacity only.** Never animate `width`, `height`, `top`, `left`, `margin`,
   `borderRadius`, `shadow*`, blur or colour per frame. The prototype measured it: the original
   repainted the garden on every frame (child opacity inside a non-composited, 3D-rotated parent),
   that alone was ~80 % of the jank.
4. **One layer per picture.** Every garden picture (base, still water `w1`, flowing water `w2`, the
   "new element" picture) is its own `Animated.Image` (or Skia `Image`) whose own opacity/transform
   changes. Never fade a parent that contains several changing pictures.
5. **Pictures are decoded before they are needed.** Preload all garden pictures at launch
   (`expo-image` `Image.prefetch` + keep them mounted). Keep the pictures of the page before and the
   two after **mounted at opacity 0** (not unmounted, not `display:none`), so nothing is decoded or
   uploaded for the first time mid-swipe. Same for the mushaf card, the "Passage reconnu" card and the
   friends' cards: mounted within ±1.6 pages.
6. **No blur views** on the onboarding (the caption pill and the reminder card were glass in the
   original; they sit on a flat sky, so a blur adds nothing visible and costs every frame). Use solid
   `rgba(255,255,255,0.9)` / `0.86`.
7. **A 3D transform turns a rounded mask into an expensive one.** The garden's camera turn
   (`perspective` + `rotateY`) is 0 on the revival page (the only page that masks the garden), and the
   transform is dropped entirely when the angle is 0.
8. **Never write a value that did not change** (the web prototype caches every style write; in
   Reanimated, `useAnimatedStyle` already diffs, but do not return new objects for hidden elements:
   early-return a constant style when the element is off-range).
9. **Reduce motion** (`useReducedMotion()`): every translate/scale/rotate listed below becomes 0, every
   morph becomes a crossfade at `p` mid-point, the night curtain becomes an opacity crossfade, droplets
   and leaves are not spawned, the demos show their final state (all words read, red word shown; card
   found). Finger tracking of the pager stays (the user produces that motion).

### Mapping helpers (worklets, exact)

```ts
export const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};
export const ramp = (v: number, a: number, b: number) => {
  'worklet';
  return clamp01((v - a) / (b - a));
}; // = interpolate(v,[a,b],[0,1],CLAMP)
export const smooth = (t: number) => {
  'worklet';
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}; // smoothstep
export const easeOutCubic = (t: number) => {
  'worklet';
  t = clamp01(t);
  return 1 - (1 - t) ** 3;
}; // = Easing.out(Easing.cubic) = cubic-bezier(.33,1,.68,1)
export const easeOutQuad = (t: number) => {
  'worklet';
  t = clamp01(t);
  return 1 - (1 - t) ** 2;
}; // = Easing.out(Easing.quad)
export const inOutCubic = (t: number) => {
  'worklet';
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}; // = Easing.inOut(Easing.cubic)
export const mix = (a: number, b: number, t: number) => {
  'worklet';
  return a + (b - a) * t;
};
// a critically damped spring released from rest, as a function of time (seconds): what withSpring({dampingRatio:1}) does
export const springT = (t: number, response: number) => {
  'worklet';
  if (t <= 0) return 0;
  const w = (2 * Math.PI) / response;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};
```

Notation per page `k`: `d = p − k` (negative while the page arrives, positive while it leaves).
Inside a transition `i → i+1`: `f = p − i` (0…1), `s = smooth(f)`.
`presence(k) = smooth(1 − 1.85·|p − k|)` (an element of page k is gone at |d| ≥ 0.54).

### Spring vocabulary (Apple ↔ Reanimated)

Critically damped (damping ratio 1) with response `R` s: `ω = 2π/R`, **stiffness = ω², damping = 2ω, mass = 1**.

| Name            | Response | Reanimated config                               | Used for                                                                        |
| --------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `pager`         | 0.45 s   | `{ mass: 1, stiffness: 195, damping: 27.9 }`    | settle after a swipe                                                            |
| `intro`         | 0.9 s    | `{ mass: 1, stiffness: 48.7, damping: 13.96 }`  | first page arriving                                                             |
| `found-rosette` | 0.55 s   | `{ mass: 1, stiffness: 130.5, damping: 22.85 }` | rosette moves up when the passage is found                                      |
| `found-card`    | 0.5 s    | `{ mass: 1, stiffness: 157.9, damping: 25.13 }` | the card rises, 80 ms after the rosette                                         |
| `sheet`         | 0.35 s   | `{ mass: 1, stiffness: 322.3, damping: 35.9 }`  | sheet snap-back / dismiss (prototype: CSS `cubic-bezier(.32,.72,0,1)`, see §12) |

SwiftUI equivalents (if a native module is ever used): `.spring(response: 0.45, dampingFraction: 1)`,
or iOS 17 `.spring(duration: 0.45, bounce: 0)`. Do not mix `response` with `bounce`.

**No bounce anywhere.** The pager must never overshoot: an overshoot of `p` past an integer starts the
next page's choreography for a few frames (a flicker of the next title/garden). The current RN pager
(`dampingRatio 0.86`) overshoots; use 1.

---

## 1. The pager (gesture → settle)

Vertical pan on the whole screen (`Gesture.Pan()`), 16 pages, no buttons.

| Phase                                 | Behaviour                                                                                                                                                                                                                                                                                          | Values                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Touch down while the spring is moving | **Catch**: `cancelAnimation(y)` in `onBegin`; the page stops under the finger at its presentation value and the finger takes over with no dead zone. If the touch ends without moving (a tap), re-launch the spring to the same target with velocity 0 in `onFinalize`.                            | —                                         |
| Touch down at rest                    | Wait for 8 pt of vertical travel before it is a swipe (a tap on an option stays a tap).                                                                                                                                                                                                            | `activeOffsetY([-8, 8])`                  |
| Track                                 | `y = start − translationY`, 1:1, no easing. Past page 0 or page 15: rubber band.                                                                                                                                                                                                                   | `rubber(x, d=H, c=0.55) = x·d·c / (d + c· | x    | )`           |
| Release: velocity                     | `v = −velocityY` (pt/s, positive = toward the next page). If the finger rested > 40 ms before lifting, `v = 0` (GH's velocity already decays; check it).                                                                                                                                           | —                                         |
| Release: target                       | Project where the flick would stop (Apple, deceleration 0.998): `proj = y + v·0.499` (pt). `target = round(proj / H)`, clamped to `[page0 − 1, page0 + 1]` and `[0, 15]`, where `page0` = the page the gesture started on (or the spring's target if it was caught). One swipe = at most one page. | `0.499 = 0.998 / (1 − 0.998) / 1000`      |
| Release: settle                       | `y = withSpring(target·H, pager, velocity = vCapped)`                                                                                                                                                                                                                                              | `pager` spring above                      |
| Velocity cap                          | So a critically damped spring never crosses the page: if `v` points at the target, `                                                                                                                                                                                                               | v                                         | ≤ ω· | target·H − y | `with`ω = 13.96 /s`. If it points away, keep it (the spring turns it round). | —   |
| Haptic                                | `Haptics.selectionAsync()` on the release frame, only when `target ≠ page0` (the page snaps in).                                                                                                                                                                                                   | —                                         |
| Mouse wheel / keyboard (web only)     | one notch / arrow = one page, same spring; a notch during the settle chains to the next page once the spring is past halfway.                                                                                                                                                                      | —                                         |

Measured in the prototype (Chromium, 4× CPU): a 90 pt flick turns the page, a slow 120 pt drag springs
back, a page caught 120 ms into its settle and pulled back returns with no jump (largest step between
two frames 0.063 page = 53 pt, i.e. the finger's own speed).

---

## 2. First launch (time-driven, once)

`t` = seconds since the first frame (after fonts and pictures are decoded). Each value is
`u = springT(t − delay, 0.9)`.

| Element                  | Delay  | Property                                       | From → to                                                              |
| ------------------------ | ------ | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Garden                   | 0 ms   | opacity · translateY · scale                   | 0 → 1 · 14 → 0 pt · 0.97 → 1                                           |
| Recited line             | 160 ms | opacity · translateY                           | 0 → 1 · 10 → 0 pt                                                      |
| Caption pill             | 200 ms | opacity                                        | 0 → 1 (only from page 1)                                               |
| Waveform                 | 250 ms | alpha                                          | 0 → 1                                                                  |
| Title « Une terre nue. » | 320 ms | opacity · translateY                           | 0 → 1 · 16 → 0 pt                                                      |
| Text                     | 420 ms | opacity · translateY                           | 0 → 1 · 20 → 0 pt                                                      |
| Page dots                | 600 ms | opacity                                        | 0 → 0.9                                                                |
| « Glisse vers le haut »  | 900 ms | opacity                                        | 0 → 1, then × `smooth(1 − 3p)`                                         |
| Hint chevron             | loop   | translateY 6 → −8 pt, opacity 0 → 1 (35 %) → 0 | 1.8 s, `cubic-bezier(.23,1,.32,1)`, infinite; stopped by reduce motion |

---

## 3. Copy (titles and texts, pages 0–13)

Hero rule: the title leads, the text follows. The block leaves as one.

| d range                  | Title                                                         | Text                                                       |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| arriving `d ∈ [−0.6, 0]` | opacity `smooth(ramp(d, −0.5, −0.08))`, translateY `−56·d` pt | opacity `smooth(ramp(d, −0.42, 0))`, translateY `−76·d` pt |
| leaving `d ∈ [0, 0.6]`   | opacity `1 − smooth(ramp(d, 0, 0.42))`, translateY `−56·d` pt | same as title                                              |
| `                        | d                                                             | ≥ 0.6`                                                     | unmounted from drawing (opacity 0) | —   |

Personalisation panels (pages 14, 15) and the « Créer mon jardin » button (page 15) move as one block:
opacity `smooth(1 − 2.2·|d|)`, translateY `−56·d` pt. The button is pressable only when its opacity > 0.9.

---

## 4. Skies

| Element                         | Driver         | Property                       | Mapping                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grey sky (drought)              | `p`            | opacity                        | `mix(g_i, g_{i+1}, s)`, per page `g = [0,0,0,0,0,0, .4, .65, .85, 1, 0, 0, 0, 0, 0, 0]`                                                                                                                                                                                                                                                                                                                  |
| **Night curtain** (pages 11–12) | `p ∈ [10, 13]` | translateY                     | One view, height `1.5·H`: the validated dusk gradient (top `H`) + a tail (`0.5·H`, `#100E0B` → transparent, stops 0 / 30 % α .82 / 68 % α .35 / 100 % α 0). `p∈[10,11]`: `−1.5H·(1 − easeOutQuad(f))`; `[11,12]`: 0; `[12,13]`: `−1.5H·easeOutQuad(f)`; else hidden. Dusk comes down from the top and leaves upward like dawn — no grey veil in between. Reduce motion: opacity `smooth(night)` instead. |
| Plain sky                       | `p`            | opacity                        | 1 for `p ≥ 12` (swapped under the full night), else 0                                                                                                                                                                                                                                                                                                                                                    |
| Dusk glow                       | `p`            | opacity · translateY           | `night²` · `rcy − 260 − 40·(p − 12)` pt (`night` = 0→1 over 10–11, 1 on 11–12, 1→0 over 12–13)                                                                                                                                                                                                                                                                                                           |
| Sun glow                        | `p`            | opacity                        | `(1 − night)·(1 − 0.7·grey)·gPresEarly`                                                                                                                                                                                                                                                                                                                                                                  |
| « Jannatuk » name colour        | `p`            | colour (discrete, 400 ms ease) | light for `p ∈ (10.1, 12.75)` (the night reaches the top first and leaves it last); page dots light for `night > 0.5`                                                                                                                                                                                                                                                                                    |

---

## 5. The garden (pages 0–10, preview on 13–15)

| Element                                | Driver        | Property                                                                    | Mapping                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole garden                           | `p`           | opacity                                                                     | `gPres`: `p ≤ 10`: 1; `10–11`: `1 − smooth(1.85f)`; `11–13`: 0; `13–14`: `smooth(1.85f − 0.85)`; `≥ 14`: 1                                                                                                                                                                                                                                                                                                              |
| Whole garden                           | `p`           | translateY, scale                                                           | `mix(T_i, T_{i+1}, s)`; `T` = pages ≤10 `[0, 1]`; 11, 12 `[−26, .94]`; 13 `[pvTop − gTop + 30, 0.9·k14]`; 14 `[pvTop − gTop, k14]`; 15 `[pvTop − gTop, k15]`; `k14 = min(.72, .27H/gH)`, `k15 = min(.6, .205H/gH)`, `pvTop = safeTop + 50`                                                                                                                                                                              |
| Whole garden (camera)                  | `p`           | perspective 1400 + rotateY                                                  | `mix(a_i, a_{i+1}, s)`, `a = [−5, −3, −1, 1, 3, 5, 4, 3, 1.5, 0, 0, 0, 0, 0, 0, 0]` deg; drop the transform when `                                                                                                                                                                                                                                                                                                      | a      | < 0.01`                                 |
| Two pictures (plain change)            | `s`           | opacity                                                                     | outgoing A: `s < .5 ? 1 : 2(1 − s)`; incoming B (above A): `s < .5 ? 2s : 1` — never a see-through dip                                                                                                                                                                                                                                                                                                                  |
| **Growth 0→1…4→5 (hero of pages 1–5)** | `f`           | "new element" picture: opacity · translateY · scaleY (origin bottom centre) | `smooth(f/0.4)` · `26·(1 − easeOutCubic(f/0.8))` → 0 pt · `0.9 + 0.1·easeOutCubic(f/0.8)`. The full picture of the new hizb then settles on top: opacity `smooth((f − 0.72)/0.28)`                                                                                                                                                                                                                                      |
| Flowing water `w2`                     | voice level   | opacity                                                                     | `flow = clamp01(0.25 + 1.1·Lv)` (see §7)                                                                                                                                                                                                                                                                                                                                                                                |
| Caption pill (« Hizb 8 »…)             | `s`           | text, opacity                                                               | text swaps at `s = 0.5`; opacity `                                                                                                                                                                                                                                                                                                                                                                                      | 2s − 1 | `when the two captions differ, ×`gPres` |
| **Drought cracks (pages 7–9)**         | `p`           | opacity of 8 crack layers                                                   | `cp = ramp(p, 7.35, 8.9)`; layer `b = 0…7`: `ramp(cp, b·0.11875 − 0.02, b·0.11875 + 0.14)`; all × `out = p > 9 ? 1 − smooth(1.7(p − 9)) : 1`. Pre-render each layer as one SVG/PNG (Skia `Path` or `Image`); the segments are bucketed by their reveal time                                                                                                                                                             |
| **Falling leaves (pages 6–8)**         | time + scroll | particles                                                                   | Only for `p ∈ (5.45, 8.9)`. Spawn rate per s: `34·scrollLv + (p ∈ (5.8, 8.4) ? 1.8 : 0)`; max 70; start above the trees; fall 26–52 pt/s; sway ±9 pt at 1.6–3.4 rad/s; spin ±2 rad/s; life 1.8–3.2 s; alpha in over 0.33 s, out `1 − (t/life)³`; 5 autumn colours. Skia, UI thread (`useFrameCallback`)                                                                                                                 |
| **Revival 9→10 (water wave)**          | `f`           | ellipse mask scale + inverse scale on the picture inside                    | `R = 2.035·smooth(0.5f + 0.5)·f`; mask = ellipse centred (49.9 %, 50.9 %) of the picture, radii (45.6 %·2.035 of width, 40.8 %·2.035 of height); mask `scale = max(.02, R/2.035)`, inner picture `scale = 1/that` (origin = ellipse centre). Hidden at `f ≤ .002`; at `f ≥ .999` replaced by the real picture. RN: `Animated.View` with `borderRadius = width/2`, `overflow: 'hidden'` (or Skia `Group clip={ellipse}`) |
| Revival rings                          | `f`           | opacity, scale                                                              | ring 1 (stroke ≈ 2.5 pt `#DFFBFF`): opacity `0.95·sin(πf)`, scale `0.04 + 1.3f`; ring 2 (≈ 1.5 pt `#8FE0EA`): `u = (f − .12)/.88`, opacity `0.8·sin(πu)`, scale `0.04 + 1.15·easeOutCubic(u)`                                                                                                                                                                                                                           |
| Droplets (pages 0–5 and 9–10)          | scroll speed  | particles                                                                   | Only for `p ∈ (0, 5.02) ∪ (9, 10.02)`. Spawn `70·scrollLv` per s, max 140; quadratic Bézier from a waveform bar to a random point of the garden, control point 30–70 pt above; progress `easeOutCubic(t/life)`, life 0.9–1.5 s; alpha `0.85·sin(π·t/life)`; radius 1.1–2.7 pt shrinking 40 %; 35 % gold `#CE9A3C`, else `#2896A8`                                                                                       |

---

## 6. The recited line under the garden (pages 0–10)

| Element                           | Driver | Property                          | Mapping                                                                                                                                                                                           |
| --------------------------------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word counter `w`                  | `p`    | —                                 | piecewise linear over pages 0…5 through `[0, 5.8, 11.5, 15, 22.2, 29]` (29 words of Al-Fâtiha); each page rests on a word in the middle of a line, never on two lines crossfading. 29 from page 5 |
| Line `v` (8 lines, words `a … b`) | `w`    | opacity · translateY              | `tIn = ramp(w, a − .1, a + .6)` (line 0: 1), `tOut = ramp(w, b − .1, b + .6)` (last line: 0); opacity `tIn·(1 − tOut)`, translateY `12(1 − tIn) − 12·tOut` pt                                     |
| Word `k` of the line              | `w`    | opacity                           | `0.26 + 0.74·clamp01(w − (a + k))·voiceOn`                                                                                                                                                        |
| Gold pill under the current word  | `w`    | translateX · scaleX (origin left) | moves to the next word over the last 45 % of a word: `e = smooth((fr − .55)/.45)`; x/width mixed between the two words' frames (±5 pt padding)                                                    |
| Whole line                        | `p`    | opacity · translateY              | `p ≤ 10`: 1; then `1 − smooth(1.85(p − 10))`, translateY `−40(p − 10)` pt                                                                                                                         |

---

## 7. The voice — one continuous object (36 bars, Skia)

It is the same 36 bars from page 0 to page 12: a line under the garden, then the line inside the
« J’écoute » bar, then a ring that wraps round the rosette and dissolves into it.

| Shape                | Where               | Bar `k` (0…35)                                                                                                                                                                                                                  |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line (pages 0–10)    | `y = waveY`         | `x = W/2 + 7(k − 17.5)`, vertical, max length `40·env`, width 3, colour water `#0E6B78` → gold `#CE9A3C` toward the ends (`                                                                                                     | d   | ^1.4`), → grey `#A8A094`as`voiceOn`falls;`env = 0.28 + 0.72·exp(−d²/0.3)`, `d = (k − 17.5)/17.5` |
| Follow bar (page 11) | inside « J’écoute » | `x = followLeft + 22 + 2.2k`, `y = follow centre`, vertical, max `26·env`, width 1.7, white                                                                                                                                     |
| Ring (page 12)       | around the rosette  | angle `θ = π/2 + (k + .5)/36·2π` (the left half of the line goes up the left side), radius `1.38·R·(0.86 + 0.14·presence12)`, centre `(W/2, rcy − 50(p − 12))`, bar along the radius, max 18, width 2.2, water/gold alternating |

| Transition | Morph `m` (position, angle, length, colour)                                                    | Extra                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 10 → 11    | `inOutCubic(ramp(f, 0.08, 0.85))`                                                              | —                                                                                                                            |
| 11 → 12    | `inOutCubic(ramp(f, 0.04, 0.72))`; angles interpolate the short way modulo π (a bar is a line) | length × `1 − 0.85·smooth(ramp(f, .55, .92))`; alpha `1 − smooth(ramp(f, .6, .92))` while the rosette lights up (presence12) |
| ≥ 12       | —                                                                                              | bars gone; the validated rosette alone                                                                                       |

Bar length = `(3 + max·Lv·n)`, `n = 0.55 + 0.45·sin(t·s1 + φ1)·sin(t·s2 + φ2)`, per-bar random
`s1 ∈ [5, 11]`, `s2 ∈ [1.7, 4.3]` rad/s.

Voice level `Lv = clamp01(max(scrollLv, vLevel, idle)·voiceOn)`:

- `scrollLv`: `0.85·|dp/dt|` (pages/s), smoothed at rate 22 /s going up and 3.5 /s going down (the faster you swipe, the louder);
- `vLevel`: follows pulses from the demos (rise rate 24 /s, fall 6 /s; pulse target decays ×0.945 per 1/60 s);
- `idle = 0.2 + 0.07·sin(1.3t)` (× 0.6 after page 10.5): the voice breathes at rest;
- `voiceOn` per page `[1,1,1,1,1,1, .5, .22, .06, 0, 1, 1, 1, 0, 0, 0]` mixed by `s`.

In the follow-bar shape, `y` is the bar's **live** position (`capY + 110·(11 − p)` while it arrives,
`capY − 60·(p − 11)` while it leaves), so the bars ride inside it instead of arriving before it.

Implementation: the line and follow-bar shapes are drawn on a small strip (full width × 120 pt) that
moves by `translateY` to the bars' common `y`; only the ring and the rosette use a larger canvas
(prototype: 390 × 529 pt band instead of full screen), and the droplets/leaves share it. In RN: one
Skia `Canvas` per surface, one `Path` of 36 segments rebuilt in `useDerivedValue` from `p` and the
frame clock (`useFrameCallback`). Skip the redraw entirely when a surface has nothing to show. The
measured cost that remains in the web prototype is canvas rasterisation (headless Chromium rasterises
on the CPU); Skia on the GPU should not have it, but check it on the oldest supported iPhone.

---

## 8. Page 11 — « Lis à voix haute, l’appli te suit. »

| Element                                                 | Driver       | Property                     | Mapping / timing                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mushaf card                                             | `p`          | opacity · translateY · scale | `presence(11)`; arriving `−70·d` pt, `1 + 0.04·d`; leaving `−30·d` pt, `1 − 0.1·d`                                                                                                                                  |
| « J’écoute » bar                                        | `p`          | opacity · translateY         | `presence(11)`; arriving `−110·d` pt (it trails the page and lands with it), leaving `−60·d`                                                                                                                        |
| (no play button)                                        | —            | —                            | removed: there is no licensed audio yet                                                                                                                                                                             |
| Words lit one by one                                    | time after ` | d                            | < 0.55`                                                                                                                                                                                                             | colour opacity | word duration `300 + 26·(letters/2)` ms, 260 ms breath after each verse mark, first word at 500 ms, loop after +1.9 s. Read: opacity 0.3 → 1, current word `#F6DFA4`; each change 280 ms `cubic-bezier(.23,1,.32,1)` |
| Gold pill                                               | word change  | translateX/scaleX · opacity  | `withTiming` 320 ms `Easing.bezier(.23,1,.32,1)` (retargets mid-flight) · 250 ms ease-out                                                                                                                           |
| **Red word نَسۡتَعِينُ (hero)**                              | timeline     | colour · translateX          | shown red 1500 ms (red pill), then « corrected » 520 ms (teal pill). On turning red: shake `0, −3, 3, −2, 1, 0` pt over 360 ms `cubic-bezier(.23,1,.32,1)` + `Haptics.notificationAsync(Warning)` on the same frame |
| Subtitle « Al-Fâtiha, verset n » ↔ « Relis ce mot : … » | timeline     | opacity · translateY         | 250 ms · ±6 pt, 300 ms `cubic-bezier(.23,1,.32,1)`                                                                                                                                                                  |

## 9. Page 12 — « D’où vient ce passage ? »

| Element                           | Driver       | Property                                   | Mapping / timing                                                                                                                                     |
| --------------------------------- | ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rosette                           | `p`          | opacity · scale · translateY               | `presence(12)` · `0.86 + 0.14·presence` · `−50·d` pt                                                                                                 |
| Listening (0–2.7 s)               | time         | petal echoes                               | one petal per voice peak (≥ 0.85 s apart), a quiet one every 2.3 s; each grows ×(1.04 → +0.95…1.3) over 4.6 s, alpha `(1 − age)^1.6·0.5`             |
| **Passage found (hero)** at 2.7 s | time         | rosette: translateY to `rcyF`, scale → 0.6 | `found-rosette` spring (0.55 s)                                                                                                                      |
| Card « Passage reconnu »          | time, +80 ms | opacity · translateY · scale               | `found-card` spring (0.5 s): opacity `clamp01(1.4c)`, translateY `46(1 − c)` pt, scale `0.96 + 0.04c`; `Haptics.notificationAsync(Success)` at 2.7 s |
| « À l’écoute… »                   | time         | opacity · translateY                       | `1 − clamp01(2.5r)` · `−14r` pt (gone before the card covers it; `r` = rosette progress)                                                             |
| Leaving (8.3 s), loop 9 s         | time         | all of the above                           | `1 − easeOutCubic((t − 8.3)/0.45)` (exits faster than it enters)                                                                                     |

## 10. Page 13 — « Avec tes proches. »

| Element                                      | Driver   | Property                                                  | Mapping                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group                                        | `p`      | opacity                                                   | `presence(13)`                                                                                                                                                                                                                                                                                                            |
| Card `k` (Mustapha, Taghread, Sarah, khatma) | `p`      | translateY · rotate                                       | `lift − d·(60 + 34k)` pt (`lift = −14` for Taghread) · `−3·d·(k − 1)` deg                                                                                                                                                                                                                                                 |
| Khatma bar                                   | `p`      | scaleX (origin left)                                      | `0.6·(0.55 + 0.45·smooth(1 − 1.4                                                                                                                                                                                                                                                                                          | d   | ))` |
| **Heart (hero)**                             | `p`      | position on a quadratic Bézier · scale · rotate · opacity | `hp = ramp(p, 12.4, 12.88)` (it lands before the settle's slow tail); from Taghread's card (centre, top + 50) to Sarah's (right − 18, top + 16), control point `(mid x, min y − 70)`; `u = easeOutCubic(hp)`; scale `1 + 0.35·sin(π·hp)` in flight, 0.8 landed; rotate `−18(1 − u)` deg; opacity `presence13·smooth(5hp)` |
| Landing (`hp ≥ 0.97`)                        | discrete | « 14 hizb, a soif » → « Encouragée »                      | crossfade 250 ms ease + `Haptics.impactAsync(Light)`                                                                                                                                                                                                                                                                      |
| « Récite » mini bars                         | loop     | scaleY 0.3 ↔ 1                                            | 0.9 s ease-in-out, phases −0.3/−0.6/−0.15 s; off with reduce motion                                                                                                                                                                                                                                                       |

## 11. Pages 14–15 — goal and reminders

| Element                           | Driver | Property                    | Mapping                                                                                                               |
| --------------------------------- | ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Preview garden                    | `p`    | see §5 (scale `k14`, `k15`) | —                                                                                                                     |
| Preview change (goal tap)         | event  | opacity                     | decode the new picture first, then crossfade 300 ms smoothstep (new above old, old leaves after)                      |
| Option press                      | touch  | scale                       | 0.97 on press-in, 140 ms `Easing.bezier(.23,1,.32,1)`; selected colour 200 ms ease; `Haptics.selectionAsync()` on tap |
| Numbers (pages per day, end date) | event  | translateY · opacity        | old out to ∓14 pt, new in from ±14 pt (direction = more/less), 260 ms `Easing.bezier(.23,1,.32,1)`                    |
| Caption « Dans un mois : n hizb » | `p`    | translateY                  | fixed above the preview                                                                                               |
| Switches                          | —      | —                           | native `Switch`                                                                                                       |
| « Créer mon jardin »              | press  | scale                       | 0.97, 140 ms `Easing.bezier(.23,1,.32,1)` (not a brightness filter)                                                   |

## 12. After « Créer mon jardin »

| Element                  | Trigger      | Property                                                      | Timing                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haptic                   | tap          | —                                                             | `Haptics.impactAsync(Medium)`                                                                                                                                                                                                                                                                           |
| Garden back to full size | tap          | translateY/scale → 0/1                                        | 600 ms `Easing.bezier(.32,.72,0,1)`                                                                                                                                                                                                                                                                     |
| Panels, button           | tap          | opacity → 0, translateY +20                                   | 300 ms ease · 500 ms `(.32,.72,0,1)`                                                                                                                                                                                                                                                                    |
| Home screen              | tap          | opacity                                                       | 450 ms `(.23,1,.32,1)`; its garden translateY 16 → 0, scale .97 → 1 over 700 ms same curve                                                                                                                                                                                                              |
| Scrim                    | tap          | opacity 0 → 1 (`rgba(18,16,13,.38)`)                          | 450 ms `(.32,.72,0,1)`                                                                                                                                                                                                                                                                                  |
| Account sheet            | tap + 280 ms | translateY 105 % → 0                                          | 500 ms `(.32,.72,0,1)` (the iOS sheet curve); no bounce (a tap applies no force)                                                                                                                                                                                                                        |
| Sheet drag               | finger       | translateY 1:1 down; up: rubber band; scrim opacity `1 − y/h` | release: dismiss (same as « Plus tard ») if `y > 0.35·h` or `v > 500 pt/s` (and the finger did not rest > 40 ms) → to 105 %; otherwise back to 0. Prototype: 420 / 350 ms `(.32,.72,0,1)`; RN: use the `sheet` spring with the release velocity. Catchable mid-way (starts from the presentation value) |

---

## 13. Haptics (iOS, `expo-haptics`) — the complete list

| Moment                                    | Call                         | Frame                   |
| ----------------------------------------- | ---------------------------- | ----------------------- |
| A swipe commits to another page           | `selectionAsync()`           | release frame           |
| Wrong word turns red (page 11, each loop) | `notificationAsync(Warning)` | same frame as the shake |
| Passage recognised (page 12, each loop)   | `notificationAsync(Success)` | card starts rising      |
| Heart lands on Sarah's card               | `impactAsync(Light)`         | `hp ≥ 0.97`             |
| Goal / moment option tapped               | `selectionAsync()`           | press-in                |
| « Créer mon jardin »                      | `impactAsync(Medium)`        | tap                     |

Nothing else vibrates (not the rubber band, not the sheet).

## 14. Checklist for the port

- [ ] One `y` shared value; every style is `useAnimatedStyle` reading `p`; no `useState` touched while swiping.
- [ ] Pager spring `{ mass: 1, stiffness: 195, damping: 27.9 }`, velocity handed off and capped, projection 0.499·v, ±1 page.
- [ ] Catch in `onBegin` with `cancelAnimation`; tap-without-move resumes the spring.
- [ ] Each garden picture its own image layer; neighbours (−1…+2 pages) mounted at opacity 0; all pictures prefetched.
- [ ] No BlurView, no animated shadow/radius/size; revival mask = scale + inverse scale, garden not rotated on that page.
- [ ] Voice = one Skia canvas limited to its band, redraw skipped when empty.
- [ ] Night = translated curtain (1.5 H) — not an opacity crossfade (reduce motion: crossfade).
- [ ] Reduce motion paths (§0.9) and the six haptics (§13).
- [ ] Measure on the oldest supported iPhone with the Perf Monitor: UI and JS threads stay at 60/120 fps during a fast swipe through all 16 pages.
