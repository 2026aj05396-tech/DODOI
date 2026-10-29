import { describe, expect, it } from "vitest";

import { cropFromView, rotatedSize } from "./image-edit";

// The photo editor's maths (P2-02): which part of the image a view keeps.

describe("rotatedSize", () => {
  it("swaps width and height on quarter turns", () => {
    expect(rotatedSize(1600, 1200, 0)).toEqual({ width: 1600, height: 1200 });
    expect(rotatedSize(1600, 1200, 90)).toEqual({ width: 1200, height: 1600 });
    expect(rotatedSize(1600, 1200, 180)).toEqual({ width: 1600, height: 1200 });
    expect(rotatedSize(1600, 1200, 270)).toEqual({ width: 1200, height: 1600 });
  });
});

describe("cropFromView", () => {
  const image = { width: 1600, height: 1200 };

  it("keeps the whole photo when the frame shows all of it", () => {
    // A 400×300 frame over a 1600×1200 photo scaled to a quarter.
    expect(
      cropFromView({
        image,
        rotation: 0,
        frame: { width: 400, height: 300 },
        scale: 0.25,
        offset: { x: 0, y: 0 },
      }),
    ).toEqual({ centerX: 800, centerY: 600, width: 1600, height: 1200 });
  });

  it("keeps a centred square when zoomed into a square frame", () => {
    // Square 300×300 frame, photo scaled so its height fills it (0.25), zoomed 2×.
    expect(
      cropFromView({
        image,
        rotation: 0,
        frame: { width: 300, height: 300 },
        scale: 0.5,
        offset: { x: 0, y: 0 },
      }),
    ).toEqual({ centerX: 800, centerY: 600, width: 600, height: 600 });
  });

  it("follows the drag: moving the photo right keeps more of its left side", () => {
    const crop = cropFromView({
      image,
      rotation: 0,
      frame: { width: 300, height: 300 },
      scale: 0.5,
      offset: { x: 100, y: -50 },
    });
    expect(crop.centerX).toBe(600);
    expect(crop.centerY).toBe(700);
  });

  it("works in the rotated photo's space", () => {
    expect(
      cropFromView({
        image,
        rotation: 90,
        frame: { width: 300, height: 400 },
        scale: 0.25,
        offset: { x: 0, y: 0 },
      }),
    ).toEqual({ centerX: 600, centerY: 800, width: 1200, height: 1600 });
  });
});
