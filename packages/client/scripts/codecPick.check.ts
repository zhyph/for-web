// Self-check for the screen share codec recommendation. Run: node scripts/codecPick.check.ts
import {
  type EncoderInfo,
  recommendCodec,
} from "../components/rtc/codecPick.ts";

function expect(name: string, got: string, want: string) {
  if (got !== want) throw new Error(`${name}: got ${got}, want ${want}`);
  console.log(`ok  ${name}`);
}

const cpu = (codec: EncoderInfo["codec"], fps?: number): EncoderInfo => ({
  codec,
  supported: true,
  gpu: false,
  fps,
});

// Linux + NVIDIA as measured 2026-10-23: no GPU encoders, H.264 fastest but below 60
expect(
  "no GPU, nothing smooth: fastest wins",
  recommendCodec([
    cpu("av1", 12),
    cpu("vp9", 25),
    cpu("h264", 38),
    cpu("vp8", 20),
  ]),
  "h264",
);
expect(
  "no GPU, several smooth: most efficient smooth wins",
  recommendCodec([
    cpu("av1", 40),
    cpu("vp9", 59),
    cpu("h264", 90),
    cpu("vp8", 70),
  ]),
  "vp9",
);
expect(
  "GPU beats faster CPU codecs",
  recommendCodec([
    cpu("vp9", 120),
    { codec: "h264", supported: true, gpu: true },
  ]),
  "h264",
);
expect(
  "most efficient GPU codec wins",
  recommendCodec([
    { codec: "h264", supported: true, gpu: true },
    { codec: "av1", supported: true, gpu: true },
  ]),
  "av1",
);
expect(
  "unsupported codecs are ignored",
  recommendCodec([
    { codec: "av1", supported: false, gpu: true, fps: 200 },
    cpu("vp8", 30),
  ]),
  "vp8",
);
expect("no information: H.264", recommendCodec([]), "h264");
