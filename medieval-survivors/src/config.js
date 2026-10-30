// =============================================================
// CONFIGURAÇÃO DO JOGO
// Todos os números de equilíbrio estão aqui. Muda à vontade e
// recarrega a página para sentires a diferença.
// =============================================================

const CONFIG = {
  // Tamanho do ecrã e do mapa (o mapa é maior; a câmara segue o herói)
  screen: { width: 960, height: 640 },
  world: { width: 1800, height: 1400 },

  // Vagas: no design final são 300 s (5 min). Para testar usamos 60 s.
  waves: {
    count: 5,          // vagas até à vitória
    duration: 60,      // segundos até aparecer o boss
    breakTime: 8,      // pausa (sem inimigos) depois de matar o boss
  },

  hero: {
    speed: 180,
    maxHp: 100,
    pickupRadius: 34,  // distância a que apanhas moedas
    invulnMs: 500,     // tempo invencível depois de levar dano
  },

  coins: {
    startWith: 0,
    lifetime: 12000,   // ms até a moeda desaparecer
    blinkAt: 3000,     // começa a piscar nos últimos 3 s
  },

  // Ritmo de aparecimento de inimigos (inimigos por segundo)
  spawn: {
    baseRate: 1.0,
    perWave: 0.5,       // + por cada vaga
    rampInWave: 1.5,    // + ao longo da vaga (do início até ao boss)
    duringBoss: 0.4,    // fração do ritmo enquanto o boss está vivo
    maxEnemies: 250,
    hpPerWave: 0.25,    // +25% vida dos inimigos por vaga
  },

  enemies: {
    goblin:    { name: 'Goblin',    hp: 8,  speed: 95, damage: 5,  coins: 1, size: 10, color: 0x6abe30 },
    esqueleto: { name: 'Esqueleto', hp: 18, speed: 65, damage: 8,  coins: 2, size: 12, color: 0xd9d9d9 },
    ogre:      { name: 'Ogre',      hp: 60, speed: 42, damage: 15, coins: 5, size: 18, color: 0x8f563b },
  },

  boss: { name: 'Senhor da Guerra', hp: 500, hpPerWave: 0.6, speed: 55, damage: 25, coins: 30, size: 34, color: 0x9b1d20 },

  // ---------------------------------------------------------
  // CONSTRUÇÕES: cada nível é mais caro e mais forte.
  // ---------------------------------------------------------
  offersPerSpot: 2, // quantas construções aleatórias cada lugar oferece
  buildings: {
    torre: {
      name: 'Torre de Arqueiros', category: 'Ofensiva', color: 0xb0413e,
      desc: 'Dispara flechas ao inimigo mais próximo',
      levels: [
        { cost: 15, range: 200, damage: 6,  fireRate: 900 },
        { cost: 35, range: 240, damage: 10, fireRate: 700 },
        { cost: 70, range: 280, damage: 16, fireRate: 500 },
      ],
    },
    espinhos: {
      name: 'Campo de Espinhos', category: 'Controlo', color: 0x5b6ee1,
      desc: 'Abranda e fere os inimigos na área',
      levels: [
        { cost: 12, radius: 80,  slow: 0.55, dps: 3 },
        { cost: 30, radius: 100, slow: 0.45, dps: 6 },
        { cost: 60, radius: 125, slow: 0.30, dps: 10 },
      ],
    },
    mina: {
      name: 'Mina de Ouro', category: 'Economia', color: 0xe0b020,
      desc: 'Produz moedas de tempos a tempos',
      levels: [
        { cost: 20, every: 6000, coins: 2 },
        { cost: 40, every: 5000, coins: 3 },
        { cost: 80, every: 4000, coins: 5 },
      ],
    },
    santuario: {
      name: 'Santuário', category: 'Suporte', color: 0x99e550,
      desc: 'Cura o herói e dá +dano enquanto estiveres na área',
      levels: [
        { cost: 18, radius: 100, heal: 2, dmgBonus: 0.15 },
        { cost: 40, radius: 120, heal: 4, dmgBonus: 0.25 },
        { cost: 75, radius: 140, heal: 7, dmgBonus: 0.40 },
      ],
    },
  },

  // Lugares de construção marcados no mapa (x, y)
  spots: [
    { x: 900,  y: 330 }, { x: 900,  y: 1070 },
    { x: 560,  y: 470 }, { x: 1240, y: 470 },
    { x: 420,  y: 700 }, { x: 1380, y: 700 },
    { x: 560,  y: 930 }, { x: 1240, y: 930 },
  ],

  // ---------------------------------------------------------
  // FORJA: melhorias do herói (3 aleatórias de cada vez)
  // ---------------------------------------------------------
  forge: { x: 900, y: 620, baseCost: 10, growth: 1.4, offers: 3 },
  heroUpgrades: [
    { name: 'Força',       desc: '+20% dano',                  apply: s => { s.damageMult *= 1.2; } },
    { name: 'Agilidade',   desc: '-12% tempo de recarga',      apply: s => { s.cooldownMult *= 0.88; } },
    { name: 'Botas Leves', desc: '+12% velocidade',            apply: s => { s.speed *= 1.12; } },
    { name: 'Vigor',       desc: '+25 vida máxima',            apply: s => { s.maxHp += 25; s.hp += 25; } },
    { name: 'Bolsa Grande',desc: '+35% raio para apanhar moedas', apply: s => { s.pickupRadius *= 1.35; } },
    { name: 'Mão Rápida',  desc: '+1 adaga por disparo',       apply: s => { s.extraProjectiles += 1; } },
    { name: 'Regeneração', desc: '+0.6 vida por segundo',      apply: s => { s.regen += 0.6; } },
  ],

  // ---------------------------------------------------------
  // ARMAS: começas com Adagas, as outras caem dos bosses.
  // Se já tiveres a arma, o baú sobe-lhe o nível.
  // ---------------------------------------------------------
  weaponDamagePerLevel: 0.3, // +30% dano por nível de arma
  weapons: {
    adaga:   { name: 'Adagas',              cooldown: 750,  damage: 5,  speed: 420, range: 420 },
    espadas: { name: 'Espadas Orbitais',    damage: 5,  radius: 62, rotSpeed: 3.2, hitCooldown: 450 },
    martelo: { name: 'Martelo Sísmico',     cooldown: 2600, damage: 14, radius: 110, knockback: 40 },
    machado: { name: 'Machado Arremessado', cooldown: 1300, damage: 10, speed: 340, pierce: 6, life: 1400 },
  },
};
