import { createResource, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useVoice } from "@revolt/rtc";
import { type ScreenShareCodec, recommendCodec } from "@revolt/rtc/codecPick";
import {
  benchmarkEncoder,
  CODEC_NAMES,
  probeEncoders,
  screenSize,
} from "@revolt/rtc/encoders";
import { useState } from "@revolt/state";
import { ScreenShareQualityName } from "@revolt/state/stores/Voice";
import {
  CategoryButton,
  CategorySelectOption,
  Checkbox,
  Column,
  Text,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

export function ScreenShareOptions() {
  const { voice } = useState();
  const voiceContext = useVoice();

  const qualities = voiceContext.getEnabledScreenShareQualities();

  // untested devices still learn which codecs exist and which are GPU-backed
  const [probed] = createResource(() => {
    const { width, height } = screenSize();
    return probeEncoders(width, height);
  });
  const encoders = () => voice.screenShareEncoders?.encoders ?? probed() ?? [];

  const [testing, setTesting] = createSignal<string>();

  async function testEncoders() {
    if (testing()) return;
    const { width, height } = screenSize();
    setTesting("…");
    const found = await probeEncoders(width, height);
    for (const encoder of found.filter((e) => e.supported)) {
      setTesting(CODEC_NAMES[encoder.codec]);
      encoder.fps = await benchmarkEncoder(encoder.codec, width, height);
    }
    voice.screenShareEncoders = {
      width,
      height,
      at: Date.now(),
      encoders: found,
    };
    setTesting(undefined);
  }

  const codecOptions = () => {
    const tested = voice.screenShareEncoders;
    // details go in the titles, which are what the open list shows
    const auto = `Auto (uses ${CODEC_NAMES[recommendCodec(encoders())]})`;
    const options: Record<string, CategorySelectOption> = {
      auto: { title: auto, shortDesc: auto },
    };
    for (const e of encoders().filter((e) => e.supported)) {
      const speed =
        e.fps !== undefined && tested
          ? ` · ${e.fps} fps at ${tested.width}×${tested.height}`
          : "";
      const label = `${CODEC_NAMES[e.codec]} · ${e.gpu ? "GPU" : "CPU"}${speed}`;
      options[e.codec] = { title: label, shortDesc: label };
    }
    return options as {
      [key in ScreenShareCodec | "auto"]: CategorySelectOption;
    };
  };

  return (
    <Column>
      <Text class="title">
        <Trans>Screen Share Settings</Trans>
      </Text>
      <CategoryButton.Group>
        <CategoryButton.Select
          icon={<Symbol>screen_share</Symbol>}
          title={<Trans>Select screen share quality</Trans>}
          options={
            Object.fromEntries(
              Object.keys(qualities).map((name) => [
                name,
                {
                  title: qualities[name as ScreenShareQualityName]!.fullName,
                },
              ]),
            ) as { [key in ScreenShareQualityName]: CategorySelectOption }
          }
          value={voice.screenShareQuality}
          onUpdate={(ns) => (voice.screenShareQuality = ns)}
        />
        <CategoryButton
          icon="blank"
          action={<Checkbox checked={voice.screenShareQualityAsk} />}
          onClick={() =>
            (voice.screenShareQualityAsk = !voice.screenShareQualityAsk)
          }
        >
          <Trans>Always Ask for Screen Share Quality</Trans>
        </CategoryButton>
        <CategoryButton.Select
          icon={<Symbol>memory</Symbol>}
          title={<Trans>Encoder</Trans>}
          options={codecOptions()}
          value={voice.screenShareCodec}
          onUpdate={(codec) => (voice.screenShareCodec = codec)}
        />
        <CategoryButton
          icon={<Symbol>speed</Symbol>}
          disabled={!!testing()}
          onClick={testEncoders}
          description={
            testing()
              ? `Testing ${testing()}, about 3 seconds per encoder…`
              : voice.screenShareEncoders
                ? `Last tested ${new Date(voice.screenShareEncoders.at).toLocaleString()}`
                : "Measures each encoder at your screen's resolution and 60 FPS"
          }
        >
          <Trans>Test my encoders</Trans>
        </CategoryButton>
      </CategoryButton.Group>
    </Column>
  );
}
