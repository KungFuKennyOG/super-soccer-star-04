# Team looks (branch `looks`)

Kenny: "can u check the population's of proportion of races of different countries to make the team's races more accurate pls?"

## Before

Every player's look came from one integer (`p.num * 7 + sum of the team id's char codes`, `game/squad.js`):
skin `SKINS[look % 5]`, hair `HAIRS[(look*3+1) % 5]`, style from a fixed table. So every team drew from the same 5 tones
(`game/tex.js`: fair, light-medium, medium, dark brown, deep), the same 5 hair colors (two near-blacks, dark brown,
dark blonde, auburn-brown) and the same styles (PS1: crop, curly, shaved, mullet, long, flattop; '04: crop, shaved,
slick, ponytail, curls). Japan, Nigeria and Sweden all fielded the same spread. Face variation in the '04 look was
paint only (brows, eye size/opening/slant, nose width, lips, stubble, freckles, iris color), keyed off the same
integer and, for nose and lips, off how dark the skin is.

## Now

- `rules/looks.js` (pure, tested by `tests/unit/looks.test.js`):
  - `TONES`: 10 skin tones (fair rosy, fair warm, light olive, light warm-ivory East Asian, olive/tan, light brown,
    brown, dark brown, deep brown, a deeper East Asian). Each player also gets `shade` (`toneOf`): up to 5% darker or 3%
    lighter than his tone, so no two men of one tone are quite the same. `HAIRS`: 8 (black, near-black, dark brown, mid
    brown, dark blonde, blonde, auburn, dyed light brown). `STYLES`: crop, shaved, slick, long, curls, spiky, mop
    (mapped to each body's own styles; spiky and mop are two new '04 hair shells, below).
  - `GROUPS`: 8 appearance clusters (north, west, south, mena, eastAsia, mestizo, mixed, black), each a weight table
    over tones, hair colors and styles, which iris colors are allowed, a stubble chance, and paint-only face
    settings (`feat`).
  - `LOOKS`: per team id (all 49), weights over the groups. `DEFAULT_LOOKS` for an unknown id.
  - `pickSquad(teamId, keys, seed)`: one match's looks. Groups are assigned by systematic (stratified) sampling, so
    each group gets floor or ceil of n x its weight: a 90/10 side never shows 2 of 4 from the 10%. Leftover places fall
    where a random offset puts them and are shuffled, so the line-up varies match to match. Within a side, nobody
    gets another player's (tone, hairstyle, hair color) while the tables leave room (up to 12 redraws).
  - Within any group each man also gets his own brow weight (x0.75-1.35), nose width (-0.08..+0.14) and lip fullness
    (-0.12..+0.18), passed to face.js through `feat`, on top of the face seed.
- `game/squad.js`: `squadLooks()` draws both sides from one seed per match (a `WeakMap` on the sim world, so
  `game/replay.js`'s copies get the same faces). `buildSet` takes `make` (the PS1 `buildPlayer` or the '04
  `buildPlayer2`) and `seed`. **Left-footers are unchanged**: they're still picked from the old `look` integer.
- `game/actors.js` `buildPlayer` and `game/ps2/player.js` `buildPlayer2` take `{ ap }` (a look) in place of the
  integer's picks. The tone goes to both the head sheet and the kit sheet (arms, hands, legs), so face, ears, neck,
  arms, hands and legs share it on both bodies (checked in the hands and heads sheets).
- `game/ps2/face.js` (small, local): `paintHead` takes `feat` = `{ crease, open, tilt, arch, eyes, brow, nose, lips }`. eastAsia: lid
  fold at 40% strength and lower, eye opening x0.88, outer corner lifted 0.004, brows less arched; mestizo and mena:
  brows a little flatter. Iris colors: 'dark' (browns), 'light' (mostly blue, grey, green) or 'any'. All default to
  the old look. Nose and lips still follow skin darkness as before. Nothing in the geometry changed.
- `game/ps2/headgeo.js`: two hair shells appended to `HAIR2` (indices 5, 6; the old ones keep theirs): `spiky` (short
  tufts standing up, front lifted) and `mop` (a longer crop with a low fringe). PS1 maps them to flat-top and
  crop/mullet. Per hairstyle the '04 body is built once (figure.js caches it), so two more styles cost two more body
  builds at load (about 110 ms each in software GL).
- `game/menus.js`: the team-select model wears one of that team's looks.
- Look page: `tools/ps2look.html?shot=squad&team=NED&seed=3` (six players of one side). Sheets:
  `tools/looks.html?teams=JPN,NGA&n=8` (`&heads=1`, `&hands=1`, `&body=ps1`, `&seed=`), rendered by
  `node tools/lookshots.mjs out JPN NGA ...` (env `TEAMS_PER`, `N`, `SEED`, `Q`). An orthographic camera, so
  every man in a row is square on.

Cost: none at run time beyond what was there (still one kit sheet per player, one head sheet per look; the sheet
cache key now includes stubble and feat). Sheet painting time unchanged (about 20 s for 48 players in software GL,
as before).

## Not done / short

- `game/trophy.js` (another helper's file) still builds the trophy-lift teammates with the old integer looks.
- `game/hands.js` (another helper's file): your first-person hands are still `SKINS[1]`, not your replay self's tone.
- The PS1 body takes tone, hair and style but not the face settings (its face is a 64 px painted texture).
- No braids, dreadlocks, cornrows or bleached tips (common in 2002-06 squads); 'curls' stands in for short afros.
- The tones were judged in headless software GL under the look page's light (hemisphere 0.62 + sun 0.68). The fairest
  tone stays under the old fairest. On a Quest panel the deepest tones may read darker; worth a look in the headset.
- `rules/` change: `rules/looks.js` is new (pure data and a picker); no gameplay or tuning touched.

## Sources

- [F05] CIA World Factbook 2005, "Ethnic groups" field (archived copy): https://user.iiasa.ac.at/~marek/fbook/05/fields/2075.html
  (the Factbook itself was retired in Feb 2026; the 2005 edition also matches the game's era).
- [SPK] Spokesman-Review, 9 Jul 2006, "French minorities see parity in team's mix": 17 of France's 23 World Cup players
  were minorities; collecting race/ethnicity data is prohibited in France; unofficial estimate ~10% of residents of
  Arab or African descent. https://www.spokesman.com/stories/2006/jul/09/french-minorities-see-parity-in-teams-mix
- [FA] The FA's list of England men's players of Black heritage with debut dates:
  https://www.englandfootball.com/articles/2025/Oct/10/england-mens-senior-team-black-players-list
- [TSWC] Brazil's 2002 World Cup squad list: https://www.thesoccerworldcups.com/rosters/2002_brazil_players.php
- [OKA] OkayAfrica, "The Black Colombian Team" (Colombia's squads have a large Afro-Colombian contingent; qualitative,
  later era): https://www.okayafrica.com/the-black-colombian-team/135610
- "Squad (recalled)": my own count from the 2002 World Cup / Euro 2004 / 2006 World Cup squads and 2003-04 club squads
  as I remember them. Not re-checked against squad lists online this session: treat the counts as **unverified**
  estimates (they set the weights, so a wrong recollection shifts a weight by a player or two).

Countries that don't collect ethnic/racial statistics (so the figure is an estimate or a proxy): France (prohibited,
[SPK]), Germany (counts nationality and "migration background", not ethnicity), Netherlands (country of birth of
parents, "allochtoon"), Belgium, Denmark, Sweden, Norway (country of birth / citizenship only), Italy, Spain, Portugal
(no ethnic question), Japan and South Korea (nationality only), Saudi Arabia, Iran, Morocco (no ethnic question),
Nigeria, Cameroon (ethnicity left out of the census), Australia (ancestry, not race). The F05 figures for those are the
Factbook's own estimates.

## Per team

Weights are over groups: no = north, we = west, so = south, me = mena, ea = eastAsia, mz = mestizo, mx = mixed, bl = black.
Sure: H high, M medium, L low.

| Team | Population (source) | Squad c. 2002-06 | Weights | Sure |
| --- | --- | --- | --- | --- |
| GER | German 91.5%, Turkish 2.4%, other 6.1% (F05; no ethnic census) | 2006 WC: 2 of 23 Black/mixed (Asamoah, Odonkor); Polish-born Klose, Podolski white (recalled) | we .70 no .12 so .10 mx .05 bl .03 | M |
| ITA | Italian, small German/French/Slovene/Albanian/Greek clusters (F05) | 2006 WC: all white (recalled) | so .85 we .15 | H |
| FRA | not collected (prohibited); ~10% of Arab or African descent, unofficial (SPK) | 2006 WC: 17 of 23 minorities (SPK); by my count ~14 Black/mixed, 1 North African heritage, 1 of Indian-Mauritian heritage, 7 white (recalled) | bl .45 mx .15 we .25 so .07 me .08 | M (squad H, split L) |
| ENG | UK 2001 census: white 92.1%, black 2%, Indian 1.8%, Pakistani 1.3%, mixed 1.2% (F05) | 2002 WC ~8 of 23, 2006 ~7 of 23 Black heritage (FA list + recalled squads) | we .63 no .05 bl .20 mx .12 | M |
| ESP | "Mediterranean and Nordic types" (F05; no ethnic census) | 2006: Marcos Senna (Brazilian-born) the one non-white (recalled) | so .90 we .05 mx .05 | H |
| NED | Dutch 83%, other 17% of which 9% non-Western (Turks, Moroccans, Antilleans, Surinamese, Indonesians), 1999 (F05) | Euro 2004: ~4-5 of 23 of Surinamese heritage (Davids, Seedorf, Kluivert, Reiziger), 1-2 Indo-Dutch (recalled) | we .50 no .20 bl .17 mx .08 mz .05 | M |
| POR | homogeneous Mediterranean; black African descent < 100,000 (F05) | Euro 2004: ~2-3 Black/mixed (e.g. Jorge Andrade; Deco Brazilian-born) (recalled) | so .85 bl .08 mx .07 | M |
| BEL | Fleming 58%, Walloon 31%, mixed/other 11% (F05) | 2002: the Mpenza brothers ~2 of 23 (recalled) | we .80 no .05 so .05 bl .10 | M |
| CRO | Croat 89.6%, Serb 4.5%, other 5.9%, 2001 census (F05) | all white (recalled) | so .65 we .35 | H |
| DEN | Scandinavian, Inuit, Faroese, German, Turkish, Iranian, Somali (F05; no ethnic census) | 2002/2004: all white (recalled) | no .85 we .15 | H |
| SWE | Swedes, Finnish and Sami minorities; immigrants Finns, Yugoslavs, Danes, Norwegians, Greeks, Turks (F05) | 2002-06: Larsson (Cape Verdean heritage), several of Balkan heritage (recalled) | no .80 we .10 so .06 mx .04 | M |
| ROU | Romanian 89.5%, Hungarian 6.6%, Roma 2.5%, 2002 census (F05) | white (recalled) | so .80 we .20 | H |
| BUL | Bulgarian 83.9%, Turk 9.4%, Roma 4.7%, 2001 census (F05) | almost all ethnic Bulgarian (recalled) | so .85 we .10 me .05 | M |
| NOR | Norwegian, Sami 20,000 (F05) | Carew (Gambian heritage) 1 of ~23 (recalled) | no .85 we .10 mx .05 | M |
| BRA | white 53.7%, mulatto 38.5%, black 6.2%, other 0.9%, 2000 census (F05) | 2002 WC squad list (TSWC): by appearance about 8 fair/olive (Marcos, Ceni, Lúcio, Belletti, Polga, Ricardinho, Juninho, Kaká), 8 mixed/brown, 7 Black: a third each, darker than the census. (Review: the first weights, Black .40, came out 6 of 8 dark.) Who counts as mixed vs Black is my call by appearance | so .35 mx .35 bl .30 | M |
| ARG | white (Spanish, Italian) 97%, mestizo/Amerindian/other 3% (F05) | mostly white/light; a few mestizo (recalled) | so .82 we .08 mz .10 | M |
| URU | white 88%, mestizo 8%, black 4% (F05) | mostly white; 1-2 Black (e.g. Zalayeta) (recalled) | so .82 mz .08 bl .06 mx .04 | M |
| COL | mestizo 58%, white 20%, mulatto 14%, black 4%, black-Amerindian 3%, Amerindian 1% (F05) | squads carry a large Afro-Colombian contingent (OKA, later era; 2001-05 e.g. Córdoba, Perea recalled), well above the census; rebalanced toward mixed after review | mz .45 so .15 bl .25 mx .15 | L-M |
| CHI | white and white-Amerindian 95%, Amerindian 3% (F05) | mestizo/white (recalled) | mz .55 so .45 | M |
| NGA | Hausa-Fulani 29%, Yoruba 21%, Igbo 18%, Ijaw 10%... (F05; ethnicity not in census) | all Black | bl 1 | H |
| CMR | Highlanders 31%, Equatorial Bantu 19%, ... non-African < 1% (F05) | all Black | bl 1 | H |
| MAR | Arab-Berber 99.1% (F05) | Arab-Berber, many European-born (recalled) | me .90 so .05 bl .05 | M |
| SEN | Wolof 43.3%, Pular 23.8%, Serer 14.7%, ... European and Lebanese 1% (F05) | 2002 WC: all Black (recalled) | bl 1 | H |
| GHA | black African 98.5%, European and other 1.5%, 1998 (F05) | all Black | bl 1 | H |
| JPN | Japanese 99% (F05; nationality only) | 2002/2006: Alex (Brazilian-born) 1 of 23 (recalled) | ea .96 so .04 | H |
| KOR | homogeneous (F05) | all Korean | ea 1 | H |
| KSA | Arab 90%, Afro-Asian 10% (F05; no census figure) | Afro-Saudi players were regulars (e.g. Mohammed Noor, Hamzah Idris) — share **unverified** | me .72 bl .18 mx .10 | L |
| IRN | Persian 51%, Azeri 24%, Gilaki/Mazandarani 8%, Kurd 7%, Arab 3%... (F05; no ethnic census) | like the population (recalled) | me .88 so .12 | M |
| AUS | Caucasian 92%, Asian 7%, aboriginal and other 1% (F05; ABS asks ancestry) | 2006: European heritage (many Croatian/Italian/Greek), Cahill (Samoan heritage), Elrich (Lebanese) (recalled); no Asian-Australian | we .55 so .30 no .05 me .05 mx .05 | M |
| MEX | mestizo 60%, Amerindian 30%, white 9% (F05; INEGI counts indigenous language, not race) | mostly mestizo, a quarter or so lighter, no Amerindian-majority look in particular (recalled) | mz .72 so .26 mx .02 | M |
| USA | white 81.7% (incl. Hispanic), black 12.9%, Asian 4.2%, 2003 est. (F05) | 2002/2006: ~6-7 of 23 Black/mixed (Beasley, Onyewu, Pope, E. Johnson, Howard...), 2-3 Latino (recalled) | we .55 no .05 so .02 mz .10 bl .20 mx .08 | M |
| CAN | British 28%, French 23%, other European 15%, Amerindian 2%, mostly Asian/African/Arab 6%, mixed 26% (F05) | De Rosario, Hutchinson, Gerba, Nsaliwa, de Guzman: ~25% (recalled) | we .55 no .05 so .10 bl .18 mx .10 ea .02 | L-M |

Clubs (the game names them by city; the real club is the one whose kit the team wears). Typical 2003-04 squads, all
recalled, so all **unverified** counts; the weights are the share of Black / mixed-heritage / other players among about
22 first-teamers, the rest by the league's local core.

| Team | Club 2003-04 | Squad note (recalled) | Weights | Sure |
| --- | --- | --- | --- | --- |
| MAD | Real Madrid | Spanish core; Roberto Carlos, Ronaldo (Brazil); Zidane; Figo; Beckham | so .68 we .10 me .05 mx .10 bl .07 | M |
| BAR | Barcelona | Ronaldinho, Kluivert, Reiziger, Davids (Jan 04); Márquez; Spanish/Dutch core | so .60 we .10 mz .05 mx .10 bl .15 | M |
| MUN | Bayern | German core; Kuffour, Zé Roberto, Elber, Pizarro, Santa Cruz | we .65 so .10 mz .07 mx .10 bl .08 | M |
| MRB | AC Milan | Italian core; Dida, Cafu, Seedorf, Serginho; Shevchenko, Kaladze, Tomasson | so .72 we .10 mx .05 bl .13 | M |
| MAN | Manchester United | Ferdinand, Silvestre, Saha, Djemba-Djemba, Kléberson, Giggs; Ronaldo, Forlán | we .55 no .05 so .12 mx .10 bl .18 | M |
| LIV | Liverpool | Heskey, Diouf, Diao, Traoré, Sinama Pongolle; Hyypiä, Hamann | we .50 no .08 so .10 mx .07 bl .25 | M |
| LDR | Arsenal | Henry, Vieira, Campbell, Cole, Lauren, Kanu, Touré, Wiltord, Edu, Gilberto, Clichy: about half | we .30 no .05 so .10 mx .12 bl .43 | M |
| LDB | Chelsea | Makélélé, Desailly, Hasselbaink, Gallas, Geremi, G. Johnson, Babayaro, Melchiot | we .45 no .02 so .15 mx .10 bl .28 | M |
| TUR | Juventus | Italian core; Thuram, Zebina, Appiah; Trezeguet, Nedvěd | so .75 we .10 mx .03 bl .12 | M |
| MBB | Inter | Córdoba, Martins, Kallon, Adriano (Jan 04); many Argentines; Emre, Okan | so .55 we .03 me .05 mz .10 mx .07 bl .20 | M |
| DOR | Dortmund | German core; Amoroso, Ewerthon, Dedê, Evanilson; Rosický, Koller | we .65 no .03 so .07 me .03 mx .12 bl .10 | M |
| PAR | Paris SG | French core with several Black French and African players (Mbami, Armand, Yepes); Pauleta, Heinze | we .35 so .20 me .05 mx .10 bl .30 | L-M |
| AMS | Ajax | Dutch core incl. Surinamese/Indo heritage; Mido, Trabelsi, Pienaar, Maxwell; Ibrahimović, Chivu | we .45 no .10 so .10 me .06 mz .04 mx .13 bl .12 | L-M |
| PRT | Porto | Portuguese core; Deco, Carlos Alberto, McCarthy, Bosingwa, Derlei | so .72 we .02 mx .14 bl .12 | M |
| LIS | Benfica | Portuguese core incl. Cape Verdean/Angolan heritage; Luisão, Geovanni | so .70 we .02 mx .15 bl .13 | L-M |
| GLA | Celtic | Scottish/Irish core, Scandinavians; Larsson, Agathe, Balde, Sylla | we .55 no .20 so .07 mx .06 bl .12 | M |
| IST | Galatasaray | Turkish core; a few South Americans / Africans | me .60 so .30 mz .05 bl .05 | M |

## Renders

`/home/claude/looks-shots/` (not committed): `looks-1..3.png` whole bodies and `looks-1..3-heads.png` heads for
JPN KOR NGA CMR SEN BRA / FRA ENG NED SWE MEX KSA / IRN USA LDR MAD IST GLA (8 players each, seed 0), `looks-1-hands.png`
(hands and legs against the face's tone), `looks-1-ps1.png` (PS1 bodies), `squad.png` (`?shot=squad&team=NED&seed=3`).

## Needs a headset

Whether the deepest and the fairest tones read naturally on the Quest's panel and at match distance, and whether the
East Asian face paint (softer lid fold, slightly narrower eye) reads at all at 10 m. In a match today the PS1 bodies
already get the team looks (`buildSet` → `buildPlayer` with `ap`); the '04 body gets them once it is wired in by passing
`make: buildPlayer2` to `buildSet`.

## Review fixes (orchestrator)

1. Sameness inside one-group sides (JPN looked like clones): per-man tone shade, brow/nose/lip settings, two new
   hairstyles, a dyed light brown (eastAsia hair: black .5, near-black .25, mid brown .1, dyed light brown .1, dark
   blonde .05; styles: spiky .25, crop .22, mop .2, slick .18, shaved .08, long .07), and no repeated (tone, style,
   hair) triple inside a side. Tested: 8-man JPN/KOR/NGA/MEX/SWE sides have at least 7 distinct triples and 3+ styles
   over 50 seeds.
2. East Asian tones lighter and less orange: `#e7c29b` → `#e8c7a4` and `#d8ad80` → `#dbb791` (about the fair tones'
   brightness, less red). Side by side with `wes` and `sou` in looks-1-heads (JPN, KOR) and looks-2-heads.
3. BRA rebalanced to about a third each (squad list above); `mixed` tones spread through the middle (olive/tan .25,
   light brown .40, brown .35; was .10/.45/.45). COL: Black .30 → .25, mixed .10 → .15.

Left-footers and determinism unchanged (replays get the same faces from the same per-world seed).
