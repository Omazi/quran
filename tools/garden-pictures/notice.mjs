/** The text of assets/images/garden/NOTICE.txt (docs/DECISIONS.md D22 and D35). */
export function noticeText() {
  return `Garden pictures (level 1): provenance and licences
=====================================================

What these files are
--------------------
assets/images/garden/level-1/ holds 3D renders of one garden, made outside the app on
24 November 2026 with the tool described in docs/specs/garden-pictures.md. They are pictures,
not models: no 3D file of the packs below is in the app.

Models used (decision D22)
--------------------------
Plants (trees, flowers, bushes, grass, rocks)
  Quaternius, "Ultimate Stylized Nature Pack"
  Licence: CC0 1.0 (public domain dedication), as read by the project on the author's page,
  quaternius.com/packs/ultimatestylizednature.html, on 24 November 2026 (decision D35).
  Files used: the FBX models of a third-party GitHub mirror,
  walterpalladino/godot-quaternius-ultimate-stylized-nature, commit
  d36a06461359a8e60039e17b95d50bedc96c1edc. That repository states MIT for its own code only
  and says nothing about the assets: the licence above is the author's, not the mirror's.

Architecture and props (fountain, walls, gates, lamp posts, pavilion, rugs, cushions, stepping
stones, lilies, cascade rock)
  Kenney (www.kenney.nl): Nature Kit, Castle Kit, Furniture Kit, Fantasy Town Kit
  Licence: CC0 1.0 ("Creative Commons Zero"), as written in the kit's LICENSE.txt.
  Files used: a third-party GitHub mirror, shorepine/kenney, commit
  3694c6879e487c108f55677be7dd2ca75b07cc3b.

Not from a pack
---------------
The earth block, its low border, the planting beds, the paving, the channels, the basin, the
water, the spring pools and the waterfall's water and pool are plain flat-coloured geometry
added by the render tool, and the foliage tint is its shader. They belong to the project.
The renders were made with three.js (MIT) in a headless browser; none of it is in the app.

To do before a store release (decision D35)
-------------------------------------------
Download both packs again from their authors' own pages, keep the proof of their licence, and
render the set again from those files. The mirrors above were used because the authors'
sites could not be reached from the machine that made the pictures.

CC0 asks for no credit; this notice is kept for provenance, not because it is required.
`;
}
