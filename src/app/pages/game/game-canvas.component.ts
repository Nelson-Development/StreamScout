import { Component, ElementRef, OnDestroy, AfterViewInit, ViewChild, inject } from '@angular/core';
import Phaser from 'phaser';
import { MainScene } from './scenes/main.scene';
import { GameStateService } from './services/game-state.service';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  templateUrl: './game-canvas.component.html',
  styleUrl: './game-canvas.component.scss',
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameContainer') gameContainer!: ElementRef<HTMLDivElement>;

  gs = inject(GameStateService);
  private game!: Phaser.Game;

  ngAfterViewInit() {
    const gs = this.gs;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.gameContainer.nativeElement,
      width: 832,
      height: 600,
      backgroundColor: '#08080f',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 832,
        height: 600,
      },
      callbacks: {
        preBoot: (game) => game.registry.set('gameState', gs),
      },
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 420 }, debug: false },
      },
      scene: [MainScene],
    });
  }

  ngOnDestroy() {
    this.game?.destroy(true);
  }

  upgrade(module: Parameters<GameStateService['purchaseUpgrade']>[0]) {
    this.gs.purchaseUpgrade(module);
  }

  restartGame() {
    this.gs.reset();
    this.game.scene.stop('MainScene');
    this.game.scene.start('MainScene');
  }

  // Touch control handlers
  setTouch(dir: 'left' | 'right' | 'up' | 'down', active: boolean) {
    if (dir === 'left')  this.gs.touchLeft.set(active);
    if (dir === 'right') this.gs.touchRight.set(active);
    if (dir === 'up')    this.gs.touchUp.set(active);
    if (dir === 'down')  this.gs.touchDown.set(active);
  }
}
