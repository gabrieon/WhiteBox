// TEMPLATE — minimal 2D game (Phaser 3).
//
// Copy this whole folder to src/games/<your-game>/, rename, tweak the manifest,
// then register it in src/games/registry.js. See GAME_AUTHORING.md.
//
// The Phaser adapter (src/sdk/adapters/PhaserAdapter.jsx) boots this scene with
// `new Phaser.Game(...)` and puts the WhiteBox game context on the Phaser
// registry under the key 'ctx'. Through it you reach the shared services
// (audio, scores, input, multiplayer, config) plus restart()/reportResult().
// This folder is NOT imported by the registry, so it never ships in the build.

import Phaser from 'phaser';

const GOAL = 10;

export default class TemplateScene2D extends Phaser.Scene {
  constructor() {
    super('template-2d');
  }

  create() {
    this.ctx = this.game.registry.get('ctx');
    this.score = 0;
    const { width, height } = this.scale;

    // Generate textures at runtime so the template needs no external assets.
    const pg = this.add.graphics();
    pg.fillStyle(0xd9ff43, 1);
    pg.fillRect(0, 0, 28, 28);
    pg.generateTexture('player', 28, 28);
    pg.destroy();

    const og = this.add.graphics();
    og.fillStyle(0x4ff3ff, 1);
    og.fillCircle(9, 9, 9);
    og.generateTexture('orb', 18, 18);
    og.destroy();

    this.player = this.add.sprite(width / 2, height - 60, 'player');
    this.orb = this.add.sprite(width / 2, 120, 'orb');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.label = this.add.text(12, 12, `ORBS 0 / ${GOAL}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eaf1ff',
    });
    this.add.text(12, height - 26, 'Arrows / WASD to move · touch the orb · R to restart', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#8fa2cc',
    });

    this.input.keyboard.on('keydown-R', () => this.ctx?.restart());
    this.placeOrb();
  }

  placeOrb() {
    const { width, height } = this.scale;
    this.orb.setPosition(
      40 + Math.random() * Math.max(1, width - 80),
      60 + Math.random() * Math.max(1, height - 160),
    );
  }

  update(_, delta) {
    if (this.score >= GOAL) return;
    const dt = delta / 1000;
    const speed = 260;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }

    const { width, height } = this.scale;
    this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed * dt, 16, width - 16);
    this.player.y = Phaser.Math.Clamp(this.player.y + vy * speed * dt, 16, height - 16);

    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.orb.x, this.orb.y) < 26) {
      this.score += 1;
      this.label.setText(`ORBS ${this.score} / ${GOAL}`);
      this.ctx?.services.audio.play({ freq: 520 + this.score * 40, duration: 0.1, type: 'triangle', gain: 0.25 });
      this.ctx?.services.scores.submit(this.score, 'high');
      if (this.score >= GOAL) {
        this.ctx?.reportResult({ win: true, score: this.score });
        this.add.text(width / 2, height / 2, `All ${GOAL} collected!\nPress R to restart`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#4ff3ff', align: 'center',
        }).setOrigin(0.5);
      } else {
        this.placeOrb();
      }
    }
  }
}
