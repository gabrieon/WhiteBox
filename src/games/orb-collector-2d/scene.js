// Orb Dash 2D — a Phaser 3 scene, loaded via the manifest's dynamic loader so
// Phaser stays out of the main bundle. Textures are generated at runtime (no
// external assets). The SDK context is read from the game registry (injected by
// PhaserAdapter) for audio, scores and restart.

import Phaser from 'phaser';

const PLAYER_SPEED = 280;

export default class OrbDashScene extends Phaser.Scene {
  constructor() {
    super('orb-dash-2d');
  }

  init() {
    this.score = 0;
    this.timeLeft = 30;
    this.over = false;
    this.abandoning = false;
  }

  readSavedRun() {
    try {
      const data = this.ctx?.loadProgress?.();
      if (!data || typeof data !== 'object') return null;
      const score = Math.max(0, Math.floor(Number(data.score) || 0));
      const timeLeft = Math.floor(Number(data.timeLeft) || 0);
      if (timeLeft < 1 || timeLeft > 300) return null;
      return { score, timeLeft };
    } catch {
      return null;
    }
  }

  create() {
    this.ctx = this.game.registry.get('ctx') || null;
    const cfg = this.ctx?.manifest?.config || {};
    this.timeLeft = cfg.rounds || 30;
    this.abandoning = false;

    // Resume a saved run when one exists; a restart clears it first (see
    // restart() below), so reaching here with data means "continue".
    const saved = this.readSavedRun();
    if (saved) {
      this.score = saved.score;
      this.timeLeft = saved.timeLeft;
    }

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(cfg.phaser?.backgroundColor || '#101322');

    this.makeTextures();

    this.player = this.physics.add.sprite(width / 2, height / 2, 'player');
    this.player.setCollideWorldBounds(true).setDepth(5);

    this.orbs = this.physics.add.group({ immovable: true, allowGravity: false });
    for (let i = 0; i < 6; i += 1) this.spawnOrb();

    this.physics.add.overlap(this.player, this.orbs, this.collect, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-R', () => this.restart());

    this.hud = this.add.text(14, 12, '', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#dff6ff',
    }).setDepth(10).setScrollFactor(0);

    this.centerMsg = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: '900',
      color: '#4ff3ff',
      align: 'center',
    }).setOrigin(0.5).setDepth(10).setVisible(false);

    this.updateHud();

    this.tick = this.time.addEvent({ delay: 1000, loop: true, callback: this.onSecond, callbackScope: this });

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.input.keyboard.off('keydown-R');
      // Leaving mid-run (not a restart, not game over) snapshots the run so
      // it can resume. Restart clears first, so its shutdown saves nothing.
      if (!this.over && !this.abandoning) {
        this.ctx?.saveProgress?.({ score: this.score, timeLeft: Math.ceil(this.timeLeft) });
      }
    });
  }

  makeTextures() {
    const p = this.add.graphics();
    p.fillStyle(0xd9ff43, 1);
    p.fillRoundedRect(0, 0, 30, 30, 7);
    p.fillStyle(0x171717, 1);
    p.fillRect(19, 9, 6, 12);
    p.generateTexture('player', 30, 30);
    p.destroy();

    const o = this.add.graphics();
    o.fillStyle(0x4ff3ff, 1);
    o.fillCircle(11, 11, 11);
    o.fillStyle(0xeafeff, 1);
    o.fillCircle(8, 8, 4);
    o.generateTexture('orb', 22, 22);
    o.destroy();
  }

  spawnOrb() {
    const { width, height } = this.scale;
    const pad = 40;
    const x = Phaser.Math.Between(pad, Math.max(pad + 1, width - pad));
    const y = Phaser.Math.Between(pad, Math.max(pad + 1, height - pad));
    const orb = this.orbs.create(x, y, 'orb');
    orb.setCircle(11);
    orb.setImmovable(true);
    return orb;
  }

  collect(player, orb) {
    if (this.over) return;
    this.score += 1;
    this.ctx?.services?.audio?.play({ freq: 480 + this.score * 15, duration: 0.09, type: 'square', gain: 0.18 });
    this.ctx?.saveProgress?.({ score: this.score, timeLeft: Math.ceil(this.timeLeft) });
    orb.destroy();
    this.spawnOrb();
    this.updateHud();
  }

  onSecond() {
    if (this.over) return;
    this.timeLeft -= 1;
    this.ctx?.saveProgress?.({ score: this.score, timeLeft: Math.ceil(this.timeLeft) });
    this.updateHud();
    if (this.timeLeft <= 0) this.gameOver();
  }

  updateHud() {
    if (this.hud) this.hud.setText(`SCORE ${this.score}    TIME ${Math.max(0, this.timeLeft)}s    [R] restart`);
  }

  gameOver() {
    this.over = true;
    this.physics.pause();
    // Finished runs don't resume.
    this.ctx?.clearProgress?.();
    const best = this.ctx?.services?.scores?.submit(this.score, 'high');
    const bestVal = this.ctx?.services?.scores?.getBest();
    const { width, height } = this.scale;
    this.centerMsg
      .setPosition(width / 2, height / 2)
      .setText(`Time!\nScore ${this.score}${bestVal != null ? `  ·  Best ${bestVal}` : ''}${best ? '\nNew best!' : ''}\nPress R to play again`)
      .setVisible(true);
    this.ctx?.reportResult?.({ score: this.score, best: bestVal });
  }

  restart() {
    // A restart abandons the run: clear the snapshot so the shutdown handler
    // below (and the remount) cannot resurrect it.
    this.abandoning = true;
    this.ctx?.clearProgress?.();
    // Prefer a full host restart (fresh React state + services run id); fall
    // back to a scene restart if launched outside the host.
    if (this.ctx?.restart) this.ctx.restart();
    else this.scene.restart();
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    this.physics.world.setBounds(0, 0, width, height);
    if (this.player) {
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x, 20, Math.max(20, width - 20)),
        Phaser.Math.Clamp(this.player.y, 20, Math.max(20, height - 20)),
      );
    }
    if (this.centerMsg) this.centerMsg.setPosition(width / 2, height / 2);
  }

  update() {
    if (this.over || !this.player) return;
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= PLAYER_SPEED;
    if (right) vx += PLAYER_SPEED;
    if (up) vy -= PLAYER_SPEED;
    if (down) vy += PLAYER_SPEED;
    // Normalize diagonals.
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }
    this.player.setVelocity(vx, vy);
  }
}
