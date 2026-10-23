import { onCleanup } from "solid-js";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useState } from "@revolt/state";

import { type SoundboardPlayEvent, soundUrl } from "../soundboard";
import { useVoice } from "../state";

/**
 * Plays soundboard sounds triggered in the call we're in (mounted for the duration of a call)
 */
export function SoundboardPlayer() {
  const client = useClient();
  const voice = useVoice();
  const state = useState();
  const instance = useInstance();

  function onEvent(event: { type: string }) {
    if (event.type !== "SoundboardPlay") return;
    const play = event as SoundboardPlayEvent;
    if (
      play.channel !== voice.channel()?.id ||
      voice.deafen() ||
      state.voice.getUserMuted(play.user)
    )
      return;

    const audio = new Audio(soundUrl(instance.mediaUrl, play.sound));
    // <audio> can't boost past 1.0, unlike call audio
    audio.volume = Math.min(1, (play.volume / 100) * state.voice.outputVolume);
    const sink = state.voice.preferredAudioOutputDevice;
    if (sink) audio.setSinkId(sink).catch(() => {});
    audio.play().catch(() => {});
  }

  const events = client().events;
  events.on("event", onEvent);
  onCleanup(() => events.off("event", onEvent));

  return null;
}
