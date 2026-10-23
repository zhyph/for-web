import { createEffect, onCleanup } from "solid-js";

import { useClient } from ".";
import { attachCosmetics, onCosmeticsUpdate } from "./cosmetics";

/**
 * Hands the client to the cosmetics cache and follows CosmeticsUpdate events. Mounted once while logged in.
 */
export function CosmeticsSync() {
  const client = useClient();

  createEffect(() => {
    const current = client();
    attachCosmetics(current);

    const onEvent = (event: { type: string }) => {
      if (event.type === "CosmeticsUpdate") {
        const { kind, id } = event as unknown as { kind: string; id: string };
        onCosmeticsUpdate(kind, id);
      }
    };
    current.events.on("event", onEvent);
    onCleanup(() => current.events.off("event", onEvent));
  });

  return null;
}
