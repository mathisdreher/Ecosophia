# Ecosophia

Roots, branches and mycelium of political ecology. *Racines, branches et mycélium de l'écologie politique.*

Ecosophia maps the thinkers of political ecology as one tree: precursors in the roots, founding texts in the trunk, schools as branches, authors as leaves, and underneath the mycelium, the sourced record of who influenced, criticised or answered whom. The site is bilingual (English and French), static, and published with GitHub Actions on GitHub Pages.

[En français](#en-français)

## What is in the site

| View | Address (en / fr) | What it shows |
|---|---|---|
| Tree | `/en/` · `/fr/` | Eleven branches, three leaves each, seven root groups below the ground line |
| Author | `/en/authors/<id>/` · `/fr/auteurs/<id>/` | Leaf, ground, roots: seeds, a sourced quotation, who they read, who answered, numbered sources |
| Branch | `/en/branches/<id>/` | The leaves of a school and the threads that cross it |
| Mycelium | `/en/mycelium/` | The influence graph, with filters, a detail panel and a table of every link with its source |
| Rings | `/en/rings/` · `/fr/cernes/` | Lifespans and publication dates on one time axis |
| Terrain | `/en/terrain/` | Birthplaces on a world map and a Europe inset, listed by country |
| Clearing | `/en/clearing/` · `/fr/clairiere/` | The page for simulated debates. It holds a hand-written specimen, labelled as such, until a first run is published |
| Canopy | `/en/canopy/` · `/fr/canopee/` | In preparation: the three axes and the rules of placement |
| Seeds, Roots, Trunk | `/en/seeds/`, `/en/roots/`, `/en/trunk/` | Concepts, precursors and founding texts |
| Method, Data | `/en/method/`, `/en/data/` | How the map is made, where the data lives |

## Stack

- [Astro](https://astro.build) generates plain HTML. No client framework; a few small scripts handle search, the theme switch, the graph and the timeline.
- The corpus is YAML in `data/`. Graph positions (d3-force) and maps (d3-geo, Natural Earth coastlines) are computed at build time and shipped as SVG.
- Colours, type, spacing and strokes come from `design/tokens.json`, the export of the Ecosophia design system. `design/brand.md` is its brand book.
- Fonts (Fraunces, Instrument Sans, IBM Plex Mono) are self-hosted. The site sets no cookie and calls no third party.
- GitHub Actions validates the data, builds, checks every internal link and deploys to GitHub Pages.

## Run it locally

Node 22.23 or later (Node 24 is used in CI).

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` first regenerates the CSS tokens and validates the corpus; a broken reference stops the build. `npm run validate` runs the checks alone.

## Publish on GitHub Pages

1. In the repository, open **Settings › Pages** and set **Source** to **GitHub Actions**. A private repository needs a paid GitHub plan for Pages.
2. Push to the default branch, or run the **Build and deploy** workflow by hand.

The workflow (`.github/workflows/deploy.yml`) deploys from the default branch only. On every other branch and on pull requests it runs the same checks and build without publishing. Until Pages is enabled it still passes and leaves a notice explaining what is missing. The base path (`/Ecosophia`) and the site address are read from the Pages configuration, so a custom domain needs no change in the code.

Links that point to the repository (report an error, suggest an author, propose a claim) appear on the site only when the repository is public.

## The corpus

```text
data/
  branches.yaml        schools, in the order of the tree
  roots.yaml           root groups (families of precursors)
  authors/*.yaml       one file per branch, plus roots.yaml and trunk.yaml
  links.yaml           the mycelium: from, to, type, note, source
  seeds.yaml           names of the concepts, in both languages
  trunk.yaml           the founding texts
  sources.yaml         secondary sources cited as evidence
  clearing/            the specimen, and later the published runs
```

An author record:

```yaml
- id: ivan-illich
  name: Ivan Illich
  sort: Illich
  layer: leaf               # root | trunk | leaf
  branch: technocritique    # leaves: a branch id; roots: `root: <group id>`
  also: [degrowth]          # secondary affiliations
  born: 1926
  died: 2002
  place: {city: {en: Vienna, fr: Vienne}, country: {en: Austria, fr: Autriche}, lat: 48.21, lon: 16.37}
  wikidata: Q84186
  lede: {en: "…", fr: "…"}
  seeds:                    # three at most, each with a source
    - seed: conviviality
      text: {en: "…", fr: "…"}
      source: illich-1973
  works:                    # works double as citable sources
    - {id: illich-1973, year: 1973, title: Tools for Conviviality}
```

A link:

```yaml
- from: jacques-ellul
  to: ivan-illich
  type: influenced          # influenced | critiqued | dialogue
  note: {en: "…", fr: "…"}
  source: illich-1993       # no source, no link
```

Rules the validator enforces: every reference resolves, every text exists in both languages, a seed and a link carry a source, a quotation stays under twenty-five words and has a citation, an author carries three seeds at most. A link marked `status: to-verify` is kept off the graph and flagged on the author page.

Facts that could not be confirmed are left empty rather than guessed. `npm run validate` lists them as warnings.

### Checking facts against Wikidata

Dates and birthplaces were entered by hand. The **Check facts against Wikidata** workflow (manual, and monthly) compares them with Wikidata and writes the differences to the run summary. It changes nothing: corrections are made in the YAML files after a human has looked. To run it locally:

```bash
WIKIDATA_USER_AGENT="EcosophiaFactCheck/0.1 (https://github.com/<owner>/<repo>)" npm run wikidata
```

## Languages

Every page exists at a localised address in both languages, with `hreflang` links between them. Interface strings are in `src/i18n/ui.mjs`, routes in `src/i18n/routes.mjs`. Titles of works stay in their original language. French typography (spaces before `:`, `;`, `?`, guillemets) is applied at build time.

## Project layout

```text
design/        tokens.json and the brand book, from the design system
data/          the corpus
scripts/       build-tokens, validate-data, check-links, wikidata-check
src/
  i18n/        interface strings and the route table
  lib/         corpus reader, text and citation helpers, graph and map layout
  layouts/     the page frame: header, ground line, below ground, footer
  components/  chips, seed tags, author leaf, tree, search
  views/       one file per view
  pages/       the router ([lang]/[...path]), root redirect, 404, search index, sitemap
```

## Status

Version 0.1. Open points are listed on the Method page ("What is not there yet") and in the warnings of `npm run validate`. The licence for the texts and data has not been chosen yet; until it is, all rights are reserved.

---

## En français

Ecosophia cartographie les penseuses et penseurs de l'écologie politique comme un seul arbre : les précurseurs dans les racines, les textes fondateurs dans le tronc, les écoles en branches, les auteurs en feuilles et, dessous, le mycélium, c'est-à-dire le relevé sourcé de qui a influencé, critiqué ou répondu à qui. Le site est bilingue, statique, et publié par GitHub Actions sur GitHub Pages.

**Lancer le site en local.** Node 22.23 ou plus récent, puis `npm install` et `npm run dev`. `npm run build` régénère les jetons de design, valide le corpus et construit le site dans `dist/`.

**Publier.** Dans **Settings › Pages**, choisir **GitHub Actions** comme source (un dépôt privé demande une offre GitHub payante pour Pages), puis pousser sur la branche par défaut. Le workflow ne déploie que depuis cette branche ; ailleurs, il vérifie et construit sans publier.

**Modifier le corpus.** Les données sont des fichiers YAML dans `data/` : un fichier par branche pour les auteurs, `links.yaml` pour le mycélium, `seeds.yaml` pour les concepts. Chaque texte existe en anglais et en français. Chaque graine et chaque lien porte une source : pas de source, pas de lien. Un fait non confirmé reste vide plutôt que deviné ; `npm run validate` liste ce qui manque.

**Sourcé et simulé.** Les citations sont exactes et référencées. La Clairière accueillera des débats simulés entre agents-auteurs ; elle ne montre pour l'instant qu'un spécimen rédigé à la main, étiqueté comme tel.

**État.** Version 0.1. La licence des textes et des données n'est pas encore choisie : d'ici là, tous droits réservés.
