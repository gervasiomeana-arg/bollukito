import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function removeGreen(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const maxRB = Math.max(r, b);
    const greenDiff = g - maxRB;

    // Chroma green detection
    if (greenDiff > 35 && g > 90) {
      // Solid green background
      pixels[i + 3] = 0; // Alpha 0
    } else if (greenDiff > 15 && g > 75) {
      // Soft antialiased border
      const factor = (greenDiff - 15) / 20;
      pixels[i + 3] = Math.round(255 * (1 - factor));
      pixels[i + 1] = maxRB; // despill
    } else if (g > maxRB && greenDiff > 5) {
      // Despill fringe
      pixels[i + 1] = maxRB;
    }
  }

  await sharp(pixels, { raw: { width, height, channels } })
    .trim({ threshold: 5 }) // trim empty transparent borders
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`Saved transparent image to ${outputPath}`);
}

async function run() {
  const img1 = path.join(process.cwd(), 'src/assets/images/bollukito_cartoon_3d_1788719231314.jpg');
  const out1 = path.join(process.cwd(), 'public/bollukito_cartoon_presenting.png');
  await removeGreen(img1, out1);

  const img2 = path.join(process.cwd(), 'src/assets/images/bollukito_cartoon_walk_1788719248362.jpg');
  const out2 = path.join(process.cwd(), 'public/bollukito_cartoon_walking.png');
  await removeGreen(img2, out2);
}

run().catch(console.error);
