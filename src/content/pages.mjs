// Long-form text of the Method and Data pages, in both languages. Numbers are
// filled from the corpus at build time so that the pages never drift from it.

export function corpusStats(c, clearing) {
  const roots = c.authors.filter((a) => a.layer === 'root').length;
  const trunk = c.authors.filter((a) => a.layer === 'trunk').length;
  const leaves = c.authors.filter((a) => a.layer === 'leaf').length;
  const linked = new Set(c.sourcedLinks.flatMap((l) => [l.from, l.to]));
  return {
    authors: c.authors.length,
    roots,
    trunk,
    leaves,
    branches: c.treeBranches.length,
    rootGroups: c.rootGroups.length,
    seeds: Object.values(c.seeds).filter((s) => s.carriers.length > 0).length,
    links: c.sourcedLinks.length,
    toVerify: c.links.length - c.sourcedLinks.length,
    sources: c.sources.size,
    withQid: c.authors.filter((a) => a.wikidata).length,
    undated: c.authors.filter((a) => a.born == null).length,
    unlocated: c.authors.filter((a) => a.place?.lat == null).length,
    isolated: c.authors.filter((a) => !linked.has(a.id)).length,
    quotes: c.authors.filter((a) => a.quote).length,
    runs: clearing?.published.length ?? 0,
  };
}

