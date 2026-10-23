import { createEffect, onCleanup } from "solid-js";

import { setStickers } from "@revolt/markdown/emoji/stickers";

import { useClient } from ".";
import { forkApi } from "./forkApi";

type RawEmoji = { _id: string; sticker?: boolean };

/**
 * Keeps the sticker registry in sync: loads each server's emoji once (the raw API includes the `sticker`
 * flag) and follows emoji create/delete events. Mounted once while logged in.
 */
export function StickerSync() {
  const client = useClient();
  const loaded = new Set<string>();

  createEffect(() => {
    const current = client();
    for (const server of current.servers.toList()) {
      if (loaded.has(server.id)) continue;
      loaded.add(server.id);
      forkApi<RawEmoji[]>(current, "GET", `/servers/${server.id}/emojis`)
        .then((emojis) =>
          setStickers(
            emojis.filter((e) => e.sticker).map((e) => e._id),
            true,
          ),
        )
        .catch(() => loaded.delete(server.id));
    }
  });

  createEffect(() => {
    const events = client().events;
    const onEvent = (event: { type: string }) => {
      if (event.type === "EmojiCreate") {
        const emoji = event as unknown as RawEmoji;
        if (emoji.sticker) setStickers([emoji._id], true);
      } else if (event.type === "EmojiDelete") {
        setStickers([(event as unknown as { id: string }).id], false);
      }
    };
    events.on("event", onEvent);
    onCleanup(() => events.off("event", onEvent));
  });

  return null;
}
