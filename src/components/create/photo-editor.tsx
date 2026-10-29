"use client";

import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import {
  cropFromView,
  loadImage,
  renderCrop,
  rotatedSize,
  type Rotation,
} from "@/lib/utils/image-edit";

// Edit a photo right in the Create flow (PO request 2026-10-29): pick a shape, zoom, drag it into
// place, rotate. "Use this photo" makes a new JPEG (≤ 2400 px) that replaces the original upload.

const SHAPES = [
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "4:5", ratio: 4 / 5 },
  { key: "classic", label: "3:4", ratio: 3 / 4 },
  { key: "wide", label: "16:9", ratio: 16 / 9 },
] as const;
type ShapeKey = (typeof SHAPES)[number]["key"];

const MAX_ZOOM = 3;
const KEY_STEP = 12;

type Offset = { x: number; y: number };

export function PhotoEditor({
  open,
  onOpenChange,
  src,
  name,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The photo to edit: the picked file on this device, else the delivered copy (HEIC). */
  src: string | null;
  name: string;
  onApply: (file: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shape, setShape] = useState<ShapeKey>("original");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open || !src) return;
    let cancelled = false;
    loadImage(src)
      .then((loaded) => {
        if (!cancelled) setImage(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("This photo can't be edited here. Try another one.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, src]);

  const rotated = image
    ? rotatedSize(image.naturalWidth, image.naturalHeight, rotation)
    : { width: 1, height: 1 };
  const ratio =
    SHAPES.find((option) => option.key === shape)?.ratio ?? rotated.width / rotated.height;

  // The frame fills the dialog width, and never gets taller than about half the screen.
  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [image]);

  const baseScale =
    frame.width > 0 ? Math.max(frame.width / rotated.width, frame.height / rotated.height) : 1;
  const scale = baseScale * zoom;

  /** Keeps the photo covering the whole frame. */
  const clamp = useCallback(
    (next: Offset): Offset => {
      const maxX = Math.max(0, (rotated.width * scale - frame.width) / 2);
      const maxY = Math.max(0, (rotated.height * scale - frame.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [rotated.width, rotated.height, scale, frame.width, frame.height],
  );
  const shown = clamp(offset);

  function reset() {
    setShape("original");
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    drag.current = { ...start, x: event.clientX, y: event.clientY };
    setOffset((current) => clamp({ x: clamp(current).x + dx, y: clamp(current).y + dy }));
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(1, current - event.deltaY * 0.002)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset((current) => clamp({ x: clamp(current).x + move.x, y: clamp(current).y + move.y }));
  }

  async function apply() {
    if (!image) return;
    setIsSaving(true);
    try {
      const crop = cropFromView({
        image: { width: image.naturalWidth, height: image.naturalHeight },
        rotation,
        frame,
        scale,
        offset: shown,
      });
      onApply(await renderCrop(image, rotation, crop, name));
      onOpenChange(false);
      reset();
    } catch {
      setError("The photo couldn't be saved. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent layout="sheet" className="gap-5 md:max-w-xl">
        <DialogTitle>Edit photo</DialogTitle>
        <DialogDescription>Drag to move it, zoom in, rotate, or choose a shape.</DialogDescription>

        {error ? (
          <p className="text-body text-destructive">{error}</p>
        ) : (
          <div className="flex justify-center rounded-md bg-inverse p-3">
            <div
              ref={frameRef}
              role="img"
              aria-label="Photo crop. Use the arrow keys to move the photo."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
              className="relative max-h-[min(50svh,26rem)] w-full cursor-grab touch-none overflow-hidden rounded-xs active:cursor-grabbing"
              style={{ aspectRatio: String(ratio), maxWidth: `calc(min(50svh, 26rem) * ${ratio})` }}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- the photo being edited, transformed live
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  crossOrigin={image.crossOrigin === "anonymous" ? "anonymous" : undefined}
                  className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
                  style={{
                    width: image.naturalWidth * scale,
                    height: image.naturalHeight * scale,
                    transform: `translate(-50%, -50%) translate(${shown.x}px, ${shown.y}px) rotate(${rotation}deg)`,
                  }}
                />
              ) : null}
              {/* Rule-of-thirds guide, to help place the make. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
              >
                {Array.from({ length: 9 }, (_, index) => (
                  <span key={index} className="border border-inverse-foreground/25" />
                ))}
              </div>
            </div>
          </div>
        )}

        <div role="radiogroup" aria-label="Shape" className="flex flex-wrap gap-2">
          {SHAPES.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={shape === option.key}
              onClick={() => {
                setShape(option.key);
                setOffset({ x: 0, y: 0 });
              }}
              className={cn(
                "h-9 rounded-full border px-3.5 text-control-sm transition",
                shape === option.key
                  ? "border-transparent bg-inverse font-bold text-inverse-foreground"
                  : "border-border bg-field text-foreground hover:border-link",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <Minus aria-hidden className="size-4.5" />
          </button>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-2 min-w-0 flex-1 accent-primary"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 0.25))}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <Plus aria-hidden className="size-4.5" />
          </button>
          <span aria-hidden className="mx-1 h-6 w-px bg-border" />
          <button
            type="button"
            aria-label="Rotate left"
            onClick={() => setRotation((current) => ((current + 270) % 360) as Rotation)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <RotateCcw aria-hidden className="size-4.5" />
          </button>
          <button
            type="button"
            aria-label="Rotate right"
            onClick={() => setRotation((current) => ((current + 90) % 360) as Rotation)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <RotateCw aria-hidden className="size-4.5" />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
          <Button variant="text" onClick={reset}>
            Start over
          </Button>
          <Button size="lg" onClick={() => void apply()} disabled={!image || isSaving}>
            {isSaving ? "Saving…" : "Use this photo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