export function methodPage(lang, s, { repoPublic }) {
  if (lang === 'fr') {
    return {
      title: 'Méthode',
      lede: "Comment la carte est faite, ce qu'elle affirme et ce qu'elle n'affirme pas.",
      sections: [
        {
          id: 'tree',
          h: "L'arbre et le mycélium",
          p: [
            "Ecosophia est une carte des penseuses et penseurs de l'écologie politique, dessinée comme un seul arbre. Les précurseurs en sont les racines, les textes fondateurs de 1962 à 1975 le tronc, les écoles les branches, les auteurs les feuilles et les concepts les graines. Dessous court le mycélium : le relevé sourcé de qui a influencé, critiqué ou répondu à qui.",
            "L'arbre donne aux nouveaux venus une structure lisible, mais un arbre ordonne et fait descendre : il cache que Bookchin a lu Kropotkine, que Gorz et Illich se répondaient, que Latouche vient d'Ellul autant que de Georgescu-Roegen. Le mycélium montre ces liens que l'arbre, seul, tiendrait séparés. Les deux sont toujours présentés ensemble.",
          ],
        },
        {
          id: 'corpus',
          h: 'Le corpus',
          p: [
            `Le corpus compte ${s.authors} auteurs : ${s.roots} précurseurs répartis en ${s.rootGroups} groupes de racines, ${s.trunk} auteurs de textes fondateurs qui ne siègent sur aucune branche, et ${s.leaves} feuilles sur ${s.branches} branches, auxquelles s'ajoute une greffe de contrepoints.`,
            "C'est une première sélection, non un canon. Elle penche vers les auteurs qui ont écrit en français et en anglais, et vers l'Europe et l'Amérique du Nord : la vue Terrain rend ce biais visible. L'objectif est que chaque auteur soit relié aux autres par au moins un lien sourcé.",
            `À ce jour, ${s.isolated} auteurs ne le sont pas encore.`,
          ],
        },
        {
          id: 'sources',
          h: 'Les sources',
          p: [
            `Chaque graine, chaque citation et chaque lien renvoie à une œuvre publiée : ${s.sources} œuvres sont référencées. Les références sont données au niveau de l'œuvre ; les numéros de page s'ajoutent à mesure que les passages sont vérifiés. Les titres restent dans leur langue d'origine.`,
            `Un lien sans source n'est pas tracé. ${s.toVerify} liens attendent une référence : ils n'apparaissent que sur les pages des auteurs, signalés « source à vérifier », et restent hors du graphe.`,
            `Chaque auteur est rattaché à une entrée Wikidata lorsqu'elle a pu être identifiée (${s.withQid} sur ${s.authors}). Les années de naissance et de mort et les lieux de naissance ont été saisis à la main et sont comparés à Wikidata par un script du dépôt. Lorsqu'un fait n'a pas pu être confirmé, il a été laissé de côté plutôt que deviné : ${s.undated} auteurs n'ont pas encore de dates et ${s.unlocated} pas encore de lieu sur la carte.`,
          ],
        },
        {
          id: 'schools',
          h: 'Les écoles sont éditoriales',
          p: [
            "Où commence et où finit une branche relève d'un choix. Un auteur qui a plusieurs affiliations est placé sur la branche où il est le plus connu, et les autres sont indiquées comme secondaires. L'ordre des branches suit le dessin de l'arbre, non un mérite : la carte décrit, elle ne classe pas.",
          ],
          list: [
            "Political ecology désigne la discipline universitaire née dans la géographie et l'anthropologie anglophones. Le terme anglais est conservé en français pour ne pas la confondre avec l'écologie politique au sens large, qui est l'objet de toute la carte.",
            "La technocritique rassemble, de Mumford à Gorz, des auteurs que d'autres rangeraient dans la décroissance ou l'écosocialisme.",
            "Morizot figure sur la branche Écosophie, par choix de rapprocher sa diplomatie du vivant de l'écosophie de Næss et de Guattari.",
            "Les contrepoints sont greffés sur l'arbre parce que le champ discute avec eux, non parce qu'ils lui appartiennent.",
          ],
        },
        {
          id: 'threads',
          h: 'Trois sortes de fils',
          list: [
            "Influence, en trait plein : le fil va de celui qui a influencé vers celui qui a reçu.",
            'Critique, en tirets : le fil va de celui qui critique vers celui qui est critiqué.',
            "Dialogue, en pointillés : les deux se sont répondu, ou ont écrit ensemble.",
          ],
          p2: [
            "Les fils sont tracés d'une seule couleur : le mycélium n'appartient à personne. Sur le graphe, une feuille grandit avec le nombre d'influences sourcées qu'elle a reçues. Cette taille mesure l'état du corpus, non l'importance d'un auteur.",
          ],
        },
        {
          id: 'simulated',
          h: 'Sourcé et simulé',
          p: [
            "Deux sortes de paroles paraissent sur Ecosophia, et elles ne se mélangent jamais. Les paroles sourcées sont des citations et des paraphrases de textes publiés, marquées « Sourcé » et référencées. Les paroles simulées sont produites par des agents-auteurs dans la Clairière : elles sont marquées « Simulé », entourées d'un trait en tirets, jamais mises entre guillemets et jamais introduites par « a dit ».",
            "Une simulation de la Clairière est faite avec MiroFish, un moteur libre de simulation multi-agents construit sur OASIS. Chaque feuille de l'arbre devient un agent qui reçoit la fiche Ecosophia de son auteur : le résumé, les graines, la liste des œuvres et les fils sourcés. Les agents discutent l'affirmation pendant quelques tours sur un fil de discussion simulé, puis chacun donne une position de 0 à 100 et une dernière ligne. Le modèle est Claude ; un second passage du même modèle regroupe les agents en alliances et traduit les dernières lignes.",
            "Un agent ne lit pas les livres, et le modèle qui l'anime s'appuie aussi sur ce qu'il sait déjà de l'auteur. Une simulation est un tirage : la même affirmation, simulée deux fois, donne d'autres chiffres. Chaque simulation est publiée avec ses prompts, son modèle, ses réglages et sa transcription complète. Les agents d'auteurs vivants portent un avertissement et sont retirés sur demande.",
            s.runs > 0 ? `${s.runs} simulation${s.runs > 1 ? 's sont publiées' : ' est publiée'} à ce jour.` : "Aucune simulation n'est encore publiée : la Clairière montre pour l'instant un spécimen rédigé à la main, étiqueté comme tel.",
          ],
        },
        {
          id: 'quotes',
          h: 'Citations et traductions',
          p: [
            `Les citations sont exactes, comptent moins de vingt-cinq mots et sont données dans la langue de l'édition citée. Le site en compte ${s.quotes}. Lorsque la page est lue dans une autre langue, une traduction suit, signalée comme la nôtre.`,
          ],
        },
        {
          id: 'portraits',
          h: 'Portraits et couleurs',
          p: [
            "Les portraits sont des dessins au crayon générés par un modèle d'image à partir de ce qu'il connaît des photographies publiques de l'auteur. Ce sont des illustrations, non des documents : chacun est signalé comme tel, tous reçoivent le même traitement pour former une série homogène, et la ressemblance n'est pas garantie. Quand le modèle refuse ou qu'un auteur ou ses ayants droit le demandent, une image de feuille tient lieu de portrait.",
            "Les couleurs de branche identifient les écoles et ne paraissent jamais sans le nom de la branche : douze teintes ne se distinguent pas par la couleur seule. Les noms, les pastilles et les tableaux portent la même information.",
          ],
        },
        {
          id: 'corrections',
          h: 'Corrections',
          p: [
            repoPublic
              ? "Les erreurs arrivent. Chaque page d'auteur liste ses sources pour que chaque affirmation puisse être vérifiée, et un lien « Signaler une erreur » ouvre une demande de correction dans le dépôt du projet."
              : "Les erreurs arrivent. Chaque page d'auteur liste ses sources pour que chaque affirmation puisse être vérifiée. Un circuit public de correction ouvrira avec le dépôt du projet.",
          ],
        },
        {
          id: 'next',
          h: "Ce qui n'y est pas encore",
          list: [
            'Les placements de la Canopée pour les autres feuilles, et les pages précises des premières lectures.',
                        "Les lieux de travail et d'exil sur le Terrain.",
            'Les références à la page pour chaque graine et chaque lien.',
            'Les capsules vidéo de quatre-vingt-dix secondes.',
            ...(s.runs > 0 ? [] : ['Les premières simulations de la Clairière.']),
          ],
        },
      ],
    };
  }
  return {
    title: 'Method',
    lede: 'How the map is made, what it claims and what it does not.',
    sections: [
      {
        id: 'tree',
        h: 'The tree and the mycelium',
        p: [
          'Ecosophia is a map of the thinkers of political ecology, drawn as one tree. Precursors are the roots, the founding texts of 1962 to 1975 are the trunk, schools are branches, authors are leaves and concepts are seeds. Underneath runs the mycelium: the sourced record of who influenced, criticised or answered whom.',
          'The tree gives newcomers a structure they can read, but a tree orders and descends: it hides that Bookchin read Kropotkin, that Gorz and Illich answered each other, that Latouche comes from Ellul as much as from Georgescu-Roegen. The mycelium shows the links that the tree alone would keep apart. The two are always shown together.',
        ],
      },
      {
        id: 'corpus',
        h: 'The corpus',
        p: [
          `The corpus holds ${s.authors} authors: ${s.roots} precursors in ${s.rootGroups} root groups, ${s.trunk} authors of founding texts who sit on no branch, and ${s.leaves} leaves on ${s.branches} branches, plus one graft of counterpoints.`,
          'It is a first selection, not a canon. It leans toward authors who wrote in French and English, and toward Europe and North America: the Terrain view makes that bias visible. The aim is that every author be tied to the others by at least one sourced link.',
          `To date, ${s.isolated} authors are not yet.`,
        ],
      },
      {
        id: 'sources',
        h: 'Sources',
        p: [
          `Every seed, quotation and link points to a published work: ${s.sources} works are referenced. Citations are given at the level of the work; page references are added as passages are checked. Titles stay in their original language.`,
          `A link without a source is not drawn. ${s.toVerify} links wait for a reference: they appear only on the author pages, flagged “source to verify”, and stay off the graph.`,
          `Each author is tied to a Wikidata item where one could be identified (${s.withQid} of ${s.authors}). Years of birth and death and birthplaces were entered by hand and are compared with Wikidata by a script in the repository. Where a fact could not be confirmed it was left out rather than guessed: ${s.undated} authors have no dates yet and ${s.unlocated} have no place on the map yet.`,
        ],
      },
      {
        id: 'schools',
        h: 'Schools are editorial',
        p: [
          'Where a branch begins and ends is a choice. An author with several affiliations is placed on the branch they are best known for, and the others are listed as secondary. The order of the branches follows the drawing of the tree, not merit: the map describes, it does not rank.',
        ],
        list: [
          'Political ecology names the academic discipline born in anglophone geography and anthropology. In French the English term is kept, to tell it from écologie politique in the broad sense, which is the subject of the whole map.',
          'Technocritique gathers authors, from Mumford to Gorz, whom others would file under degrowth or ecosocialism.',
          'Morizot stands on the Ecosophy branch, a choice that sets his diplomacy with the living beside the ecosophies of Næss and Guattari.',
          'Counterpoints are grafted onto the tree because the field argues with them, not because they belong to it.',
        ],
      },
      {
        id: 'threads',
        h: 'Three kinds of thread',
        list: [
          'Influence, a solid line: the thread runs from the one who influenced to the one who received.',
          'Critique, a dashed line: the thread runs from the critic to the one criticised.',
          'Dialogue, a dotted line: the two answered each other, or wrote together.',
        ],
        p2: [
          'Threads are drawn in one colour: the mycelium belongs to no one. On the graph, a leaf grows with the number of sourced influences it received. That size measures the state of the corpus, not the importance of an author.',
        ],
      },
      {
        id: 'simulated',
        h: 'Sourced and simulated',
        p: [
          'Two kinds of words appear on Ecosophia and they are never mixed. Sourced words are quotations and paraphrases of published texts, marked “Sourced” and cited. Simulated words are produced by author-agents in the Clearing: they are marked “Simulated”, outlined with a dashed line, never set in quotation marks and never introduced by “said”.',
          'A run of the Clearing is made with MiroFish, an open-source multi-agent simulation engine built on OASIS. Each leaf of the tree becomes an agent that receives the Ecosophia record of its author: the summary, the seeds, the list of works and the sourced threads. The agents discuss the claim for a few rounds on a simulated discussion thread, then each gives a position from 0 to 100 and one closing line. The model is Claude; a second pass by the same model groups the agents into alliances and translates the closing lines.',
          'An agent does not read the books, and the model behind it also draws on what it already knows of the author. A run is one draw: the same claim, run twice, gives other numbers. Each run is published with its prompts, its model, its settings and its full transcript. Agents of living authors carry a notice and are withdrawn on request.',
          s.runs > 0 ? `${s.runs} run${s.runs > 1 ? 's are' : ' is'} published so far.` : 'No run has been published yet: for now the Clearing shows a specimen written by hand and labelled as such.',
        ],
      },
      {
        id: 'quotes',
        h: 'Quotations and translations',
        p: [
          `Quotations are verbatim, under twenty-five words, and given in the language of the edition cited. The site holds ${s.quotes} of them. When the page is read in another language, a translation follows, marked as ours.`,
        ],
      },
      {
        id: 'portraits',
        h: 'Portraits and colour',
        p: [
          "Portraits are pencil drawings generated by an image model from what it knows of the author's public photographs. They are illustrations, not documents: each is labelled as such, all receive the same treatment so that they form one series, and the likeness is not guaranteed. When the model declines, or when an author or their estate asks, a drawing of a leaf stands in for the portrait.",
          'Branch colours identify schools and never appear without the name of the branch: twelve hues cannot be told apart by colour alone. Names, chips and tables carry the same information.',
        ],
      },
      {
        id: 'corrections',
        h: 'Corrections',
        p: [
          repoPublic
            ? 'Errors happen. Each author page lists its sources so that every claim can be checked, and a “Report an error” link opens a correction request in the project repository.'
            : 'Errors happen. Each author page lists its sources so that every claim can be checked. A public route for corrections will open with the project repository.',
        ],
      },
      {
        id: 'next',
        h: 'What is not there yet',
        list: [
          'Canopy placements for the other leaves, and page references for the first readings.',
          'Places of work and exile on the Terrain.',
          'Page references for every seed and every link.',
          'The ninety-second video capsules.',
          ...(s.runs > 0 ? [] : ['The first runs of the Clearing.']),
        ],
      },
    ],
  };
}

