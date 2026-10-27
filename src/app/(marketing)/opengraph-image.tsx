import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Share image for the landing page (P1-30), rendered once at build time. Built from the design
// system: images can't read CSS variables, so the colours are the hex values of
// src/styles/tokens.css (paper, ink, ink-2, brick, butter-strong and the craft accents) and the
// fonts are static DM Sans files in assets/fonts (SIL OFL 1.1, THIRD_PARTY_NOTICES.md).

export const alt =
  "dodoi: for the things you love making, and all the things you haven't tried yet.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLOURS = {
  paper: "#fff8f0",
  ink: "#2b2233",
  ink2: "#5a4e5e",
  brick: "#c04a37",
  butterStrong: "#f5c96b",
  coral: "#f4a79d",
};

const TILES = [
  { label: "crochet", colour: "#fbe7a1", height: 300 },
  { label: "sketchbook", colour: "#e2d9f7", height: 196 },
  { label: "embroidery", colour: "#f9d0d3", height: 196 },
  { label: "clay", colour: "#cde8d6", height: 300 },
  { label: "watercolour", colour: "#cfe3f5", height: 196 },
  { label: "+ 40 more", colour: COLOURS.coral, height: 196 },
];

async function font(file: string) {
  return readFile(join(process.cwd(), "assets/fonts", file));
}

export default async function Image() {
  const [regular, bold] = await Promise.all([
    font("DMSans_400Regular.ttf"),
    font("DMSans_700Bold.ttf"),
  ]);
  const columns = [TILES.slice(0, 3), TILES.slice(3)];

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 64,
        gap: 56,
        backgroundColor: COLOURS.paper,
        fontFamily: "DM Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 700, color: COLOURS.brick, lineHeight: 1 }}>
            dodoi
          </span>
          <span
            style={{
              width: 14,
              height: 14,
              marginBottom: 8,
              borderRadius: 7,
              backgroundColor: COLOURS.butterStrong,
            }}
          />
        </div>
        <span
          style={{
            marginTop: 36,
            fontSize: 58,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: COLOURS.ink,
          }}
        >
          For the things you love making, and all the things you haven&apos;t tried yet.
        </span>
        <span style={{ fontSize: 28, fontWeight: 400, color: COLOURS.ink2 }}>
          Ideas across 40+ crafts. No experience needed.
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, width: 380 }}>
        {columns.map((column, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {column.map((tile) => (
              <div
                key={tile.label}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  height: tile.height - (index === 1 ? 52 : 0),
                  padding: 18,
                  borderRadius: 20,
                  backgroundColor: tile.colour,
                  fontSize: 22,
                  fontWeight: 700,
                  color: COLOURS.ink2,
                }}
              >
                {tile.label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "DM Sans", data: regular, weight: 400, style: "normal" },
        { name: "DM Sans", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
