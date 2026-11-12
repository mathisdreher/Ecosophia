Ecosophia maps the thinkers of political ecology as one living tree: precursors in the roots, founding texts in the trunk, schools as branches, authors as leaves, and the mycelium underneath that carries influence between branches the tree itself would keep apart. Use this system for the website, the data visualisations and the 90-second video capsules.

## The idea

Ecosophy, not ecology. Ecology names a science of habitats; ecosophy (Næss, then Guattari) names a wisdom of dwelling that is at once environmental, social and mental. The brand takes that wider word as its name and its stance.

The tree and the mycelium hold each other in check. A tree is a genealogy: it orders, ranks and descends. Deleuze and Guattari opposed that arborescent model to the rhizome, which connects any point to any other. Ecosophia keeps both: the tree above ground gives newcomers a readable structure, the mycelium below ground shows that Bookchin read Kropotkin, that Gorz and Illich wrote in dialogue, that Ferdinand sets the slave ship against environmentalism's Noah's Ark. Never draw one without the other.

The mark nods to Næss's own "Ecosophy T", named after his mountain hut Tvergastein: a T-shaped crown above a ground line, mirrored by roots that end in three spores joined by threads.

## The ground line

Every page has one ground line: a full-width `ink` rule at `stroke-ground`. Above it sits what is visible: ideas, schools, authors. Below it sits what feeds them: influences, sources and method, on `humus-soft`. An author page reads top to bottom as leaf, ground, roots. The logo stands on the same line, and the p of Ecosophia roots below it.

- One ground line per page, never a decorative divider. Other separations use `line` hairlines.
- Content below ground is always evidence: who the author read, who answered them, and the citations behind every claim on the page.
- In video, the ground line is the first thing drawn and the last thing left on screen.

## The tree as architecture

Every metaphor is also a data entity, a view of the site and a token. Use these names everywhere: in the interface, in the database schema and in video scripts.

| Layer | Holds | Site view | Token | Glyph |
|---|---|---|---|---|
| Roots | Precursors, from Quesnay and the physiocrats to Thoreau, Reclus, Kropotkin, Podolinsky | Roots | `humus`, `humus-soft` | `root.svg` |
| Trunk | Founding texts, roughly 1962 to 1975 (Carson, Ellul, Illich, Gorz, Næss, Georgescu-Roegen, the Meadows report) | Trunk | `ink` | `trunk.svg` |
| Branches | Schools and currents (eleven, see Colour) | Tree | `branch-*` | `branch.svg` |
| Leaves | Authors | Author page | `paper-raised` | `leaf.svg` |
| Seeds | Concepts (wildness, metabolic rift, autonomy, conviviality, care, plantationocene) | Seed index | `moss-soft` | `seed.svg` |
| Mycelium | Influence, critique and dialogue between authors | Mycelium (graph) | `mycelium` | `hypha.svg` |
| Rings | Dates of life and publication | Rings (timeline) | `line` | `ring.svg` |
| Canopy | Positions on conceptual axes | Canopy (map of ideas) | `branch-*` | none |
| Terrain | Where authors lived and wrote | Terrain (geographic map) | `line`, `ink-muted` | none |
| Clearing | Simulated debates between author-agents on a news event or a political claim | Clearing | `lichen`, `lichen-ink` | `clearing.svg` |

The author is the primary entity: every view resolves to author leaves, and works and concepts hang from them.

## Voice

- Write in English, in sentence case, in the third person for authors and the second person for the reader. No emoji, no exclamation marks.
- Map, don't rank. Describe what an author argued and whom they answered; never award points. "Gorz shifts the question from how much we produce to who decides what is produced" is right; "Gorz brilliantly demolishes productivism" is not.
- Let authors speak in their own words, briefly and with a citation. Paraphrase everything else.
- Name disagreements plainly. The field is a quarrel, and the quarrel is the content.
- Keep numbers consistent within a sentence: all digits or all words ("eleven branches, four views", not "eleven branches, 4 views").
- Dates in `meta`: lifespans as 1912–2009, living authors as b. 1947, works as *Title* (1973). Cite as Author, *Title* (year), p. 12. Every author links its Wikidata QID.

