const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure output directories
const outDir = path.join(__dirname, 'assets', 'blocks');
fs.mkdirSync(outDir, { recursive: true });

function makePng(width, height, getPixel) {
  const rowBytes = width * 4 + 1;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = Math.max(0, Math.min(255, Math.round(r)));
      raw[pxOffset + 1] = Math.max(0, Math.min(255, Math.round(g)));
      raw[pxOffset + 2] = Math.max(0, Math.min(255, Math.round(b)));
      raw[pxOffset + 3] = a !== undefined ? Math.max(0, Math.min(255, Math.round(a))) : 255;
    }
  }

  const deflated = zlib.deflateSync(raw);

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
    }
    return ~c;
  }
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Pseudo-random noise helper
function pseudoNoise(x, y, seed = 0) {
  let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed = 0) {
  const s = 0.15;
  const i = pseudoNoise(Math.floor(x * s), Math.floor(y * s), seed);
  const f = pseudoNoise(Math.floor(x * 0.4), Math.floor(y * 0.4), seed + 1);
  return i * 0.7 + f * 0.3;
}

// Distance from line segment (for stone cracks)
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Generate base stone block (128x128)
 */
function renderStoneBlock(options = {}) {
  const {
    baseColor = [118, 112, 108], // Taupe grey stone
    darken = 1.0,
    cracks = [],
    hasGrass = false,
    seed = 1
  } = options;

  return makePng(128, 128, (x, y) => {
    // 1. Base stone color with gentle gradient and stone grain
    const grad = (y / 128) * 12 - (x / 128) * 8;
    const grain = (smoothNoise(x, y, seed) - 0.5) * 22;
    const microGrain = (pseudoNoise(x, y, seed + 5) - 0.5) * 14;

    let r = (baseColor[0] + grad + grain + microGrain) * darken;
    let g = (baseColor[1] + grad + grain + microGrain) * darken;
    let b = (baseColor[2] + grad + grain + microGrain) * darken;

    // 2. Chiseled Bevel Borders (3D game block feel)
    const bSize = 10;
    const outerMortar = 2;

    // Dark outer mortar outline
    if (x < outerMortar || x >= 128 - outerMortar || y < outerMortar || y >= 128 - outerMortar) {
      r *= 0.35;
      g *= 0.35;
      b *= 0.35;
    }
    // Top-Left bevel highlight (light from top-left)
    else if (x < bSize && y >= x && (128 - y) >= x) {
      const f = 1 - x / bSize;
      r = r * (1 + 0.35 * f) + 20 * f;
      g = g * (1 + 0.35 * f) + 20 * f;
      b = b * (1 + 0.35 * f) + 20 * f;
    }
    else if (y < bSize && x >= y && (128 - x) >= y) {
      const f = 1 - y / bSize;
      r = r * (1 + 0.45 * f) + 25 * f;
      g = g * (1 + 0.45 * f) + 25 * f;
      b = b * (1 + 0.45 * f) + 25 * f;
    }
    // Bottom-Right bevel shadow
    else if (x >= 128 - bSize && (128 - x) <= y && (128 - x) <= (128 - y)) {
      const f = (x - (128 - bSize)) / bSize;
      r = r * (1 - 0.45 * f);
      g = g * (1 - 0.45 * f);
      b = b * (1 - 0.45 * f);
    }
    else if (y >= 128 - bSize && (128 - y) <= x && (128 - y) <= (128 - x)) {
      const f = (y - (128 - bSize)) / bSize;
      r = r * (1 - 0.55 * f);
      g = g * (1 - 0.55 * f);
      b = b * (1 - 0.55 * f);
    }

    // 3. Natural Stone Cracks & Fissures
    for (const crack of cracks) {
      for (let i = 0; i < crack.length - 1; i++) {
        const p1 = crack[i];
        const p2 = crack[i + 1];
        const dist = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
        if (dist < 1.2) {
          // Dark core of fissure
          r *= 0.25;
          g *= 0.25;
          b *= 0.25;
        } else if (dist < 2.5 && y > p1[1]) {
          // Bottom-edge highlight of crack
          r = Math.min(255, r * 1.35 + 18);
          g = Math.min(255, g * 1.35 + 18);
          b = Math.min(255, b * 1.35 + 18);
        }
      }
    }

    // 4. Lush Green Grass Overhang (for top summit blocks)
    if (hasGrass) {
      // Procedural ragged grass blade wave
      const grassWave = 14 + Math.sin(x * 0.18) * 6 + Math.sin(x * 0.45) * 5 + Math.cos(x * 0.9) * 3;
      // Ragged hanging triangular teeth / blades
      const bladeIdx = Math.floor(x / 14);
      const bladePhase = (x % 14) / 14;
      const bladeH = 10 + pseudoNoise(bladeIdx, 3) * 14;
      const tipDist = 1 - Math.abs(bladePhase - 0.5) * 2;
      const bladeY = grassWave + tipDist * bladeH;

      if (y <= bladeY) {
        // Inside grass
        const depth = y / bladeY;
        const grassGrain = (pseudoNoise(x, y, 77) - 0.5) * 20;

        // Bright green at top rim transitioning to rich earthy green
        let grR = 100 - depth * 45 + grassGrain;
        let grG = 175 - depth * 55 + grassGrain;
        let grB = 45 - depth * 25 + grassGrain * 0.5;

        // Highlight at top rim of grass
        if (y < 4) {
          grR += 30;
          grG += 40;
          grB += 15;
        }

        r = grR;
        g = grG;
        b = grB;
      } else if (y <= bladeY + 4) {
        // Soft drop shadow cast by grass onto stone
        r *= 0.45;
        g *= 0.45;
        b *= 0.45;
      }
    }

    return [r, g, b, 255];
  });
}

