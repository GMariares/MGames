// =============================================================
// MEDIEVAL SURVIVORS — protótipo
// Uma única "Scene" do Phaser com todo o jogo.
// Ordem de leitura sugerida: create() -> update() -> resto.
// =============================================================

const DIRECTIONS = ['Norte', 'Sul', 'Este', 'Oeste'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  // -----------------------------------------------------------
  // CRIAÇÃO
  // -----------------------------------------------------------
  create() {
    this.makeTextures();

    const W = CONFIG.world;
    this.physics.world.setBounds(0, 0, W.width, W.height);
    this.add.tileSprite(0, 0, W.width, W.height, 'grass').setOrigin(0).setDepth(0);
    this.add.rectangle(W.width / 2, W.height / 2, W.width, W.height).setStrokeStyle(6, 0x3b2a1a).setDepth(0);

    // Herói e os seus atributos (as melhorias mexem nestes valores)
    this.hero = this.physics.add.sprite(W.width / 2, W.height / 2 + 90, 'hero').setDepth(5);
    this.hero.setCollideWorldBounds(true);
    this.hero.body.setCircle(14);
    this.stats = {
      ...CONFIG.hero,
      hp: CONFIG.hero.maxHp,
      damageMult: 1,
      cooldownMult: 1,
      extraProjectiles: 0,
      regen: 0,
    };
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.invulnUntil = 0;

    this.coins = CONFIG.coins.startWith;
    this.weapons = { adaga: 1 };   // nome da arma -> nível
    this.weaponTimers = {};
    this.blades = [];
    this.bladeAngle = 0;
    this.forgePurchases = 0;
    this.sanctuaryBonus = 0;

    // Grupos de objetos
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.coinGroup = this.add.group();
    this.chests = this.add.group();

    this.createSpots();
    this.createForge();

    // Física: inimigos empurram-se uns aos outros, tocam no herói, levam com projéteis
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.hero, this.enemies, this.onHeroTouched, null, this);
    this.physics.add.overlap(this.projectiles, this.enemies, this.onProjectileHit, null, this);

    this.cameras.main.setBounds(0, 0, W.width, W.height);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,E,R');
    this.createTouchControls();

    this.createHud();

    this.state = 'fighting'; // fighting | boss | break | over
    this.startWave(1);
  }

  // Desenha as imagens do jogo com formas simples (sem ficheiros de arte)
  makeTextures() {
    if (this.textures.exists('hero')) return; // já criadas (reinício)
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const tex = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };

    tex('grass', 64, 64, g => {
      g.fillStyle(0x3e6b2f).fillRect(0, 0, 64, 64);
      g.fillStyle(0x467a35);
      [[8, 10], [40, 6], [22, 30], [52, 40], [12, 50], [34, 56]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
    });
    tex('hero', 28, 28, g => {
      g.fillStyle(0x3f7fd9).fillCircle(14, 14, 13);
      g.lineStyle(2, 0xffffff).strokeCircle(14, 14, 13);
      g.fillStyle(0xc0c0c0).fillRect(9, 5, 10, 6); // elmo
    });
    Object.entries(CONFIG.enemies).forEach(([key, e]) => {
      const s = e.size;
      tex('e_' + key, s * 2 + 2, s * 2 + 2, g => {
        g.fillStyle(e.color).fillCircle(s + 1, s + 1, s);
        g.lineStyle(2, 0x000000, 0.5).strokeCircle(s + 1, s + 1, s);
        g.fillStyle(0xff0000).fillRect(s - 4, s - 3, 3, 3).fillRect(s + 2, s - 3, 3, 3);
      });
    });
    const b = CONFIG.boss;
    tex('boss', b.size * 2 + 4, b.size * 2 + 4, g => {
      g.fillStyle(b.color).fillCircle(b.size + 2, b.size + 2, b.size);
      g.lineStyle(4, 0x000000, 0.6).strokeCircle(b.size + 2, b.size + 2, b.size);
      g.fillStyle(0xffd23f).fillTriangle(b.size - 14, 14, b.size - 6, 0, b.size + 2, 14)
        .fillTriangle(b.size + 2, 14, b.size + 10, 0, b.size + 18, 14);
    });
    tex('coin', 12, 12, g => {
      g.fillStyle(0xffd23f).fillCircle(6, 6, 5);
      g.lineStyle(1.5, 0xa0701a).strokeCircle(6, 6, 5);
    });
    tex('dagger', 12, 4, g => g.fillStyle(0xe0e0e0).fillRect(0, 0, 12, 4));
    tex('arrow', 14, 3, g => g.fillStyle(0x8a5a2b).fillRect(0, 0, 14, 3));
    tex('axe', 16, 16, g => {
      g.fillStyle(0x6b4a2b).fillRect(7, 0, 3, 16);
      g.fillStyle(0xb8b8b8).fillTriangle(9, 1, 16, 4, 9, 9);
    });
    tex('blade', 20, 6, g => g.fillStyle(0xcfe8ff).fillRect(0, 0, 20, 6));
    tex('chest', 24, 18, g => {
      g.fillStyle(0x7a4a1e).fillRect(0, 0, 24, 18);
      g.lineStyle(2, 0xffd23f).strokeRect(1, 1, 22, 16);
      g.fillStyle(0xffd23f).fillRect(10, 6, 4, 5);
    });
    tex('spot', 60, 60, g => {
      g.lineStyle(2, 0xf0e6c8, 0.7).strokeCircle(30, 30, 27);
      g.fillStyle(0xf0e6c8, 0.12).fillCircle(30, 30, 27);
    });
    tex('forge', 48, 40, g => {
      g.fillStyle(0x3a3a3a).fillRect(4, 12, 40, 18).fillRect(14, 30, 20, 10);
      g.fillStyle(0xff7a1a).fillRect(10, 8, 28, 5);
    });
    Object.entries(CONFIG.buildings).forEach(([key, bd]) => {
      tex('b_' + key, 40, 40, g => {
        g.fillStyle(bd.color).fillRect(2, 2, 36, 36);
        g.lineStyle(3, 0x000000, 0.5).strokeRect(2, 2, 36, 36);
      });
    });
    g.destroy();
  }

  // Lugares de construção: cada um sorteia que construções oferece
  createSpots() {
    const types = Object.keys(CONFIG.buildings);
    this.spots = CONFIG.spots.map(p => {
      const spot = {
        x: p.x, y: p.y,
        offers: Phaser.Utils.Array.Shuffle([...types]).slice(0, CONFIG.offersPerSpot),
        building: null,
      };
      spot.ring = this.add.image(p.x, p.y, 'spot').setDepth(1);
      spot.label = this.add.text(p.x, p.y, '+', { fontSize: '24px', color: '#f0e6c8' }).setOrigin(0.5).setDepth(1);
      return spot;
    });
  }

  createForge() {
    const f = CONFIG.forge;
    this.forge = { x: f.x, y: f.y, isForge: true, offers: [] };
    this.add.image(f.x, f.y, 'spot').setDepth(1).setTint(0xff9a3a);
    this.add.image(f.x, f.y, 'forge').setDepth(2);
    this.add.text(f.x, f.y + 34, 'FORJA', { fontSize: '12px', color: '#ffb36b' }).setOrigin(0.5).setDepth(2);
    this.rollForgeOffers();
  }

  rollForgeOffers() {
    this.forge.offers = Phaser.Utils.Array.Shuffle([...CONFIG.heroUpgrades]).slice(0, CONFIG.forge.offers);
  }

  createHud() {
    const fixed = obj => obj.setScrollFactor(0).setDepth(100);
    this.hudGfx = fixed(this.add.graphics());
    this.hudText = fixed(this.add.text(16, 36, '', { fontSize: '15px', color: '#ffffff', lineSpacing: 4 }));
    this.centerText = fixed(this.add.text(CONFIG.screen.width / 2, 150, '', {
      fontSize: '28px', color: '#ffe9a8', align: 'center', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5));
    this.panelBg = fixed(this.add.rectangle(CONFIG.screen.width / 2, CONFIG.screen.height - 70, 620, 120, 0x000000, 0.7));
    this.panelBg.setInteractive().on('pointerdown', p => this.onPanelTap(p));
    this.panelText = fixed(this.add.text(CONFIG.screen.width / 2 - 296, CONFIG.screen.height - 124, '', {
      fontSize: '14px', color: '#ffffff', lineSpacing: 3,
    }));
  }

  // Telemóvel: arrastar o dedo em qualquer sítio funciona como joystick
  createTouchControls() {
    this.joy = null;
    this.joyGfx = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.input.addPointer(1);

    this.input.on('pointerdown', (p, over) => {
      if (this.state === 'over') { this.scene.restart(); return; }
      if (over.length || this.joy) return; // toque no painel, ou já há joystick
      this.joy = { id: p.id, x: p.x, y: p.y, dx: 0, dy: 0 };
    });
    this.input.on('pointermove', p => {
      if (!this.joy || p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.x, p.y - this.joy.y);
      const max = 50;
      if (v.length() > max) v.setLength(max);
      this.joy.dx = v.x / max;
      this.joy.dy = v.y / max;
    });
    this.input.on('pointerup', p => {
      if (this.joy && p.id === this.joy.id) this.joy = null;
    });
  }

  // -----------------------------------------------------------
  // CICLO PRINCIPAL (corre ~60 vezes por segundo)
  // -----------------------------------------------------------
  update(time, deltaMs) {
    if (this.state === 'over') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
      return;
    }
    const dt = deltaMs / 1000;

    this.updateHero(dt);
    this.updateWave(dt);

    // As construções podem abrandar inimigos, por isso o "slow" é reposto antes
    this.enemies.getChildren().forEach(e => { e.slow = 1; });
    this.updateBuildings(dt, time);
    this.updateEnemies(time);
    this.updateWeapons(dt, time);
    this.updateProjectiles(time);
    this.updateCoins(time);
    this.updateChests();
    this.updateInteraction();
    this.updateHud();
  }

  updateHero(dt) {
    const k = this.keys;
    const dir = new Phaser.Math.Vector2(
      (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown),
      (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown),
    );
    const joy = this.joy;
    this.joyGfx.clear();
    if (joy) {
      this.joyGfx.lineStyle(2, 0xffffff, 0.4).strokeCircle(joy.x, joy.y, 50);
      this.joyGfx.fillStyle(0xffffff, 0.35).fillCircle(joy.x + joy.dx * 50, joy.y + joy.dy * 50, 18);
      if (Math.hypot(joy.dx, joy.dy) > 0.15) dir.set(joy.dx, joy.dy);
    }
    if (dir.lengthSq() > 0) {
      if (dir.length() > 1 || !joy) dir.normalize();
      this.facing.copy(dir).normalize();
    }
    this.hero.setVelocity(dir.x * this.stats.speed, dir.y * this.stats.speed);

    if (this.stats.regen > 0) this.heal(this.stats.regen * dt);
    this.hero.setAlpha(this.time.now < this.invulnUntil ? 0.5 : 1);
  }

  heal(amount) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  // -----------------------------------------------------------
  // VAGAS
  // -----------------------------------------------------------
  startWave(n) {
    this.wave = n;
    this.waveTime = 0;
    this.spawnAcc = 0;
    this.state = 'fighting';

    // Cada vaga é diferente: direções e mistura de inimigos aleatórias
    const maxDirs = Math.min(4, 1 + Math.ceil(n / 2));
    this.waveDirs = Phaser.Utils.Array.Shuffle([...DIRECTIONS]).slice(0, Phaser.Math.Between(1, maxDirs));
    this.waveMix = {
      goblin: Phaser.Math.Between(1, 4),
      esqueleto: Phaser.Math.Between(1, 4),
      ogre: n >= 2 ? Phaser.Math.Between(0, 2) : 0,
    };
    this.showMessage(`Vaga ${n}\nInimigos vêm de: ${this.waveDirs.join(', ')}`, 3000);
  }

  updateWave(dt) {
    if (this.state === 'break') {
      this.breakTime -= dt;
      if (this.breakTime <= 0) this.startWave(this.wave + 1);
      return;
    }

    this.waveTime += dt;
    const S = CONFIG.spawn;
    const progress = Math.min(1, this.waveTime / CONFIG.waves.duration);
    let rate = S.baseRate + S.perWave * (this.wave - 1) + S.rampInWave * progress;
    if (this.state === 'boss') rate *= S.duringBoss;

    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.countActive() < S.maxEnemies) this.spawnEnemy(this.pickEnemyType());
    }

    if (this.state === 'fighting' && this.waveTime >= CONFIG.waves.duration) this.spawnBoss();
  }

  pickEnemyType() {
    const entries = Object.entries(this.waveMix);
    let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [type, w] of entries) {
      if ((r -= w) < 0) return type;
    }
    return entries[0][0];
  }

  // Posição aleatória numa das margens do mapa por onde a vaga entra
  edgePosition(dirName) {
    const W = CONFIG.world, m = 20;
    switch (dirName) {
      case 'Norte': return { x: Phaser.Math.Between(m, W.width - m), y: m };
      case 'Sul':   return { x: Phaser.Math.Between(m, W.width - m), y: W.height - m };
      case 'Este':  return { x: W.width - m, y: Phaser.Math.Between(m, W.height - m) };
      default:      return { x: m, y: Phaser.Math.Between(m, W.height - m) };
    }
  }

  spawnEnemy(type) {
    const def = CONFIG.enemies[type];
    const pos = this.edgePosition(Phaser.Utils.Array.GetRandom(this.waveDirs));
    const e = this.enemies.create(pos.x, pos.y, 'e_' + type).setDepth(4);
    e.body.setCircle(def.size, 1, 1);
    e.hp = def.hp * (1 + CONFIG.spawn.hpPerWave * (this.wave - 1));
    e.speed = def.speed * Phaser.Math.FloatBetween(0.9, 1.1);
    e.damage = def.damage;
    e.coinValue = def.coins;
    e.slow = 1;
    return e;
  }

  spawnBoss() {
    const B = CONFIG.boss;
    const pos = this.edgePosition(Phaser.Utils.Array.GetRandom(this.waveDirs));
    const e = this.enemies.create(pos.x, pos.y, 'boss').setDepth(4);
    e.body.setCircle(B.size, 2, 2);
    e.body.pushable = false; // os outros inimigos não o empurram
    e.isBoss = true;
    e.hp = e.maxHp = B.hp * (1 + B.hpPerWave * (this.wave - 1));
    e.speed = B.speed;
    e.damage = B.damage;
    e.coinValue = B.coins;
    e.slow = 1;
    this.boss = e;
    this.state = 'boss';
    this.showMessage(`${B.name} chegou!`, 2500);
  }

  onBossDefeated(x, y) {
    this.boss = null;
    const chest = this.add.image(x, y, 'chest').setDepth(3);
    this.chests.add(chest);

    if (this.wave >= CONFIG.waves.count) {
      this.endGame(true);
      return;
    }
    this.state = 'break';
    this.breakTime = CONFIG.waves.breakTime;
    this.showMessage(`Vaga ${this.wave} concluída!\nApanha o baú do boss`, 3000);
  }

  // -----------------------------------------------------------
  // INIMIGOS
  // -----------------------------------------------------------
  updateEnemies(time) {
    this.enemies.getChildren().forEach(e => {
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.hero.x, this.hero.y);
      const v = e.speed * e.slow;
      e.setVelocity(Math.cos(angle) * v, Math.sin(angle) * v);
      if (e.flashUntil && time > e.flashUntil) {
        e.clearTint();
        e.flashUntil = 0;
      }
    });
  }

  onHeroTouched(hero, enemy) {
    if (this.time.now < this.invulnUntil) return;
    this.invulnUntil = this.time.now + this.stats.invulnMs;
    this.stats.hp -= enemy.damage;
    this.cameras.main.shake(80, 0.004);
    if (this.stats.hp <= 0) this.endGame(false);
  }

  damageEnemy(e, amount, flash = true) {
    if (!e.active) return;
    e.hp -= amount;
    if (flash) {
      e.setTintFill(0xffffff);
      e.flashUntil = this.time.now + 60;
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const spread = e.isBoss ? 45 : 10;
    for (let i = 0; i < e.coinValue; i++) {
      this.dropCoin(e.x + Phaser.Math.Between(-spread, spread), e.y + Phaser.Math.Between(-spread, spread));
    }
    const { x, y } = e;
    const wasBoss = e.isBoss;
    e.destroy();
    if (wasBoss) this.onBossDefeated(x, y);
  }

  nearestEnemy(x, y, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    this.enemies.getChildren().forEach(e => {
      const d = Phaser.Math.Distance.Squared(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  enemiesInRadius(x, y, r) {
    const r2 = r * r;
    return this.enemies.getChildren().filter(e => Phaser.Math.Distance.Squared(x, y, e.x, e.y) <= r2);
  }

  // -----------------------------------------------------------
  // MOEDAS E BAÚS
  // -----------------------------------------------------------
  dropCoin(x, y) {
    const c = this.add.image(x, y, 'coin').setDepth(3);
    c.bornAt = this.time.now;
    this.coinGroup.add(c);
  }

  updateCoins(time) {
    const C = CONFIG.coins;
    const r2 = this.stats.pickupRadius ** 2;
    this.coinGroup.getChildren().slice().forEach(c => {
      if (Phaser.Math.Distance.Squared(c.x, c.y, this.hero.x, this.hero.y) <= r2) {
        this.coins += 1;
        c.destroy();
        return;
      }
      const age = time - c.bornAt;
      if (age > C.lifetime) {
        c.destroy();
      } else if (age > C.lifetime - C.blinkAt) {
        c.setAlpha(Math.floor(age / 150) % 2 ? 0.25 : 1);
      }
    });
  }

  updateChests() {
    this.chests.getChildren().slice().forEach(ch => {
      if (Phaser.Math.Distance.Between(ch.x, ch.y, this.hero.x, this.hero.y) < 30) {
        ch.destroy();
        this.grantWeapon();
      }
    });
  }

  // Baú do boss: arma nova; se já tiveres todas, sobe o nível de uma
  grantWeapon() {
    const all = Object.keys(CONFIG.weapons);
    const missing = all.filter(w => !this.weapons[w]);
    let key;
    if (missing.length) {
      key = Phaser.Utils.Array.GetRandom(missing);
      this.weapons[key] = 1;
      this.showMessage(`Nova arma: ${CONFIG.weapons[key].name}!`, 2500);
    } else {
      key = Phaser.Utils.Array.GetRandom(all);
      this.weapons[key] += 1;
      this.showMessage(`${CONFIG.weapons[key].name} sobe para nível ${this.weapons[key]}!`, 2500);
    }
    if (key === 'espadas') this.rebuildBlades();
  }

  // -----------------------------------------------------------
  // ARMAS DO HERÓI
  // -----------------------------------------------------------
  weaponDamage(key) {
    const lvl = this.weapons[key];
    const base = CONFIG.weapons[key].damage;
    return base * (1 + CONFIG.weaponDamagePerLevel * (lvl - 1)) * this.stats.damageMult * (1 + this.sanctuaryBonus);
  }

  // true quando a arma está pronta a disparar (e reinicia o temporizador)
  weaponReady(key, dt) {
    const t = (this.weaponTimers[key] ?? 0) - dt * 1000;
    if (t > 0) { this.weaponTimers[key] = t; return false; }
    this.weaponTimers[key] = CONFIG.weapons[key].cooldown * this.stats.cooldownMult;
    return true;
  }

  updateWeapons(dt, time) {
    const W = CONFIG.weapons;
    const h = this.hero;

    if (this.weapons.adaga && this.nearestEnemy(h.x, h.y, W.adaga.range) && this.weaponReady('adaga', dt)) {
      const target = this.nearestEnemy(h.x, h.y, W.adaga.range);
      const base = Phaser.Math.Angle.Between(h.x, h.y, target.x, target.y);
      const count = 1 + this.stats.extraProjectiles;
      for (let i = 0; i < count; i++) {
        const angle = base + (i - (count - 1) / 2) * 0.18;
        this.fireProjectile('dagger', h.x, h.y, angle, W.adaga.speed, this.weaponDamage('adaga'), 1, 1200);
      }
    }

    if (this.weapons.machado && this.weaponReady('machado', dt)) {
      const angle = Math.atan2(this.facing.y, this.facing.x);
      const p = this.fireProjectile('axe', h.x, h.y, angle, W.machado.speed, this.weaponDamage('machado'), W.machado.pierce, W.machado.life);
      p.spin = 12;
    }

    if (this.weapons.martelo && this.weaponReady('martelo', dt)) {
      const r = W.martelo.radius + 15 * (this.weapons.martelo - 1);
      this.enemiesInRadius(h.x, h.y, r).forEach(e => {
        const a = Phaser.Math.Angle.Between(h.x, h.y, e.x, e.y);
        if (!e.isBoss) { e.x += Math.cos(a) * W.martelo.knockback; e.y += Math.sin(a) * W.martelo.knockback; }
        this.damageEnemy(e, this.weaponDamage('martelo'));
      });
      const ring = this.add.circle(h.x, h.y, r, 0xffc070, 0.25).setStrokeStyle(3, 0xffc070).setDepth(6).setScale(0.2);
      this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    }

    if (this.weapons.espadas) {
      this.bladeAngle += W.espadas.rotSpeed * dt;
      const dmg = this.weaponDamage('espadas');
      this.blades.forEach((b, i) => {
        const a = this.bladeAngle + (i / this.blades.length) * Math.PI * 2;
        b.setPosition(h.x + Math.cos(a) * W.espadas.radius, h.y + Math.sin(a) * W.espadas.radius);
        b.setRotation(a + Math.PI / 2);
        this.enemiesInRadius(b.x, b.y, 16).forEach(e => {
          if ((e.bladeHitAt ?? 0) > time) return;
          e.bladeHitAt = time + W.espadas.hitCooldown;
          this.damageEnemy(e, dmg);
        });
      });
    }
  }

  rebuildBlades() {
    this.blades.forEach(b => b.destroy());
    const count = 1 + this.weapons.espadas; // nível 1 = 2 espadas
    this.blades = Array.from({ length: count }, () => this.add.image(0, 0, 'blade').setDepth(6));
  }

  fireProjectile(texture, x, y, angle, speed, damage, pierce, lifeMs) {
    const p = this.projectiles.create(x, y, texture).setDepth(6);
    p.setRotation(angle);
    p.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    p.damage = damage;
    p.pierce = pierce;
    p.hits = new Set();
    p.dieAt = this.time.now + lifeMs;
    return p;
  }

  onProjectileHit(p, e) {
    if (p.hits.has(e)) return;
    p.hits.add(e);
    this.damageEnemy(e, p.damage);
    p.pierce -= 1;
    if (p.pierce <= 0) p.destroy();
  }

  updateProjectiles(time) {
    this.projectiles.getChildren().slice().forEach(p => {
      if (p.spin) p.rotation += p.spin / 60;
      if (time > p.dieAt) p.destroy();
    });
  }

  // -----------------------------------------------------------
  // CONSTRUÇÕES
  // -----------------------------------------------------------
  buildingStats(spot) {
    const b = spot.building;
    return CONFIG.buildings[b.type].levels[b.level - 1];
  }

  build(spot, type) {
    const cost = CONFIG.buildings[type].levels[0].cost;
    if (this.coins < cost) return;
    this.coins -= cost;
    spot.building = {
      type,
      level: 1,
      timer: 0,
      sprite: this.add.image(spot.x, spot.y, 'b_' + type).setDepth(2),
      area: this.add.graphics().setDepth(1),
    };
    spot.label.setDepth(3).setFontSize(16).setColor('#ffffff').setStroke('#000', 3);
    this.refreshBuildingVisual(spot);
  }

  upgrade(spot) {
    const b = spot.building;
    const levels = CONFIG.buildings[b.type].levels;
    if (b.level >= levels.length) return;
    const cost = levels[b.level].cost;
    if (this.coins < cost) return;
    this.coins -= cost;
    b.level += 1;
    this.refreshBuildingVisual(spot);
  }

  refreshBuildingVisual(spot) {
    const b = spot.building;
    const def = CONFIG.buildings[b.type];
    const s = this.buildingStats(spot);
    spot.label.setText(ROMAN[b.level]);
    b.sprite.setScale(1 + 0.12 * (b.level - 1));
    b.area.clear();
    const r = s.range ?? s.radius;
    if (r) b.area.lineStyle(2, def.color, 0.45).strokeCircle(spot.x, spot.y, r).fillStyle(def.color, 0.07).fillCircle(spot.x, spot.y, r);
  }

  updateBuildings(dt, time) {
    this.sanctuaryBonus = 0;
    const h = this.hero;

    this.spots.forEach(spot => {
      const b = spot.building;
      if (!b) return;
      const s = this.buildingStats(spot);

      switch (b.type) {
        case 'torre': {
          b.timer -= dt * 1000;
          if (b.timer > 0) break;
          const target = this.nearestEnemy(spot.x, spot.y, s.range);
          if (!target) break;
          b.timer = s.fireRate;
          const angle = Phaser.Math.Angle.Between(spot.x, spot.y, target.x, target.y);
          this.fireProjectile('arrow', spot.x, spot.y, angle, 520, s.damage, 1, 900);
          break;
        }
        case 'espinhos':
          this.enemiesInRadius(spot.x, spot.y, s.radius).forEach(e => {
            e.slow = Math.min(e.slow, s.slow);
            this.damageEnemy(e, s.dps * dt, false);
          });
          break;
        case 'mina':
          b.timer += dt * 1000;
          if (b.timer >= s.every) {
            b.timer = 0;
            for (let i = 0; i < s.coins; i++) this.dropCoin(spot.x + Phaser.Math.Between(-30, 30), spot.y + Phaser.Math.Between(22, 40));
          }
          break;
        case 'santuario':
          if (Phaser.Math.Distance.Between(spot.x, spot.y, h.x, h.y) <= s.radius) {
            this.heal(s.heal * dt);
            this.sanctuaryBonus = Math.max(this.sanctuaryBonus, s.dmgBonus);
          }
          break;
      }
    });
  }

  // -----------------------------------------------------------
  // INTERAÇÃO COM LUGARES DE CONSTRUÇÃO E FORJA (o jogo não pausa!)
  // -----------------------------------------------------------
  updateInteraction() {
    const h = this.hero;
    const near = p => Phaser.Math.Distance.Between(p.x, p.y, h.x, h.y) < 45;
    const spot = near(this.forge) ? this.forge : this.spots.find(near);
    const k = this.keys;

    // Cada linha do painel: texto + (opcional) tecla e ação.
    // A mesma ação corre com a tecla ou tocando na linha (telemóvel).
    const lines = [];
    const add = (text, keys = [], action = null) => lines.push({ text, keys, action });
    const priceTag = cost => (this.coins >= cost ? `${cost} moedas` : `${cost} moedas (faltam ${cost - this.coins})`);
    const optionKeys = [k.ONE, k.TWO, k.THREE];

    if (!spot) {
      // nada
    } else if (spot.isForge) {
      const cost = this.forgeCost();
      add(`FORJA DO HERÓI — cada melhoria custa ${priceTag(cost)}`);
      spot.offers.forEach((u, i) => add(`[${i + 1}] ${u.name}: ${u.desc}`, [optionKeys[i]], () => this.buyHeroUpgrade(u)));
    } else if (!spot.building) {
      add('LUGAR DE CONSTRUÇÃO — escolhe:');
      spot.offers.forEach((type, i) => {
        const def = CONFIG.buildings[type];
        const action = () => this.build(spot, type);
        add(`[${i + 1}] ${def.name} (${def.category}) — ${priceTag(def.levels[0].cost)}`, [optionKeys[i]], action);
        add(`     ${def.desc}`, [], action);
      });
    } else {
      const b = spot.building;
      const def = CONFIG.buildings[b.type];
      add(`${def.name.toUpperCase()} — nível ${ROMAN[b.level]}`);
      add(def.desc);
      if (b.level < def.levels.length) {
        add(`[E] Evoluir para nível ${ROMAN[b.level + 1]} — ${priceTag(def.levels[b.level].cost)}`, [k.E, k.ONE], () => this.upgrade(spot));
      } else {
        add('Nível máximo');
      }
    }

    this.panelLines = lines;
    this.panelBg.setVisible(lines.length > 0);
    this.panelText.setVisible(lines.length > 0).setText(lines.map(l => l.text).join('\n'));

    // Teclado (JustDown é chamado em todas as teclas para não ficar "pendente")
    let fired = false;
    lines.forEach(l => l.keys.forEach(key => {
      if (Phaser.Input.Keyboard.JustDown(key) && l.action && !fired) { fired = true; l.action(); }
    }));
  }

  // Toque no painel: descobre em que linha se tocou
  onPanelTap(pointer) {
    const lines = this.panelLines ?? [];
    if (!lines.length) return;
    const lineHeight = this.panelText.height / lines.length;
    const line = lines[Math.floor((pointer.y - this.panelText.y) / lineHeight)];
    if (line && line.action) line.action();
  }

  buyHeroUpgrade(upgrade) {
    const cost = this.forgeCost();
    if (this.coins < cost) return;
    this.coins -= cost;
    this.forgePurchases += 1;
    upgrade.apply(this.stats);
    this.showMessage(upgrade.name + '!', 1200);
    this.rollForgeOffers();
  }

  forgeCost() {
    return Math.round(CONFIG.forge.baseCost * CONFIG.forge.growth ** this.forgePurchases);
  }

  // -----------------------------------------------------------
  // HUD E MENSAGENS
  // -----------------------------------------------------------
  updateHud() {
    const g = this.hudGfx;
    const s = this.stats;
    g.clear();
    g.fillStyle(0x000000, 0.6).fillRect(14, 12, 204, 18);
    g.fillStyle(0xd23c3c).fillRect(16, 14, 200 * Math.max(0, s.hp) / s.maxHp, 14);

    let waveInfo;
    if (this.state === 'boss') waveInfo = 'BOSS!';
    else if (this.state === 'break') waveInfo = `próxima vaga em ${Math.ceil(this.breakTime)}s`;
    else waveInfo = `boss em ${Math.ceil(CONFIG.waves.duration - this.waveTime)}s`;

    const weaponList = Object.entries(this.weapons).map(([k, lvl]) => `${CONFIG.weapons[k].name} ${ROMAN[lvl]}`).join(', ');
    this.hudText.setText([
      `Vida ${Math.ceil(s.hp)}/${s.maxHp}`,
      `Moedas: ${this.coins}`,
      `Vaga ${this.wave}/${CONFIG.waves.count} — ${waveInfo}`,
      `Armas: ${weaponList}`,
      this.sanctuaryBonus > 0 ? `Bênção do Santuário: +${Math.round(this.sanctuaryBonus * 100)}% dano` : '',
    ].join('\n'));

    if (this.boss && this.boss.active) {
      const w = 400, x = (CONFIG.screen.width - w) / 2;
      g.fillStyle(0x000000, 0.6).fillRect(x - 2, 14, w + 4, 16);
      g.fillStyle(0x9b1d20).fillRect(x, 16, w * Math.max(0, this.boss.hp) / this.boss.maxHp, 12);
    }
  }

  showMessage(text, ms) {
    this.centerText.setText(text).setAlpha(1);
    this.tweens.killTweensOf(this.centerText);
    this.tweens.add({ targets: this.centerText, alpha: 0, delay: ms, duration: 400 });
  }

  endGame(won) {
    this.state = 'over';
    this.physics.pause();
    this.tweens.killTweensOf(this.centerText);
    const msg = won
      ? `VITÓRIA!\nSobreviveste às ${CONFIG.waves.count} vagas`
      : `Morreste na vaga ${this.wave}`;
    this.centerText.setText(msg + '\n\nPrime R (ou toca no ecrã) para recomeçar').setAlpha(1);
    this.panelBg.setVisible(false);
    this.panelText.setVisible(false);
  }
}

// Arranque do Phaser (window.game permite inspecionar o jogo na consola do browser)
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CONFIG.screen.width,
  height: CONFIG.screen.height,
  backgroundColor: '#1d2b1a',
  physics: { default: 'arcade', arcade: { debug: false } },
  parent: 'game',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});
