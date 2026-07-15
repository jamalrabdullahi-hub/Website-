const fs = require('fs');
const path = require('path');

const imgDir = '/tmp/opt_images';
const files = [
  'agriculture_land.jpg',
  'energy_hydrocarbons.jpg',
  'fisheries_marine.jpg',
  'hero_natural_resources.jpg',
  'mining_minerals.jpg'
];

let out = `// This file is auto-generated to prevent binary image corruption when exporting/deploying to GitHub.
// By embedding images as Base64 strings, we guarantee they remain 100% intact as plain-text assets.

export const IMAGES: Record<string, string> = {
`;

for (const file of files) {
  const name = file.replace('.jpg', '');
  const filePath = path.join(imgDir, file);
  const data = fs.readFileSync(filePath);
  const base64 = data.toString('base64');
  out += `  ${name}: "data:image/jpeg;base64,${base64}",\n`;
}

out += '};\n';

fs.writeFileSync('/src/image-data.ts', out);
console.log('Base64 image data file successfully generated at /src/image-data.ts!');
