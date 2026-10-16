import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const meldRoot = path.resolve(projectRoot, '..');
const outputDirectory = path.join(projectRoot, 'public', 'images');
const iconDirectory = path.join(projectRoot, 'public', 'icons');

const sources = [
  { input: path.join(meldRoot, 'image pack', 'desktop', '288934132366079401.jpg_2K_20261014154500.jpg'), output: 'meld-hero-desktop.webp', width: 2200 },
  { input: path.join(meldRoot, 'image pack', 'mobile', '288934132366079401.jpg_2K_20261014155144.jpg'), output: 'meld-hero-mobile.webp', width: 1200 },
  { input: path.join(meldRoot, 'image pack', 'auth panel', '288934132366079401.jpg_2K_20261014155435.jpg'), output: 'meld-auth-panel.webp', width: 1300 },
];

await mkdir(outputDirectory, { recursive: true });
await mkdir(iconDirectory, { recursive: true });

for (const asset of sources) {
  const destination = path.join(outputDirectory, asset.output);
  await sharp(asset.input)
    .rotate()
    .resize({ width: asset.width, withoutEnlargement: true })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(destination);
  const result = await sharp(destination).metadata();
  console.info(`${asset.output}: ${result.width}x${result.height}, ${result.format}`);
}

const icon = path.join(projectRoot, 'public', 'icons', 'meld-icon.svg');
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png({ compressionLevel: 9, palette: true }).toFile(path.join(iconDirectory, `meld-${size}.png`));
}
