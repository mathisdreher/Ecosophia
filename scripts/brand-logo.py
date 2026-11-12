#!/usr/bin/env python3
"""Builds the rooted-wordmark logo family in public/brand from one drawing.

The wordmark is the outlined Fraunces "Ecosophia" of the previous lockup. It
stands on the ground line; the p runs through it, and roots grow from the p,
joined at their tips by fine moss threads (the mycelium). Two sprouts rise
from the E and the i. Run: python3 scripts/brand-logo.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = ROOT / 'design' / 'previous-logo' / 'handdrawn'  # superseded by the Gemini drawing, see scripts/brand-install.mjs
BRAND.mkdir(parents=True, exist_ok=True)
# The outlined Fraunces wordmark, kept from the first lockup.
src = (ROOT / 'design' / 'wordmark-source.svg').read_text()
WORD = re.search(r'<path d="(M74\.08[^"]+)"', src).group(1)
E_GLYPH = WORD.split(' M117.2')[0]  # first glyph: the E

INK, CREAM = '#2a2219', '#ece6d8'
MOSS, MOSS_NIGHT = '#3d5a2a', '#8fae6a'

# Geometry, in a 200 x 80 box: the wordmark is moved by (-70, 12).
TX, TY = -70, 12
GROUND = 'M2 44H198'
ROOTS = [  # from the p: one tap root, two main roots, their offshoots
    ('M118.8 52C118.6 58 117 64 114 72', 1.9),
    ('M118.6 54.5C112 56 104 59 97 66', 1.6),
    ('M118.9 54.5C126 56 134 59 140 66', 1.6),
    ('M108 57.2C100 57.6 92 59.5 86 63', 1.1),
    ('M130 57.2C138 57.6 146 59.5 152 63', 1.1),
    ('M97 66C93 68 89 70 84 70.5', 1.0),
    ('M140 66C144 68 148 70 153 70.5', 1.0),
    ('M116.6 62.5C113 66 108 69.5 104 72', 1.0),
    ('M118.2 60.5C121 65 124 69.5 127 73', 1.0),
]
THREADS = ['M84 70.5Q94 77 104 72', 'M127 73Q141 78 153 70.5', 'M86 63Q84 66.5 84 70.5', 'M152 63Q154 66.5 153 70.5']
TIPS = [(86, 63), (84, 70.5), (104, 72), (114, 72), (127, 73), (152, 63), (153, 70.5)]
def sprout(x, y, s=1.0):
    """A stem from (x, y) with two leaves, scaled by s."""
    p = lambda dx, dy: f'{x+dx*s:.2f} {y+dy*s:.2f}'
    stem = f'M{p(0,0)}Q{p(0.3,-4)} {p(1.2,-7)}'
    left = f'M{p(0.6,-4.6)}C{p(-2.6,-4.4)} {p(-5.2,-6.6)} {p(-5.6,-10.2)}C{p(-2.2,-10.2)} {p(0.2,-8)} {p(0.6,-4.6)}Z'
    right = f'M{p(1.2,-7)}C{p(1.6,-10.4)} {p(4.4,-12.6)} {p(8,-12.6)}C{p(7.8,-9.2)} {p(5,-7)} {p(1.2,-7)}Z'
    return stem, left + right
SPROUTS = [sprout(9.2, 14.8, 0.95), sprout(167.7, 13.4, 0.8)]

def logo(ink, moss, title='Ecosophia', mono=False):
    leaf = ink if mono else moss
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>{title}</title>']
    out.append(f'<path d="{GROUND}" stroke="{ink}" stroke-width="2.75"/>')
    out.append(f'<g transform="translate({TX} {TY})"><path d="{WORD}" fill="{ink}"/></g>')
    for d, w in ROOTS:
        out.append(f'<path d="{d}" stroke="{ink}" stroke-width="{w}"/>')
    out.append(f'<path d="{" ".join(THREADS)}" stroke="{leaf}" stroke-width="0.8"/>')
    out.append(f'<g fill="{leaf}">' + ''.join(f'<circle cx="{x}" cy="{y}" r="1.6"/>' for x, y in TIPS) + '</g>')
    for stem, leaves in SPROUTS:
        out.append(f'<path d="{stem}" stroke="{leaf}" stroke-width="1.3"/><path d="{leaves}" fill="{leaf}"/>')
    out.append('</svg>')
    return ''.join(out)

def mark(ink, moss, mono=False, size=64, title='Ecosophia mark'):
    """The E on its ground line, a sprout on top and three roots below."""
    leaf = ink if mono else moss
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>{title}</title>']
    # E glyph spans x 74.08..97.56, y 1.8..31.34 in source units; scaled 1.25,
    # centred, its baseline on the ground line.
    out.append(f'<g transform="translate(-75.3 12.75) scale(1.25)"><path d="{E_GLYPH}" fill="{ink}"/></g>')
    out.append(f'<path d="M8 52H56" stroke="{ink}" stroke-width="3"/>')
    out.append(f'<path d="M25.5 53V56Q25 59.5 19 61.5M25.5 55Q29.5 58.5 35 60.5M25.6 56.5Q26.5 59.5 25 62.5" stroke="{ink}" stroke-width="1.8"/>')
    out.append(f'<g fill="{leaf}"><circle cx="19" cy="61.5" r="1.8"/><circle cx="35" cy="60.5" r="1.8"/><circle cx="25" cy="62.5" r="1.5"/></g>')
    stem, leaves = sprout(21.2, 15.2, 0.95)
    out.append(f'<path d="{stem}" stroke="{leaf}" stroke-width="1.6"/><path d="{leaves}" fill="{leaf}"/>')
    out.append('</svg>')
    return ''.join(out)

def tile(bg, ink, moss, size=512, radius=112):
    """App icon: the mark on a square tile."""
    inner = mark(ink, moss).split('>', 1)[1].rsplit('</svg>', 1)[0]
    inner = re.sub(r'<title>.*?</title>', '', inner)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}"><title>Ecosophia</title>'
            f'<rect width="64" height="64" rx="{radius*64/size:.2f}" fill="{bg}"/><g transform="translate(6.4 5.2) scale(0.8)" fill="none" stroke-linecap="round" stroke-linejoin="round">{inner}</g></svg>')

files = {
    'ecosophia-logo.svg': logo(INK, MOSS),
    'ecosophia-logo-night.svg': logo(CREAM, MOSS_NIGHT),
    'ecosophia-logo-mono-bark.svg': logo(INK, MOSS, mono=True),
    'ecosophia-logo-mono-cream.svg': logo(CREAM, MOSS_NIGHT, mono=True),
    'ecosophia-logo-mono-moss.svg': logo(MOSS, MOSS, mono=True),
    'ecosophia-e-mark.svg': mark(INK, MOSS),
    'ecosophia-e-mark-night.svg': mark(CREAM, MOSS_NIGHT),
    'ecosophia-e-mark-mono.svg': mark(INK, MOSS, mono=True),
    'ecosophia-app-icon.svg': tile('#f3eee3', INK, MOSS),
    'ecosophia-app-icon-moss.svg': tile(MOSS, '#f3eee3', '#cfe0b4'),
    'ecosophia-app-icon-night.svg': tile('#16201a', CREAM, MOSS_NIGHT),
}
for name, svg in files.items():
    (BRAND / name).write_text(svg)
(BRAND / 'favicon.svg').write_text(mark(INK, MOSS).replace('<title>Ecosophia mark</title>', '<title>Ecosophia</title><style>@media (prefers-color-scheme: dark){path[fill="#2a2219"],path[stroke="#2a2219"]{fill:#ece6d8;stroke:#ece6d8}path[fill="#2a2219"]{stroke:none}}</style>'))
print('\n'.join(files))
