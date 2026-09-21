/**
 * js/ai.js - Optional AI Opponent Logic for Solo Testing
 * 
 * If enabled via the Bot toggle:
 * - Deploys P2 hikers in the right-side base camp (rows 12-14, cols 4-8) climbing UP
 * - Drops tactical bombs to counter P1 hikers getting close to Row 0 Peak
 */

window.AISystem = {
  actionCooldown: 0,

  update(dt) {
    if (!window.GameState.aiEnabled || window.GameState.isGameOver || window.GameState.isPaused) {
      return;
    }

    this.actionCooldown -= dt;
    if (this.actionCooldown > 0) return;

    const p2Mana = window.GameState.mana[1];
    const arena = window.GameConfig.ARENA;
    const p1Units = window.GameState.units.filter(u => u.player === 1);
    const p2Units = window.GameState.units.filter(u => u.player === 2);

    // 1. TACTICAL DEFENSE: Intercept enemy hikers dangerously close to summit (Row 0-4)
    const dangerousEnemies = p1Units.filter(u => u.y <= 4).sort((a, b) => a.y - b.y);
    if (dangerousEnemies.length > 0) {
      const targetEnemy = dangerousEnemies[0];
      const instantCard = window.GameConfig.CARDS.find(c => c.id === "instant");
      const shockCard = window.GameConfig.CARDS.find(c => c.id === "shock");
      const areaCard = window.GameConfig.CARDS.find(c => c.id === "area");

      let defCard = null;
      if (instantCard && p2Mana >= instantCard.cost) {
        defCard = instantCard;
      } else if (shockCard && p2Mana >= shockCard.cost) {
        defCard = shockCard;
      } else if (areaCard && p2Mana >= areaCard.cost) {
        defCard = areaCard;
      }

      if (defCard && window.GameSystem.isValidPlacement(2, defCard, targetEnemy.x, targetEnemy.y)) {
        window.GameSystem.executePlacement(2, defCard, targetEnemy.x, targetEnemy.y);
        this.actionCooldown = 1.8 + Math.random() * 0.6;
        return;
      }
    }

    // 2. OFFENSIVE BOMBS: Check for clumped enemy hikers
    if (p1Units.length >= 2) {
      for (let enemy of p1Units) {
        const cluster = window.GameState.getUnitsInRadius(enemy.x, enemy.y, 1).filter(u => u.player === 1);
        if (cluster.length >= 2) {
          const areaCard = window.GameConfig.CARDS.find(c => c.id === "area");
          const shockCard = window.GameConfig.CARDS.find(c => c.id === "shock");
          let bomb = null;
          if (areaCard && p2Mana >= areaCard.cost) bomb = areaCard;
          else if (shockCard && p2Mana >= shockCard.cost) bomb = shockCard;

          if (bomb && window.GameSystem.isValidPlacement(2, bomb, enemy.x, enemy.y)) {
            window.GameSystem.executePlacement(2, bomb, enemy.x, enemy.y);
            this.actionCooldown = 2.0 + Math.random() * 0.7;
            return;
          }
        }
      }
    }

    // 3. STRATEGIC HIKER DEPLOYMENT
    const affordableHikers = window.GameConfig.CARDS.filter(c => c.kind === "hiker" && c.cost <= p2Mana);
    if (affordableHikers.length > 0) {
      // Prioritize role based on current mountain state
      let chosenCard = null;
      const sumoCard = affordableHikers.find(c => c.id === "sumo");
      const doctorCard = affordableHikers.find(c => c.id === "doctor");
      const attackCard = affordableHikers.find(c => c.id === "attack");
      const smallCard = affordableHikers.find(c => c.id === "small");

      if (p2Units.some(u => u.hp < u.maxHp * 0.65) && doctorCard) {
        chosenCard = doctorCard;
      } else if (p1Units.length > p2Units.length && sumoCard) {
        chosenCard = sumoCard;
      } else if (p2Units.length < 2 && attackCard) {
        chosenCard = attackCard;
      } else if (smallCard) {
        chosenCard = smallCard;
      } else {
        chosenCard = affordableHikers[0];
      }

      if (chosenCard) {
        // Find valid placement cells in deploy rows
        const validCells = [];
        const { COLS } = window.GameConfig.GRID;
        for (let y of arena.deployRows) {
          for (let x = 0; x < COLS; x++) {
            if (window.GameSystem.isValidPlacement(2, chosenCard, x, y)) {
              validCells.push({ x, y });
            }
          }
        }

        if (validCells.length > 0) {
          // Prefer columns that target uncaptured summit flags
          const flagCols = [0, 1, 2, 3, 5, 6, 7, 8];
          const uncapturedCols = flagCols.filter((col, idx) => window.GameState.flags[idx] !== 2);
          const preferredCells = validCells.filter(c => uncapturedCols.includes(c.x));
          
          const candidatePool = preferredCells.length > 0 ? preferredCells : validCells;
          const target = candidatePool[Math.floor(Math.random() * candidatePool.length)];

          window.GameSystem.executePlacement(2, chosenCard, target.x, target.y);
          this.actionCooldown = 1.5 + Math.random() * 1.0;
        }
      }
    }
  }
};
