import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Flower2 } from 'lucide-react';
import sharp from 'sharp';

// Reuse the app's existing flower mark. The central artwork fits inside the
// maskable icon's safe circle, with an opaque background for all phone masks.
const mark = renderToStaticMarkup(
  createElement(Flower2, {
    x: 116,
    y: 116,
    width: 280,
    height: 280,
    color: '#fff0d1',
    strokeWidth: 1.6,
  }),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#71382f"/>${mark}</svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/icon.svg', svg);
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile('public/icons/' + name);
}
console.log('Generated PWA icons from the existing Jayananda flower mark.');
