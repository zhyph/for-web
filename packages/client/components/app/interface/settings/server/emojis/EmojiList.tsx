import { createFormControl, createFormGroup } from "solid-forms";
import { For, Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "stoat.js";
import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import { forkApi } from "@revolt/client/forkApi";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { isSticker, setStickers } from "@revolt/markdown/emoji/stickers";
import { useModals } from "@revolt/modal";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import {
  Avatar,
  Button,
  CircularProgress,
  Column,
  Form2,
  List,
  Row,
  Symbol,
  Text,
} from "@revolt/ui";

/**
 * Emoji list
 */
export function EmojiList(props: { server: Server }) {
  const err = useError();
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const instance = useInstance();

  // stickers are custom emoji with a flag (fork); emoji and stickers have separate slots
  const emojis = () => props.server.emojis.filter((e) => !isSticker(e.id));
  const stickers = () => props.server.emojis.filter((e) => isSticker(e.id));
  const maxStickers = () =>
    (instance.globalLimits as unknown as Record<string, number>)
      .server_stickers ?? 60;
  const remaining = (sticker: boolean) =>
    sticker
      ? maxStickers() - stickers().length
      : instance.globalLimits.server_emoji - emojis().length;

  function isDisabled() {
    return remaining(false) <= 0 && remaining(true) <= 0;
  }

  const editGroup = createFormGroup(
    {
      name: createFormControl("", { required: true }),
      file: createFormControl<string | File[] | null>(null, {
        required: true,
      }),
      sticker: createFormControl(false),
    },
    {
      disabled: isDisabled(),
    },
  );

  async function onSubmit() {
    const body = new FormData();
    body.append("file", editGroup.controls.file.value![0]);

    const [key, value] = client().authenticationHeader;
    const data: { id: string } = await fetch(`${instance.mediaUrl}/emojis`, {
      method: "POST",
      body,
      headers: {
        [key]: value,
      },
    }).then((res) => res.json());

    if (editGroup.controls.sticker.value) {
      // the SDK doesn't know the sticker flag
      await forkApi(client(), "PUT", `/custom/emoji/${data.id}`, {
        name: editGroup.controls.name.value,
        parent: { type: "Server", id: props.server.id },
        sticker: true,
      });
      setStickers([data.id], true);
    } else {
      await props.server.createEmoji(data.id, {
        name: editGroup.controls.name.value,
      });
    }
  }

  function onReset() {
    editGroup.controls.name.setValue("");
    editGroup.controls.file.setValue(null);
    editGroup.controls.sticker.setValue(false);
  }

  const submit = Form2.useSubmitHandler(editGroup, onSubmit, onReset);

  return (
    <Column gap="lg">
      <form onSubmit={submit}>
        <Column>
          <Row align>
            <Column>
              <Form2.FileInput
                control={editGroup.controls.file}
                accept="image/*"
                label={t`Emoji`}
                imageJustify={false}
                allowRemoval={false}
                hideErrors={true}
                maxSize={instance.limits().file_upload_size_limits["emojis"]}
                process={cropProcess({
                  ratio: 1,
                  ratioLabel: t`Square`,
                  openModal,
                  dialogTitle: t`Crop Emoji`,
                })}
              />
            </Column>
            <Column grow>
              <Form2.TextField
                minlength={1}
                maxlength={32}
                counter
                name="name"
                control={editGroup.controls.name}
                label={t`Emoji Name`}
                pattern="[a-z0-9_]{1,32}"
                helper={t`Lowercase letters, numbers and underscores only.`}
                helper-on-focus={true}
                autocomplete="off"
              />

              <Form2.Checkbox control={editGroup.controls.sticker}>
                <Trans>Sticker (shown large when sent on its own)</Trans>
              </Form2.Checkbox>

              <Row align>
                <Form2.Submit group={editGroup}>
                  <Trans>Create</Trans>
                </Form2.Submit>
                <Switch
                  fallback={
                    <Show
                      when={editGroup.controls.sticker.value}
                      fallback={
                        <Trans>{remaining(false)} emoji slots remaining</Trans>
                      }
                    >
                      <Trans>{remaining(true)} sticker slots remaining</Trans>
                    </Show>
                  }
                >
                  <Match when={editGroup.errors?.error}>
                    {err(editGroup.errors!.error)}
                  </Match>
                  <Match when={editGroup.isPending}>
                    <CircularProgress />
                  </Match>
                </Switch>
              </Row>
            </Column>
          </Row>
        </Column>
      </form>

      <List>
        <For each={emojis().toSorted((b, a) => a.id.localeCompare(b.id))}>
          {(emoji) => (
            <List.Item
              onClick={() => openModal({ type: "emoji_preview", emoji })}
            >
              <Row align>
                <Column gap="none">
                  <Row align>
                    <Avatar src={emoji.url} size={32} shape="rounded-square" />
                  </Row>
                </Column>
                <Column gap="none" grow>
                  <span class={css({ flex: 1 })}>:{emoji.name}:</span>
                  <span
                    class={css({
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--gap-sm)",
                    })}
                  >
                    <Avatar
                      size={12}
                      fallback={emoji.creator?.displayName}
                      src={emoji.creator?.animatedAvatarURL}
                    />
                    <Text class="label">{emoji.creator?.displayName}</Text>
                  </span>
                </Column>
                <Column gap="none">
                  <Row>
                    <Button
                      size="icon"
                      variant="text"
                      use:floating={{
                        tooltip: {
                          placement: "bottom",
                          content: t`Edit Emoji`,
                        },
                      }}
                      onPress={() => openModal({ type: "edit_emoji", emoji })}
                    >
                      <Symbol>edit</Symbol>
                    </Button>
                    <Button
                      size="icon"
                      variant="text"
                      use:floating={{
                        tooltip: {
                          placement: "bottom",
                          content: t`Delete Emoji`,
                        },
                      }}
                      onPress={() => openModal({ type: "delete_emoji", emoji })}
                    >
                      <Symbol>delete</Symbol>
                    </Button>
                  </Row>
                </Column>
              </Row>
            </List.Item>
          )}
        </For>
      </List>

      <Show when={stickers().length}>
        <Text class="title">
          <Trans>Stickers</Trans>
        </Text>
        <List>
          <For each={stickers().toSorted((b, a) => a.id.localeCompare(b.id))}>
            {(sticker) => (
              <List.Item
                onClick={() =>
                  openModal({ type: "emoji_preview", emoji: sticker })
                }
              >
                <Row align>
                  <Avatar src={sticker.url} size={48} shape="rounded-square" />
                  <span class={css({ flex: 1 })}>:{sticker.name}:</span>
                </Row>
              </List.Item>
            )}
          </For>
        </List>
      </Show>
    </Column>
  );
}
