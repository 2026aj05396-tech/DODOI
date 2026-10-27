// `pnpm icons` (P1-27): draws the app icon and writes every size the app uses. The icon is design
// `1a` "Coral" (Claude Design, dodoi App Icon): the sidebar's "d." mark in plum on coral, with a
// butter dot. It is drawn by Chromium from the design's own markup, so text rendering matches the
// design, and the font is the static DM Sans ExtraBold in assets/fonts (SIL OFL 1.1). Run it again
// after changing the icon and commit the files it writes.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();

// Hex values of src/styles/tokens.css: images can't read CSS variables.
const CORAL = "#f4a79d";
const INK = "#2b2233";
const BUTTER = "#fbe7a1";

/**
 * - rounded: the design's tile (corners 22.5% of the side) on a transparent background, for browser
 *   tabs and installed-app icons that are shown as they are.
 * - square: full bleed, for iOS, which rounds the corners itself.
 * - maskable: full bleed with the mark scaled down into the safe zone (the middle 80% circle), so
 *   Android can crop it to any shape.
 */
type Variant = "rounded" | "square" | "maskable";

const OUTPUTS: { path: string; size: number; variant: Variant }[] = [
  { path: "src/app/apple-icon.png", size: 180, variant: "square" },
  { path: "public/icons/icon-192.png", size: 192, variant: "rounded" },
  { path: "public/icons/icon-512.png", size: 512, variant: "rounded" },
  { path: "public/icons/icon-maskable-512.png", size: 512, variant: "maskable" },
];
const FAVICON_SIZES = [16, 32, 48];

/** Mark size inside the safe zone, relative to the design's 240px tile. */
const MASKABLE_SCALE = 0.74;

/** The design's 240px tile, every length scaled to `size`. */
function iconHtml(size: number, variant: Variant, fontUrl: string): string {
  const unit = (size / 240) * (variant === "maskable" ? MASKABLE_SCALE : 1);
  const px = (designPx: number) => `${designPx * unit}px`;
  const radius = variant === "rounded" ? `${size * 0.225}px` : "0";
  return `<!doctype html><html><head><style>
    @font-face { font-family: "DM Sans"; font-weight: 800; src: url(${fontUrl}) format("truetype"); }
    html, body { margin: 0; background: transparent; }
    #icon { width: ${size}px; height: ${size}px; border-radius: ${radius}; background: ${CORAL};
      display: flex; align-items: center; justify-content: center; overflow: hidden; }
    #mark { display: flex; align-items: baseline; gap: ${px(7)}; margin-top: ${px(-28)};
      margin-left: ${px(7)}; }
    #d { font: 800 ${px(190)}/1 "DM Sans"; color: ${INK}; letter-spacing: -0.04em; }
    #dot { flex: none; width: ${px(38)}; height: ${px(38)}; border-radius: 50%; background: ${BUTTER}; }
  </style></head><body><div id="icon"><span id="mark"><span id="d">d</span><span id="dot"></span></span></div></body></html>`;
}

/** An .ico holding PNG images, which every current browser reads. */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

async function main(): Promise<void> {
  const font = await readFile(join(ROOT, "assets/fonts/DMSans_800ExtraBold.ttf"));
  const fontUrl = `data:font/ttf;base64,${font.toString("base64")}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const draw = async (size: number, variant: Variant) => {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(iconHtml(size, variant, fontUrl));
      await page.evaluate(() => document.fonts.ready);
      return page.locator("#icon").screenshot({ omitBackground: true });
    };

    for (const output of OUTPUTS) {
      await writeFile(join(ROOT, output.path), await draw(output.size, output.variant));
      process.stdout.write(`✓ ${output.path}\n`);
    }
    const favicons = [];
    for (const size of FAVICON_SIZES) favicons.push({ size, png: await draw(size, "rounded") });
    await writeFile(join(ROOT, "src/app/favicon.ico"), ico(favicons));
    process.stdout.write("✓ src/app/favicon.ico\n");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Icon generation failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
