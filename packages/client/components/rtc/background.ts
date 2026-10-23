import {
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
  BackgroundProcessor,
  supportsBackgroundProcessors,
} from "@livekit/track-processors";
import { LocalVideoTrack } from "livekit-client";

import type { CameraBackground } from "@revolt/state/stores/Voice";

export { supportsBackgroundProcessors };

// served from our origin (see vite.config.ts) instead of jsDelivr / Google Storage
const assetPaths = {
  tasksVisionFileSet: `${import.meta.env.BASE_URL}mediapipe/wasm`,
  modelAssetPath: `${import.meta.env.BASE_URL}mediapipe/selfie_segmenter.tflite`,
};

function processorOptions(
  mode: CameraBackground,
  image?: string,
): SwitchBackgroundProcessorOptions {
  switch (mode) {
    case "blur-light":
      return { mode: "background-blur", blurRadius: 8 };
    case "blur-strong":
      return { mode: "background-blur", blurRadius: 24 };
    case "image":
      return image
        ? { mode: "virtual-background", imagePath: image }
        : { mode: "disabled" };
    default:
      return { mode: "disabled" };
  }
}

/**
 * A processor to start the camera with, so no unprocessed frame is ever sent; undefined for no effect
 */
export function createCameraBackground(mode: CameraBackground, image?: string) {
  const options = processorOptions(mode, image);
  if (options.mode === "disabled" || !supportsBackgroundProcessors()) return;
  return BackgroundProcessor({ ...options, assetPaths });
}

/**
 * Apply, switch or remove the background effect on a local camera track
 */
export async function applyCameraBackground(
  track: LocalVideoTrack,
  mode: CameraBackground,
  image?: string,
) {
  if (!supportsBackgroundProcessors()) return;

  const options = processorOptions(mode, image);
  const current = track.getProcessor() as
    | BackgroundProcessorWrapper
    | undefined;

  if (options.mode === "disabled") {
    if (current) await track.stopProcessor();
  } else if (current) {
    await current.switchTo(options);
  } else {
    await track.setProcessor(BackgroundProcessor({ ...options, assetPaths }));
  }
}

/**
 * Shrink a picked image to at most 1920x1080 and return it as a JPEG data URL
 */
export async function backgroundImageFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / bitmap.width, 1080 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
