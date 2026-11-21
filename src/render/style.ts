// Pure style helpers (no Pixi): which ring / badge a city level or building status gets.
import type { BuildingStatus } from '../core/rules/production';
import type { CityLevel } from '../data/buildings';

export interface CityRingStyle {
  /** Outer ring color, null = none (settlement). */
  outerColor: number | null;
  /** Outer ring width in px. */
  outerWidth: number;
  /** Thin inner ring color, null = none. */
  innerColor: number | null;
}

export const CITY_RING_STYLES: Record<CityLevel, CityRingStyle> = {
  settlement: { outerColor: null, outerWidth: 0, innerColor: null },
  polis: { outerColor: 0x3e7d6b, outerWidth: 3, innerColor: null },
  metropolis: { outerColor: 0xc9a227, outerWidth: 4, innerColor: 0xc9a227 },
};

export function cityRingStyle(level: CityLevel): CityRingStyle {
  return CITY_RING_STYLES[level];
}

export type BadgeKind = 'problem' | 'paused' | null;

/** Which badge a building status shows (producing/working/noProduction: none). */
export function badgeKind(status: BuildingStatus | undefined): BadgeKind {
  switch (status?.kind) {
    case 'paused':
      return 'paused';
    // A wonder under construction or complete is not a problem: no badge.
    case 'wonderBuilding':
    case 'wonderComplete':
      return null;
    case 'notConnected':
    case 'missingWorkers':
    case 'missingInput':
      return 'problem';
    default:
      return null;
  }
}
