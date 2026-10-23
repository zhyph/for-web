import { createResource, createSignal, For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "stoat.js";
import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  type SoundboardSound,
  audioDuration,
  createSound,
  deleteSound,
  editSound,
  listSounds,
  MAX_SOUND_SECONDS,
  soundUrl,
} from "@revolt/rtc/soundboard";
import {
  Button,
  CategoryButton,
  CircularProgress,
  Column,
  IconButton,
  Row,
  Text,
  TextField,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Manage a server's soundboard sounds
 */
export function SoundboardList(props: { server: Server }) {
  const err = useError();
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();

  // our fork's limits aren't in the SDK's types
  const maxSounds = () =>
    (instance.globalLimits as unknown as Record<string, number>)
      .server_sounds ?? 48;
  const maxBytes = () =>
    (
      instance.limits().file_upload_size_limits as unknown as Record<
        string,
        number
      >
    ).sounds ?? 1_000_000;

  const [sounds, { mutate }] = createResource(
    () => props.server.id,
    (id) => listSounds(client(), id),
  );

  const [file, setFile] = createSignal<File>();
  const [name, setName] = createSignal("");
  const [emoji, setEmoji] = createSignal("");
  const [volume, setVolume] = createSignal(100);
  const [error, setError] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);
  let fileInput!: HTMLInputElement;

  async function pickFile(picked?: File) {
    setError(undefined);
    setFile(undefined);
    if (!picked) return;
    if (picked.size > maxBytes())
      return setError(
        t`That file is larger than ${Math.round(maxBytes() / 1000)} KB.`,
      );
    const seconds = await audioDuration(picked).catch(() => NaN);
    if (!(seconds <= MAX_SOUND_SECONDS))
      return setError(
        Number.isNaN(seconds)
          ? t`That file isn't audio this browser can play.`
          : t`Sounds can be at most ${MAX_SOUND_SECONDS} seconds long.`,
      );
    setFile(picked);
    if (!name()) setName(picked.name.replace(/\.[^.]+$/, "").slice(0, 32));
  }

  async function create() {
    const picked = file();
    if (!picked || !name().trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const sound = await createSound(
        client(),
        instance.mediaUrl,
        props.server.id,
        picked,
        {
          name: name().trim(),
          volume: volume(),
          emoji: emoji().trim() || undefined,
        },
      );
      mutate((list) => [...(list ?? []), sound]);
      setFile(undefined);
      setName("");
      setEmoji("");
      setVolume(100);
      fileInput.value = "";
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  function preview(sound: SoundboardSound) {
    const audio = new Audio(soundUrl(instance.mediaUrl, sound._id));
    audio.volume = sound.volume / 100;
    audio.play().catch(() => {});
  }

  async function setSoundVolume(sound: SoundboardSound, value: number) {
    const updated = await editSound(client(), sound, { volume: value }).catch(
      (e) => void setError(e),
    );
    if (updated)
      mutate((list) => list?.map((s) => (s._id === sound._id ? updated : s)));
  }

  async function remove(sound: SoundboardSound) {
    await deleteSound(client(), sound)
      .then(() => mutate((list) => list?.filter((s) => s._id !== sound._id)))
      .catch((e) => setError(e));
  }

  const full = () => (sounds()?.length ?? 0) >= maxSounds();

  return (
    <Column gap="lg">
      <Column>
        <Row align>
          <Button
            variant="tonal"
            isDisabled={full() || busy()}
            onPress={() => fileInput.click()}
          >
            <Symbol>upload_file</Symbol>
            <Show when={file()} fallback={<Trans>Choose audio file</Trans>}>
              {file()!.name}
            </Show>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => pickFile(e.currentTarget.files?.[0])}
          />
        </Row>
        <Row align>
          <TextField
            label={t`Sound Name`}
            value={name()}
            maxlength={32}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <TextField
            label={t`Emoji (optional)`}
            value={emoji()}
            maxlength={16}
            onInput={(e) => setEmoji(e.currentTarget.value)}
          />
        </Row>
        <Row align>
          <Text class="label">
            <Trans>Volume</Trans>
          </Text>
          <input
            type="range"
            min="0"
            max="100"
            value={volume()}
            onInput={(e) => setVolume(Number(e.currentTarget.value))}
          />
          <Text class="label">{volume()}%</Text>
        </Row>
        <Row align>
          <Button
            isDisabled={!file() || !name().trim() || busy() || full()}
            onPress={create}
          >
            <Trans>Add sound</Trans>
          </Button>
          <Show when={busy()}>
            <CircularProgress />
          </Show>
          <Show
            when={error()}
            fallback={
              <Text class="label">
                <Trans>
                  {maxSounds() - (sounds()?.length ?? 0)} sound slots remaining
                </Trans>
              </Text>
            }
          >
            <Text class="label">
              {typeof error() === "string"
                ? (error() as string)
                : err(error() as Parameters<typeof err>[0])}
            </Text>
          </Show>
        </Row>
      </Column>

      <Column gap="sm">
        <For each={sounds()}>
          {(sound) => (
            <CategoryButton
              icon={<Symbol>volume_up</Symbol>}
              onClick={() => preview(sound)}
              description={t`Volume ${sound.volume}% · click to preview`}
              action={
                <Row align>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sound.volume}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setSoundVolume(sound, Number(e.currentTarget.value))
                    }
                  />
                  <IconButton
                    variant="standard"
                    onPress={() => remove(sound)}
                    use:floating={{
                      tooltip: { placement: "top", content: t`Delete sound` },
                    }}
                  >
                    <Symbol>delete</Symbol>
                  </IconButton>
                </Row>
              }
            >
              <span class={css({ flex: 1 })}>
                {sound.emoji ? `${sound.emoji} ` : ""}
                {sound.name}
              </span>
            </CategoryButton>
          )}
        </For>
      </Column>
    </Column>
  );
}
