import { CraftPhoto } from "@/components/marketing/craft-photo";
import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { cn } from "@/lib/utils/cn";

// Art for the empty home feed: a little maker's mood board. Three craft prints held up with
// washi tape (the craft patterns), a coral thread that draws itself in from the crochet print
// to a needle, and twinkling doodle sparkles. The prints fan out when the board is hovered and
// each one lifts when it is. Decorative; a print shows its pattern until (or instead of) its photo.

type Print = {
  label: string;
  accent: PatternAccent;
  tape: PatternAccent;
  photo: string;
  /** Size, resting pose and the fanned pose on hover. */
  pose: string;
  /** Tape angle. */
  tapePose: string;
  /** Keeps the caption clear of the middle print. */
  labelAlign: string;
};

const PRINTS: Print[] = [
  {
    label: "crochet",
    accent: "butter",
    tape: "mint",
    photo: "/images/crafts/crochet.jpg",
    pose: "top-4 w-[112px] -ml-[56px] -translate-x-[100px] -rotate-8 group-hover:-translate-x-[112px] group-hover:-rotate-12",
    tapePose: "rotate-6",
    labelAlign: "pl-1 text-left",
  },
  {
    label: "watercolour",
    accent: "sky",
    tape: "lavender",
    photo: "/images/crafts/watercolour.jpg",
    pose: "top-5 w-[112px] -ml-[56px] translate-x-[100px] rotate-7 group-hover:translate-x-[112px] group-hover:rotate-10",
    tapePose: "-rotate-8",
    labelAlign: "pr-1 text-right",
  },
  {
    label: "embroidery",
    accent: "blush",
    tape: "butter",
    photo: "/images/crafts/embroidery-blossom.jpg",
    pose: "top-0 z-10 w-[128px] -ml-[64px] -rotate-2 group-hover:-translate-y-2 group-hover:rotate-0",
    tapePose: "-rotate-3",
    labelAlign: "text-center",
  },
];

/** A four-point doodle sparkle. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("absolute animate-dd-twinkle", className)}>
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z" />
    </svg>
  );
}

export function EmptyFeedArt() {
  return (
    // The board is drawn at 336px on an absolute stage, so it never widens the layout, and
    // scaled down on phones.
    <div className="relative mb-3 h-[200px] w-[288px] sm:h-[236px] sm:w-[336px]">
      <div className="group absolute top-0 left-1/2 h-[236px] w-[336px] origin-top -translate-x-1/2 max-sm:scale-[0.84]">
        {/* The thread: from the crochet print, under the board in one loop, up to a needle. */}
        <svg
          viewBox="0 0 336 236"
          fill="none"
          className="absolute inset-0 size-full overflow-visible stroke-selected-border"
        >
          <path
            pathLength={1}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={1}
            className="animate-dd-draw"
            d="M40 186C30 214 74 232 116 222c32-8 34-34 54-32 22 2 14 30 -4 26-14-4 0-26 40-20 40 6 74 16 100-6 12-10 14-22 22-34"
          />
          <g className="stroke-muted-foreground" strokeWidth={2} strokeLinecap="round">
            <path d="M318 168l14-24" />
            <ellipse cx="333" cy="141" rx="1.6" ry="3.4" transform="rotate(30 333 141)" />
          </g>
        </svg>

        {PRINTS.map((print) => (
          <div
            key={print.label}
            className={cn(
              "absolute left-1/2 rounded-md bg-card p-1.5 shadow-frame transition-transform duration-500 ease-soft hover:z-20 hover:scale-105 motion-reduce:transition-none",
              print.pose,
            )}
          >
            <PatternTile
              accent={print.tape}
              className={cn(
                "absolute -top-2.5 left-1/2 z-10 -ml-6 h-4 w-12 rounded-xs opacity-90 shadow-sm",
                print.tapePose,
              )}
            />
            <PatternTile
              accent={print.accent}
              className="relative aspect-4/5 overflow-hidden rounded-sm"
            >
              <CraftPhoto src={print.photo} sizes="128px" />
            </PatternTile>
            <p className={cn("pt-1 pb-0.5 text-tab text-muted-foreground", print.labelAlign)}>
              {print.label}
            </p>
          </div>
        ))}

        <Sparkle className="top-0 left-2 size-5 fill-butter-strong" />
        <Sparkle className="top-1 right-3 size-3.5 fill-lavender-strong [animation-delay:0.8s]" />
        <Sparkle className="top-28 -left-3 size-3 fill-selected-border [animation-delay:1.6s]" />
        <Sparkle className="top-32 -right-3 size-4 fill-butter-strong [animation-delay:1.2s]" />
      </div>
    </div>
  );
}
