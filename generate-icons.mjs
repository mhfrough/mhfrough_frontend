// Icon generator — run once: node generate-icons.mjs
// Creates all PWA icons from SVG using sharp
import sharp from './node_modules/sharp/lib/index.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = './public/icons';
const SCREENSHOTS = './public/screenshots';

// ─── SVG templates ────────────────────────────────────────────────────────────

function iconSvg(size, maskable = false) {
    // For maskable icons, content sits in the inner 80% (safe zone = 40% padding each side)
    const pad = maskable ? size * 0.15 : size * 0.12;
    const inner = size - pad * 2;

    // Noise filter — baked as a lightweight fractalNoise
    const noiseId = `n${size}${maskable ? 'm' : ''}`;

    // Font size scales with icon
    const fs = inner * 0.38;
    const cy = size / 2;
    const cx = size / 2;

    // Dot accent
    const dotR = inner * 0.045;
    const dotY = cy + inner * 0.31;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="${noiseId}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="linearRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
      <feBlend in="SourceGraphic" in2="grey" mode="overlay" result="blended"/>
      <feComposite in="blended" in2="SourceGraphic" operator="in"/>
    </filter>
    <clipPath id="clip${size}${maskable ? 'm' : ''}">
      <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.18}" ry="${maskable ? 0 : size * 0.18}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#1a1917" rx="${maskable ? 0 : size * 0.18}" ry="${maskable ? 0 : size * 0.18}"/>

  <!-- Noise overlay -->
  <rect width="${size}" height="${size}" fill="#e4e0d8" opacity="0.04"
    filter="url(#${noiseId})" rx="${maskable ? 0 : size * 0.18}" ry="${maskable ? 0 : size * 0.18}"/>

  <!-- Subtle indigo accent line at top -->
  <rect x="${cx - inner * 0.28}" y="${cy - inner * 0.5}" width="${inner * 0.56}" height="${inner * 0.025}"
    fill="#6366f1" opacity="0.85" rx="${inner * 0.012}"/>

  <!-- Hamza letter -->
  <text
    x="${cx}" y="${cy + fs * 0.42}"
    text-anchor="middle"
    font-family="'Arial', 'Tahoma', 'Segoe UI', sans-serif"
    font-size="${fs * 1.15}"
    font-weight="700"
    fill="#e4e0d8">ء</text>

  <!-- Small indigo dot below -->
  <circle cx="${cx}" cy="${dotY}" r="${dotR}" fill="#6366f1" opacity="0.9"/>
</svg>`;
}

// Screenshot placeholder SVGs (1280×720 desktop, 390×844 mobile)
function screenshotSvg(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    // Two-line sub-label — always split so it never hits the edge
    const line1 = 'Application Developer &amp; Product Designer';
    const line2 = '· Karachi';
    const labelSize = w < 600 ? 13 : 15;   // smaller on narrow screens
    const lineH = labelSize * 1.7;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#1a1917"/>
  <text x="${cx}" y="${cy - 20}" text-anchor="middle" font-family="'Arial', 'Tahoma', sans-serif"
    font-size="60" font-weight="700" fill="#e4e0d8">\u0621</text>
  <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="'Courier New', monospace"
    font-size="18" fill="#7a7770" letter-spacing="2">mhfrough.dev</text>
  <rect x="${cx - 30}" y="${cy + 48}" width="60" height="3" rx="2" fill="#6366f1"/>
  <text x="${cx}" y="${cy + 48 + 3 + lineH}" text-anchor="middle" font-family="'Courier New', monospace"
    font-size="${labelSize}" fill="#7a7770">${line1}</text>
  <text x="${cx}" y="${cy + 48 + 3 + lineH * 2}" text-anchor="middle" font-family="'Courier New', monospace"
    font-size="${labelSize}" fill="#7a7770">${line2}</text>
</svg>`;
}

// ─── Transparent SVG icon (no bg, paper noise, letter in website bg colour) ───
function transparentIconSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <filter id="paper" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="linearRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grey"/>
      <feBlend in="SourceGraphic" in2="grey" mode="overlay" result="blended"/>
      <feComposite in="blended" in2="SourceGraphic" operator="in"/>
    </filter>
    <clipPath id="shape">
      <rect width="64" height="64" rx="11.5" ry="11.5"/>
    </clipPath>
  </defs>

  <!-- Paper noise overlay (transparent bg — only texture) -->
  <rect width="64" height="64" fill="#1a1917" opacity="0.08"
    filter="url(#paper)" rx="11.5" ry="11.5"/>

  <!-- Indigo accent bar -->
  <rect x="20" y="13" width="24" height="2" rx="1" fill="#6366f1" opacity="0.85"/>

  <!-- ء in website background colour (#1a1917) -->
  <text x="32" y="40"
    text-anchor="middle"
    font-family="Arial, Tahoma, sans-serif"
    font-size="36"
    font-weight="700"
    fill="#1a1917">&#x621;</text>

  <!-- Small indigo dot -->
  <circle cx="32" cy="54" r="2.5" fill="#6366f1" opacity="0.9"/>
</svg>`;
}

// ─── Generate icons ────────────────────────────────────────────────────────────

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function run() {
    for (const size of sizes) {
        const svg = Buffer.from(iconSvg(size, false));
        await sharp(svg).png().toFile(join(OUT, `icon-${size}x${size}.png`));
        console.log(`✓ icon-${size}x${size}.png`);
    }

    // Maskable — only 192 and 512 needed
    for (const size of [192, 512]) {
        const svg = Buffer.from(iconSvg(size, true));
        await sharp(svg).png().toFile(join(OUT, `icon-${size}x${size}-maskable.png`));
        console.log(`✓ icon-${size}x${size}-maskable.png`);
    }

    // Screenshots (separate folder)
    const { mkdirSync } = await import('fs');
    mkdirSync(SCREENSHOTS, { recursive: true });

    const deskSvg = Buffer.from(screenshotSvg(1280, 720));
    await sharp(deskSvg).png().toFile(join(SCREENSHOTS, 'screenshot-desktop.png'));
    console.log('✓ screenshots/screenshot-desktop.png');

    const mobSvg = Buffer.from(screenshotSvg(390, 844));
    await sharp(mobSvg).png().toFile(join(SCREENSHOTS, 'screenshot-mobile.png'));
    console.log('✓ screenshots/screenshot-mobile.png');

    // Favicon PNGs
    const fav32 = Buffer.from(iconSvg(32, false));
    await sharp(fav32).png().toFile('./public/favicon-32x32.png');
    console.log('✓ favicon-32x32.png');

    const fav64 = Buffer.from(iconSvg(64, false));
    await sharp(fav64).png().toFile('./public/favicon-64x64.png');
    console.log('✓ favicon-64x64.png');

    // Transparent SVG icon (for public/icons/icon.svg)
    const svgIcon = transparentIconSvg();
    const { writeFileSync } = await import('fs');
    writeFileSync(join(OUT, 'icon.svg'), svgIcon, 'utf8');
    console.log('✓ icons/icon.svg (transparent)');

    console.log('\nAll icons generated.');
}

run().catch(err => { console.error(err); process.exit(1); });
