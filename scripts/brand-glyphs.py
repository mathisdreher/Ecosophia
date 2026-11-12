#!/usr/bin/env python3
"""Draws the Ecosophia glyphs: concept and interface glyphs in public/glyphs,
one emblem per branch in public/glyphs/branches. 24px grid, 1.75 stroke,
round caps, single ink. Run: python3 scripts/brand-glyphs.py"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
INK = '#2a2219'

def svg(title, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" '
            f'stroke="{INK}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><title>{title}</title>{body}</svg>')
P = lambda d, extra='': f'<path d="{d}"{extra}/>'
C = lambda x, y, r, extra='': f'<circle cx="{x}" cy="{y}" r="{r}"{extra}/>'
FILL = f' fill="{INK}" stroke="none"'

GLYPHS = {
    'canopy': ('Canopy: positions on three axes', P('M5.5 14a4 4 0 0 1 1.6-7.6 5.2 5.2 0 0 1 9.8 0A4 4 0 0 1 18.5 14z') + P('M12 14v6.5M8.5 20.5h7') + C(9.5, 10.5, 0.9, FILL) + C(14.5, 9.5, 0.9, FILL)),
    'terrain': ('Terrain: birthplaces', P('M12 20.5s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z') + C(12, 10.5, 2.2) + P('M4 20.5h16')),
    'sourced': ('Sourced: from a published text', P('M6 3.5h8.5l3.5 3.5v13.5H6z') + P('M14.5 3.5V7H18') + P('M9 11.5h6M9 15h4')),
    'simulated': ('Simulated: said by an agent', P('M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4 3.5v-3.5H6.5a2 2 0 0 1-2-2z', ' stroke-dasharray="2.2 2.4"')),
    'work': ('Work: a book', P('M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13')),
    'programme': ('Programme: a party measure', P('M4.5 12.5h15v7h-15z') + P('M8 12.5V4.5h8v8') + P('M10 8.5l1.5 1.5 3-3')),
    'axiom': ('Axiom: a claim that splits the schools', P('M12 21v-7M12 14 6.5 7.5M12 14l5.5-6.5') + C(6, 5.5, 1.8) + C(18, 5.5, 1.8)),
    'portrait': ('Portrait: a generated drawing', P('M4 6.5A2.5 2.5 0 0 1 6.5 4H20v13.5a2.5 2.5 0 0 1-2.5 2.5H4z') + C(12, 10, 2.5) + P('M7.5 18c1-2.4 2.8-3.4 4.5-3.4s3.5 1 4.5 3.4')),
    'search': ('Search', C(10.5, 10.5, 6) + P('M15 15l5 5')),
    'download': ('Download', P('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14')),
}
BRANCHES = {
    'ecosophy': ('Ecosophy: the three ecologies', C(12, 8.5, 4.2) + C(8.3, 14.8, 4.2) + C(15.7, 14.8, 4.2)),
    'deep-ecology': ('Deep ecology: the mountain', P('M3 19.5 9.5 8.5l4 6 2.5-3.5 5 8.5z') + C(17, 5.5, 1.8)),
    'social-ecology': ('Social ecology: the assembly', C(12, 12, 8) + P('M12 7.2l4.2 7.3H7.8z') + C(12, 7.2, 1.1, FILL) + C(16.2, 14.5, 1.1, FILL) + C(7.8, 14.5, 1.1, FILL)),
    'ecosocialism': ('Ecosocialism: the metabolic rift', P('M10 4.2A8 8 0 0 0 10 19.8M14 4.2A8 8 0 0 1 14 19.8') + P('M12.3 2.8l-1.4 4.4 2.2 3.4-2.2 3.8 2.2 3.8-1 3')),
    'degrowth': ('Degrowth: the snail', P('M12.6 17a5.4 5.4 0 1 1 5.1-7.2 3.5 3.5 0 1 1-6.6 2.4 1.7 1.7 0 1 1 3.2-1.1') + P('M3 18.5h16.5l1.6-2.6M19 16.2l.6-3.2M20.6 16.4l1.4-2.6')),
    'ecofeminism': ('Ecofeminism: care and the seed', P('M4 11.5c0 4.8 3.6 8.5 8 8.5s8-3.7 8-8.5') + P('M8 12c0 2.4 1.8 4 4 4s4-1.6 4-4') + P('M12 3.5c1.6 1.1 1.6 3.9 0 5-1.6-1.1-1.6-3.9 0-5z')),
    'political-ecology': ('Political ecology: the contour map', P('M5.5 12.5c-.2-4.2 3-7.3 7.2-6.9s6.3 3.7 5.3 7.3-4.3 6.1-7.8 5.6S5.7 15.6 5.5 12.5z') + P('M9.5 12.3c0-1.8 1.5-3 3.2-2.8s2.6 1.6 2.2 3.1-1.8 2.4-3.3 2.3-2.1-1-2.1-2.6z')),
    'decolonial': ('Decolonial ecology: the south-up compass', C(12, 12, 8) + P('M12 5.5l2.2 6.5L12 18.5 9.8 12z') + P('M12 5.5l2.2 6.5H9.8z', FILL)),
    'anthropocene': ('Anthropocene: the strata', P('M4 5h16v14H4z') + P('M4 9.5c3 1 5-1 8 0s5 1 8 0M4 14c3 1 5-1 8 0s5 1 8 0')),
    'technocritique': ('Technocritique: the gear and the leaf', C(12, 12, 6) + P('M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1') + P('M9.8 14.2c0-2.8 1.8-4.6 4.6-4.6 0 2.8-1.8 4.6-4.6 4.6zM9.8 14.2l2.6-2.6')),
    'queer-ecology': ('Queer ecology: the fungus', P('M4 12a8 7 0 0 1 16 0z') + P('M10 12v6.5a2 2 0 0 0 4 0V12') + C(9, 9, 0.9, FILL) + C(14.5, 8, 0.9, FILL)),
    'counterpoint': ('Counterpoint: the reply', P('M4 9h13M13.5 5.5 17 9l-3.5 3.5') + P('M20 15H7M10.5 11.5 7 15l3.5 3.5')),
}
(ROOT / 'public/glyphs/branches').mkdir(parents=True, exist_ok=True)
for k, (t, b) in GLYPHS.items():
    (ROOT / f'public/glyphs/{k}.svg').write_text(svg(t, b))
for k, (t, b) in BRANCHES.items():
    (ROOT / f'public/glyphs/branches/{k}.svg').write_text(svg(t, b))
print(len(GLYPHS), 'glyphs,', len(BRANCHES), 'branch emblems')
