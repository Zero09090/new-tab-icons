/**
 * Scans the Viral icon pack folder and generates icon_list.js
 * Run this whenever you add new icons to the folder:
 *   node scan_icons.js
 */
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'Viral icon pack');
const outputFile = path.join(__dirname, 'icon_list.js');

const icons = fs.readdirSync(iconDir)
  .filter(f => f.endsWith('.png'))
  .sort();

const content = `const viralIcons = ${JSON.stringify(icons, null, 2)};\n`;
fs.writeFileSync(outputFile, content, 'utf8');

console.log(`✅ Scanned ${icons.length} icons → icon_list.js`);
