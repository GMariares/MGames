# Medieval Survivors (protótipo)

Roguelite ao estilo *Vampire Survivors*. Os inimigos largam moedas, e essas moedas servem para **construir defesas em lugares marcados do mapa**, **evoluí-las** e **melhorar o herói**.

## Como jogar

Abre `index.html` no browser. Não precisa de instalar nada, porque o Phaser vem de uma CDN.

| Tecla | Ação |
|---|---|
| WASD / setas | Mover |
| 1 / 2 / 3 | Escolher opção no lugar onde estás (construir / forja) |
| E | Evoluir a construção onde estás |
| R | Recomeçar depois de morrer ou ganhar |

No **telemóvel**: arrasta o dedo para mover (joystick), toca numa opção do painel para comprar e toca no ecrã para recomeçar. Joga-se melhor com o telemóvel deitado.

O herói ataca sozinho. Para construir ou comprar, tens de estar **em cima** do lugar, e o jogo **não pausa** enquanto o fazes.

## Estrutura

```
index.html      carrega o Phaser e os scripts
src/config.js   TODOS os números do jogo (vida, custos, dano, vagas...)
src/game.js     a lógica (uma Scene do Phaser)
```

Para aprender, o melhor ponto de partida é mexer em `src/config.js` e recarregar a página. Em `game.js`, lê primeiro o `create()` e o `update()`, que é o ciclo que corre 60 vezes por segundo.

Na consola do browser (F12) podes fazer batota para testar, por exemplo:
```js
game.scene.getScene('Game').coins = 999
```

## Decisões de design (até agora)

- **Tema:** fantasia medieval. Um herói que luta.
- **Moedas** substituem o XP. Caem dos inimigos, **tens de as ir buscar** e **desaparecem** ao fim de 12 s.
- **Construções** só em **lugares marcados**. Cada lugar oferece **2 tipos aleatórios** (sorteados por partida).
- **4 categorias:** Ofensiva (Torre de Arqueiros), Controlo (Campo de Espinhos), Economia (Mina de Ouro), Suporte (Santuário).
- Cada construção tem **3 níveis**, cada um mais caro e mais forte.
- **Melhorias do herói** compram-se na **Forja** (centro do mapa): 3 opções aleatórias, preço sobe a cada compra.
- **Armas** caem dos **bosses** (num baú). Se já tens todas, o baú sobe o nível de uma.
- **Vagas** terminam com um **boss**. Cada vaga sorteia **de que lados** vêm os inimigos e a **mistura** de tipos.
- **Perdes** quando o herói morre.
- Design final: vagas de **5 min**. No protótipo são **60 s** (`CONFIG.waves.duration`).

## Perguntas em aberto

1. Os inimigos devem atacar as construções? Neste momento são invencíveis.
2. O que fica de uma partida para a outra (progressão permanente)?
3. Quantas vagas tem uma partida completa?
4. A Mina de Ouro compensa? (é preciso medir: quanto custa e quanto rende)
5. O mapa deve mudar entre partidas (lugares noutras posições)?
