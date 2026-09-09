/**
 * js/sprites.js - Authentic Chibi Character & Bomb Sprites
 * 
 * Renders high-resolution chibi illustrations extracted from the reference game art:
 * - Small Hiker, Sumo Hiker, Attack Hiker, Doctor Hiker
 * - Instant Kill, Timer Bomb, Area Bomb, Shock Bomb
 * - Enhanced with dynamic team-colored halos, combat auras, and stun effects.
 */

window.Sprites = {
  /**
   * Get sprite HTML for a Hiker unit
   * @param {string} type 'small' | 'sumo' | 'attack' | 'doctor'
   * @param {number} player 1 (Blue) | 2 (Red)
   * @param {object} opts optional state like { stunned: boolean }
   */
  getHiker(type, player = 1, opts = {}) {
    const isStunned = Boolean(opts.stunned);
    const pClass = player === 1 ? "team-p1" : "team-p2";
    const stunClass = isStunned ? "unit-stunned" : "";

    return `
      <div class="hiker-sprite-wrap ${pClass} ${stunClass}" data-type="${type}">
        <div class="team-disc"></div>
        <img src="assets/sprites/hiker_${type}.png" class="hiker-avatar-img" alt="${type}" draggable="false" />
        ${isStunned ? '<span class="stun-stars">💫</span>' : ''}
      </div>
    `;
  },

  /**
   * Get sprite HTML for a Bomb weapon
   * @param {string} type 'instant' | 'timer' | 'area' | 'shock'
   * @param {number} player 1 (Blue) | 2 (Red)
   */
  getBomb(type, player = 1) {
    const pClass = player === 1 ? "team-p1" : "team-p2";

    return `
      <div class="bomb-sprite-wrap ${pClass} bomb-${type}">
        <img src="assets/sprites/bomb_${type}.png" class="bomb-avatar-img" alt="${type}" draggable="false" />
      </div>
    `;
  }
};
