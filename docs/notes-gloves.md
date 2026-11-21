# Keeper's gloves in the '04 look (branch `gloves`)

## What exists

- `game/ps2/gloves.js`: early-2000s keeper gloves, built and painted in code, used when the kit has `gloves: true`
  (every `keeperKit()` in `rules/teams.js`). No other code needs to know: `buildPlayer2` passes `kit.gloves` to
  `figureGeometry(style, gloves)` (cached per style and gloves) and paints them on the keeper's own kit sheet.
  - Second pass (Kenny: "downgrade em a bit", they looked a quality level above the bodies): brought down to the
    body's level of detail, checked side by side with an outfield player's bare hand at 3 m and 1.2 m.
  - Shape: wide cuff over the end of the forearm, a broad flat hand padded thicker on the palm side, four fingers
    about 3 cm thick fanned apart and only a little bent (a keeper's open hand, not the outfield half-closed
    hanging hand), a thumb set well open. Cuff and palm 12 sides, fingers and thumb 8; no knuckle bump.
  - Paint (`paintGloves`, the 160x64 corner of the kit sheet where the unused neck patch was): plain and soft, lit
    round the hand the way `limbs()` lights the arm's skin: pale latex palm wrapping the finger sides and tips,
    the back in the kit's dark trim with one panel in the shirt colour, the strap round the cuff in the shirt
    colour. No seams, ribs or mark (the first pass's 5 px star read as a stray yellow mark). Green kit →
    green/black, yellow kit → yellow/black. No brand shapes.
  - Same bones: cuff weighted forearm→hand across the wrist, everything else the hand bone. Every keeper pose
    drives them unchanged (`keeperpose.js` not touched).
- `limbs.js`: `arm(b, s, n, gloves)` ends the arm at the wrist and calls `glove()` instead of the bare palm,
  fingers and thumb; `TURN` exported. `figure.js`, `player.js`: a few lines each.
- `gripPoint(m, out, tmp)` in `gloves.js`: where a ball held in both gloves sits, touching both palms (palms as
  planes, the ball one radius off both, nearest their midpoint). Meant for `holdInGloves` in `main.js` when the
  look is wired in, in place of `handsOf` (the wrists' midpoint, 7 cm short of the palms). Not wired: `main.js`
  isn't on the '04 look yet.
- Look page (`tools/ps2look.html`): `gloves`, `glovesfull`, `glovesback`, `glovesbackhand`, `glovespalm`, `glovespair` / `glovespairclose` (keeper beside an outfield player, 3 m / 1.2 m),
  `glovescatch`, `gloveshold`, `glovesover`, `glovesdive` (high parry, touch at t = 0.92), `glovesdivecatch`.
  Player 4 becomes the keeper (in `?team=`'s keeper kit, default MAD). The keeper on the kit card already wears them.
- `tests/unit/gloves.test.js`: real figure geometry skinned by the real keeper poses.

## Numbers

- Triangles: +540 per keeper (6,396 → 6,936 for hairstyle 0; the bare hands removed, gloves added; the first pass
  was +1,268). Outfield players unchanged.
- Draw calls: unchanged. Still one SkinnedMesh with the same two materials (kit sheet, head sheet), plus the same
  flat shadow draw. No new texture: the gloves are painted onto the keeper's kit sheet.
- Glove vs ball (ball r = 0.12), measured over all glove vertices: catch standing at the touch 0.5 cm, overhead
  catch 1.5 cm, held after a catch 0.7 cm, held to the chest and lying after a low diving catch -0.3 cm (0
  vertices more than 1.2 cm into the ball). Test thresholds unchanged by the second pass.

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
- Keeper sleeves are still short (the kit's); many keepers of the era wore long sleeves. Not part of this job.
- Shapes are from how gloves of the time were made (roll-finger latex palm, padded backhand, wide wrap strap),
  not from any one glove; the second pass keeps only the broad parts of that. All shading is painted; one material, so latex can't be matte while the kit shines.

## Not checked (needs a headset)

- How they read at real distance in the Quest (fingers are 8-sided tubes; close up they show facets, as the bare fingers do).
- fps: no change in draw calls and +1.3k triangles on one player, so none expected, but not measured.
