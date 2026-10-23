import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { cachedSounds, refreshSounds } from "@revolt/rtc/soundboard";
import { useState } from "@revolt/state";
import { CategoryButton, CategorySelectOption, Column, Text } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Pick a soundboard sound that plays for everyone when we join a call
 */
export function EntranceSoundOptions() {
  const { voice } = useState();
  const client = useClient();

  const servers = () => client().servers.toList();
  void refreshSounds(
    client(),
    servers().map((server) => server.id),
  );

  const options = () => {
    const list: Record<string, CategorySelectOption> = {
      none: { title: <Trans>None</Trans> },
    };
    for (const server of servers()) {
      for (const sound of cachedSounds()[server.id] ?? []) {
        list[sound._id] = { title: `${sound.name} · ${server.name}` };
      }
    }
    return list;
  };

  return (
    <Column>
      <Text class="title">
        <Trans>Entrance Sound</Trans>
      </Text>
      <CategoryButton.Group>
        <CategoryButton.Select
          icon={<Symbol>campaign</Symbol>}
          title={<Trans>Play when I join a call</Trans>}
          options={options()}
          value={voice.entranceSound ?? "none"}
          onUpdate={(id) =>
            (voice.entranceSound = id === "none" ? undefined : id)
          }
        />
      </CategoryButton.Group>
    </Column>
  );
}
