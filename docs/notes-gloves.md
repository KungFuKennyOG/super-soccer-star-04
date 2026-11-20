# Keeper's gloves in the '04 look (branch `gloves`)

## What exists

- `game/ps2/gloves.js`: early-2000s keeper gloves, built and painted in code, used when the kit has `gloves: true`
  (every `keeperKit()` in `rules/teams.js`). No other code needs to know: `buildPlayer2` passes `kit.gloves` to
  `figureGeometry(style, gloves)` (cached per style and gloves) and paints them on the keeper's own kit sheet.
  - Shape: wide elasticated cuff over the end of the forearm with a strap band standing proud of it (open,
    turned-in top), a broad flat hand padded thicker on the palm side, a raised panel over the knuckles, four
    fingers about 3 cm thick fanned apart and only a little bent (a keeper's open ready hand, not the outfield
    half-closed hanging hand), a big thumb set well open from the hand.
  - Paint (`paintGloves`, the 160x64 corner of the kit sheet where the unused neck patch was): pale grey latex
    palm that rolls round the finger sides and over the tips (roll-finger), with a faint wear patch, flex lines and
    a raised seam where it meets the back; back of the hand in the kit's dark trim with a shield-shaped panel in the
    shirt colour (flex grooves, dark edge); a rib down each finger back in the shirt colour; ribbed black cuff, strap
    in the shirt colour with stitched edges and a tab carrying an invented star in `trim2`. Green kit → green/black
    gloves, yellow kit → yellow/black. No brand shapes or marks.
  - Same bones: cuff weighted forearm→hand across the wrist, everything else the hand bone. Every keeper pose
    drives them unchanged (`keeperpose.js` not touched).
- `limbs.js`: `arm(b, s, n, gloves)` ends the arm at the wrist and calls `glove()` instead of the bare palm,
  fingers and thumb; `TURN` exported. `figure.js`, `player.js`: a few lines each.
- `gripPoint(m, out, tmp)` in `gloves.js`: where a ball held in both gloves sits, touching both palms (palms as
  planes, the ball one radius off both, nearest their midpoint). Meant for `holdInGloves` in `main.js` when the
  look is wired in, in place of `handsOf` (the wrists' midpoint, 7 cm short of the palms). Not wired: `main.js`
  isn't on the '04 look yet.
- Look page (`tools/ps2look.html`): `gloves`, `glovesfull`, `glovesback`, `glovesbackhand`, `glovespalm`,
  `glovescatch`, `gloveshold`, `glovesover`, `glovesdive` (high parry, touch at t = 0.92), `glovesdivecatch`.
  Player 4 becomes the keeper (in `?team=`'s keeper kit, default MAD). The keeper on the kit card already wears them.
- `tests/unit/gloves.test.js`: real figure geometry skinned by the real keeper poses.

## Numbers

- Triangles: +1,268 per keeper (6,396 → 7,664 for hairstyle 0; the bare hands removed, gloves added). Outfield
  players unchanged.
- Draw calls: unchanged. Still one SkinnedMesh with the same two materials (kit sheet, head sheet), plus the same
  flat shadow draw. No new texture: the gloves are painted onto the keeper's kit sheet.
- Geometry build: about 290 ms for the gloved figure vs 230 ms bare in Node (once per hairstyle, cached).
- Glove vs ball (ball r = 0.12), measured over all glove vertices: catch standing at the touch 0.2 cm, overhead
  catch 1.6 cm, held after a catch 0.7 cm, held to the chest and lying after a low diving catch -0.3 cm (0
  vertices more than 1.2 cm into the ball).

## Short of real / judgment calls

- The chest hug (`HUG` in `keeperpose.js`) puts the palms 16 cm apart; the ball is 24 cm. It can't sit between the
  palms. `gripPoint` then puts it just in front of the hands, out of the plane of the forearms (clear of the
  gloves), so he holds it out at his chest rather than clutched to it. Putting it against his chest instead
  pushed the thumbs 4.5 cm into it. For the keeper-animation rebuild: forearms about 26 cm apart at the wrists
  in the hug would let the ball sit between the palms.
- `keeperpose.js` low dive: at the touch (0.42 s into the dive) the hands are 0.43 m under the pitch, so the
  touch of a low diving save is not measured and looks wrong whatever the gloves do (for the other helper).
- The ready stance's palms face inward and down a little, not toward the ball; that's the pose, not the glove.
- Fingers have no bones: the open, fanned shape is fixed. It reads right on saves and the ready stance, a bit
  stiff in the chest hug (fingers don't wrap the ball) and when hanging at his sides.
- The strap's star is about 5 px across on the sheet: at any distance it is a small yellow mark, not a star.
- Keeper sleeves are still short (the kit's); many keepers of the era wore long sleeves. Not part of this job.
- Shapes are from how gloves of the time were made (roll-finger latex palm, padded backhand, wide wrap strap),
  not from any one glove. All shading is painted; one material, so latex can't be matte while the kit shines.

## Not checked (needs a headset)

- How they read at real distance in the Quest (fingers are 10-sided tubes; the palm close-up shows facets).
- fps: no change in draw calls and +1.3k triangles on one player, so none expected, but not measured.
