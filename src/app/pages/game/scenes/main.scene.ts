import Phaser from 'phaser';
import { TILE_CONFIGS, getTileTypeForDepth, TileType } from '../config/tiles.config';
import { GameStateService, OreType } from '../services/game-state.service';

const TILE_SIZE        = 64;
const COLS             = 13;
const SURFACE_ROWS     = 3;
const UNDERGROUND_ROWS = 58;
const SURFACE_Y        = SURFACE_ROWS * TILE_SIZE;
const WORLD_W          = COLS * TILE_SIZE;

const SHOP_X           = TILE_SIZE * 2;
const FUEL_X           = WORLD_W - TILE_SIZE * 2;
const FUEL_ZONE_RANGE  = TILE_SIZE * 2.5;
const LOW_FUEL_PCT     = 25;

// Fuel drain rates (units/second)
const DRAIN_MOVE  = 3;
const DRAIN_THRUST = 12;
const DRAIN_DRILL  = 20;

interface TileData {
  gameObject: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Rectangle;
  tileType: TileType;
  row: number;
  col: number;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private drillSprite!: Phaser.GameObjects.Image;
  private thrustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private tileGroup!: Phaser.Physics.Arcade.StaticGroup;
  private tileGrid: (TileData | null)[][] = [];
  private gs!: GameStateService;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private drillingTarget: TileData | null = null;
  private drillTimer = 0;
  private drillBar!: Phaser.GameObjects.Graphics;
  private drillDir: 'left' | 'right' | 'down' = 'down';
  private drillOscillation = 0;

  private wasOnSurface = true;
  private hasExploded  = false;

