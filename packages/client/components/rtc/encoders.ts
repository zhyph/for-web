import {
  type EncoderInfo,
  type ScreenShareCodec,
  SCREEN_SHARE_CODECS,
} from "./codecPick";

const MIME: Record<ScreenShareCodec, string> = {
  av1: "video/AV1",
  vp9: "video/VP9",
  h264: "video/H264",
  vp8: "video/VP8",
};

/**
 * WebCodecs codec strings, at levels that allow 4K at 60 FPS
 */
const WEBCODECS: Record<ScreenShareCodec, string> = {
  av1: "av01.0.13M.08",
  vp9: "vp09.00.51.08",
  h264: "avc1.640034",
  vp8: "vp8",
};

export const CODEC_NAMES: Record<ScreenShareCodec, string> = {
  av1: "AV1",
  vp9: "VP9",
  h264: "H.264",
  vp8: "VP8",
};

/**
 * Native pixel size of the screen this window is on (screen shares capture at this size)
 */
export function screenSize() {
  const even = (n: number) => Math.round(n / 2) * 2;
  return {
    width: even(window.screen.width * window.devicePixelRatio),
    height: even(window.screen.height * window.devicePixelRatio),
  };
}

/**
 * Which codecs this browser can encode for calls, and whether each is hardware-backed
 */
export async function probeEncoders(
  width: number,
  height: number,
): Promise<EncoderInfo[]> {
  const mimes = (RTCRtpSender.getCapabilities("video")?.codecs ?? []).map((c) =>
    c.mimeType.toLowerCase(),
  );

  return Promise.all(
    SCREEN_SHARE_CODECS.map(async (codec) => {
      const supported = mimes.includes(MIME[codec].toLowerCase());
      let gpu = false;
      if (supported) {
        try {
          const info = await navigator.mediaCapabilities.encodingInfo({
            type: "webrtc",
            video: {
              contentType: MIME[codec],
              width,
              height,
              bitrate: 20_000_000,
              framerate: 60,
            },
          });
          gpu = info.supported && info.powerEfficient;
        } catch {
          // query not supported for this codec: treat as a CPU encoder
        }
      }
      return { codec, supported, gpu };
    }),
  );
}

/**
 * Frames with blocky random detail that changes completely every frame: a worst case for encoders,
 * like confetti or fast camera pans in games
 */
function testFrames(width: number, height: number, count: number) {
  const blocksX = Math.ceil(width / 8);
  const chromaWidth = width / 2;
  const chromaHeight = height / 2;
  const frames: Uint8Array[] = [];

  for (let k = 0; k < count; k++) {
    // a fresh random value per 8x8 luma block (and 4x4 chroma block) every frame
    const blocks = new Uint8Array(blocksX * Math.ceil(height / 8));
    // getRandomValues fills at most 65536 bytes per call
    for (let i = 0; i < blocks.length; i += 65536) {
      crypto.getRandomValues(blocks.subarray(i, i + 65536));
    }

    const frame = new Uint8Array(width * height * 1.5);
    for (let y = 0; y < height; y++) {
      const row = (y >> 3) * blocksX;
      for (let x = 0; x < width; x++) {
        // plus fine texture inside each block
        frame[y * width + x] = blocks[row + (x >> 3)] ^ ((x ^ y) & 15);
      }
    }
    for (let plane = 0; plane < 2; plane++) {
      const offset = width * height + plane * chromaWidth * chromaHeight;
      for (let y = 0; y < chromaHeight; y++) {
        const row = (y >> 2) * blocksX;
        for (let x = 0; x < chromaWidth; x++) {
          frame[offset + y * chromaWidth + x] =
            blocks[row + (x >> 2)] ^ (plane * 85);
        }
      }
    }
    frames.push(frame);
  }

  return frames;
}

/**
 * Encode test frames as fast as the encoder allows for `seconds` and return the frames per second reached,
 * or undefined if this configuration can't be encoded
 */
export async function benchmarkEncoder(
  codec: ScreenShareCodec,
  width: number,
  height: number,
  seconds = 3,
): Promise<number | undefined> {
  const config: VideoEncoderConfig = {
    codec: WEBCODECS[codec],
    width,
    height,
    bitrate: 20_000_000,
    framerate: 60,
    latencyMode: "realtime",
    ...(codec === "h264" ? { avc: { format: "annexb" } } : {}),
  };

  const support = await VideoEncoder.isConfigSupported(config).catch(
    () => undefined,
  );
  if (!support?.supported) return undefined;

  const frames = testFrames(width, height, 6);
  let encoded = 0;
  let failed = false;
  const encoder = new VideoEncoder({
    output: () => encoded++,
    error: () => (failed = true),
  });
  encoder.configure(config);

  const start = performance.now();
  let n = 0;
  while (!failed && performance.now() - start < seconds * 1000) {
    // keep a short queue so we measure encoding speed, not queueing
    if (encoder.encodeQueueSize > 2) {
      await new Promise((r) => setTimeout(r, 1));
      continue;
    }
    const frame = new VideoFrame(frames[n % frames.length], {
      format: "I420",
      codedWidth: width,
      codedHeight: height,
      timestamp: Math.round((n * 1_000_000) / 60),
    });
    encoder.encode(frame, { keyFrame: n % 600 === 0 });
    frame.close();
    n++;
  }

  if (!failed) await encoder.flush().catch(() => (failed = true));
  const elapsed = (performance.now() - start) / 1000;
  if (encoder.state !== "closed") encoder.close();

  return failed ? undefined : Math.round(encoded / elapsed);
}
