import { createResource, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import type { CameraBackground } from "@revolt/state/stores/Voice";
import { CategoryButton, CategorySelectOption, Column, Text } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Blur or replace what's behind you on camera
 */
export function CameraBackgroundOptions() {
  const { voice } = useState();
  const voiceContext = useVoice();
  // loaded on demand: pulls in MediaPipe
  const [lib] = createResource(() => import("@revolt/rtc/background"));
  let fileInput!: HTMLInputElement;

  async function setMode(mode: CameraBackground) {
    voice.cameraBackground = mode;
    if (mode === "image" && !voice.cameraBackgroundImage) fileInput.click();
    await voiceContext.updateCameraBackground();
  }

  async function pickImage(file: File) {
    voice.cameraBackgroundImage = await lib()!.backgroundImageFromFile(file);
    voice.cameraBackground = "image";
    await voiceContext.updateCameraBackground();
  }

  const options: { [key in CameraBackground]: CategorySelectOption } = {
    none: { title: <Trans>None</Trans> },
    "blur-light": { title: <Trans>Light blur</Trans> },
    "blur-strong": { title: <Trans>Strong blur</Trans> },
    image: { title: <Trans>Custom image</Trans> },
  };

  return (
    <Show when={lib()?.supportsBackgroundProcessors()}>
      <Column>
        <Text class="title">
          <Trans>Camera Background</Trans>
        </Text>
        <CategoryButton.Group>
          <CategoryButton.Select
            icon={<Symbol>background_replace</Symbol>}
            title={<Trans>Background effect</Trans>}
            options={options}
            value={voice.cameraBackground}
            onUpdate={setMode}
          />
          <CategoryButton
            icon={<Symbol>image</Symbol>}
            onClick={() => fileInput.click()}
            description={
              voice.cameraBackgroundImage ? (
                <Trans>Replace the image used by Custom image</Trans>
              ) : (
                <Trans>Pick an image to show behind you</Trans>
              )
            }
          >
            <Trans>Choose background image</Trans>
          </CategoryButton>
        </CategoryButton.Group>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void pickImage(file);
          }}
        />
      </Column>
    </Show>
  );
}
