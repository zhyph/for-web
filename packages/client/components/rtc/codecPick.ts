/**
 * Video codecs offered for screen sharing, most efficient (best quality per bit) first
 */
export const SCREEN_SHARE_CODECS = ["av1", "vp9", "h264", "vp8"] as const;

export type ScreenShareCodec = (typeof SCREEN_SHARE_CODECS)[number];

/**
 * What this machine can do with one codec
 */
export type EncoderInfo = {
  codec: ScreenShareCodec;
  /** The browser can encode this codec for calls */
  supported: boolean;
  /** Hardware (GPU) encoder, per mediaCapabilities' powerEfficient */
  gpu: boolean;
  /** Frames per second reached by the encoder benchmark at the screen's resolution */
  fps?: number;
};

/**
 * Pick a screen share codec:
 * 1. the most efficient GPU encoder;
 * 2. else the most efficient CPU encoder that reached the target frame rate in the benchmark;
 * 3. else the fastest benchmarked CPU encoder;
 * 4. else H.264, which most systems encode on the GPU.
 */
export function recommendCodec(
  encoders: EncoderInfo[],
  targetFps = 60,
): ScreenShareCodec {
  const rank = (codec: ScreenShareCodec) => SCREEN_SHARE_CODECS.indexOf(codec);
  const usable = encoders
    .filter((e) => e.supported)
    .sort((a, b) => rank(a.codec) - rank(b.codec));

  const gpu = usable.find((e) => e.gpu);
  if (gpu) return gpu.codec;

  // 5% slack so a codec measured at 58 fps still counts as holding 60
  const smooth = usable.find(
    (e) => e.fps !== undefined && e.fps >= targetFps * 0.95,
  );
  if (smooth) return smooth.codec;

  const fastest = usable
    .filter((e) => e.fps !== undefined)
    .sort((a, b) => b.fps! - a.fps!)[0];
  if (fastest) return fastest.codec;

  return "h264";
}
