import { Injectable, signal, computed } from '@angular/core';

export type OreType = 'copper' | 'iron' | 'gold' | 'diamond';

export interface CargoItem {
  type: OreType;
  name: string;
  value: number;
}

export interface UpgradeLevel {
  drillBit: number;
  fuelTank: number;
  cargoBay: number;
  engine: number;
  hullPlating: number;
}

const UPGRADE_COSTS: Record<keyof UpgradeLevel, number[]> = {
  drillBit:    [100, 300,  700, 1500],
  fuelTank:    [150, 350,  800, 1800],
  cargoBay:    [200, 450,  900, 2000],
  engine:      [300, 600, 1200, 2500],
  hullPlating: [200, 450,  900, 2000],
};

const UPGRADE_LABELS: Record<keyof UpgradeLevel, string> = {
  drillBit:    'Drill Bit',
  fuelTank:    'Fuel Tank',
  cargoBay:    'Cargo Bay',
  engine:      'Engine',
  hullPlating: 'Hull Plating',
};

const UPGRADE_DESC: Record<keyof UpgradeLevel, string> = {
  drillBit:    'Drill through rock faster',
  fuelTank:    'Carry more fuel per trip',
  cargoBay:    'Haul more ore per trip',
  engine:      'Stronger upward thrust',
  hullPlating: 'Survive harder impacts',
};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly UPGRADE_COSTS = UPGRADE_COSTS;
  readonly UPGRADE_LABELS = UPGRADE_LABELS;
  readonly UPGRADE_DESC = UPGRADE_DESC;
  readonly MAX_UPGRADE_LEVEL = 4;

  fuel        = signal(100);
  maxFuel     = signal(100);
  hull        = signal(100);
  maxHull     = signal(100);
  cargo       = signal<CargoItem[]>([]);
  maxCargo    = signal(10);
  cash        = signal(250);
  depth       = signal(0);
  upgrades    = signal<UpgradeLevel>({ drillBit: 0, fuelTank: 0, cargoBay: 0, engine: 0, hullPlating: 0 });
  isOnSurface      = signal(true);
  shopOpen         = signal(false);
  touchLeft        = signal(false);
  touchRight       = signal(false);
  touchUp          = signal(false);
  touchDown        = signal(false);
  gameOver         = signal(false);
  gameOverReason   = signal<'hull' | 'fuel' | null>(null);

  fuelPercent  = computed(() => Math.round((this.fuel() / this.maxFuel()) * 100));
  hullPercent  = computed(() => Math.round((this.hull() / this.maxHull()) * 100));
  cargoCount   = computed(() => this.cargo().length);
  cargoFull    = computed(() => this.cargo().length >= this.maxCargo());
  cargoValue   = computed(() => this.cargo().reduce((s, i) => s + i.value, 0));

  upgradeKeys = Object.keys(UPGRADE_COSTS) as (keyof UpgradeLevel)[];

  updateFuel(v: number) { this.fuel.set(Math.max(0, Math.min(this.maxFuel(), v))); }
  updateHull(v: number) { this.hull.set(Math.max(0, Math.min(this.maxHull(), v))); }
  updateDepth(v: number) { this.depth.set(Math.max(0, v)); }

  addOre(type: OreType, name: string, value: number) {
    if (this.cargo().length < this.maxCargo()) {
      this.cargo.update(c => [...c, { type, name, value }]);
    }
  }

  sellCargo() {
    const earned = this.cargoValue();
    this.cash.update(c => c + earned);
    this.cargo.set([]);
    return earned;
  }

  refuel(delta: number, rate = 40) {
    this.updateFuel(this.fuel() + (delta / 1000) * rate);
  }

  repairHull(delta: number, rate = 30) {
    this.updateHull(this.hull() + (delta / 1000) * rate);
  }

  canAfford(module: keyof UpgradeLevel): boolean {
    const level = this.upgrades()[module];
    if (level >= this.MAX_UPGRADE_LEVEL) return false;
    return this.cash() >= UPGRADE_COSTS[module][level];
  }

  nextUpgradeCost(module: keyof UpgradeLevel): number | null {
    const level = this.upgrades()[module];
    if (level >= this.MAX_UPGRADE_LEVEL) return null;
    return UPGRADE_COSTS[module][level];
  }

  purchaseUpgrade(module: keyof UpgradeLevel): boolean {
    if (!this.canAfford(module)) return false;
    const level = this.upgrades()[module];
    const cost = UPGRADE_COSTS[module][level];

    this.cash.update(c => c - cost);
    this.upgrades.update(u => ({ ...u, [module]: u[module] + 1 }));

    if (module === 'fuelTank')    { this.maxFuel.update(v => v + 25); this.fuel.set(this.maxFuel()); }
    if (module === 'cargoBay')    { this.maxCargo.update(v => v + 5); }
    if (module === 'hullPlating') { this.maxHull.update(v => v + 25); this.hull.set(this.maxHull()); }
    return true;
  }

  reset() {
    this.fuel.set(100); this.maxFuel.set(100);
    this.hull.set(100); this.maxHull.set(100);
    this.cargo.set([]); this.maxCargo.set(10);
    this.cash.set(250); this.depth.set(0);
    this.upgrades.set({ drillBit: 0, fuelTank: 0, cargoBay: 0, engine: 0, hullPlating: 0 });
    this.isOnSurface.set(true); this.shopOpen.set(false);
    this.gameOver.set(false); this.gameOverReason.set(null);
    this.touchLeft.set(false); this.touchRight.set(false);
    this.touchUp.set(false);   this.touchDown.set(false);
  }
}