## Colour

Build on `paper` and `paper-raised` with `ink` and `ink-muted` text. `moss` is the brand colour and the primary action, with `on-moss` for its labels and `moss-soft` for selected states. The palette stays earthy and matte: no gradients, no glows, no shadows beyond a hairline `line`.

`humus` belongs to the Roots layer only. `mycelium` belongs to influence links only. `lichen` belongs to simulated content only, and is never decorative.

Eleven branch colours, all natural pigments, identify the schools. Each passes 4.5:1 as text on both grounds in both themes. Eleven hues cannot be told apart by colour alone, so a branch colour always travels with its name, its chip or its legend entry.

| Token | Pigment | School |
|---|---|---|
| `branch-ecosophy` | moss | Ecosophy proper (alias of `moss`) |
| `branch-deep-ecology` | fir | Deep ecology and environmental ethics |
| `branch-social-ecology` | rust | Social ecology and libertarian municipalism |
| `branch-ecosocialism` | madder | Ecosocialism and eco-Marxism |
| `branch-degrowth` | ochre | Degrowth and bioeconomics |
| `branch-ecofeminism` | heather | Ecofeminism |
| `branch-political-ecology` | slate | Political ecology as a discipline (geography, anthropology) |
| `branch-decolonial` | indigo | Decolonial ecology and environmental justice |
| `branch-anthropocene` | lagoon | Anthropocene, Gaia and new materialisms |
| `branch-technocritique` | olive | Technocritique and eco-anarchism |
| `branch-queer-ecology` | orchid | Queer ecology |
| `branch-counterpoint` | basalt | Counterpoints (ecomodernism, green growth), grafted for debate, never a branch of the field |

An author with several affiliations takes the colour of the branch they are best known in and lists the others as chips. School boundaries are editorial; say so on the methodology page.

Two themes ship: Day (linen paper, bark ink) and Night forest (deep green-black paper, cream ink). Video defaults to Night forest.

## Type

- Set names, titles and headings in Fraunces (`display`, `title`, `heading`). Set verbatim quotes in `quote`, Fraunces italic, and nothing else in italic serif.
- Set interface and reading text in Instrument Sans (`lede`, `body`, `label`). `label` is uppercase and reserved for chips, tabs and the Sourced and Simulated marks.
- Set dates, QIDs, page references and run ids in IBM Plex Mono (`meta`).
- Load all three from Google Fonts.

## Logo

- The rooted lockup is the primary logo: the mark and the outlined wordmark stand on one shared ground line, and the p roots below it. Use `ecosophia-lockup-rooted-bark.svg` on `paper` and `ecosophia-lockup-rooted-cream.svg` on Night forest.
- Below 120px wide, or where a line would clash with a neighbouring rule, use the inline lockup. Below 64px wide, use the mark alone.
- Clear space: a quarter of the mark's width on every side. Never recolour outside `ink`, cream and `moss`, never tilt, never set the wordmark in another face.
- In a site header the lockup's ground line sits exactly on the header's bottom rule, so the logo grows out of the page.

## Shape, space and line

- The leaf cut is the signature shape: round only the top-right and bottom-left corners with `radius-leaf` (border-radius: 0 24px 0 24px). Use it for author leaves and the capsule name card, never for buttons or inputs.
- Buttons and panels take `radius-md`; chips and concept tags take `radius-pill`.
- Space on the `space-*` steps. Cards pad `space-4` on mobile and `space-6` on desktop; sections sit `space-12` apart.
- Lines carry meaning in the graph. Use `stroke-thread` for mycelium links, `stroke-branch` for branch lines and stance bars, `stroke-glyph` for glyphs.
- Focus ring: 2px solid `moss`, 2px offset, on every interactive element.

