// Photo editing in the browser (P2-02, PO request 2026-10-29): crop, zoom, rotate and resize with a
// canvas, so makers fix a photo right in the Create flow instead of being turned away. Output is a
// JPEG no larger than MAX_OUTPUT_SIDE on its long side.

export const MAX_OUTPUT_SIDE = 2400;
const JPEG_QUALITY = 0.9;

export type Rotation = 0 | 90 | 180 | 270;

/** Loads an image; remote (Cloudinary) images are fetched with CORS so the canvas can export. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo couldn't be opened."));
    image.src = src;
  });
}

/** Width and height once rotated. */
export function rotatedSize(width: number, height: number, rotation: Rotation) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * The part of the (rotated) image to keep: its centre and size in image pixels. The editor shows a
 * frame of `frame` CSS pixels over the image scaled by `scale` and moved by `offset`.
 */
export function cropFromView(options: {
  image: { width: number; height: number };
  rotation: Rotation;
  frame: { width: number; height: number };
  scale: number;
  offset: { x: number; y: number };
}) {
  const { width, height } = rotatedSize(
    options.image.width,
    options.image.height,
    options.rotation,
  );
  return {
    centerX: width / 2 - options.offset.x / options.scale,
    centerY: height / 2 - options.offset.y / options.scale,
    width: options.frame.width / options.scale,
    height: options.frame.height / options.scale,
  };
}

/** Draws the crop of the rotated image into a JPEG file, scaled down to MAX_OUTPUT_SIDE. */
export async function renderCrop(
  image: HTMLImageElement,
  rotation: Rotation,
  crop: { centerX: number; centerY: number; width: number; height: number },
  name: string,
): Promise<File> {
  const outScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * outScale));
  canvas.height = Math.max(1, Math.round(crop.height * outScale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't edit photos.");

  const rotated = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  context.imageSmoothingQuality = "high";
  context.scale(outScale, outScale);
  // Move the crop's top-left corner to the canvas origin, then draw the image rotated about its
  // own centre in the rotated image's space.
  context.translate(-(crop.centerX - crop.width / 2), -(crop.centerY - crop.height / 2));
  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
    image.naturalWidth,
    image.naturalHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("The photo couldn't be saved.");
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** A whole photo scaled down to MAX_OUTPUT_SIDE (big phone photos over the 10 MB upload limit). */
export async function shrinkImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return await renderCrop(
      image,
      0,
      {
        centerX: image.naturalWidth / 2,
        centerY: image.naturalHeight / 2,
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
      file.name,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
