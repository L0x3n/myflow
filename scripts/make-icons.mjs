// Genererar PWA-ikoner (PNG) från ett inline-SVG-löv. Körs en gång: pnpm icons
// PNG:erna commitas så att bygget inte behöver sharp.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const leaf = (bgRadius, scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${bgRadius}" fill="#faf6ef"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 84 C 380 152 384 316 258 428 C 132 316 132 152 256 84 Z" fill="#7c9a7e"/>
    <path d="M257 132 L 257 392" stroke="#5f7f63" stroke-width="15" stroke-linecap="round"/>
    <path d="M257 208 C 296 200 318 178 330 152" stroke="#5f7f63" stroke-width="11" stroke-linecap="round" fill="none"/>
    <path d="M257 288 C 300 282 326 258 340 228" stroke="#5f7f63" stroke-width="11" stroke-linecap="round" fill="none"/>
    <path d="M257 208 C 218 200 196 178 184 152" stroke="#5f7f63" stroke-width="11" stroke-linecap="round" fill="none"/>
    <path d="M257 288 C 214 282 188 258 174 228" stroke="#5f7f63" stroke-width="11" stroke-linecap="round" fill="none"/>
  </g>
</svg>`

mkdirSync('public/icons', { recursive: true })

const jobs = [
  ['public/icons/icon-192.png', 192, leaf(96, 0.92)],
  ['public/icons/icon-512.png', 512, leaf(256, 0.92)],
  ['public/icons/icon-maskable-512.png', 512, leaf(0, 0.66)],
]

for (const [file, size, svg] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
  console.log('skrev', file)
}