export function dataPage(lang, s) {
  const files = [
    ['data/authors/*.yaml', { en: 'One file per branch, plus roots and trunk. An author record holds dates, place, Wikidata QID, lede, seeds, an optional quotation and works.', fr: 'Un fichier par branche, plus les racines et le tronc. Une fiche auteur contient les dates, le lieu, le QID Wikidata, le chapeau, les graines, une citation éventuelle et les œuvres.' }],
    ['data/links.yaml', { en: 'The mycelium: from, to, type of thread, what passed, and the source.', fr: 'Le mycélium : de, vers, type de fil, ce qui est passé, et la source.' }],
    ['data/seeds.yaml', { en: 'The names of the concepts, in both languages.', fr: 'Les noms des concepts, dans les deux langues.' }],
    ['data/branches.yaml, data/roots.yaml', { en: 'Schools and root groups, in the order of the tree.', fr: "Les écoles et les groupes de racines, dans l'ordre de l'arbre." }],
    ['data/trunk.yaml', { en: 'The founding texts.', fr: 'Les textes fondateurs.' }],
    ['data/sources.yaml', { en: 'Secondary sources cited as evidence.', fr: 'Les sources secondaires citées comme preuves.' }],
    ['data/canopy.yaml', { en: 'Canopy placements: author, axis, score from 0 to 100, the work it rests on and the reason in a sentence.', fr: "Les placements de la Canopée : auteur, axe, score de 0 à 100, l'œuvre sur laquelle il repose et la raison en une phrase." }],
    ['data/clearing/', { en: 'Party measures quoted with their source, the questions and axioms put to the agents, and the stored runs with their transcripts.', fr: 'Les mesures des partis citées avec leur source, les questions et axiomes soumis aux agents, et les simulations enregistrées avec leur transcription.' }],
    ['design/tokens.json', { en: 'Colour, type, space and stroke tokens of the design system.', fr: "Les jetons de couleur, de typographie, d'espace et de trait du système de design." }],
  ];
  const numbers =
    lang === 'fr'
      ? [
          [s.authors, 'auteurs'],
          [s.branches, 'branches'],
          [s.rootGroups, 'groupes de racines'],
          [s.seeds, 'graines'],
          [s.links, 'fils sourcés'],
          [s.sources, 'œuvres référencées'],
        ]
      : [
          [s.authors, 'authors'],
          [s.branches, 'branches'],
          [s.rootGroups, 'root groups'],
          [s.seeds, 'seeds'],
          [s.links, 'sourced threads'],
          [s.sources, 'works referenced'],
        ];
  if (lang === 'fr') {
    return {
      title: 'Données et licence',
      lede: "Où vivent les données, d'où viennent les éléments tiers et ce que vous pouvez en faire.",
      numbers,
      files: files.map(([f, d]) => [f, d.fr]),
      filesHead: ['Fichier', 'Contenu'],
      sections: [
        {
          id: 'where',
          h: 'Où vivent les données',
          p: [
            "Le corpus est un ensemble de fichiers YAML lisibles, conservés dans le dépôt du site. Le site est reconstruit à partir de ces fichiers à chaque modification, après qu'un script a vérifié chaque référence : un auteur inconnu, une source manquante ou une citation trop longue font échouer la construction.",
          ],
          files: true,
        },
        {
          id: 'third',
          h: 'Éléments tiers',
          list: [
            'Les identifiants viennent de Wikidata (CC0).',
            'Les traits de côte de la vue Terrain viennent de Natural Earth (domaine public), via le paquet world-atlas.',
            'Les caractères sont Fraunces, Instrument Sans et IBM Plex Mono, sous licence SIL Open Font License, servis depuis ce site.',
          ],
        },
        {
          id: 'privacy',
          h: 'Vie privée',
          p: [
            "Ce site ne dépose aucun cookie et ne charge rien depuis un tiers : ni police distante, ni mesure d'audience. Vos choix de thème et de langue sont enregistrés dans votre navigateur, et nulle part ailleurs.",
          ],
        },
        {
          id: 'licence',
          h: 'Licence',
          p: [
            "La licence des textes et des données propres à Ecosophia n'a pas encore été choisie. D'ici là, tous droits réservés. Les citations restent la propriété de leurs auteurs et de leurs éditeurs ; elles sont reproduites au titre de la courte citation, avec leur source.",
            'Un export téléchargeable du corpus suivra lorsque la licence sera fixée.',
          ],
        },
      ],
    };
  }
  return {
    title: 'Data and licence',
    lede: 'Where the data lives, where third-party material comes from, and what you may do with it.',
    numbers,
    files: files.map(([f, d]) => [f, d.en]),
    filesHead: ['File', 'Holds'],
    sections: [
      {
        id: 'where',
        h: 'Where the data lives',
        p: [
          'The corpus is a set of plain YAML files kept in the repository of the site. The site is rebuilt from these files at every change, after a script has checked every reference: an unknown author, a missing source or a quotation that runs too long stops the build.',
        ],
        files: true,
      },
      {
        id: 'third',
        h: 'Third-party material',
        list: [
          'Identifiers come from Wikidata (CC0).',
          'Coastlines on the Terrain view come from Natural Earth (public domain), through the world-atlas package.',
          'The typefaces are Fraunces, Instrument Sans and IBM Plex Mono, under the SIL Open Font License, served from this site.',
        ],
      },
      {
        id: 'privacy',
        h: 'Privacy',
        p: [
          'This site sets no cookie and loads nothing from a third party: no remote font, no analytics. Your choices of theme and language are stored in your browser and nowhere else.',
        ],
      },
      {
        id: 'licence',
        h: 'Licence',
        p: [
          "The licence for Ecosophia's own texts and data has not been chosen yet. Until it is, all rights are reserved. Quotations remain the property of their authors and publishers; they are reproduced as short quotations, with their source.",
          'A downloadable export of the corpus will follow once the licence is set.',
        ],
      },
    ],
  };
}
