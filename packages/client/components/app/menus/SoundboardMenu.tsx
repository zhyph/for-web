import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useVoice } from "@revolt/rtc";
import { cachedSounds, playSound, refreshSounds } from "@revolt/rtc/soundboard";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "./ContextMenu";

/** Custom emoji are stored by id; only unicode emoji are shown inline */
const isUnicode = (emoji?: string) =>
  !!emoji && !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(emoji);

/**
 * Soundboard picker for the call controls: sounds from every server we're in
 */
export function SoundboardMenu() {
  const client = useClient();
  const voice = useVoice();

  const servers = () => client().servers.toList();
  void refreshSounds(
    client(),
    servers().map((server) => server.id),
  );

  const groups = () =>
    servers()
      .map((server) => ({ server, sounds: cachedSounds()[server.id] ?? [] }))
      .filter((group) => group.sounds.length);

  function play(soundId: string) {
    const channel = voice.channel();
    if (channel) playSound(client(), channel.id, soundId).catch(() => {});
  }

  return (
    <Menu>
      <Show
        when={groups().length}
        fallback={
          <ContextMenuButton symbol={<Symbol>info</Symbol>}>
            <Trans>
              No sounds yet: add some in Server Settings › Soundboard
            </Trans>
          </ContextMenuButton>
        }
      >
        <For each={groups()}>
          {(group, index) => (
            <>
              <Show when={index() > 0}>
                <ContextMenuDivider />
              </Show>
              <Heading>{group.server.name}</Heading>
              <For each={group.sounds}>
                {(sound) => (
                  <ContextMenuButton
                    symbol={<Symbol>volume_up</Symbol>}
                    onClick={() => play(sound._id)}
                  >
                    {isUnicode(sound.emoji)
                      ? `${sound.emoji} ${sound.name}`
                      : sound.name}
                  </ContextMenuButton>
                )}
              </For>
            </>
          )}
        </For>
      </Show>
    </Menu>
  );
}

const Menu = styled(ContextMenu, {
  base: {
    maxHeight: "min(420px, 60vh)",
    overflowY: "auto",
  },
});

const Heading = styled("div", {
  base: {
    padding: "var(--gap-sm) var(--gap-lg)",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
