# Making the kits: a step-by-step template

This is a complete set of instructions for designing every team's kit in the '04 look. It is written so that a model with no knowledge of this project can do all 49 teams by following it literally. Read all of it once before starting. Do not improvise outside it: where it doesn't cover a case, stop on that team, write it in the log as BLOCKED, and go on to the next.

## 0. The era

**ERA = the 2003-04 season, give or take two years (2002 to 2005).** The game's look is early-2000s football, so every kit has to be right for that era: what the team actually wore then, as far as colors and layout go. This one line is the owner's to change; if it changes, everything below that says "the era" follows it.

"Right for the era" means, for each team: which color its trim, collar and cuffs were; whether its shirt of those years was plain, had curved piping or had contrasting side panels; what color its number was; and above all what its **change kit** looked like in those years (which color shirt, shorts and socks). It does not mean copying a shirt: no badge, no sponsor, no maker's mark, no real name, and no reproducing the exact graphic design of one season's shirt (see the hard rules). Colors and layout only.

## 1. The job

There are 49 teams: 32 nations and 17 city clubs. Each already has a home kit: its colors and pattern were agreed with the owner (Kenny) and are in `rules/teams.js`. What is not designed yet, for any team:

1. **The cut** of the home shirt (three styles of panels and piping) and the **sock tops** (two styles). Today these are picked by a hash of the colors, so they are arbitrary.
2. **The trim**: whether the collar, cuffs and piping actually show against the shirt.
3. **A change kit** (away kit). Today every team gets the same plain one: white with home-color trim, or navy if the home kit is pale.

Your job is to find out what each team wore in the era (section 0), decide those three things to match it, write them into `rules/teams.js`, check them with the two tools, look at the picture, and log what you did. Nothing else.

**Done means:** all 49 teams have been researched and have `cut`, `hoops` and an `away` kit written in `rules/teams.js`; `node tools/kitcheck.mjs` prints `0 errors`; `npm run check` passes; every team has a row marked DONE or BLOCKED in `docs/kits-log.md`; the work is committed on the branch `kits` and not pushed.

## 2. Hard rules

These come from the owner. Breaking any of them makes the work unusable.