// 1. Top Row Block: Stone with Green Grass Overhang
const topGrassBuf = renderStoneBlock({
  hasGrass: true,
  seed: 42,
  cracks: [
    [[24, 45], [40, 65], [35, 90]],
    [[85, 40], [95, 60], [115, 75]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_top_grass.png'), topGrassBuf);
console.log('Saved block_top_grass.png');

// 2. Stone Block Variation 1 (Diagonal crack from top-left)
const stone1Buf = renderStoneBlock({
  seed: 11,
  cracks: [
    [[15, 15], [35, 30], [55, 35], [75, 55], [85, 80]],
    [[55, 35], [50, 60], [42, 75]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_stone_1.png'), stone1Buf);
console.log('Saved block_stone_1.png');

// 3. Stone Block Variation 2 (Vertical fracture on right)
const stone2Buf = renderStoneBlock({
  seed: 23,
  cracks: [
    [[88, 12], [82, 38], [94, 65], [90, 105], [105, 115]],
    [[82, 38], [68, 50], [60, 68]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_stone_2.png'), stone2Buf);
console.log('Saved block_stone_2.png');

// 4. Stone Block Variation 3 (Center weathering & fissure)
const stone3Buf = renderStoneBlock({
  seed: 37,
  cracks: [
    [[45, 20], [60, 45], [55, 75], [70, 95]],
    [[60, 45], [80, 52], [95, 48]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_stone_3.png'), stone3Buf);
console.log('Saved block_stone_3.png');

// 5. Stone Block Variation 4 (Subtle weathered stone, minimal cracks)
const stone4Buf = renderStoneBlock({
  seed: 59,
  cracks: [
    [[20, 85], [38, 92], [50, 110]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_stone_4.png'), stone4Buf);
console.log('Saved block_stone_4.png');

// 6. Bottom Soil / Dark Stone Block 1 (Rows 12-14 Base Camp)
const soil1Buf = renderStoneBlock({
  baseColor: [78, 70, 65],
  darken: 0.72,
  seed: 81,
  cracks: [
    [[20, 30], [45, 50], [65, 85]],
    [[75, 25], [85, 60]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_soil_1.png'), soil1Buf);
console.log('Saved block_soil_1.png');

// 7. Bottom Soil / Dark Stone Block 2
const soil2Buf = renderStoneBlock({
  baseColor: [72, 64, 60],
  darken: 0.68,
  seed: 94,
  cracks: [
    [[35, 15], [50, 45], [40, 80], [60, 105]]
  ]
});
fs.writeFileSync(path.join(outDir, 'block_soil_2.png'), soil2Buf);
console.log('Saved block_soil_2.png');

// 8. Simple Sky Blue Background Image (use image for the background)
const skyBuf = makePng(512, 512, (x, y) => {
  // Vibrant, cheerful sky blue from top to bottom
  const f = y / 512;
  const r = Math.round(92 + (125 - 92) * f);
  const g = Math.round(180 + (205 - 180) * f);
  const b = Math.round(245 + (255 - 245) * f);
  return [r, g, b, 255];
});
fs.writeFileSync(path.join(__dirname, 'assets', 'bg_sky.png'), skyBuf);
console.log('Saved bg_sky.png in assets/');
