# Battle assets

All sprites and UI use nearest-neighbor scaling on a shared pixel canvas. Native HTML controls retain keyboard, password input and screen-reader support.

- `mascot-sheet.png`: The Don, based on the owner-provided school mascot photograph; generated with the built-in imagegen tool on 2026-10-09. Six equal cells in a 3 × 2 grid with alpha transparency. Actual opaque bounds anchor each pose to the grass. Idle uses the standing frame and a slow foot-anchored breathing cycle.
- `pikachu-back.png`: original FireRed/LeafGreen back sprite from [PokéAPI's sprite collection](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/back/25.png), © Nintendo / Creatures / GAME FREAK. Used at the owner's request. Source blob `0ea5ff592ea8c17abad26fdaf2c39f86fa00ba2a`; transparent 64 × 64 image, opaque bounds `[5,8,51,49]`. Attacks and defeat animate the standing sprite without alternating poses.
- `frlg-font.png`: source bitmap lettering from [pret/pokefirered](https://github.com/pret/pokefirered/blob/master/graphics/fonts/latin_normal.png), © Nintendo / Creatures / GAME FREAK. Source blob `42e847faf0f281db3da29ac5a33b6c224a416207`. `admin-battle.js` includes the exact pixel coordinates for the Latin glyphs and their one-pixel shadows, mapped using the same repository's `charmap.txt`. The font is rendered as whole pixels rather than smooth browser text.
- `spark-sheet.png`: retired workshop robot, retained with its original generation prompt below; no longer loaded by the battle.

## Background music

Juhani Junkala, “Title Screen,” from [5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action). The composer released this pack under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). The audio and the composer's license note are also preserved in [this source mirror](https://github.com/petergyang/space-shooter-game/tree/main/assets/music). Music loops quietly, shares the sound toggle with battle effects, and stops on cancellation or before TV shutdown. The CC0 designation applies to the music, not the Pokémon art or font.

Frame order, left to right: top row idle / alternate idle / attack; bottom row hit / defeat / entrance.

## Mascot generation prompt

Use case: stylized-concept. Asset type: production pixel-art game sprite sheet with real transparent background. Reference image 1 is the mascot subject to preserve: broad black hat, large black mustache, oversized costume head, dark green full outfit, golden yellow belt and cape, pale gloves, oversized tan shoes. Reference image 2 supplies only the crisp retro handheld RPG sprite style. Create ONLY this mascot as six isolated full-body sprites in a precise 3-column by 2-row grid, all cells equally sized, no borders, no labels, no text, no ground or shadow. Every sprite faces toward lower left, consistent proportions, colors and design, thick dark pixel outlines, limited palette, hard square pixel edges. Top row left: neutral arms relaxed; top middle: lively idle with arms slightly raised; top right: water attack arms extended forward. Bottom left: taking a hit leaning backwards; bottom middle: defeated slumped crouch; bottom right: dramatic entrance both hands raised as in the photo. Each entire figure occupies middle 70% of its cell; same feet baseline at 88% cell height, fully visible hat and cape and shoes, ample transparent margins in EVERY cell. Landscape 3:2 sheet, no other characters. Keep photographed mascot identifiable in pixel art.

## Mascot cleanup prompt

Preserve the exact six mascot designs, poses, colors, pixel outlines, precise 3-column 2-row arrangement and positions. Remove all backdrop, dark haze, lighting gradients, soft shadow, bloom and glowing clouds. Retain only crisp isolated pixel-art character sprites and the small hard pixel bolt. Spaces between characters and around their silhouettes must be alpha-transparent, with sharp edges, no translucent aura, ground, text, or labels. Keep the same sheet dimensions and layout.

## Spark generation prompt

Use case: stylized-concept. Production retro pixel-art sprite sheet for an original friendly little workshop robot named Spark. Golden yellow rectangular metal head and compact yellow riveted body, two short square antenna ears, large teal safety goggles, charcoal mechanical paws, copper spring tail with a tiny lightning-bolt-shaped metal tip. Clearly a handmade robot with square panel seams and small screws, no fur, no orange or red cheeks, no logos, no text. Charming expressive character, dark pixel outline, crisp square pixels, limited palette, authentic old handheld RPG art. Six separate poses on an EXACT 3-column by 2-row grid with equal square cells, real alpha-transparent backdrop. No haze, glow, gradient background, ground or shadows. Same robot design and proportions in every cell, facing upper right in rear three-quarter view. Top row: neutral standing, slightly raised joyful idle, aiming one arm forward. Bottom row: leaning backwards surprised, resting flat on its belly with eyes closed, arms lifted in greeting. Complete character and entire tail centered in each cell, central 70% occupation, feet baseline at 88% cell height. Landscape sheet 3:2. Only robot sprites.

