import { For, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "stoat.js";
import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import {
  RoleStyle,
  ServerStyle,
  cacheServerStyle,
  fileUrl,
  serverStyle,
} from "@revolt/client/cosmetics";
import { forkApi, uploadFile } from "@revolt/client/forkApi";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { Emoji } from "@revolt/markdown";
import {
  Button,
  CategoryButton,
  Column,
  Row,
  Text,
  TextField,
} from "@revolt/ui";
import { StyledName } from "@revolt/ui/components/features/cosmetics/Cosmetics";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Server cosmetics (fork, see NITRO.md): server tag, vanity invite, invite background and role styles
 */
export function ServerCosmetics(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const err = useError();
  const style = () => serverStyle(props.server.id);
  const canManage = () => props.server.havePermission("ManageServer");
  const canRoles = () => props.server.havePermission("ManageRole");

  const [status, setStatus] = createSignal<unknown>();
  const show = (value: unknown) => setStatus(value);
  const message = () =>
    typeof status() === "string"
      ? (status() as string)
      : err(status() as Parameters<typeof err>[0]);

  async function edit(body: object) {
    setStatus(undefined);
    try {
      const updated = await forkApi<ServerStyle>(
        client(),
        "PATCH",
        `/cosmetics/servers/${props.server.id}`,
        body,
      );
      cacheServerStyle(updated);
      show(t`Saved`);
    } catch (e) {
      show(e);
    }
  }

  // tag
  const [tag, setTag] = createSignal("");
  const [tagEmoji, setTagEmoji] = createSignal("");
  createEffect(
    on(style, (s) => {
      setTag(s?.tag ?? "");
      setTagEmoji(s?.tag_emoji ?? "");
    }),
  );

  // vanity
  const textChannels = () =>
    props.server.channels.filter((c) => c.type === "TextChannel");
  const [vanity, setVanity] = createSignal("");
  const [vanityChannel, setVanityChannel] = createSignal(textChannels()[0]?.id);
  createEffect(on(style, (s) => setVanity(s?.vanity ?? "")));
  async function saveVanity() {
    setStatus(undefined);
    try {
      const updated = await forkApi<ServerStyle>(
        client(),
        "PUT",
        `/cosmetics/servers/${props.server.id}/vanity`,
        { code: vanity().trim().toLowerCase(), channel: vanityChannel() },
      );
      cacheServerStyle(updated);
      show(t`Saved`);
    } catch (e) {
      show(
        (e as { type?: string }).type === "VanityTaken"
          ? t`That invite code is already taken.`
          : e,
      );
    }
  }

  let bgInput!: HTMLInputElement;
  async function uploadBackground(file?: File) {
    if (!file) return;
    try {
      const id = await uploadFile(
        client(),
        instance.mediaUrl,
        "backgrounds",
        file,
      );
      await edit({ invite_background: id });
    } catch (e) {
      show(e);
    }
    bgInput.value = "";
  }

  const colouredRoles = () =>
    props.server.orderedRoles.filter((role) => role.colour);
  function setRoleStyle(roleId: string, value: string) {
    const next = { ...(style()?.role_styles ?? {}) };
    if (value === "none") delete next[roleId];
    else next[roleId] = value as RoleStyle;
    void edit({ role_styles: next });
  }

  const origin = () => window.location.origin;

  return (
    <Column gap="lg">
      <Show when={canManage()}>
        <Column>
          <Text class="title">
            <Trans>Server Tag</Trans>
          </Text>
          <Text class="label">
            <Trans>
              Members can show this next to their name everywhere (Settings →
              Cosmetics). Up to 4 letters or digits.
            </Trans>
          </Text>
          <Row align>
            <TextField
              label={t`Tag`}
              value={tag()}
              maxlength={4}
              onInput={(e) =>
                setTag(
                  e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                )
              }
            />
            <TextField
              label={t`Badge emoji (optional)`}
              value={tagEmoji()}
              maxlength={64}
              onInput={(e) => setTagEmoji(e.currentTarget.value)}
            />
            <Show when={tag()}>
              {/* how it shows next to names */}
              <span class="zc-tag" title={t`Preview`}>
                <Show when={tagEmoji().trim()}>
                  <Emoji emoji={tagEmoji().trim()} />
                </Show>
                {tag()}
              </span>
            </Show>
            <Button
              isDisabled={!tag()}
              onPress={() =>
                edit({
                  tag: tag(),
                  ...(tagEmoji().trim()
                    ? { tag_emoji: tagEmoji().trim() }
                    : {}),
                })
              }
            >
              <Trans>Save tag</Trans>
            </Button>
            <Show when={style()?.tag}>
              <Button variant="text" onPress={() => edit({ remove: ["Tag"] })}>
                <Trans>Remove</Trans>
              </Button>
            </Show>
          </Row>
        </Column>

        <Column>
          <Text class="title">
            <Trans>Custom Invite Link</Trans>
          </Text>
          <CategoryButton.Group>
            <CategoryButton.Select
              icon={<Symbol>tag</Symbol>}
              title={<Trans>Opens in</Trans>}
              options={Object.fromEntries(
                textChannels().map((c) => [c.id, { title: `#${c.name}` }]),
              )}
              value={vanityChannel()!}
              onUpdate={setVanityChannel}
            />
          </CategoryButton.Group>
          <Row align>
            <TextField
              label={t`Invite code`}
              value={vanity()}
              maxlength={32}
              onInput={(e) =>
                setVanity(
                  e.currentTarget.value
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, ""),
                )
              }
            />
            <Button
              isDisabled={vanity().length < 3 || !vanityChannel()}
              onPress={saveVanity}
            >
              <Trans>Save link</Trans>
            </Button>
          </Row>
          <Show when={style()?.vanity}>
            <Text class="label">
              {origin()}/invite/{style()!.vanity}
            </Text>
          </Show>
        </Column>

        <Column>
          <Text class="title">
            <Trans>Invite Background</Trans>
          </Text>
          <Show when={style()?.invite_background}>
            <img
              src={fileUrl(style()!.invite_background)}
              alt=""
              class={css({
                width: "320px",
                aspectRatio: "16/9",
                objectFit: "cover",
                borderRadius: "var(--borderRadius-md)",
              })}
            />
          </Show>
          <Row align>
            <Button variant="tonal" onPress={() => bgInput.click()}>
              <Symbol>image</Symbol>
              <Trans>Upload background</Trans>
            </Button>
            <Show when={style()?.invite_background}>
              <Button
                variant="text"
                onPress={() => edit({ remove: ["InviteBackground"] })}
              >
                <Trans>Remove</Trans>
              </Button>
            </Show>
            <input
              ref={bgInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => uploadBackground(e.currentTarget.files?.[0])}
            />
          </Row>
        </Column>
      </Show>

      <Show when={canRoles()}>
        <Column>
          <Text class="title">
            <Trans>Role Styles</Trans>
          </Text>
          <Text class="label">
            <Trans>Animated styles for coloured roles' names.</Trans>
          </Text>
          <CategoryButton.Group>
            <For each={colouredRoles()}>
              {(role) => (
                <CategoryButton.Select
                  icon={<Symbol>palette</Symbol>}
                  title={
                    <StyledName
                      name={role.name}
                      serverId={props.server.id}
                      roleId={role.id}
                      roleColour={role.colour}
                      noTag
                    />
                  }
                  options={{
                    none: { title: <Trans>Solid</Trans> },
                    GradientAnimated: {
                      title: <Trans>Animated gradient</Trans>,
                    },
                    Holographic: { title: <Trans>Holographic</Trans> },
                  }}
                  value={style()?.role_styles?.[role.id] ?? "none"}
                  onUpdate={(value) => setRoleStyle(role.id, value)}
                />
              )}
            </For>
          </CategoryButton.Group>
          <Show when={!colouredRoles().length}>
            <Text class="label">
              <Trans>Give a role a colour first.</Trans>
            </Text>
          </Show>
        </Column>
      </Show>

      <Show when={status()}>
        <Text class="label">{message()}</Text>
      </Show>
    </Column>
  );
}
