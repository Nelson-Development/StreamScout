export type TileType = 'dirt' | 'stone' | 'hard_rock' | 'copper' | 'iron' | 'gold' | 'diamond' | 'legend' | 'bedrock';

export interface TileConfig {
  type: TileType;
  color: number;
  borderColor: number;
  hardness: number;
  breakable: boolean;
  isOre: boolean;
  oreValue: number;
  oreName: string;
  isImageTile?: boolean;
}

export const TILE_CONFIGS: Record<TileType, TileConfig> = {
  dirt:      { type: 'dirt',      color: 0x7a5230, borderColor: 0x5c3d20, hardness: 500,      breakable: true,  isOre: false, oreValue: 0,    oreName: '' },
  stone:     { type: 'stone',     color: 0x5f6370, borderColor: 0x3a3d45, hardness: 1100,     breakable: true,  isOre: false, oreValue: 0,    oreName: '' },
  hard_rock: { type: 'hard_rock', color: 0x3d3d4a, borderColor: 0x252530, hardness: 2000,     breakable: true,  isOre: false, oreValue: 0,    oreName: '' },
  copper:    { type: 'copper',    color: 0xb87333, borderColor: 0x7a4a1e, hardness: 700,      breakable: true,  isOre: true,  oreValue: 8,    oreName: 'Copper' },
  iron:      { type: 'iron',      color: 0x9090a8, borderColor: 0x606075, hardness: 1400,     breakable: true,  isOre: true,  oreValue: 28,   oreName: 'Iron' },
  gold:      { type: 'gold',      color: 0xffd700, borderColor: 0xb89800, hardness: 2200,     breakable: true,  isOre: true,  oreValue: 90,   oreName: 'Gold' },
  diamond:   { type: 'diamond',   color: 0x7df9ff, borderColor: 0x00b8c8, hardness: 3800,     breakable: true,  isOre: true,  oreValue: 350,  oreName: 'Diamond' },
  legend:    { type: 'legend',    color: 0xffffff, borderColor: 0xffaaff, hardness: 5000,     breakable: true,  isOre: true,  oreValue: 1000, oreName: 'Legend', isImageTile: true },
  bedrock:   { type: 'bedrock',   color: 0x0d0d18, borderColor: 0x080812, hardness: Infinity, breakable: false, isOre: false, oreValue: 0,    oreName: '' },
};

export function getTileTypeForDepth(row: number): TileType {
  const r = Math.random();

  // 0.5% chance of Legend ore on any layer
  if (r < 0.005) return 'legend';

  const r2 = Math.random();

  if (row < 12) {
    if (r2 < 0.07) return 'copper';
    return 'dirt';
  } else if (row < 25) {
    if (r2 < 0.04) return 'iron';
    if (r2 < 0.13) return 'copper';
    if (r2 < 0.55) return 'stone';
    return 'dirt';
  } else if (row < 40) {
    if (r2 < 0.03) return 'gold';
    if (r2 < 0.12) return 'iron';
    if (r2 < 0.20) return 'copper';
    if (r2 < 0.65) return 'stone';
    return 'hard_rock';
  } else {
    if (r2 < 0.025) return 'diamond';
    if (r2 < 0.08)  return 'gold';
    if (r2 < 0.16)  return 'iron';
    if (r2 < 0.55)  return 'hard_rock';
    return 'stone';
  }
}
