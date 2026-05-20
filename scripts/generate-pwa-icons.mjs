import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

/** Teal palette aligned with manifest theme */
const BG = { r: 13, g: 148, b: 136 }
const FG = { r: 236, g: 253, b: 245 }

function fillSolid(png, rgb) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2
      png.data[idx] = rgb.r
      png.data[idx + 1] = rgb.g
      png.data[idx + 2] = rgb.b
      png.data[idx + 3] = 255
    }
  }
}

function drawCircle(png, cx, cy, radius, rgb) {
  const r2 = radius * radius
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        const idx = (png.width * y + x) << 2
        png.data[idx] = rgb.r
        png.data[idx + 1] = rgb.g
        png.data[idx + 2] = rgb.b
        png.data[idx + 3] = 255
      }
    }
  }
}

function writeIcon(size, filename) {
  const png = new PNG({ width: size, height: size })
  fillSolid(png, BG)
  const r = Math.round(size * 0.22)
  drawCircle(png, size / 2, size / 2, r, FG)
  fs.writeFileSync(path.join(publicDir, filename), PNG.sync.write(png))
}

fs.mkdirSync(publicDir, { recursive: true })
writeIcon(192, 'pwa-192x192.png')
writeIcon(512, 'pwa-512x512.png')
writeIcon(180, 'apple-touch-icon.png')
