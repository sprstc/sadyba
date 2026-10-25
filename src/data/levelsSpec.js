/**
 * src/data/levelsSpec.js
 * Definicje kondygnacji dla selektora poziomów (lewy panel) i karty szczegółów (prawy panel).
 * Wszystkie liczby są wyprowadzane z houseSpec.js (Single Source of Truth).
 */

import { ELEVATIONS, ARCHIVE_METADATA, ROOMS_SPEC } from './houseSpec.js';

const scan = ARCHIVE_METADATA.modernScan2026;

/** Kolejność od góry do dołu – tak jak w przekroju budynku. */
export const LEVELS = [
  {
    key: 'atticWalls',
    name: 'Poddasze',
    projElev: '+5,95',
    worldY: ELEVATIONS.ATTIC_FLOOR,
    clearHeight: ELEVATIONS.ROOF_RIDGE - ELEVATIONS.ATTIC_FLOOR,
    clearHeightNote: 'w kalenicy',
    area2026: scan.floorsBreakdown.attic,
    clipY: 8.6,
    structureAbove: 'Więźba stolcowo-kleszczowa, 3 lukarny',
    summary: 'Strych pod więźbą dachową z wydzielonym pokojem zachodnim przy lukarnie od ogrodu.',
  },
  {
    key: 'firstFloor',
    name: 'I piętro',
    projElev: '+3,10',
    worldY: ELEVATIONS.FIRST_FLOOR,
    clearHeight: ELEVATIONS.FIRST_CEILING - ELEVATIONS.FIRST_FLOOR,
    area2026: scan.floorsBreakdown.firstFloor,
    clipY: 5.9,
    structureAbove: 'Strop Kleina (gr. 27 cm)',
    summary: 'Dwie sypialnie, łazienka, osobne WC i taras nad werandą.',
  },
  {
    key: 'groundFloor',
    name: 'Parter',
    projElev: '±0,00',
    worldY: ELEVATIONS.GROUND_FLOOR,
    clearHeight: ELEVATIONS.GROUND_CEILING - ELEVATIONS.GROUND_FLOOR,
    area2026: scan.floorsBreakdown.groundFloor,
    clipY: 2.9,
    structureAbove: 'Strop Kleina (gr. 30 cm, I NP 22/24)',
    summary: 'Wejście, hol ze schodami, kuchnia, gabinet, salon i weranda ogrodowa.',
  },
  {
    key: 'basement',
    name: 'Podziemie',
    projElev: '−2,52',
    worldY: ELEVATIONS.BASEMENT_FLOOR,
    clearHeight: ELEVATIONS.BASEMENT_CEILING - ELEVATIONS.BASEMENT_FLOOR,
    area2026: scan.floorsBreakdown.basement,
    clipY: 0.5,
    structureAbove: 'Strop Kleina (I NP 22/24)',
    summary: 'Dwa garaże (wjazd od ulicy), kotłownia i pomieszczenie pod werandą.',
  },
];

/** Pozycja „Cały budynek” – wyłącza przekrój poziomy. */
export const WHOLE_BUILDING = {
  key: 'all',
  name: 'Cały budynek',
  clipY: 11.5,
};

export function getLevel(key) {
  if (key === WHOLE_BUILDING.key) return WHOLE_BUILDING;
  return LEVELS.find((l) => l.key === key) || WHOLE_BUILDING;
}

export function getRoomsForLevel(key) {
  return ROOMS_SPEC.filter((r) => r.floorKey === key);
}

/** Wyznacza kondygnację na podstawie wysokości przekroju poziomego Y (suwak w sekcji Przekroje). */
export function levelKeyForClipY(y) {
  const v = parseFloat(y);
  if (v >= 11.45) return WHOLE_BUILDING.key;
  if (v >= ELEVATIONS.ATTIC_FLOOR) return 'atticWalls';
  if (v >= ELEVATIONS.FIRST_FLOOR) return 'firstFloor';
  if (v >= ELEVATIONS.GROUND_FLOOR) return 'groundFloor';
  return 'basement';
}
