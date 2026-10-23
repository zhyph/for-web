import { Show } from "solid-js";

import { useInstance } from "@revolt/instance";
import { Column } from "@revolt/ui";

import { CameraBackgroundOptions } from "./CameraBackgroundOptions";
import { EntranceSoundOptions } from "./EntranceSoundOptions";
import { ScreenShareOptions } from "./ScreenShareOptions";
import { VoiceInputOptions } from "./VoiceInputOptions";
import { VoiceProcessingOptions } from "./VoiceProcessingOptions";

/**
 * Configure voice options
 */
export function VoiceSettings() {
  const { limits } = useInstance();

  return (
    <Column gap="lg">
      <VoiceInputOptions />
      <VoiceProcessingOptions />
      <EntranceSoundOptions />
      <Show when={limits().video}>
        <CameraBackgroundOptions />
        <ScreenShareOptions />
      </Show>
    </Column>
  );
}