- **Never change a home kit's `pattern`, `shirt`, `alt`, `shorts` or `socks`.** Those five are the agreed identity of the team. If a check can only pass by changing one of them, mark the team BLOCKED and say why. If your research shows the team wore something different in the era (say, white shorts where the file has blue), do **not** change it: write `ERA MISMATCH` and what you found in the team's log notes, so the owner can decide.
- **Era accuracy comes from looking it up, not from memory.** Every era fact you use (a trim color, an away kit's colors) must come from a source you opened for that team (section 5a). If you cannot confirm something, say so in the log (`era unverified`) and take the plainer option. Never invent a "fact".
- **Real names stay out of the repository.** A city club in this game stands for the well-known club of that city in those colors; work out which one yourself in order to research it, but never write a real club's name, a player's name, a sponsor or a maker into `rules/teams.js`, the log or a commit message. Refer to teams by their id.
- **Never change a team's `id`, `name`, `s` (stars) or its place in the list.**
- **No real-world marks or designs.** No real crests, sponsors, kit-maker marks, club names or player names anywhere. Kits are colors and the generic patterns listed below, nothing more. Do not try to reproduce a specific real shirt from a specific season; do not add any text. The painter draws the only marks there are (an invented shield with a star, and an invented wordmark): leave them alone.
- **Edit only two files:** `rules/teams.js` (team entries only, see section 4) and `docs/kits-log.md`. Do not edit anything in `game/`, `tools/`, `tests/`, any other file in `rules/`, or the helper functions at the bottom of `rules/teams.js`.
- **Do not touch the keeper kits.** They are generated (green, or yellow for a team in green). You only look at them.
- **Never push.** Commit on the branch `kits` only.
- **Do not skip the picture.** A kit that passes the checker can still look wrong. Every team's card must be looked at.

## 3. Setup (once)

Run from the repository root.

```
git checkout -b kits          # if the branch exists already: git checkout kits
ls node_modules >/dev/null || npm install
node tools/kitcheck.mjs       # should print a list and end with a line like "1 error, 6 warnings"
```

If `node tools/kitcheck.mjs` fails to run at all (a crash, not ERROR lines), stop and report it. Do not try to repair the tools.

## 4. What a kit is

Open `rules/teams.js`. A team looks like this:

```js
{ id: 'GER', name: 'GERMANY', s: 5, kit: k('solid', W, null, BLK, W, BLK, BLK, { trim2: RED }) },
```

`k(pattern, shirt, alt, shorts, socks, trim, number, extra)` builds a kit. Colors are `'#rrggbb'` strings; the file also has named ones you may use: `W` (white), `BLK`, `NAVY`, `RED`, `GOLD`, `GREEN`, `SKY`.

| Field | Where | What it paints in the '04 look | May you change it on a home kit? |
| --- | --- | --- | --- |
| `pattern` | 1st argument | The shirt's layout (list below) | **No** |
| `shirt` | 2nd | The shirt's main color | **No** |
| `alt` | 3rd (`null` = same as shirt) | The pattern's second color | **No** |
| `shorts` | 4th | Shorts | **No** |
| `socks` | 5th | Socks | **No** |
| `trim` | 6th | Collar band, cuffs, piping, sock-top band; the side panels when `cut` is 2 | Yes |
| `number` | 7th | The number on the back | Yes |
| `trim2` | in `extra` | A thin second line on the collar, the shorts hem (cut 0) and the sock top | Yes |
| `outline` | in `extra` | Outline round the back number | Yes |
| `sleeve` | in `extra` | Sleeve color, if different from the shirt | Yes, sparingly |
| `band` | in `extra` | The centre stripe's color for the `band` pattern | Only on a `band` kit |
| `cut` | in `extra` | 0, 1 or 2 (below) | **You set it** |
| `hoops` | in `extra` | Sock tops: 0 or 1 (below) | **You set it** |

**Patterns:** `solid`; `stripes` (vertical); `hoops` (horizontal); `checks`; `band` (one centre stripe); `halves` (left half `shirt`, right half `alt`); `sleeves` (body in `shirt`, sleeves in `alt`).

**Cut:**
- `0`: side panels in a slightly different shade of the shirt, edged with piping in the trim color. The quietest. On patterned shirts (stripes, hoops, checks, halves, band) the panels are not drawn, so cut mostly changes the shorts and sleeves there.
- `1`: piping that curves from the collar round the shoulder to the armhole and runs down the sleeve. Reads as "sporty".
- `2`: side panels in the trim color itself, with a wedge of trim up the outside of the shorts. The loudest. Needs a `trim` that looks good in a big block next to the shirt.

**Sock tops (`hoops`):** `0` = one solid band in the trim color (with a thin `trim2` line if `trim2` differs); `1` = two thin hoops.

**The change kit** is a second kit on the team, as a sibling of `kit`:

```js
{ id: 'XXX', name: 'EXAMPLE', s: 3,
  kit: k('solid', RED, null, W, RED, W, W, { cut: 1, hoops: 0, trim2: NAVY }),
  away: k('solid', W, null, NAVY, W, RED, NAVY, { cut: 1, hoops: 0, trim2: NAVY }) },
```

For the away kit you choose every field, including pattern and colors.

## 5a. Research, per team (before designing)

For each team, find out what it wore in the era. Use your web search tool. If you have no web search tool, stop and report that: this job cannot be done to the owner's standard without it.

1. **Which team is it?** A nation is itself. A city club is the famous club of that city in the file's colors (two cities have two clubs each; the id and colors tell you which).
2. **Search** for its home and away kits of the era. Useful anchors: for clubs, the 2003-04 season (then 2002-03 or 2004-05); for nations, the tournament nearest the era that the team played in (2002 World Cup, Euro 2004, Copa America 2004, Africa Cup of Nations 2004, Asian Cup 2004, Gold Cup 2003) or its 2002 to 2005 qualifiers.
3. **Write down**, from what you opened (not from memory):
   - home: the trim / collar / cuff color; whether the shirt was plain, had curved piping from collar to armhole, or had side panels in another color; the number's color;
   - away: shirt, shorts and socks colors, the trim color, and whether it was plain or patterned;
   - if the home colors or pattern in the file differ from what the team wore (an `ERA MISMATCH`).
4. **Open at least one source per team** that shows or describes those kits, and prefer two that agree. Kit-history pages, tournament squad pages and match reports with photos all work. If sources disagree, take what the majority show for the anchor season and note the disagreement.
5. If after a reasonable try (three searches) you cannot find the away kit, design one by the fallback rules in section 5 and mark the row `era unverified (away)`.

Keep each team's facts to two or three lines. They go in the log's notes column.

## 5. Design rules

**Era first.** Where your research (5a) tells you what the team wore, do that, within what the painter can draw. The rules below about balance and variety are tie-breakers for when the era leaves a choice open or could not be verified. They never override a verified era fact.

**Mapping what you found onto what the painter can draw**
- Shirt was plain, with at most a little piping at the seams → `cut: 0`.
- Shirt had piping curving from the collar round the shoulder or down the sleeve → `cut: 1`.
- Shirt had side panels, underarm panels or shoulder panels in a second color → `cut: 2`, with `trim` set to that panel color.
- Sock tops had a single band of color, or were plain → `hoops: 0`; two or more thin hoops → `hoops: 1`.
- Away kit patterns: use `solid` unless the era's away shirt was clearly a `band`, `hoops` or `sleeves` design.
- Anything the painter cannot draw (a sash, pinstripes, a graphic print, a two-tone gradient): pick the nearest of the options above and say so in the notes. Do not try to fake it.

**Home kit**
1. `cut` and `hoops` follow the era (mapping above). Only when the era leaves it open or unverified: pick to differ from look-alikes, and lean toward whichever cut the cup has fewest of. Keep a running count in your log either way.
2. Two teams in the same cup with similar shirt colors must not share the same cut **and** the same sock tops. The checker warns about the worst cases ("looks the same as"); fix those by changing `cut`, `hoops` or `trim2` on one of them.
3. `trim` is the era's trim color for that team. It must also show against the shirt: if the checker warns that trim "won't show" and the era's shirt really had same-color trim, keep `trim` and put the visible accent in `trim2`; otherwise change `trim` to another color the team wore (its shorts, socks or `alt` color, or white, black or navy).
4. `trim2` is a small accent. Use a color already in the kit, or white/black/gold. Leave it out if the kit has enough going on.
5. The back number must be readable (the checker enforces this). Prefer white, black, navy or the team's own contrasting color. On stripes, hoops, checks and halves set an `outline`.
6. Leave `sleeve` alone unless the kit already has one.

**Change kit**
0. Its colors are the era's (5a): the shirt, shorts, socks and trim the team's change kit had in the anchor season. The rules below apply as written only when that could not be verified; when it could, they are checks on your result (rule 1 is always enforced by the checker).
1. It must be clearly different from the team's own home shirt (the checker enforces this), and from the home shirt of any same-cup team it would be worn against (the checker enforces this too).
2. Build it from the team's own colors turned round: the home trim or shorts color as the shirt is the usual answer. If the home shirt is dark or strong, a pale away shirt; if the home shirt is white or pale, a dark or strong one.
3. Mostly `solid`. About one away kit in five may be `band`, `sleeves` or `hoops` for variety. No `checks`, `stripes` or `halves` on away kits.
4. Give it the same `cut` as the home kit unless that looks wrong with the new colors. Set `hoops` too.
5. Shorts and socks may match the shirt or contrast; avoid shirt, shorts and socks all three in different strong colors.
6. For unverified away kits only: not every one white. Use navy, black, yellow, sky blue, red, green and others where they fit the team. (If the era's away kits really were mostly white, that is fine: era wins.)
7. If the era's away shirt would clash with the team's own home shirt as the checker measures it (it happens: some real change kits were close to the home one), use the team's third kit of the era if it had one, else shift the away shirt further from the home color and note it.

**Taste, in one line:** what that team wore in the era, reduced to colors and layout. When unsure or unverified, choose the plainer option.

## 6. The procedure, per batch of 8 teams

Work through `NATIONS` in file order, then `CLUBS` in file order, 8 teams at a time (the last batches are shorter).

**Before the first batch only:** the checker currently reports one ERROR, for `LDR` (London Red) against `AMS`. It is fixed by giving `LDR` an away kit that is not white and not red. You will reach `LDR` in the club batches; the error stays until then. That one error is expected.

For each batch:

1. **Read** the 8 entries in `rules/teams.js`.
1a. **Research** each of the 8 (section 5a) and write down its era facts.
2. **Decide** for each: `cut`, `hoops`, any change to `trim` / `trim2` / `number` / `outline`, and the whole `away` kit. Write your decisions down first (one line per team) so the batch is consistent with the counts in section 5.
3. **Edit** `rules/teams.js`. Add `cut` and `hoops` inside the `extra` object of the home kit (create `{ ... }` as the 8th argument if there is none; keep anything already in it). Add `away: k(...)` after `kit: k(...)`, separated by a comma, inside the team's `{ }`. Keep one team per line where it fits; a long entry may wrap as in the example in section 4.
4. **Check the fields and clashes:**
   ```
   node tools/kitcheck.mjs GER ITA FRA ENG ESP NED POR BEL
   ```
   (the 8 ids of the batch). Fix every `ERROR` line for those teams and run it again until there are none, apart from the expected `LDR` one before you have done `LDR`. Read every `WARN` line; fix it unless fixing it would break a hard rule, in which case note it in the log.
5. **Draw the cards:**
   ```
   PORT=8124 node tools/kitshots.mjs /tmp/kits GER ITA FRA ENG ESP NED POR BEL
   ```
   This takes about 10 seconds per team; give the command a timeout of at least 5 minutes. It writes `/tmp/kits/GER.png` and so on (1280 x 720). Ignore lines that mention "GPU stall". If it prints `[page error]`, the entry you wrote is malformed: fix the syntax in `rules/teams.js` and run it again.
6. **Look at every card.** Each shows five players, left to right: home kit from the front (number 10 on the shorts), home kit from the back (10), change kit from the front (7), change kit from the back (7), the keeper (1). Go through the checklist in section 7 for each. If anything fails, change the entry, then repeat steps 4 to 6 for that team only.
7. **Log** each team in `docs/kits-log.md` (section 8).
8. **Verify and commit:**
   ```
   npm run check
   git add rules/teams.js docs/kits-log.md
   git commit -m "Kits: GER ITA FRA ENG ESP NED POR BEL"
   ```
   `npm run check` must end with `# fail 0`. If it fails, the cause is almost certainly a syntax error or a broken field in the entries you just edited: fix that. If a test fails that has nothing to do with kits, stop and report it; do not edit tests.

After the last batch run the whole thing once more:

```
node tools/kitcheck.mjs            # must print "0 errors"
PORT=8124 node tools/kitshots.mjs /tmp/kits-final     # every team; about 10 minutes, timeout 20
npm run check
```

and look through all 49 final cards one more time for anything that changed by accident.

## 7. The checklist for each card

Answer each with yes or no. Any "no" means change the entry and redraw.

1. **Home front:** can you see the collar and the cuffs as a different color from the shirt?
2. **Home front:** does the shirt read as the team's pattern (stripes are stripes, a band is a band)?
3. **Home back:** can you read the number 10 at a glance?
4. **Home:** do shirt, shorts and socks look like one kit (no single piece that looks like it belongs to another team)?
5. **Change kit:** would you tell it from the home kit instantly, at a distance, by the shirt alone?
6. **Change kit back:** can you read the number 7 at a glance?
7. **Change kit:** does it match what you found the team wore away in the era (or, if unverified, is it built from this team's colors)?
7a. **Era:** would someone who watched this team in the era recognise both kits' colors and layout as right, with no badge or sponsor to help? If you could not verify, is the row marked `era unverified`?
8. **Keeper:** is he clearly different from both outfield kits? (You can't change him. If he isn't, change the away kit, or note it in the log.)
9. **Anything broken:** a black or missing patch, a color bleeding where it shouldn't, text that isn't the invented wordmark? If so, do not try to fix the painter: mark the team BLOCKED and describe what you see.

## 8. The log

`docs/kits-log.md` has one row per team, all starting as TODO. Fill in the row when the team is finished:

```
| GER | GERMANY | 0 | 1 | black, red trim | DONE | era: Euro 2004, 2 sources. home plain, black trim; away black with red. trim kept |
```

(That row shows the format only; its facts are not verified. Look every team up yourself.)

Columns: id, name, cut, hoops, the away kit in a few words, status (`DONE` or `BLOCKED`), notes: the era anchor you used and how many sources agreed, the era facts in a few words, what you changed on the home kit, any `ERA MISMATCH`, `era unverified`, a warning you left and why, or why it is blocked. No real club, player, sponsor or maker names. Keep the running counts of cuts per cup at the bottom of the file up to date.

## 9. When something goes wrong

- **A check you cannot satisfy without breaking a hard rule:** mark the team BLOCKED with the exact checker line, and move on.
- **Two teams in a cup that can't be told apart whatever you do** (same shirt, shorts and socks by agreement): give them different cuts, sock tops and `trim2`, note it on both rows, and move on. This is known for a few pairs (the checker lists them at the start).
- **The tools crash, or `npm run check` fails for a reason unrelated to kits:** stop. Report the command and its output. Do not edit tools or tests.
- **You are unsure whether a design is too close to a real club's or nation's actual shirt:** choose the plainer option (solid, one trim color).
- **You notice a mistake in an earlier batch:** fix it, re-run steps 4 to 6 for that team, update its log row, and commit it with the current batch.

## 10. A worked example

Take an imaginary team (not in the file; do not add it):

```js
{ id: 'XXX', name: 'EXAMPLE', s: 3, kit: k('solid', '#1a8a3a', null, '#1a8a3a', '#1a8a3a', '#1a8a3a', W) },
```

Thinking it through (this team is imaginary, so there is nothing to look up; for a real one, step one is the research in 5a, and what you find decides most of what follows):
- The kit is all green with green trim. The checker would warn that the trim won't show. The team's only other color is white (its number), so `trim` becomes `W`.
- It is a one-color kit, which can take the loudest cut. But white panels on an all-green kit would change its character a lot, so `cut: 1` (piping) is the safer choice. Suppose the cup's counts so far are cut 0: 5, cut 1: 3, cut 2: 4: cut 1 also helps the balance.
- Sock tops: another all-green team earlier in the cup has `hoops: 0`, so this one takes `hoops: 1`.
- The number is white on green: readable. No outline needed on a solid shirt.
- Away: the home shirt is strong and dark, so a pale away. White shirt, green shorts, white socks, green trim, green number, same cut.

Result:

```js
{ id: 'XXX', name: 'EXAMPLE', s: 3,
  kit: k('solid', '#1a8a3a', null, '#1a8a3a', '#1a8a3a', W, W, { cut: 1, hoops: 1 }),
  away: k('solid', W, null, '#1a8a3a', W, '#1a8a3a', '#1a8a3a', { cut: 1, hoops: 0 }) },
```

Then: run the checker for that id (no ERROR lines), draw the card, go through the nine questions, write the log row, and include it in the batch's commit.

## 11. Final report

When everything is done, report:
- how many teams are DONE and how many BLOCKED, with the BLOCKED ids and reasons;
- every `ERA MISMATCH` (id, what the file has, what the team wore), and every row marked `era unverified`;
- the final line of `node tools/kitcheck.mjs`, and any WARN lines you chose to leave, with why;
- the counts of cut 0 / 1 / 2 per cup, and how many away shirts are white per cup;
- the last line of `npm run check`;
- the folder with the final cards (`/tmp/kits-final`);
- anything in the pictures that looked wrong and that you could not fix from `rules/teams.js`.
