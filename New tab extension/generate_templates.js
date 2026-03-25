// Script to generate templates from viral icon filenames
// Run with: node generate_templates.js

const fs = require('fs');
const path = require('path');

// Read icon_list.js to extract icon names
const iconListContent = fs.readFileSync(path.join(__dirname, 'icon_list.js'), 'utf8');
const match = iconListContent.match(/\[([^\]]+)\]/s);
const iconNames = match[1].match(/"([^"]+)"/g).map(s => s.replace(/"/g, ''));

// Suffixes to strip when deriving domain names
const STRIP_SUFFIXES = ['_new', '_og', '_alt', '_trans', '_preog', '_neon', '_pride', '_black', '_light', '_color', '_big', '_final'];

// Icons to skip (not websites, utility apps, generic names, etc.)
const SKIP_PATTERNS = [
  /^calendar_/, /^business_calendar_/, /^battery/, /^wallpaper/, /^launcher/,
  /^widget/, /^kwgt/, /^icon/, /^theme/, /^clock/, /^weather_/,
  /^camera/, /^alarm/, /^calc/, /^cpu/, /^font/, /^lock/,
  /^\d+$/, /^complete_/, /^auto_/
];

function shouldSkip(name) {
  return SKIP_PATTERNS.some(p => p.test(name));
}

function cleanName(filename) {
  let name = filename.replace('.png', '');
  // Strip common suffixes
  for (const suffix of STRIP_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }
  return name;
}

function toTitle(name) {
  return name.replace(/_/g, ' ').split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function toDomain(name) {
  // Special known mappings
  const KNOWN = {
    'google': 'google.com',
    'google_search': 'google.com',
    'google_gmail': 'mail.google.com',
    'google_drive': 'drive.google.com',
    'google_maps': 'maps.google.com',
    'google_photos': 'photos.google.com',
    'google_calendar': 'calendar.google.com',
    'google_translate': 'translate.google.com',
    'google_keep': 'keep.google.com',
    'google_docs': 'docs.google.com',
    'google_sheets': 'sheets.google.com',
    'google_meet': 'meet.google.com',
    'google_play': 'play.google.com',
    'google_classroom': 'classroom.google.com',
    'google_earth': 'earth.google.com',
    'facebook': 'facebook.com',
    'facebook_messenger': 'messenger.com',
    'instagram': 'instagram.com',
    'whatsapp': 'web.whatsapp.com',
    'twitter': 'x.com',
    'twitter_8_dollars': 'x.com',
    'youtube': 'youtube.com',
    'youtube_music': 'music.youtube.com',
    'youtube_tv': 'tv.youtube.com',
    'linkedin': 'linkedin.com',
    'pinterest': 'pinterest.com',
    'reddit': 'reddit.com',
    'discord': 'discord.com',
    'telegram': 'web.telegram.org',
    'slack': 'slack.com',
    'snapchat': 'snapchat.com',
    'tiktok': 'tiktok.com',
    'netflix': 'netflix.com',
    'spotify': 'open.spotify.com',
    'amazon_shopping': 'amazon.com',
    'amazon_prime_video': 'primevideo.com',
    'amazon_music': 'music.amazon.com',
    'amazon_kindle': 'read.amazon.com',
    'ebay': 'ebay.com',
    'aliexpress': 'aliexpress.com',
    'etsy': 'etsy.com',
    'walmart': 'walmart.com',
    'twitch': 'twitch.tv',
    'github': 'github.com',
    'gitlab': 'gitlab.com',
    'stackoverflow': 'stackoverflow.com',
    'steam': 'store.steampowered.com',
    'epic_games': 'epicgames.com',
    'paypal': 'paypal.com',
    'venmo': 'venmo.com',
    'cash_app': 'cash.app',
    'coinbase': 'coinbase.com',
    'binance': 'binance.com',
    'uber': 'uber.com',
    'uber_eats': 'ubereats.com',
    'lyft': 'lyft.com',
    'airbnb': 'airbnb.com',
    'booking': 'booking.com',
    'zoom': 'zoom.us',
    'microsoft_teams': 'teams.microsoft.com',
    'microsoft': 'microsoft.com',
    'outlook': 'outlook.live.com',
    'onedrive': 'onedrive.live.com',
    'dropbox': 'dropbox.com',
    'notion': 'notion.so',
    'trello': 'trello.com',
    'asana': 'asana.com',
    'figma': 'figma.com',
    'canva': 'canva.com',
    'adobe_lightroom': 'lightroom.adobe.com',
    'duolingo': 'duolingo.com',
    'coursera': 'coursera.org',
    'khan_academy': 'khanacademy.org',
    'wikipedia': 'wikipedia.org',
    'medium': 'medium.com',
    'cnn': 'cnn.com',
    'bbc': 'bbc.com',
    'espn': 'espn.com',
    'hulu': 'hulu.com',
    'crunchyroll': 'crunchyroll.com',
    'hbo_max': 'max.com',
    'disney_plus': 'disneyplus.com',
    'battle_net': 'battle.net',
    'roblox': 'roblox.com',
    'minecraft': 'minecraft.net',
    'kick': 'kick.com',
  };

  if (KNOWN[name]) return KNOWN[name];

  // Try simple domain derivation: strip underscores, use as .com
  const simple = name.replace(/_/g, '');
  return `${simple}.com`;
}

// Process all icons
const seen = new Set();
const templates = [];

for (const iconFile of iconNames) {
  const cleaned = cleanName(iconFile);
  
  if (shouldSkip(cleaned)) continue;
  if (seen.has(cleaned)) continue;
  seen.add(cleaned);

  const title = toTitle(cleaned);
  const domain = toDomain(cleaned);
  const url = `https://${domain}`;

  templates.push({
    name: title,
    url: url,
    subtitle: '',
    icon: `Viral icon pack/${iconFile}`
  });
}

// Read existing default_templates.json
const existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'default_templates.json'), 'utf8'));

// Replace the templates array
existing.templates = templates;

// Write back
fs.writeFileSync(
  path.join(__dirname, 'default_templates.json'),
  JSON.stringify(existing, null, 2),
  'utf8'
);

console.log(`Generated ${templates.length} templates from ${iconNames.length} icon files.`);
