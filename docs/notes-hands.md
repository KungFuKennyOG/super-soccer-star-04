# Your own hands in the '04 look (branch `hands`)

Not wired into the game. `game/ps2/hands.js` exports the same `buildHand` / `createHands` as `game/hands.js`;
switching is the import line in `game/main.js` **and** the one in `game/trophy.js` (it imports `buildHand` too).

## Files

- `game/ps2/handgeo.js`: sizes, skeleton, the skinned mesh (forearm + band + palm in one loft, four fingers, thumb with its thenar base), baked shade, forearm fade.
- `game/ps2/handpose.js`: joint ranges, the poses, the hold solver (closes round a handle of any diameter), the thumb placer, blending and easing, `applyPose`.
- `game/ps2/handskin.js`: the 512 x 512 painted sheet (skin, creases, nails, veins, tendons, hair, towelling band).
- `game/ps2/hands.js`: material, `buildHand`, `createHands` (analog fingers, eased).
- `tools/handlook.js` + a few lines in `tools/ps2look.html`: shots `handeye`, `handraise`, `handgrid`, `handortho`, `handposes`, `handcmp`, `handfilm` (`&pose=open|point|fist|hold`, `&d=`, `&side=left`).
- `tests/unit/hands.test.js`: size, budget, ranges, cascade, holds (3.2 / 3.8 / 6.6 cm), fist, grip-space convention.

## Numbers

- 1,124 triangles and 660 vertices per hand, so 2,248 for both. One SkinnedMesh with one material each, so 1 draw call per hand. 31 bones (root, 15 joints, 15 half-joint helpers).
- Sheet: one 512 x 512 per kit/skin, shared by both hands. Painting took 290 to 520 ms in headless Chrome. That's plain JS and it only runs on `setKit`. It's slower than the face sheet: a Quest stall to check. The first hand (geometry, thumb solve, paint) took 370 to 640 ms. Geometry is built once and shared.
- Thumb solve for fist, point and open at load: about 50 ms in Node. Each hold diameter is solved once and cached.

## What it is

- Size: an adult man's hand. Wrist to middle tip 18 to 20 cm (tested), breadth across the knuckles 8 to 9.5 cm (tested). Phalanx lengths are from the usual proportions, joint to joint.
- Skeleton: MCP, PIP and DIP for each finger, CMC, MCP and IP for the thumb. Every joint has a **half bone** that turns half as far as the joint, and the ring of skin over the joint follows it alone. That keeps a bent knuckle's thickness (plain linear blending pinched the fingers flat at 100 degrees).
- Poses, in `POSES`:
  - **Open** is the resting cascade: index to little, MCP 18/22/27/32 and PIP 30/36/42/48 degrees, each finger more bent than the last (tested). The thumb rests beside and in front of the index, a little bent.
  - **Fist**: MCP 84 to 90, PIP 95 to 105, DIP 70 to 76.
  - **Point**: the index nearly straight, the rest as in the fist.
  - **Hold(d)**: each finger closes joint by joint until its pad meets a handle of diameter d (how a grasp closes), within each joint's range.
  - The thumb of the fist, point, open and hold is **placed by its pad**: a small search over its five angles, within range. It puts the pad across the backs of the index and middle fingers' middle phalanges (fist), the middle and ring (point), or round the far side of the handle without going into it (hold).
- Ranges: MCP 0-90, PIP 0-100 (the little finger less), DIP 0-80, thumb MCP 0-55, IP 0-80, base 40-50 flexion / about 80 abduction / 70-110 axial rotation. These are the standard clinical tables (e.g. physio-pedia, "Functional Anatomy of the Hand"). The resting cascade is the usual hand-surgery description. DIP follows PIP at about two-thirds in curled poses.
- Analog: the trigger closes the index and the grip the other three. Grip alone is point, the trigger (with or without grip) is fist, neither is open. The blend is linear in the values and eased (time constant ~45 ms closing, ~65 ms opening), so a half-pressed trigger is a half-closed hand. Nothing snaps.
- Grip space: exactly as `game/hands.js` (tested). The controller handle (3.8 cm) lies across the palm a little diagonally, from the root of the index to the heel of the hand, and its middle is the origin. The left hand is a true mirror.
- Skin: you get `SKINS[1]`, the tone `game/hands.js` uses, deepened like the '04 players. Painted like `face.js`: blotched at two scales, a fine grain, redder knuckles and fingertips, lighter palms (much lighter on dark skin), palm creases (distal, proximal, thenar), finger flexion creases, knuckle wrinkles, nails (cuticle, lunula, a thin free edge), faint dorsal veins and extensor tendons, a little forearm hair.
- Sweatband: towelling in the kit's sleeve or shirt colour, with one trim stripe near each edge.
- Material: Phong with a low broad highlight plus baked shade in the vertex colours, like the '04 players.
- The forearm runs 13.5 cm and fades out over its last 4.5 cm. The fade is a screen-door dither: the game runs without MSAA, so alpha to coverage wouldn't work.

## Trophy grip

`buildHand(side, 'hold', kit, skin, { d, at })` closes round a handle of diameter `d` whose middle is at `at` in grip space (right-hand terms; the left mirrors it). The returned group has `.hand` with `setPose`, `setInput`, `update(dt)` and `snap()`, so the trophy can ease the hand closed if it calls `update`.

Values for the current trophies (from `game/trophy.js` GRIPS and its geometry):

| Trophy | Hand-hold | Diameter `d` | `at` |
| --- | --- | --- | --- |
| Club cup | Ear bar, 3 cm square | 0.032 m | `[0.04, 0, 0]` (the bar is 4 cm outside the anchor) |
| World cup | Column under the globe, about 6.6 cm | 0.066 m | `[-0.07, 0, 0]` (the column's axis is 7 cm in from the anchor) |

Tested at 3.2, 3.8 and 6.6 cm: no skin more than 3 mm into the handle, and every finger and the palm within 4 mm of it.

Today trophy.js asks for `'fist'`. With the new hands that's a tight fist (no hole), so it should ask for `'hold'` with the values above. That's for whoever owns trophy.js; I didn't touch it.

## Built from references vs guessed

- **From references:** sizes and proportions, joint ranges, the resting cascade, DIP/PIP coupling, the power grip with the thumb over the middle phalanges, and the grasp closing until contact.
- **Guesses tuned by eye:** the forearm angle off the hand (a little extended, toward the thumb), how diagonally the handle lies, the thenar bulge, and paint placement.
- **No capture:** CMU has no finger data.

## Short of real

- Fingers have 8 sides and joints are 3 rings, so curled fingers read a little squarish from the knuckle side.
- No sideways spread except a little convergence as the fingers curl.
- The ring and little metacarpals don't cup in a fist.
- The thumb's web is skinned partly to the thumb base: fine in these poses, but a wide-open thumb would stretch it.
- The open hand's thumb lies fairly close along the index.
- At your sides the hands are small in view, and most of what you see is the band and the faded forearm end. In real life you'd see your forearm carry on.
- The thumb doesn't react to the face buttons or the stick. It could curl when one is touched, and Quest reports `touched`.

## Needs a headset

- Whether the grip-space placement matches your real hand on Quest Touch Plus. The handle's diagonal and the 3.8 cm diameter are estimates.
- Whether the fade on the forearm end reads as a fade or as noise at framebuffer scale 0.7.
- fps with two 1,124-triangle skinned hands (cheap on paper).
- How long the paint takes on the Quest at kit change.
- How the analog blend feels.
