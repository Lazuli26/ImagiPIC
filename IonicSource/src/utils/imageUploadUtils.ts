export interface NormalizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  wasConverted: boolean;
  wasDownscaled: boolean;
}

function isLikelyHEIC(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    (type === "" && name.match(/\.(hei[cf])$/) !== null)
  );
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    /iPad|iPhone|iPod/.test(platform) ||
    (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document)
  );
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  let out = "";
  try {
    out = canvas.toDataURL("image/jpeg", quality);
  } catch (_e1) {
    try {
      out = canvas.toDataURL("image/png");
    } catch (_e2) {
      throw new Error(
        "Your browser could not export the image canvas. Please try a smaller or different photo."
      );
    }
  }
  if (!out || out.length < 32) {
    throw new Error("Canvas export produced empty output. Try a smaller photo.");
  }
  return out;
}

function drawToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Could not acquire a 2D canvas context for image processing.");
  }
  try {
    (ctx as any).imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) {
      (ctx as any).imageSmoothingQuality = "high";
    }
  } catch (_e) {
    /* ignore */
  }
  ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, targetW, targetH);
  return canvas;
}

async function loadImageElement(src: string, timeoutMs = 45000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    (img as any).crossOrigin = "anonymous";
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("Image load timed out. Try a smaller photo."));
    }, timeoutMs);

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (err) {
        reject(err);
      } else if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error("The image has invalid dimensions."));
      } else {
        resolve(img);
      }
    };

    img.onerror = () => {
      finish(new Error("Could not decode the selected image. It may be corrupted or in an unsupported format (e.g., iPhone HEIC that couldn't be converted)."));
    };

    img.onload = () => {
      try {
        if (typeof (img as any).decode === "function") {
          (img as any)
            .decode()
            .then(() => finish())
            .catch(() => finish());
        } else {
          finish();
        }
      } catch (_e) {
        finish();
      }
    };

    try {
      img.decoding = "async";
    } catch (_e) {
      /* ignore */
    }
    img.src = src;
  });
}

export function resetFileInput(input: HTMLInputElement | null): void {
  if (!input) return;
  try {
    input.value = "";
    if ((input as any).files) {
      try {
        (input as any).files = null;
      } catch (_e) {
        /* some browsers disallow direct assignment */
      }
    }
    const form = input.closest("form");
    if (form) form.reset();
  } catch (_e) {
    /* ignore */
  }
}

async function normalizeWithCreateImageBitmap(
  file: File,
  targetW: number,
  targetH: number,
  originalW: number,
  originalH: number
): Promise<HTMLCanvasElement | null> {
  if (typeof (window as any).createImageBitmap !== "function") return null;
  try {
    const options: any = {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: "high",
    };
    if (detectIOS()) {
      try {
        (options as any).premultiplyAlpha = "default";
        (options as any).colorSpaceConversion = "default";
        (options as any).imageOrientation = "from-image";
      } catch (_e) {
        /* ignore */
      }
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await (window as any).createImageBitmap(file, options);
    } catch (_directErr) {
      try {
        bitmap = await (window as any).createImageBitmap(file);
      } catch (_e) {
        return null;
      }
    }
    if (!bitmap || bitmap.width <= 0 || bitmap.height <= 0) return null;
    const bW = bitmap.width;
    const bH = bitmap.height;
    const useW = targetW > 0 && targetW === bW ? bW : targetW;
    const useH = targetH > 0 && targetH === bH ? bH : targetH;
    const canvas = drawToCanvas(bitmap, bW, bH, useW || bW, useH || bH);
    try {
      (bitmap as any).close?.();
    } catch (_e) {
      /* ignore */
    }
    return canvas;
  } catch (_e) {
    return null;
  }
}

