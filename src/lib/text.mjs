// Text helpers shared by the site and the scripts: language picking,
// typography and citation formatting.

const NBSP = ' ';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Typographic apostrophes in every language; French spacing before : ; ? ! and inside « ». */
export function typo(s, lang = 'en') {
  if (typeof s !== 'string') return s;
  let out = s.replace(/(\p{L})'(?=\p{L})/gu, '$1’').replace(/(\p{L})'(?=[\s,.;:)]|$)/gu, '$1’');
  if (lang === 'fr') {
    out = out
      .replace(/ ([:;?!»])/g, `${NBSP}$1`)
      .replace(/« /g, `«${NBSP}`)
      .replace(/(\d) (%|€)/g, `$1${NBSP}$2`);
  }
  return out;
}

/** Picks the language of a {en, fr} field (or passes a plain string through). */
export function L(value, lang = 'en') {
  if (value == null) return '';
  if (typeof value === 'string') return typo(value, lang);
  return typo(value[lang] ?? value.en ?? '', lang);
}

export function yearLabel(w) {
  return w.to ? `${w.year}–${w.to}` : String(w.year);
}

function quoteTitle(title, lang) {
  return lang === 'fr' ? `«${NBSP}${title}${NBSP}»` : `“${title}”`;
}

const QUOTED_KINDS = new Set(['article', 'chapter', 'talk']);

/** The title of a work as HTML: italics for books and reports, quotation marks for articles. */
export function titleHtml(w, lang = 'en') {
  const raw = typeof w.title === 'string' ? w.title : (w.title[lang] ?? w.title.en);
  const title = escapeHtml(typo(raw, lang));
  if (w.kind === 'letter') return title;
  if (QUOTED_KINDS.has(w.kind)) return quoteTitle(title, lang);
  return `<i>${title}</i>`;
}

/**
 * A citation as HTML: Næss, “The Shallow and the Deep…”, <i>Inquiry</i> 16 (1973).
 * `by` is the short author form unless the work declares its own (co-authored works).
 */
export function citeHtml(w, lang = 'en', { withAuthor = true, locator } = {}) {
  if (!w) return '';
  const parts = [];
  if (withAuthor) {
    const by = w.secondary ? L(w.by, lang) : w.by ? L(w.by, lang) : typo(w.short ?? '', lang);
    if (by) parts.push(escapeHtml(by));
  }
  let main = titleHtml(w, lang);
  if (w.in) {
    const container = `<i>${escapeHtml(typo(w.in, lang))}</i>`;
    const issue = w.issue ? ` ${escapeHtml(w.issue)}` : '';
    main += w.kind === 'chapter' ? `, ${lang === 'fr' ? 'dans' : 'in'} ${container}` : `, ${container}${issue}`;
  }
  if (w.kind !== 'letter') main += ` (${yearLabel(w)})`;
  parts.push(main);
  if (w.tr && (w.tr[lang] ?? w.tr.en)) parts.push(`[${escapeHtml(typo(w.tr[lang] ?? w.tr.en, lang))}]`);
  // Co-authored works name their authors in `by`, so the "with …" note would repeat them.
  if (w.note && !w.by) parts.push(escapeHtml(L(w.note, lang)));
  if (locator) {
    const loc = String(locator);
    if (/^\d/.test(loc)) parts.push(`${/[–-]/.test(loc) ? 'pp.' : 'p.'}${NBSP}${escapeHtml(loc)}`);
    else parts.push(quoteTitle(escapeHtml(typo(loc, lang)), lang));
  }
  return parts.join(', ').replace(/, \[/g, ' [');
}

/** Same citation without markup, for search and for plain-text contexts. */
export function citeText(w, lang = 'en', opts = {}) {
  return citeHtml(w, lang, opts)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Lower-cased, accent-free form for search matching. */
export function fold(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'o')
    .replace(/œ/gi, 'oe')
    .toLowerCase();
}
