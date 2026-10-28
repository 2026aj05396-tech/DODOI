import { CraftPhoto } from "@/components/marketing/craft-photo";
import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { cn } from "@/lib/utils/cn";

// The craft-tile collages from the design: Welcome 1a (mobile) and Landing 2a (web). Purely
// decorative (aria-hidden). The tiles stay still: the design's floating loop is removed and
// must not come back (PO, 2026-10-28; UI_UX_GUIDELINES §2.5).
// Each tile shows a craft photo (public/images/crafts, Unsplash License) over its pattern; the
// pattern stays as the placeholder and the fallback when a photo can't load.

type Tile = {
  label: string;
  accent: PatternAccent;
  /** Grid rows the tile spans. */
  rows: 1 | 2 | 3;
  photo: string;
  /** object-position for the photo's crop. */
  position?: string;
};

const PHOTOS = {
  crochet: "/images/crafts/crochet.jpg",
  sketchbook: "/images/crafts/sketchbook.jpg",
  embroidery: "/images/crafts/embroidery-blossom.jpg",
  clay: "/images/crafts/clay.jpg",
  watercolour: "/images/crafts/watercolour.jpg",
  punchNeedle: "/images/crafts/punch-needle.jpg",
  moreCrafts: "/images/crafts/more-crafts.jpg",
} as const;

/** Darkens the photo under a label; hidden until the photo before it has loaded. */
function PhotoScrim({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 peer-data-[loaded=true]:opacity-100 motion-reduce:transition-none",
        className,
      )}
    />
  );
}

/** The scrim and label for a tile labelled at the bottom edge. */
function PhotoLabel({ children }: { children: string }) {
  return (
    <>
      <PhotoScrim className="bg-linear-to-t from-inverse/65 via-inverse/10 via-40% to-transparent" />
      <span className="relative transition-colors duration-700 peer-data-[loaded=true]:font-semibold peer-data-[loaded=true]:text-inverse-foreground motion-reduce:transition-none">
        {children}
      </span>
    </>
  );
}

const ROW_SPAN = { 1: "", 2: "row-span-2", 3: "row-span-3" } as const;

// Design 1a: 3 columns, 84px rows.
const WELCOME_TILES: Tile[] = [
  {
    label: "crochet",
    accent: "butter",
    rows: 2,
    photo: PHOTOS.crochet,
  },
  {
    label: "sketch",
    accent: "lavender",
    rows: 1,
    photo: PHOTOS.sketchbook,
    position: "50% 40%",
  },
  { label: "clay", accent: "mint", rows: 2, photo: PHOTOS.clay },
  {
    label: "embroidery",
    accent: "blush",
    rows: 2,
    photo: PHOTOS.embroidery,
    position: "45% 55%",
  },
  {
    label: "paint",
    accent: "sky",
    rows: 1,
    photo: PHOTOS.watercolour,
    position: "50% 70%",
  },
];

// Three columns of the max-w-md mobile layout.
const WELCOME_SIZES = "(min-width: 448px) 150px, 33vw";

/** Welcome (1a): five craft tiles and a solid coral "+ 40 more". */
export function WelcomeCraftTiles({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("grid auto-rows-[84px] grid-cols-3 gap-2", className)}>
      {WELCOME_TILES.map((tile) => (
        <PatternTile
          key={tile.label}
          accent={tile.accent}
          className={cn(
            "relative flex items-end overflow-hidden rounded-md p-2.5 text-tab text-foreground-secondary",
            ROW_SPAN[tile.rows],
          )}
        >
          <CraftPhoto src={tile.photo} sizes={WELCOME_SIZES} position={tile.position} />
          <PhotoLabel>{tile.label}</PhotoLabel>
        </PatternTile>
      ))}
      <div className="relative flex items-end overflow-hidden rounded-md bg-primary p-2.5 text-tab text-foreground">
        <CraftPhoto src={PHOTOS.moreCrafts} sizes={WELCOME_SIZES} />
        <PhotoScrim className="bg-primary/75" />
        <span className="relative">+ 40 more</span>
      </div>
    </div>
  );
}

// Design 2a: 3 columns, 120px rows; 20px radius drawn, rounded-lg (18px) is the nearest token.
const LANDING_TILES: Tile[] = [
  {
    label: "crochet",
    accent: "butter",
    rows: 3,
    photo: PHOTOS.crochet,
  },
  {
    label: "sketchbook",
    accent: "lavender",
    rows: 2,
    photo: PHOTOS.sketchbook,
    position: "50% 45%",
  },
  {
    label: "embroidery",
    accent: "blush",
    rows: 2,
    photo: PHOTOS.embroidery,
    position: "45% 55%",
  },
  { label: "clay", accent: "mint", rows: 2, photo: PHOTOS.clay },
  {
    label: "watercolour",
    accent: "sky",
    rows: 3,
    photo: PHOTOS.watercolour,
  },
];

// Three columns of the right half of the landing grid (and the auth screens' side panel).
const LANDING_SIZES = "(min-width: 1024px) 260px, 33vw";

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
            "relative flex items-end overflow-hidden rounded-lg p-3.5 text-meta text-foreground-secondary",
            ROW_SPAN[tile.rows],
          )}
        >
          <CraftPhoto src={tile.photo} sizes={LANDING_SIZES} position={tile.position} />
          <PhotoLabel>{tile.label}</PhotoLabel>
        </PatternTile>
      ))}
      <PatternTile
        accent="new-to-you"
        className="relative row-span-2 flex flex-col justify-between overflow-hidden rounded-lg p-4.5 text-foreground"
      >
        <CraftPhoto src={PHOTOS.punchNeedle} sizes={LANDING_SIZES} position="30% 50%" />
        <PhotoScrim className="bg-linear-to-b from-inverse/50 via-inverse/5 to-inverse/70" />
        <span className="relative text-overline uppercase transition-colors duration-700 peer-data-[loaded=true]:text-inverse-foreground motion-reduce:transition-none">
          New to you
        </span>
        <span className="relative text-greeting text-balance transition-colors duration-700 peer-data-[loaded=true]:text-inverse-foreground motion-reduce:transition-none">
          Punch needle in under an hour
        </span>
      </PatternTile>
      <PatternTile
        accent="coral"
        className="relative flex items-center justify-center overflow-hidden rounded-lg text-control-xl font-bold text-foreground"
      >
        <CraftPhoto src={PHOTOS.moreCrafts} sizes={LANDING_SIZES} />
        <PhotoScrim className="bg-primary/75" />
        <span className="relative">+ 40 more crafts</span>
      </PatternTile>
    </div>
  );
}
