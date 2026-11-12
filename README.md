# Ecosophia

Roots, branches and mycelium of political ecology. *Racines, branches et mycélium de l'écologie politique.*

**Site:** https://mathisdreher.github.io/Ecosophia/ · [En français](#en-français)

Ecosophia maps the thinkers of political ecology as one tree: precursors in the roots, founding texts in the trunk, schools as branches, authors as leaves. Underneath runs the mycelium, the sourced record of who influenced, criticised or answered whom. In the Clearing, agents built from the authors' records debate questions taken from French party programmes, and every word they produce is marked as simulated.

The site is bilingual (English and French) and static. Everything runs in GitHub Actions: checks, build, publication, fact-checking, portraits and simulations.

## What you can do, and where

| Task | How | Needs |
|---|---|---|
| Publish the site | Push to the default branch, or Actions › **Build and deploy** | Settings › Pages › Source: GitHub Actions |
| Add or correct an author, a link, a seed | Edit `data/*.yaml`, push. The build refuses broken references | Nothing |
| Check dates and birthplaces against Wikidata | Actions › **Check facts against Wikidata** (also monthly) | Nothing |
| Draw the portraits | Actions › **Portraits** | Secret `GEMINI_API_KEY` |
| Run a debate in the Clearing | Actions › **Clearing run** | Secret `ANTHROPIC_API_KEY` |
| Publish, unpublish or delete a run | Actions › **Clearing run status** | Nothing |

Secrets go in Settings › Secrets and variables › Actions › New repository secret. Each one is used by a single workflow and never reaches the site.

## The Clearing: simulated debates

