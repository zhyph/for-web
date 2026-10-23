import { createSignal, onCleanup } from "solid-js";

import { LocalTrack, Track } from "livekit-client";

export type SenderStats = {
  codec: string;
  gpu: boolean;
  fps: number;
  mbps: number;
  width: number;
  height: number;
  /** "cpu" or "bandwidth" when the encoder is cutting quality */
  limit?: string;
};

/**
 * Poll a local video track's encoder stats (top layer) every two seconds
 */
export function useSenderStats(track: () => Track | undefined) {
  const [stats, setStats] = createSignal<SenderStats>();
  let lastBytes = 0;
  let lastTime = 0;

  const timer = setInterval(async () => {
    const local = track();
    const sender = local instanceof LocalTrack ? local.sender : undefined;
    if (!sender) return setStats(undefined);

    const report = await sender.getStats();
    let top: RTCOutboundRtpStreamStats | undefined;
    let bytes = 0;
    report.forEach((s) => {
      if (s.type !== "outbound-rtp") return;
      bytes += s.bytesSent ?? 0;
      if (s.frameWidth && (!top || s.frameWidth > (top.frameWidth ?? 0)))
        top = s;
    });
    if (!top) return setStats(undefined);

    const now = performance.now();
    const mbps =
      lastTime && bytes >= lastBytes
        ? ((bytes - lastBytes) * 8) / ((now - lastTime) * 1000)
        : 0;
    lastBytes = bytes;
    lastTime = now;

    const codec = (report.get(top.codecId!)?.mimeType ?? "").replace(
      "video/",
      "",
    );
    const extra = top as RTCOutboundRtpStreamStats & {
      powerEfficientEncoder?: boolean;
      qualityLimitationReason?: string;
    };
    setStats({
      codec: codec === "H264" ? "H.264" : codec,
      gpu: !!extra.powerEfficientEncoder,
      fps: Math.round(top.framesPerSecond ?? 0),
      mbps,
      width: top.frameWidth ?? 0,
      height: top.frameHeight ?? 0,
      limit:
        extra.qualityLimitationReason &&
        extra.qualityLimitationReason !== "none"
          ? extra.qualityLimitationReason
          : undefined,
    });
  }, 2000);

  onCleanup(() => clearInterval(timer));
  return stats;
}
