import { For, Show, useContext } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { isSticker } from "@revolt/markdown/emoji/stickers";
import { useState } from "@revolt/state";

import {
  CompositionMediaPickerContext,
  compositionContent,
} from "./CompositionMediaPicker";

/**
 * Stickers (Nitro parity fork): every server's stickers, sent on their own as soon as they're picked
 */
export function StickerPicker() {
  const client = useClient();
  const { ordering } = useState();
  const { onMessage } = useContext(CompositionMediaPickerContext);

  const groups = () =>
    ordering
      .orderedServers(client())
      .map((server) => ({
        server,
        stickers: server.emojis.filter((emoji) => isSticker(emoji.id)),
      }))
      .filter((group) => group.stickers.length);

  return (
    <List class={compositionContent()}>
      <Show
        when={groups().length}
        fallback={
          <Empty>
            <Trans>
              No stickers yet. Add some in Server Settings → Emojis.
            </Trans>
          </Empty>
        }
      >
        <For each={groups()}>
          {(group) => (
            <>
              <Header>{group.server.name}</Header>
              <Grid>
                <For each={group.stickers}>
                  {(sticker) => (
                    <Tile
                      title={`:${sticker.name}:`}
                      onClick={() => onMessage(`:${sticker.id}:`)}
                    >
                      <img src={sticker.url} alt={sticker.name} />
                    </Tile>
                  )}
                </For>
              </Grid>
            </>
          )}
        </For>
      </Show>
    </List>
  );
}

const List = styled("div", {
  base: {
    overflowY: "auto",
    padding: "0 var(--gap-md)",
  },
});

const Header = styled("div", {
  base: {
    fontSize: "12px",
    fontWeight: 600,
    margin: "var(--gap-md) 0 var(--gap-sm)",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--gap-sm)",
  },
});

const Tile = styled("button", {
  base: {
    aspectRatio: "1/1",
    padding: "var(--gap-sm)",
    border: "none",
    cursor: "pointer",
    borderRadius: "var(--borderRadius-md)",
    background: "transparent",
    "&:hover": {
      background: "var(--md-sys-color-surface-container-highest)",
    },
    "& img": {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    },
  },
});

const Empty = styled("div", {
  base: {
    padding: "var(--gap-lg)",
    textAlign: "center",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