  // Camera-fixed UI elements
  private fuelWarningText!: Phaser.GameObjects.Text;
  private fuelZoneGlow!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'MainScene' }); }

  preload() {
    this.load.image('legend-ore', 'character.png');
  }

  create() {
    const worldH = (SURFACE_ROWS + UNDERGROUND_ROWS + 1) * TILE_SIZE;

    this.physics.world.setBounds(0, 0, WORLD_W, worldH);
    this.cameras.main.setBounds(0, 0, WORLD_W, worldH);

    this.gs = this.registry.get('gameState') as GameStateService;

    this.buildBackground(worldH);
    this.buildTileGrid();
    this.buildPlayer();
    this.buildParticles();
    this.buildUI();
    this.bindKeys();

    this.physics.add.collider(this.player, this.tileGroup);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(80, 120);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.drillBar = this.add.graphics().setDepth(20);

    this.gs.isOnSurface.set(true);
    this.wasOnSurface = true;
    this.hasExploded  = false;
  }

  // ─── World building ──────────────────────────────────────────────────────────

  private buildBackground(worldH: number) {
    // Sky
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x070715, 0x070715, 0x140a30, 0x140a30, 1);
    sky.fillRect(0, 0, WORLD_W, SURFACE_Y);

    for (let i = 0; i < 60; i++) {
      this.add.circle(
        Phaser.Math.Between(0, WORLD_W), Phaser.Math.Between(0, SURFACE_Y - 20),
        Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.7)
      );
    }

    // Ground surface line
    this.add.rectangle(WORLD_W / 2, SURFACE_Y - 4, WORLD_W, 8, 0x3d8c40);

    // Underground bg
    const ug = this.add.graphics();
    ug.fillGradientStyle(0x1a0d00, 0x1a0d00, 0x06040e, 0x06040e, 1);
    ug.fillRect(0, SURFACE_Y, WORLD_W, worldH - SURFACE_Y);

    // Depth markers
    for (let row = 5; row < UNDERGROUND_ROWS; row += 5) {
      const y = SURFACE_Y + row * TILE_SIZE + TILE_SIZE / 2;
      this.add.text(4, y, `${row * 6}m`, { fontSize: '9px', fontFamily: 'monospace', color: '#2a2a4a' }).setDepth(1);
    }

    this.buildShop();
    this.buildFuelStation();
  }

  private buildShop() {
    const g = this.add.graphics();
    const bx = SHOP_X;
    const by = SURFACE_Y;

    // Building body
    g.fillStyle(0x1e1e30); g.fillRect(bx - 42, by - 62, 84, 62);
    // Roof
    g.fillStyle(0x2a2a45); g.fillRect(bx - 45, by - 66, 90, 8);
    // Door
    g.fillStyle(0x0d0d1a); g.fillRect(bx - 12, by - 28, 24, 28);
    // Door handle
    g.fillStyle(0xffd700); g.fillRect(bx + 7, by - 17, 4, 4);
    // Windows
    g.fillStyle(0xfff4a0, 0.6); g.fillRect(bx - 38, by - 54, 20, 16);
    g.fillStyle(0xfff4a0, 0.6); g.fillRect(bx + 18, by - 54, 20, 16);
    // Window frames
    g.lineStyle(1, 0x444466, 1);
    g.strokeRect(bx - 38, by - 54, 20, 16); g.strokeRect(bx + 18, by - 54, 20, 16);

    // Sign
    this.add.text(bx, by - 72, 'SHOP', {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#a78bfa',
    }).setOrigin(0.5, 1);

    // Prompt
    this.add.text(bx, by - 6, '[ I ] Open', {
      fontSize: '9px', fontFamily: 'monospace', color: '#555588',
    }).setOrigin(0.5, 1);
  }

  private buildFuelStation() {
    const g = this.add.graphics();
    const fx = FUEL_X;
    const fy = SURFACE_Y;

    // Canopy
    g.fillStyle(0x2a1a00); g.fillRect(fx - 50, fy - 70, 100, 8);
    g.fillStyle(0xff6600); g.fillRect(fx - 50, fy - 75, 100, 5);
    // Canopy posts
    g.fillStyle(0x3a2a00); g.fillRect(fx - 45, fy - 68, 6, 68);
    g.fillStyle(0x3a2a00); g.fillRect(fx + 39, fy - 68, 6, 68);
    // Pump body
    g.fillStyle(0x2a1800); g.fillRect(fx - 14, fy - 55, 28, 55);
    // Pump screen
    g.fillStyle(0x00cc44, 0.8); g.fillRect(fx - 10, fy - 50, 20, 14);
    // Pump buttons
    g.fillStyle(0xff4400); g.fillCircle(fx - 5,  fy - 25, 4);
    g.fillStyle(0x00aa22); g.fillCircle(fx + 5,  fy - 25, 4);
    // Hose
    g.lineStyle(3, 0xff8800, 1);
    g.beginPath(); g.moveTo(fx + 14, fy - 30); g.lineTo(fx + 30, fy - 30); g.lineTo(fx + 30, fy - 16); g.strokePath();
    // Nozzle
    g.fillStyle(0xcc5500); g.fillRect(fx + 26, fy - 20, 8, 8);

    // Sign
    this.add.text(fx, fy - 82, '⛽ FUEL STATION', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff8800',
    }).setOrigin(0.5, 1);

    // Zone highlight on ground (subtle)
    const zg = this.add.graphics();
    zg.fillStyle(0xff6600, 0.06);
    zg.fillRect(fx - FUEL_ZONE_RANGE, fy - 3, FUEL_ZONE_RANGE * 2, 3);
  }

  private buildTileGrid() {
    this.tileGroup = this.physics.add.staticGroup();
    for (let row = 0; row < UNDERGROUND_ROWS; row++) {
      this.tileGrid[row] = [];
      for (let col = 0; col < COLS; col++) {
        this.spawnTile(row, col, getTileTypeForDepth(row));
      }
    }
    // Bedrock floor
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE_SIZE + TILE_SIZE / 2;
      const y = SURFACE_Y + UNDERGROUND_ROWS * TILE_SIZE + TILE_SIZE / 2;
      const br = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x0d0d18);
      br.setStrokeStyle(1, 0x1a1a2e, 0.8);
      this.tileGroup.add(br);
    }
  }

  private spawnTile(row: number, col: number, type: TileType) {
    const cfg = TILE_CONFIGS[type];
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = SURFACE_Y + row * TILE_SIZE + TILE_SIZE / 2;

    if (cfg.isImageTile) {
      const img = this.add.image(x, y, 'legend-ore')
        .setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2)
        .setDepth(2);
      // Pulsing golden glow border
      const glow = this.add.rectangle(x, y, TILE_SIZE - 1, TILE_SIZE - 1, 0xffd700, 0)
        .setStrokeStyle(2, 0xffd700, 0.8).setDepth(1);
      this.tweens.add({ targets: glow, strokeAlpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      this.tileGroup.add(img as any);
      this.tileGrid[row][col] = { gameObject: img, glow, tileType: type, row, col };
      return;
    }

    const rect = this.add.rectangle(x, y, TILE_SIZE - 1, TILE_SIZE - 1, cfg.color);
    rect.setStrokeStyle(1, cfg.borderColor, 0.5);
    if (cfg.isOre) {
      this.add.circle(x - 10, y - 10, 3, 0xffffff, 0.35).setDepth(2);
      this.add.circle(x + 8,  y + 6,  2, 0xffffff, 0.25).setDepth(2);
    }
    this.tileGroup.add(rect);
    this.tileGrid[row][col] = { gameObject: rect, tileType: type, row, col };
  }

  private buildPlayer() {
    const g = this.make.graphics({});
    g.fillStyle(0xa78bfa); g.fillRoundedRect(4, 2, 24, 30, 5);
    g.fillStyle(0x1a0a30); g.fillRoundedRect(9, 6, 14, 10, 3);
    g.fillStyle(0x7df9ff, 0.6); g.fillRoundedRect(10, 7, 12, 8, 2);
    g.fillStyle(0xffd700); g.fillTriangle(16, 40, 7, 28, 25, 28);
    g.fillStyle(0x7c3aed); g.fillRect(7, 32, 6, 5); g.fillRect(19, 32, 6, 5);
    g.generateTexture('player', 32, 42);
    g.destroy();

    // Drill tip only — collar + pointed bit, no shaft
    const dg = this.make.graphics({});
    dg.fillStyle(0xff6600); dg.fillRect(0, 2, 6, 14);           // collar
    dg.fillStyle(0x909090); dg.fillTriangle(6, 0, 22, 9, 6, 18); // bit
    dg.fillStyle(0xd0d0e0); dg.fillTriangle(6, 3, 18, 9, 6, 15); // bit shine
    dg.generateTexture('drill', 22, 18);
    dg.destroy();

    this.player = this.physics.add.sprite(WORLD_W / 2, SURFACE_Y - 28, 'player');
    this.player.setMaxVelocity(200, 500).setDragX(600).setDepth(10).setCollideWorldBounds(true);

    this.drillSprite = this.add.image(this.player.x, this.player.y, 'drill')
      .setDepth(11).setOrigin(0, 0.5);
  }

  private buildParticles() {
    // Shared 4×4 white square — tinted per emitter
    const pg = this.make.graphics({});
    pg.fillStyle(0xffffff); pg.fillRect(0, 0, 4, 4);
    pg.generateTexture('particle', 4, 4);
    pg.destroy();

    // Thrust exhaust — emitted downward from nozzles
    this.thrustEmitter = this.add.particles(0, 0, 'particle', {
      lifespan:  { min: 250, max: 480 },
      speed:     { min: 70,  max: 160 },
      angle:     { min: 75,  max: 105 },
      scale:     { start: 4, end: 0 },
      alpha:     { start: 0.85, end: 0 },
      tint:      [0xff4400, 0xff7700, 0xffcc00, 0xffeedd, 0xffffff],
      quantity:  5,
      frequency: 25,
      emitting:  false,
    }).setDepth(9);
  }

  private buildUI() {
    // Low fuel warning — camera-fixed (scrollFactor 0)
    this.fuelWarningText = this.add.text(WORLD_W / 2, 72, '⚠  LOW FUEL  ⚠', {
      fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ef4444',
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setVisible(false);

    this.tweens.add({
      targets: this.fuelWarningText,
      alpha: 0.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Fuel zone glow (camera-fixed, shown when near station)
    this.fuelZoneGlow = this.add.graphics().setScrollFactor(0).setDepth(29);
  }

  private bindKeys() {
    this.input.keyboard!.on('keydown-I', () => {
      if (!this.gs || this.gs.gameOver()) return;
      if (!this.gs.isOnSurface()) return;
      this.gs.shopOpen.update((v) => !v);
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      this.gs?.shopOpen.set(false);
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  override update(_time: number, delta: number) {
    if (!this.gs || this.gs.gameOver()) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const { left, right, up, down } = this.cursors;
    const goLeft  = left.isDown  || this.gs.touchLeft();
    const goRight = right.isDown || this.gs.touchRight();
    const goUp    = up.isDown    || this.gs.touchUp();
    const goDown  = down.isDown  || this.gs.touchDown();
    const thrustPower = 280 + this.gs.upgrades().engine * 40;
    const fuelPct = this.gs.fuelPercent();

    // ── Movement ──
    const movingLeft  = goLeft  && !body.blocked.left;
    const movingRight = goRight && !body.blocked.right;

    if (goLeft)       { this.player.setVelocityX(-180); this.player.setFlipX(true);  }
    else if (goRight) { this.player.setVelocityX(180);  this.player.setFlipX(false); }
    else              { this.player.setVelocityX(0); }

    const thrusting = goUp && this.gs.fuel() > 0;
    if (thrusting) this.player.setVelocityY(-thrustPower);

    // ── Thrust exhaust particles ──
    if (thrusting) {
      // Position between the two nozzles at the bottom of the sprite
      this.thrustEmitter.setPosition(this.player.x, this.player.y + 17);
      if (!this.thrustEmitter.emitting) this.thrustEmitter.start();
    } else {
      if (this.thrustEmitter.emitting) this.thrustEmitter.stop();
    }

    // ── Drill direction tracking ──
    if (goLeft)       this.drillDir = 'left';
    else if (goRight) this.drillDir = 'right';
    else if (goDown)  this.drillDir = 'down';

    // ── Drilling ──
    let drillDir: 'left' | 'right' | 'down' | null = null;
    if (goLeft  && body.blocked.left)  drillDir = 'left';
    if (goRight && body.blocked.right) drillDir = 'right';
    if (goDown  && body.blocked.down)  drillDir = 'down';

    let drilling = false;
    if (drillDir) {
      const target = this.adjacentTile(drillDir);
      if (target && TILE_CONFIGS[target.tileType].breakable) {
        drilling = true;
        if (this.drillingTarget !== target) { this.drillingTarget = target; this.drillTimer = 0; }
        const speedMod = 1 - Math.min(0.75, this.gs.upgrades().drillBit * 0.18);
        const hardness = TILE_CONFIGS[target.tileType].hardness * speedMod;
        this.drillTimer += delta;
        this.drawDrillBar(target, this.drillTimer / hardness);
        if (this.drillTimer >= hardness) this.breakTile(target);
      } else { this.clearDrill(); }
    } else { this.clearDrill(); }

    // ── Fuel drain — only on activity ──
    if (drilling) {
      this.consumeFuel(delta, DRAIN_DRILL);
    } else if (thrusting) {
      this.consumeFuel(delta, DRAIN_THRUST);
    } else if (movingLeft || movingRight) {
      this.consumeFuel(delta, DRAIN_MOVE);
    }

    // ── Fuel empty → explode ──
    if (this.gs.fuel() <= 0 && !this.hasExploded) {
      this.hasExploded = true;
      this.triggerExplosion();
      return;
    }

    // ── Low fuel warning ──
    const showWarning = fuelPct <= LOW_FUEL_PCT && fuelPct > 0;
    this.fuelWarningText.setVisible(showWarning);

    // ── Depth ──
    this.gs.updateDepth(Math.max(0, Math.floor((this.player.y - SURFACE_Y) / 6)));

    // ── Surface & refuel zone ──
    const onSurface = this.player.y <= SURFACE_Y + 8;
    if (onSurface && !this.wasOnSurface) this.onLandedSurface();
    this.wasOnSurface = onSurface;
    this.gs.isOnSurface.set(onSurface);

    const nearFuel = onSurface && Math.abs(this.player.x - FUEL_X) < FUEL_ZONE_RANGE;
    this.updateFuelZoneGlow(nearFuel);
    if (nearFuel) {
      this.gs.refuel(delta);
      this.gs.repairHull(delta);
    }

    // ── Drill sprite position & angle ──
    this.drillOscillation = drilling
      ? Math.sin(_time * 0.04) * 3
      : 0;

    const px = this.player.x;
    const py = this.player.y;
    const osc = this.drillOscillation;

    switch (this.drillDir) {
      case 'right':
        this.drillSprite.setPosition(px + 16 + osc, py).setAngle(0);
        break;
      case 'left':
        this.drillSprite.setPosition(px - 16 - osc, py).setAngle(180);
        break;
      case 'down':
        this.drillSprite.setPosition(px, py + 20 + osc).setAngle(90);
        break;
    }

    // ── Fall damage ──
    if (body.blocked.down && body.velocity.y > 380) {
      const dmg = (body.velocity.y - 380) * 0.12;
      this.gs.updateHull(this.gs.hull() - dmg);
      this.player.setTint(0xff4444);
      this.time.delayedCall(150, () => this.player.clearTint());
    }

    // ── Hull destroyed ──
    if (this.gs.hull() <= 0) {
      this.gs.gameOverReason.set('hull');
      this.gs.gameOver.set(true);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private consumeFuel(delta: number, rate: number) {
    this.gs.updateFuel(this.gs.fuel() - (delta / 1000) * rate);
  }

  private adjacentTile(dir: 'left' | 'right' | 'down'): TileData | null {
    const hw = this.player.width  / 2 - 2;
    const hh = this.player.height / 2 - 2;
    let tx = this.player.x, ty = this.player.y;
    if (dir === 'left')  tx -= hw + TILE_SIZE * 0.6;
    if (dir === 'right') tx += hw + TILE_SIZE * 0.6;
    if (dir === 'down')  ty += hh + TILE_SIZE * 0.6;
    const col = Math.floor(tx / TILE_SIZE);
    const row = Math.floor((ty - SURFACE_Y) / TILE_SIZE);
    if (row < 0 || row >= UNDERGROUND_ROWS || col < 0 || col >= COLS) return null;
    return this.tileGrid[row]?.[col] ?? null;
  }

  private breakTile(td: TileData) {
    const cfg = TILE_CONFIGS[td.tileType];
    if (cfg.isOre) {
      this.gs.addOre(td.tileType as OreType, cfg.oreName, cfg.oreValue);
      this.floatText(td.gameObject.x, td.gameObject.y, `+$${cfg.oreValue} ${cfg.oreName}`, '#ffd700');
    }

    if (td.glow) td.glow.destroy();
    this.emitChips(td.gameObject.x, td.gameObject.y, cfg.color, cfg.isOre ? 14 : 8);

    const flash = this.add.rectangle(td.gameObject.x, td.gameObject.y, TILE_SIZE - 4, TILE_SIZE - 4, 0xffffff, 0.45).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 180, onComplete: () => flash.destroy() });
    td.gameObject.destroy();
    this.tileGrid[td.row][td.col] = null;
    this.tileGroup.refresh();
    this.clearDrill();
  }

  private emitChips(x: number, y: number, color: number, count: number) {
    const burst = this.add.particles(x, y, 'particle', {
      lifespan:    { min: 300, max: 600 },
      speed:       { min: 60,  max: 180 },
      angle:       { min: 0,   max: 360 },
      scale:       { start: 1.2, end: 0 },
      alpha:       { start: 1,   end: 0 },
      gravityY:    300,
      tint:        [color, Phaser.Display.Color.IntegerToColor(color).brighten(30).color, 0xffffff],
      quantity:    count,
      emitting:    false,
    }).setDepth(16);
    burst.explode(count, x, y);
    this.time.delayedCall(700, () => burst.destroy());
  }

  private clearDrill() {
    this.drillingTarget = null;
    this.drillTimer = 0;
    this.drillBar.clear();
  }

  private drawDrillBar(td: TileData, progress: number) {
    this.drillBar.clear();
    const bx = td.gameObject.x - 26, by = td.gameObject.y + 28;
    this.drillBar.fillStyle(0x000000, 0.75); this.drillBar.fillRect(bx, by, 52, 7);
    const col = progress < 0.5 ? 0xffd700 : 0xff8800;
    this.drillBar.fillStyle(col, 1); this.drillBar.fillRect(bx, by, 52 * Math.min(1, progress), 7);
  }

  private onLandedSurface() {
    this.gs.shopOpen.set(false);
    const earned = this.gs.sellCargo();
    if (earned > 0) this.floatText(this.player.x, this.player.y - 20, `SOLD  +$${earned}`, '#10b981');
  }

  private updateFuelZoneGlow(active: boolean) {
    this.fuelZoneGlow.clear();
    if (!active) return;
    // Screen-space glow banner at bottom of HUD
    this.fuelZoneGlow.fillStyle(0xff6600, 0.12);
    this.fuelZoneGlow.fillRect(0, 580, 832, 20);
    this.fuelZoneGlow.fillStyle(0xff8800, 0.4);
    this.fuelZoneGlow.fillRect(0, 597, 832, 3);
  }

  private triggerExplosion() {
    const x = this.player.x, y = this.player.y;
    this.player.setVisible(false);
    this.drillSprite.setVisible(false);
    this.fuelWarningText.setVisible(false);
    this.thrustEmitter.stop();

    const colors = [0xff6600, 0xff0000, 0xffff00, 0xff8800, 0xffffff];
    for (let i = 0; i < 20; i++) {
      const angle  = (i / 20) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const dist   = Phaser.Math.Between(50, 120);
      const size   = Phaser.Math.Between(3, 9);
      const color  = colors[i % colors.length];
      const p = this.add.circle(x, y, size, color).setDepth(30);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0, scale: 0,
        duration: Phaser.Math.Between(400, 900),
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }

    // Core flash
    const flash = this.add.circle(x, y, 36, 0xffffff, 0.95).setDepth(31);
    this.tweens.add({ targets: flash, scale: 4, alpha: 0, duration: 350, onComplete: () => flash.destroy() });

    // Screen shake
    this.cameras.main.shake(500, 0.02);

    this.time.delayedCall(900, () => {
      this.gs.gameOverReason.set('fuel');
      this.gs.gameOver.set(true);
    });
  }

  private floatText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 1600, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }
}
