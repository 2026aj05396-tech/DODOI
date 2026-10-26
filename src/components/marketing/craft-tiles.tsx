import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { cn } from "@/lib/utils/cn";

// The drifting craft-tile collages from the design: Welcome 1a (mobile) and Landing 2a (web).
// Purely decorative (aria-hidden); the drift stops under prefers-reduced-motion.

type Tile = {
  label: string;
  accent: PatternAccent;
  /** Grid rows the tile spans. */
  rows: 1 | 2 | 3;
  delay: string;
};

const ROW_SPAN = { 1: "", 2: "row-span-2", 3: "row-span-3" } as const;

// Design 1a: 3 columns, 84px rows.
const WELCOME_TILES: Tile[] = [
  { label: "crochet", accent: "butter", rows: 2, delay: "[animation-delay:0s]" },
  { label: "sketch", accent: "lavender", rows: 1, delay: "[animation-delay:0.6s]" },
  { label: "clay", accent: "mint", rows: 2, delay: "[animation-delay:1.2s]" },
  { label: "embroidery", accent: "blush", rows: 2, delay: "[animation-delay:1.8s]" },
  { label: "paint", accent: "sky", rows: 1, delay: "[animation-delay:2.4s]" },
];

/** Welcome (1a): five craft tiles and a solid coral "+ 40 more". */
export function WelcomeCraftTiles({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("grid auto-rows-[84px] grid-cols-3 gap-2", className)}>
      {WELCOME_TILES.map((tile) => (
        <PatternTile
          key={tile.label}
          accent={tile.accent}
          className={cn(
            "flex animate-dd-float items-end rounded-md p-2.5 text-tab text-foreground-secondary",
            ROW_SPAN[tile.rows],
            tile.delay,
          )}
        >
          {tile.label}
        </PatternTile>
      ))}
      <div className="flex animate-dd-float items-end rounded-md bg-primary p-2.5 text-tab text-foreground [animation-delay:3s]">
        + 40 more
      </div>
    </div>
  );
}

// Design 2a: 3 columns, 120px rows; 20px radius drawn, rounded-lg (18px) is the nearest token.
const LANDING_TILES: Tile[] = [
  { label: "crochet", accent: "butter", rows: 3, delay: "[animation-delay:0s]" },
  { label: "sketchbook", accent: "lavender", rows: 2, delay: "[animation-delay:0.5s]" },
  { label: "embroidery", accent: "blush", rows: 2, delay: "[animation-delay:1s]" },
  { label: "clay", accent: "mint", rows: 2, delay: "[animation-delay:1.5s]" },
  { label: "watercolour", accent: "sky", rows: 3, delay: "[animation-delay:2s]" },
];

type LandingCraftTilesProps = {
  className?: string;
  /** Row height; the auth screens use a shorter grid than the landing page. */
  rowClassName?: string;
};

/** Landing (2a): five craft tiles, a "New to you" card and "+ 40 more crafts". */
export function LandingCraftTiles({
  className,
  rowClassName = "auto-rows-[120px]",
}: LandingCraftTilesProps) {
  return (
    <div aria-hidden className={cn("grid grid-cols-3 gap-3", rowClassName, className)}>
      {LANDING_TILES.map((tile) => (
        <PatternTile
          key={tile.label}
          accent={tile.accent}
          className={cn(
            "flex animate-dd-float items-end rounded-lg p-3.5 text-meta text-foreground-secondary",
            ROW_SPAN[tile.rows],
            tile.delay,
          )}
        >
          {tile.label}
        </PatternTile>
      ))}
      <PatternTile
        accent="new-to-you"
        className="row-span-2 flex flex-col justify-between rounded-lg p-4.5 text-foreground"
      >
        <span className="text-overline uppercase">New to you</span>
        <span className="text-greeting text-balance">Punch needle in under an hour</span>
      </PatternTile>
      <PatternTile
        accent="coral"
        className="flex animate-dd-float items-center justify-center rounded-lg text-control-xl font-bold text-foreground [animation-delay:3s]"
      >
        + 40 more crafts
      </PatternTile>
    </div>
  );
}
