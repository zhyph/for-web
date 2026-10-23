import { createSignal } from "solid-js";

import type { Client } from "stoat.js";

import { forkApi } from "@revolt/client/forkApi";

/**
 * Soundboard sound, as returned by our fork's API (see NITRO.md; not part of the SDK)
 */
export type SoundboardSound = {
  _id: string;
  server_id: string;
  creator_id: string;
  name: string;
  /** Playback volume in percent, 0 to 100 */
  volume: number;
  emoji?: string;
};

export type SoundboardPlayEvent = {
  type: "SoundboardPlay";
  channel: string;
  user: string;
  sound: string;
  volume: number;
};

/** Longest sound we accept, checked client-side before upload */
export const MAX_SOUND_SECONDS = 10;

export const listSounds = (client: Client, serverId: string) =>
  forkApi<SoundboardSound[]>(client, "GET", `/servers/${serverId}/sounds`);

export const editSound = (
  client: Client,
  sound: SoundboardSound,
  data: { name?: string; volume?: number; emoji?: string },
) =>
  forkApi<SoundboardSound>(
    client,
    "PATCH",
    `/servers/${sound.server_id}/sounds/${sound._id}`,
    data,
  );

export const deleteSound = (client: Client, sound: SoundboardSound) =>
  forkApi<void>(
    client,
    "DELETE",
    `/servers/${sound.server_id}/sounds/${sound._id}`,
  );

export const playSound = (client: Client, channelId: string, soundId: string) =>
  forkApi<void>(
    client,
    "POST",
    `/channels/${channelId}/sounds/${soundId}/play`,
  );

/**
 * Upload an audio file to the `sounds` tag, then register it on the server
 */
export async function createSound(
  client: Client,
  mediaUrl: string,
  serverId: string,
  file: File,
  data: { name: string; volume?: number; emoji?: string },
) {
  const body = new FormData();
  body.append("file", file);
  const [key, value] = client.authenticationHeader;
  const res = await fetch(`${mediaUrl}/sounds`, {
    method: "POST",
    body,
    headers: { [key]: value },
  });
  if (!res.ok) throw await res.json();
  const { id } = (await res.json()) as { id: string };

  return forkApi<SoundboardSound>(
    client,
    "POST",
    `/servers/${serverId}/sounds`,
    {
      file_id: id,
      ...data,
    },
  );
}

export const soundUrl = (mediaUrl: string, id: string) =>
  `${mediaUrl}/sounds/${id}`;

/**
 * Length of an audio file in seconds (rejects if the browser can't decode it)
 */
export function audioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable audio"));
    };
    audio.src = url;
  });
}

// Sounds of every server we've looked at, refreshed whenever the soundboard menu opens
const [cache, setCache] = createSignal<Record<string, SoundboardSound[]>>({});
export const cachedSounds = cache;

export async function refreshSounds(client: Client, serverIds: string[]) {
  const lists = await Promise.all(
    serverIds.map((id) => listSounds(client, id).catch(() => [])),
  );
  setCache(Object.fromEntries(serverIds.map((id, i) => [id, lists[i]])));
}