A run takes one question, chooses agents among the authors, lets them discuss in [MiroFish](https://github.com/666ghj/MiroFish) (a multi-agent simulation engine built on OASIS) and asks each one for a closing position from 0 (against) to 100 (for). Claude plays the agents through the official Anthropic SDK. The result is stored in `data/clearing/runs/` and the site shows where each school stands, who stood with whom, every closing line, the prompts and the full transcript.

**Start a run.** Actions › Clearing run › Run workflow. Usually only the first field needs filling.

| Input | Default | Meaning |
|---|---|---|
| `claim` | | A question id, or one sentence in English or French. Questions: `nouveau-nucleaire`, `eolien-solaire`, `pesticides`, `voitures-thermiques-2035`, `rail-avion` |
| `agents` | `auto` | `auto`: one Opus call ranks the agents worth hearing on the question (at least one per branch, at most 30) and gives a reason for each. Or `all`, or author and branch ids separated by commas |
| `rounds` | `auto` | Chosen with the agents (1 to 3), or a number from 1 to 8 |
| `budget_usd` | `3` | Spending limit. The plan is cut to fit before anything is spent; a manual choice above it is refused; calls stop at 1.5 times it. `0` for no limit |
| `model` | Opus 5.5 | Model that plays the agents, most of the cost. Opus, Sonnet or Haiku 5.5 |
| `reader_model` | same | Model that writes the summary and the French; two calls |
| `effort` | `medium` | How hard the model thinks on each turn |
| `status` | `draft` | A draft has its own page and is listed nowhere. Publish it afterwards with Clearing run status |
| `dry_run` | off | Whole pipeline with a stand-in model: no key, no cost, nothing stored |

**Cost.** Estimates at list prices, printed before each run; the real cost is reported at the end of the run and on its page. Cost grows faster than the number of agents, because each agent rereads the whole thread every round.

| Run | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| 12 agents, 2 rounds | 0.90 USD | 0.45 USD | 0.03 USD |
| 24 agents, 2 rounds | 1.80 USD | 0.90 USD | 0.05 USD |
| All 80 agents, 3 rounds | 19 USD | 10 USD | 0.50 USD |

A sensible routine: draft each question with `auto` and Sonnet, then rerun on Opus the ones worth publishing.

**Questions, not variants.** `data/clearing/claims.yaml` keeps every quoted party measure (LFI, PCF, Les Écologistes, PS, Ensemble, LR, RN), with its exact wording, document and page. `data/clearing/questions.yaml` gathers the measures that answer the same question, so one run covers all the parties. The run page shows each party's measure and stance next to the agents' positions; the agents themselves only see the question, never a party name.

**What an agent is.** It receives its author's Ecosophia record (summary, seeds, works, sourced threads) and rules: argue from the record, say when the work is silent, never use quotation marks, never speak as the author. It does not read the books, and the model also draws on what it already knows. An author with `agent: false` takes no part; `node clearing/withdraw.mjs <author-id>` removes one from stored runs.

How the pipeline is built, how the API key is kept away from the engine, and how to run it on your own machine: [`clearing/README.md`](clearing/README.md).

## Portraits

Pencil drawings generated with the Gemini image API by `scripts/portraits.mjs`, run from the **Portraits** workflow.

| Input | Default | Meaning |
|---|---|---|
| `authors` | `missing` | Authors without a portrait, or `all`, or author and branch ids |
| `limit` | `5` | Draw at most this many; start small to judge the style |
| `model` | `gemini-nano-banana-2.1` | Gemini image model. List price per image at 1K: 0.034 USD (all 109 images: about 3.70 USD); `gemini-3.1-flash-image` 0.067; `gemini-3-pro-image` 0.134 |
| `seed` | `1912` | Sampling seed, the same for every image |
| `placeholders` | off | Redraw the two leaf drawings used when there is no portrait |

The series stays uniform in four ways. Every prompt uses one fixed style. Every portrait is drawn with the first leaf placeholder attached as a style reference. Every request uses the same sampling seed. And every image goes through the same treatment: 3:2 crop centred on the face, greyscale, levels, paper tint, WebP at 1200 × 800. When the model declines, or an author is marked `portrait: false`, one of the two leaf drawings stands in. `data/portraits.yaml` records which model drew each image and when. The raw images of each run are kept as a workflow artifact for 14 days, for review. To redraw a portrait, delete its line in `data/portraits.yaml` and run the workflow with `missing`.

The portraits are illustrations, not documents: the site labels each one as a generated drawing, and the likeness is not guaranteed.

## The site

| View | Address (en / fr) | What it shows |
|---|---|---|
| Tree | `/en/` · `/fr/` | The branches and their leaves, the trunk, the root groups below the ground line |
| Author | `/en/authors/<id>/` · `/fr/auteurs/<id>/` | Portrait, seeds, a sourced quotation, who they read, who answered, numbered sources |
| Branch | `/en/branches/<id>/` | The leaves of a school and the threads that cross it |
| Mycelium | `/en/mycelium/` | The influence graph, with filters and a table of every link and its source |
| Rings | `/en/rings/` · `/fr/cernes/` | Lifespans and publication dates on one time axis |
| Terrain | `/en/terrain/` | Birthplaces on a world map and a Europe inset |
| Clearing | `/en/clearing/` · `/fr/clairiere/` | The latest published run, the questions and the party positions |
| Clearing run | `/en/clearing/<run>/` · `/fr/clairiere/<run>/` | One run in full, with prompts and transcript |
| Canopy | `/en/canopy/` · `/fr/canopee/` | In preparation: three axes and the rules of placement |
| Seeds, Roots, Trunk, Method, Data | `/en/seeds/` and so on | Concepts, precursors, founding texts, how the map is made |

## The corpus

```text
data/
  authors/*.yaml       one file per branch, plus roots.yaml and trunk.yaml
  branches.yaml        schools, in the order of the tree
  roots.yaml           families of precursors
  links.yaml           the mycelium: from, to, type, note, source
  seeds.yaml           names of the concepts, in both languages
  trunk.yaml           the founding texts
  sources.yaml         secondary sources cited as evidence
  portraits.yaml       which portraits are drawn
  clearing/            specimen.yaml, claims.yaml, questions.yaml, runs/
```

An author:

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
  # agent: false            # never an agent in the Clearing
  # portrait: false         # always the leaf placeholder
```

A link:

```yaml
- from: jacques-ellul
  to: ivan-illich
  type: influenced          # influenced | critiqued | dialogue
  note: {en: "…", fr: "…"}
  source: illich-1993       # no source, no link
  # status: to-verify       # kept off the graph, flagged on the author page
```

The validator (`npm run validate`, run before every build) refuses: an unknown reference, a text missing in one language, a seed or a link without a source, a quotation over twenty-five words or without a citation, more than three seeds, a simulated line in quotation marks, a Clearing run that names a withdrawn agent. It lists as warnings what is still missing: dates, coordinates, Wikidata IDs, authors without any link.

Facts that could not be confirmed are left empty rather than guessed. The **Check facts against Wikidata** workflow compares dates and birthplaces with Wikidata, and proposes IDs for authors who have none, with their dates, for a human to confirm. It changes nothing by itself.

## Run it locally

Node 22.23 or later (CI uses Node 24).

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

Other scripts: `npm run validate`, `npm run test:clearing` (the simulation pipeline against a stand-in engine, no key needed), `npm run clearing -- --dry-run --claim pesticides --engine <MiroFish checkout>`, `npm run portraits -- --dry-run`.

## Project layout

```text
data/          the corpus
design/        tokens.json and the brand book, from the design system
src/
  i18n/        interface strings and the route table (localised addresses)
  lib/         corpus reader, text and citation helpers, graph and map layout
  layouts/     the page frame: header, ground line, below ground, footer
  components/  chips, tree, run board, voices, party positions, search
  views/       one file per view
  pages/       the router, root redirect, 404, search index, sitemap
clearing/      the simulation pipeline: agents, planner, budget, bridge to Claude, reading
scripts/       tokens, validation, link check, Wikidata check, portraits
.github/       workflows and issue forms
```

## Stack

[Astro](https://astro.build) generates plain HTML; a few small scripts handle search, the theme switch, the graph and the timeline. Graph positions (d3-force) and maps (d3-geo) are computed at build time. Fonts are self-hosted; the site sets no cookie and calls no third party. Colours, type and spacing come from `design/tokens.json`; `design/brand.md` is the brand book. Interface strings are in `src/i18n/ui.mjs`; French typography is applied at build time.

## Status

Open points are listed on the Method page ("What is not there yet") and in the warnings of `npm run validate`. The licence of the texts and data is not chosen yet; until it is, all rights are reserved. MiroFish is AGPL-3.0 and is fetched at a pinned commit, never copied into this repository.

---

## En français

Ecosophia cartographie les penseuses et penseurs de l'écologie politique comme un seul arbre : précurseurs dans les racines, textes fondateurs dans le tronc, écoles en branches, auteurs en feuilles et, dessous, le mycélium, relevé sourcé de qui a influencé, critiqué ou répondu à qui. Dans la Clairière, des agents construits à partir des fiches des auteurs débattent de questions tirées des programmes des partis français ; tout ce qu'ils produisent est marqué « Simulé ». Le site est bilingue, statique, et tout tourne dans GitHub Actions.

**Ce que l'on peut faire, et où.**

| Tâche | Comment | Prérequis |
|---|---|---|
| Publier le site | Pousser sur la branche par défaut, ou Actions › **Build and deploy** | Settings › Pages › Source : GitHub Actions |
| Corriger ou ajouter un auteur, un lien, une graine | Modifier `data/*.yaml` et pousser ; la construction refuse les références cassées | Rien |
| Vérifier dates et lieux avec Wikidata | Actions › **Check facts against Wikidata** (aussi chaque mois) | Rien |
| Dessiner les portraits | Actions › **Portraits** | Secret `GEMINI_API_KEY` |
| Lancer un débat dans la Clairière | Actions › **Clearing run** | Secret `ANTHROPIC_API_KEY` |
| Publier, dépublier ou supprimer une simulation | Actions › **Clearing run status** | Rien |

**Lancer un débat.** Dans le champ `claim`, saisir l'identifiant d'une question (`nouveau-nucleaire`, `eolien-solaire`, `pesticides`, `voitures-thermiques-2035`, `rail-avion`) ou une affirmation en une phrase. Par défaut, Opus choisit les agents et le nombre de tours, et le plan est réduit pour tenir dans un budget de 3 USD. Coût indicatif : 12 agents sur 2 tours, environ 0,90 USD avec Opus, 0,45 USD avec Sonnet, 0,03 USD avec Haiku. La simulation est enregistrée comme brouillon ; après relecture, Actions › **Clearing run status** la publie.

**Portraits.** Des dessins au crayon générés avec l'API d'images Gemini, dans un style unique, puis traités de la même façon (recadrage, gris, niveaux, teinte papier). Faute de portrait, un dessin de feuille en tient lieu. Le site présente chaque portrait comme un dessin généré, et non comme une photographie.

**Données.** Les fichiers YAML de `data/` sont la seule source. Chaque texte existe en anglais et en français ; chaque graine et chaque lien porte une source ; un fait non confirmé reste vide plutôt que deviné.
