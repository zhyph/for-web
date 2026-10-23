import { createSignal } from "solid-js";

/**
 * Ids of custom emoji that are stickers (Nitro parity fork, see NITRO.md). The SDK's Emoji objects don't
 * carry the `sticker` flag, so StickerSync fills this from the raw API and events.
 */
const [stickerIds, setStickerIds] = createSignal<ReadonlySet<string>>(
  new Set(),
);

export const isSticker = (id: string) => stickerIds().has(id);

/** Read in render code that must re-run when the sticker set changes */
export const stickerSet = stickerIds;

export function setStickers(ids: Iterable<string>, sticker: boolean) {
  setStickerIds((current) => {
    const next = new Set(current);
    for (const id of ids) {
      if (sticker) next.add(id);
      else next.delete(id);
    }
    return next;
  });
}
