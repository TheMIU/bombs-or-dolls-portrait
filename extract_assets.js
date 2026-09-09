const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const refImgPath = path.join(__dirname, 'ChatGPT Image Sep 9, 2026, 01_30_44 PM.png');
const refPng = PNG.sync.read(fs.readFileSync(refImgPath));
console.log('Read reference image:', refPng.width, 'x', refPng.height);

const spritesDir = path.join(__dirname, 'assets', 'sprites');
const blocksDir = path.join(__dirname, 'assets', 'blocks');
fs.mkdirSync(spritesDir, { recursive: true });
fs.mkdirSync(blocksDir, { recursive: true });

// 1. EXTRACT BACKGROUND (y = 55 to y = 1270)
// Width: 885, Height: 1215
const bgW = refPng.width;
const bgH = 1220;
const bgStartY = 55;
const bgDst = new PNG({ width: bgW, height: bgH });
for (let y = 0; y < bgH; y++) {
  for (let x = 0; x < bgW; x++) {
    const srcIdx = (refPng.width * (bgStartY + y) + x) << 2;
    const dstIdx = (bgW * y + x) << 2;
    bgDst.data[dstIdx] = refPng.data[srcIdx];
    bgDst.data[dstIdx + 1] = refPng.data[srcIdx + 1];
    bgDst.data[dstIdx + 2] = refPng.data[srcIdx + 2];
    bgDst.data[dstIdx + 3] = 255;
  }
}
fs.writeFileSync(path.join(__dirname, 'assets', 'bg_mountain.png'), PNG.sync.write(bgDst));
console.log('Saved assets/bg_mountain.png');

// 2. EXTRACT SPRITES (4 Hikers + 4 Bombs)
const spriteConfigs = [
  { name: 'hiker_small',  cx: 122, cy: 1466, w: 78, h: 78 },
  { name: 'hiker_sumo',   cx: 341, cy: 1455, w: 82, h: 84 },
  { name: 'hiker_attack', cx: 563, cy: 1460, w: 82, h: 82 },
  { name: 'hiker_doctor', cx: 772, cy: 1456, w: 80, h: 82 },

  { name: 'bomb_instant', cx: 122, cy: 1632, w: 68, h: 68 },
  { name: 'bomb_timer',   cx: 341, cy: 1632, w: 78, h: 64 },
  { name: 'bomb_area',    cx: 561, cy: 1632, w: 76, h: 72 },
  { name: 'bomb_shock',   cx: 766, cy: 1634, w: 68, h: 68 },
];

for (const cfg of spriteConfigs) {
  const x0 = Math.round(cfg.cx - cfg.w / 2);
  const y0 = Math.round(cfg.cy - cfg.h / 2);
  const dst = new PNG({ width: cfg.w, height: cfg.h });

  for (let y = 0; y < cfg.h; y++) {
    for (let x = 0; x < cfg.w; x++) {
      const srcIdx = (refPng.width * (y0 + y) + (x0 + x)) << 2;
      const dstIdx = (cfg.w * y + x) << 2;
      dst.data[dstIdx] = refPng.data[srcIdx];
      dst.data[dstIdx + 1] = refPng.data[srcIdx + 1];
      dst.data[dstIdx + 2] = refPng.data[srcIdx + 2];
      dst.data[dstIdx + 3] = 255;
    }
  }

  // Flood-fill transparency from borders
  const visited = new Uint8Array(cfg.w * cfg.h);
  const queue = [];
  function pushIfBg(x, y) {
    if (x < 0 || x >= cfg.w || y < 0 || y >= cfg.h) return;
    const idx = y * cfg.w + x;
    if (visited[idx]) return;
    const px = idx << 2;
    const r = dst.data[px], g = dst.data[px + 1], b = dst.data[px + 2];
    // Dark card background in reference image is rgb(21, 29, 39)
    const dist = Math.hypot(r - 21, g - 29, b - 39);
    if (dist < 26) {
      visited[idx] = 1;
      queue.push([x, y]);
    }
  }

  for (let x = 0; x < cfg.w; x++) { pushIfBg(x, 0); pushIfBg(x, cfg.h - 1); }
  for (let y = 0; y < cfg.h; y++) { pushIfBg(0, y); pushIfBg(cfg.w - 1, y); }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = cy * cfg.w + cx;
    const px = idx << 2;
    dst.data[px + 3] = 0;

    pushIfBg(cx + 1, cy);
    pushIfBg(cx - 1, cy);
    pushIfBg(cx, cy + 1);
    pushIfBg(cx, cy - 1);
  }

  // Clear stray corner badge pixels
  for (let y = 0; y < cfg.h; y++) {
    for (let x = 0; x < cfg.w; x++) {
      const isCorner = (x < 12 || x > cfg.w - 13) && (y < 12 || y > cfg.h - 13);
      if (isCorner) {
        const px = (y * cfg.w + x) << 2;
        const r = dst.data[px], g = dst.data[px + 1], b = dst.data[px + 2];
        if (b > 120 || r > 150 || (r < 40 && g < 40 && b < 40)) {
          dst.data[px + 3] = 0;
        }
      }
    }
  }

  fs.writeFileSync(path.join(spritesDir, cfg.name + '.png'), PNG.sync.write(dst));
  console.log('Saved sprite:', cfg.name);
}

// 3. EXTRACT BLOCKS (128x128 scaled authentic blocks from image)
function extractAndScaleBlock(srcX, srcY, srcW, srcH, outName) {
  const targetSize = 128;
  const dst = new PNG({ width: targetSize, height: targetSize });

  for (let dy = 0; dy < targetSize; dy++) {
    const sy = srcY + Math.min(srcH - 1, Math.floor((dy / targetSize) * srcH));
    for (let dx = 0; dx < targetSize; dx++) {
      const sx = srcX + Math.min(srcW - 1, Math.floor((dx / targetSize) * srcW));
      const srcIdx = (refPng.width * sy + sx) << 2;
      const dstIdx = (targetSize * dy + dx) << 2;
      dst.data[dstIdx] = refPng.data[srcIdx];
      dst.data[dstIdx + 1] = refPng.data[srcIdx + 1];
      dst.data[dstIdx + 2] = refPng.data[srcIdx + 2];
      dst.data[dstIdx + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(blocksDir, outName + '.png'), PNG.sync.write(dst));
  console.log('Saved block:', outName);
}

// Block 1: Clean stone (Col 2, Row 3: x=243, y=321)
extractAndScaleBlock(243, 321, 76, 72, 'block_stone_1');
// Block 2: Stone with fissure (Col 4, Row 5: x=403, y=473)
extractAndScaleBlock(403, 473, 78, 72, 'block_stone_2');
// Block 3: Stone with moss & flowers (Col 5, Row 4: x=485, y=397)
extractAndScaleBlock(485, 397, 76, 72, 'block_stone_3');
// Block 4: Weathered stone (Col 6, Row 6: x=565, y=549)
extractAndScaleBlock(565, 549, 76, 72, 'block_stone_4');
// Top Grass Block (Col 3, Row 1: x=323, y=140 to 220)
extractAndScaleBlock(323, 140, 76, 80, 'block_top_grass');
// Soil Block 1 (Col 3, Row 14: x=323, y=1175)
extractAndScaleBlock(323, 1175, 76, 74, 'block_soil_1');
// Soil Block 2 (Col 5, Row 14: x=485, y=1175)
extractAndScaleBlock(485, 1175, 76, 74, 'block_soil_2');

console.log('All reference assets extracted and generated successfully!');
