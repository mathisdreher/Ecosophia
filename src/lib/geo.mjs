// Build-time maps for the Terrain view. Coastlines come from Natural Earth
// (public domain) through the world-atlas package; they are projected here and
// reach the browser as plain SVG paths.
import fs from 'node:fs';
import path from 'node:path';
import { geoEqualEarth, geoConicConformal, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

function land(resolution) {
  const file = path.join(process.cwd(), 'node_modules/world-atlas', `land-${resolution}.json`);
  const topology = JSON.parse(fs.readFileSync(file, 'utf8'));
  return feature(topology, topology.objects.land);
}

function build(projection, shape, w, h) {
  const draw = geoPath(projection).digits(1);
  return {
    w,
    h,
    land: draw(shape),
    outline: draw({ type: 'Sphere' }),
    /** [lon, lat] -> [x, y], or null when the point falls outside the map. */
    project(lon, lat) {
      const p = projection([lon, lat]);
      if (!p || p[0] < 0 || p[0] > w || p[1] < 0 || p[1] > h) return null;
      return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    },
  };
}

export function worldMap(w = 960, h = 470) {
  const projection = geoEqualEarth().fitExtent(
    [
      [2, 2],
      [w - 2, h - 2],
    ],
    { type: 'Sphere' },
  );
  return build(projection, land('110m'), w, h);
}

export function europeMap(w = 560, h = 470) {
  const frame = {
    type: 'MultiPoint',
    coordinates: [
      [-11, 35.5],
      [39, 35.5],
      [-11, 61.5],
      [39, 61.5],
      [14, 35],
      [14, 62],
    ],
  };
  const projection = geoConicConformal()
    .parallels([40, 60])
    .rotate([-14, 0])
    .fitExtent(
      [
        [0, 0],
        [w, h],
      ],
      frame,
    )
    .clipExtent([
      [0, 0],
      [w, h],
    ]);
  const map = build(projection, land('50m'), w, h);
  map.outline = null;
  return map;
}