## Graph grammar

- Node = author leaf, a circle filled with its branch colour, area proportional to the number of incoming influence links. Precursors use `humus`.
- Edge = hypha, drawn in `mycelium` at `stroke-thread`. Solid for "influenced", dashed (4 4) for "critiqued", dotted (1 3) for "in dialogue with". Each edge stores its source (Wikidata property or a cited passage).
- Never colour edges by branch: the mycelium belongs to no one.

## Canopy axes

The Canopy view places authors on three axes, each scored from 0 to 100 and each backed by at least one cited passage. Plot two at a time and filter on the third.

| Axis | 0 | 100 |
|---|---|---|
| Standing of nature | Anthropocentric: nature matters for humans | Ecocentric: nature matters in itself |
| Path of change | Reform within existing institutions | Rupture with them |
| Seat of power | The state and its plans | The commune and autonomy |

An author with no sourced passage on an axis shows as a hollow marker at the school's median, never as a filled one.

## Sourced and simulated

Two kinds of words appear on Ecosophia and they must never be confused.

- Sourced: a verbatim quote or a paraphrase of a published text. Mark it with the `SourcedQuote` component: `moss` label "Sourced", Fraunces italic, citation in `meta`.
- Simulated: anything said by an author-agent in the Clearing. Mark it with the `SimulatedVoice` component: dashed `lichen-ink` outline at `stroke-thread`, `lichen` label "Simulated", the run id and the date. Never set a simulated statement in `quote`, never put it in quotation marks, never attribute it with "said".
- In video, a simulated line keeps the lichen label on screen for its whole duration.

## Video capsules

One author, 90 seconds, Night forest theme, 16:9 at 1920×1080 and 9:16 at 1080×1920, safe margin `space-16`.

1. Hook (0–8 s): one question the author answered, set in `title`.
2. Roots (8–20 s): two or three influences, drawn as hyphae arriving on the leaf.
3. Three seeds (20–65 s): the key ideas, one concept per beat, each with a sourced line.
4. Branch (65–80 s): the school, its colour and one contemporary who disagrees.
5. Today (80–90 s): end card with the rooted lockup, the author's QID and the URL; a simulated reaction to a current claim only if labelled Simulated.

Name cards use `CapsuleLowerThird`. Titles never cover a face or a map node.

## Motion

- Things grow; they never fly in. Lines draw outward from the ground line in 600 ms, ease-out. A leaf appears in 240 ms once its branch has arrived.
- A hypha draws from the author who influenced to the author who received: direction is meaning.
- No bounce, no parallax, no spin. With reduced motion, show the final state.

## Portraits

- Use a portrait only when its licence is verified (Wikimedia Commons, with the credit in `meta`).
- Treat every portrait the same way: greyscale, tinted `ink` on `paper`, cut with the leaf shape.
- No portrait available: set the author's initials in `title` on `moss-soft` in the same leaf shape. Never an AI-generated face.

## Taglines

- Descriptive, the default: "Roots, branches and mycelium of political ecology."
- Manifesto, for the about page and video intros: "Ecology is a science. Ecosophy is a way of dwelling."
- Product, for social posts: "Who read whom, and what they disagreed on."

## Iconography

Use the eight glyphs in assets/Glyphs, drawn on a 24px grid at `stroke-glyph` with round caps. They are single-ink files in `ink` (#2a2219); for Night forest, recolour to the dark `ink` value before export. Do not mix in a third-party icon set for these concepts; for interface chrome (search, close, menu) use thin round-cap outline icons at the same stroke. No emoji.

## Don't

- Don't draw the tree without the mycelium, or rank branches by height.
- Don't use green as a moral colour ("good ecology"): `moss` is a brand colour, not a verdict.
- Don't show a branch colour without its name.
- Don't let a simulated line look like a quote.
- Don't use stock photos of forests or melting ice.
- Don't use the ground line twice on a page.
