# Battle sprites

Generated with the built-in imagegen tool on 2026-10-09. Both sheets have six equal cells in a 3 × 2 grid and an alpha-transparent background. Used by the battle canvas with nearest-neighbor scaling.

- `mascot-sheet.png`: opponent based on the owner-provided school mascot photograph.
- `spark-sheet.png`: original yellow workshop robot, generated after the tool rejected the animal designs.

Frame order, left to right: top row idle / alternate idle / attack; bottom row hit / defeat / entrance.

## Mascot generation prompt

Use case: stylized-concept. Asset type: production pixel-art game sprite sheet with real transparent background. Reference image 1 is the mascot subject to preserve: broad black hat, large black mustache, oversized costume head, dark green full outfit, golden yellow belt and cape, pale gloves, oversized tan shoes. Reference image 2 supplies only the crisp retro handheld RPG sprite style. Create ONLY this mascot as six isolated full-body sprites in a precise 3-column by 2-row grid, all cells equally sized, no borders, no labels, no text, no ground or shadow. Every sprite faces toward lower left, consistent proportions, colors and design, thick dark pixel outlines, limited palette, hard square pixel edges. Top row left: neutral arms relaxed; top middle: lively idle with arms slightly raised; top right: water attack arms extended forward. Bottom left: taking a hit leaning backwards; bottom middle: defeated slumped crouch; bottom right: dramatic entrance both hands raised as in the photo. Each entire figure occupies middle 70% of its cell; same feet baseline at 88% cell height, fully visible hat and cape and shoes, ample transparent margins in EVERY cell. Landscape 3:2 sheet, no other characters. Keep photographed mascot identifiable in pixel art.

## Mascot cleanup prompt

Preserve the exact six mascot designs, poses, colors, pixel outlines, precise 3-column 2-row arrangement and positions. Remove all backdrop, dark haze, lighting gradients, soft shadow, bloom and glowing clouds. Retain only crisp isolated pixel-art character sprites and the small hard pixel bolt. Spaces between characters and around their silhouettes must be alpha-transparent, with sharp edges, no translucent aura, ground, text, or labels. Keep the same sheet dimensions and layout.

## Spark generation prompt

Use case: stylized-concept. Production retro pixel-art sprite sheet for an original friendly little workshop robot named Spark. Golden yellow rectangular metal head and compact yellow riveted body, two short square antenna ears, large teal safety goggles, charcoal mechanical paws, copper spring tail with a tiny lightning-bolt-shaped metal tip. Clearly a handmade robot with square panel seams and small screws, no fur, no orange or red cheeks, no logos, no text. Charming expressive character, dark pixel outline, crisp square pixels, limited palette, authentic old handheld RPG art. Six separate poses on an EXACT 3-column by 2-row grid with equal square cells, real alpha-transparent backdrop. No haze, glow, gradient background, ground or shadows. Same robot design and proportions in every cell, facing upper right in rear three-quarter view. Top row: neutral standing, slightly raised joyful idle, aiming one arm forward. Bottom row: leaning backwards surprised, resting flat on its belly with eyes closed, arms lifted in greeting. Complete character and entire tail centered in each cell, central 70% occupation, feet baseline at 88% cell height. Landscape sheet 3:2. Only robot sprites.