export async function normalizeUploadedImage(
  file: File,
  maxTotalPixels = 262144 * 4,
  targetQuality = 0.92
): Promise<NormalizedImageResult> {
  if (!file) throw new Error("No file selected.");
  if (file.size <= 0) throw new Error("The selected file is empty (0 bytes).");

  const heic = isLikelyHEIC(file);
  const ios = detectIOS();

  if (heic && !ios) {
    throw new Error(
      "HEIC/HEIF images (Apple High Efficiency format) are not supported by your browser. " +
      "On iPhone, use JPG, send the photo via Messages first (converts to JPG), or enable " +
      "\"Most Compatible\" in Settings → Camera → Formats."
    );
  }

  let objectUrl: string | null = null;
  let loadedImg: HTMLImageElement | null = null;
  try {
    let originalW = 0;
    let originalH = 0;
    let probeFailed = false;

    objectUrl = URL.createObjectURL(file);
    try {
      loadedImg = await loadImageElement(objectUrl);
      originalW = loadedImg.naturalWidth;
      originalH = loadedImg.naturalHeight;
    } catch (probeErr) {
      probeFailed = true;
    }

    if (probeFailed || originalW <= 0 || originalH <= 0) {
      throw new Error(
        probeFailed
          ? "Your browser could not decode this file. It may be in Apple HEIC format or corrupted. On iPhone, try sharing the photo to yourself via Messages first (converts to JPG)."
          : "The image has invalid dimensions."
      );
    }

    const totalPixels = originalW * originalH;
    const wasDownscaled = totalPixels > maxTotalPixels;
    let targetW = originalW;
    let targetH = originalH;
    if (wasDownscaled) {
      const scale = Math.sqrt(maxTotalPixels / totalPixels);
      targetW = Math.max(1, Math.floor(originalW * scale));
      targetH = Math.max(1, Math.floor(originalH * scale));
    }

    const wasConverted = heic || ios || wasDownscaled;

    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await normalizeWithCreateImageBitmap(file, targetW, targetH, originalW, originalH);
    } catch (_e) {
      canvas = null;
    }

    if (!canvas && loadedImg) {
      try {
        canvas = drawToCanvas(loadedImg, originalW, originalH, targetW, targetH);
      } catch (drawErr) {
        throw new Error(
          drawErr instanceof Error
            ? drawErr.message
            : "Failed to rasterize the image onto the canvas. Try a smaller photo."
        );
      }
    }

    if (!canvas) {
      throw new Error("Could not produce a canvas from the image. Try a different photo.");
    }

    const dataUrl = canvasToJpegDataUrl(canvas, targetQuality);

    if (loadedImg) {
      loadedImg.src = "";
      loadedImg.onload = null;
      loadedImg.onerror = null;
      loadedImg = null;
    }

    if (objectUrl) {
      const urlToRevoke = objectUrl;
      objectUrl = null;
      try {
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 250);
      } catch (_e) {
        /* ignore */
      }
    }

    return {
      dataUrl,
      width: targetW,
      height: targetH,
      wasConverted,
      wasDownscaled,
    };
  } catch (error) {
    if (loadedImg) {
      try {
        loadedImg.src = "";
        loadedImg.onload = null;
        loadedImg.onerror = null;
      } catch (_e) {
        /* ignore */
      }
    }
    if (objectUrl) {
      const urlToRevoke = objectUrl;
      try {
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 250);
      } catch (_e) {
        /* ignore */
      }
    }
    throw error instanceof Error ? error : new Error("Unknown image processing failure.");
  }
}

export function describeNormalization(r: NormalizedImageResult): string | null {
  const parts: string[] = [];
  if (r.wasDownscaled) {
    parts.push(`large photo resized to ${r.width}×${r.height}`);
  }
  if (r.wasConverted && !r.wasDownscaled) {
    parts.push("format normalized for processing");
  }
  return parts.length ? parts.join(", ") : null;
}

export function getAcceptAttrForMobile(): string {
  return "image/jpeg,image/png,image/bmp,image/heic,image/heif,image/*";
}
